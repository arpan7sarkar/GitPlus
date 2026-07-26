/**
 * Route: /api/chat
 * Replaces: supabase/functions/chat/index.ts
 *
 * Provider failover chain:
 *   1. Google Gemini 2.0 Flash (primary)
 *   2. OpenAI GPT-4o-mini (fallback)
 *
 * Supported action modes on POST /api/chat:
 *   - "chat" (default): SSE stream with RAG context
 *   - "overview": JSON overview object
 *   - "security": JSON array of 12-point security audit findings
 *   - "onboarding": Markdown onboarding guide
 *   - "system-design": 10-section markdown system design document
 */

import { Router, Request, Response } from "express";
import { retrieveForQuery } from "../lib/retrieval.js";

const router = Router();

interface ProviderConfig {
  name: string;
  url: string;
  model: string;
  getKey: () => string | undefined;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.0-flash",
    getKey: () => process.env.GOOGLE_GEMINI_API_KEY,
  },
  {
    name: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    getKey: () => process.env.OPENAI_API_KEY,
  },
];

const COOLDOWN_MS = 60_000; // 60-second cooldown after 429
const rateLimitState: Record<string, number> = {};

function isProviderAvailable(provider: ProviderConfig): boolean {
  const key = provider.getKey();
  if (!key) return false;
  const blockedUntil = rateLimitState[provider.name] || 0;
  return Date.now() >= blockedUntil;
}

function markRateLimited(providerName: string) {
  rateLimitState[providerName] = Date.now() + COOLDOWN_MS;
  console.log(`[chat rate-limit] ${providerName} blocked for ${COOLDOWN_MS / 1000}s`);
}

function getAvailableProviders(): ProviderConfig[] {
  return PROVIDERS.filter(isProviderAvailable);
}

function buildPrompts(action: string, repoContext: string, messages: any[]) {
  const ctx = repoContext || "No specific repo context provided.";

  if (action === "overview") {
    const systemPrompt = `You are CodebaseGPT, an expert code analyst. Analyze the provided codebase context and return a JSON object with these fields:
{
  "narrative": "A 2-3 sentence plain-English description of the architecture",
  "framework": "Primary framework detected (e.g. Next.js 14, FastAPI, Rails)",
  "complexity": "Low | Medium | High | Enterprise",
  "suggestedQs": ["array of exactly 8 insightful questions about this codebase"],
  "keyFiles": ["top 5 most important files to read first"],
  "keyPatterns": ["3-5 architectural patterns used"],
  "mainDeps": ["top 8 dependencies"],
  "languages": [{"name": "TypeScript", "percentage": 78}]
}
Return ONLY valid JSON, no markdown wrapping.`;
    return {
      systemPrompt,
      userMessages: [{ role: "user", content: `Analyze this codebase:\n\n${ctx}` }],
    };
  }

  if (action === "onboarding") {
    const systemPrompt = `You are CodebaseGPT. Generate a comprehensive onboarding guide in markdown format for a developer joining this project. Include:
# Onboarding Guide

## 🚀 Quick Start
- 3 commands to get running

## 📁 Files to Read First
- Top 5 files with explanations of why they matter

## 🏗️ Architecture Patterns
- Key patterns used and where to find them

## ⚠️ Gotchas & Tips
- 3-5 common pitfalls new developers face

## 🔧 Key Tools & Dependencies
- Important tools and what they do

Make it practical, actionable, and welcoming.`;
    return {
      systemPrompt,
      userMessages: [{ role: "user", content: `Generate an onboarding guide for this codebase:\n\n${ctx}` }],
    };
  }

  if (action === "security") {
    const systemPrompt = `You are CodebaseGPT Security Auditor. You must produce DETERMINISTIC, CONSISTENT results. Analyze the codebase methodically using this exact checklist in this exact order. For each category, check if the issue exists. Only report REAL findings backed by evidence in the code.

CHECKLIST (check in this exact order):
1. SEC-001: Hardcoded secrets or API keys in source code
2. SEC-002: Missing or permissive CORS configuration
3. SEC-003: SQL injection or NoSQL injection risks
4. SEC-004: Cross-site scripting (XSS) vulnerabilities
5. SEC-005: Missing input validation on user-facing endpoints
6. SEC-006: Insecure authentication patterns (e.g., no token validation)
7. SEC-007: Missing rate limiting on public endpoints
8. SEC-008: Sensitive data exposure in client-side code
9. SEC-009: Insecure dependency usage or known vulnerable packages
10. SEC-010: Missing CSRF protection
11. SEC-011: Insecure file upload/handling
12. SEC-012: Missing or weak RLS/authorization policies

For each finding, return this exact JSON shape:
{
  "id": "SEC-XXX (from checklist above)",
  "severity": "critical" | "high" | "medium" | "low" | "info",
  "title": "Short title",
  "description": "1-2 sentence explanation with specific evidence from the code",
  "file": "exact file path or 'General'",
  "line": "line number/range or null",
  "recommendation": "Specific actionable fix"
}

RULES:
- Only report issues you can PROVE from the code context. Do not speculate.
- Use the exact SEC-XXX IDs from the checklist.
- Assign severity consistently: hardcoded secrets = critical, missing auth = high, missing validation = medium, missing rate limiting = low, best practice suggestions = info.
- Return ONLY a valid JSON array, no markdown, no wrapping text.`;
    return {
      systemPrompt,
      userMessages: [{ role: "user", content: `Perform a security audit of this codebase:\n\n${ctx}` }],
    };
  }

  if (action === "system-design") {
    const systemPrompt = `You are CodebaseGPT System Architect. Generate a comprehensive system design document for this codebase. Use markdown format with these sections:

# System Design Document

## 1. System Overview
A high-level description of what this system does.

## 2. Architecture Diagram (Text)
An ASCII-art or text-based architecture diagram showing major components and their relationships. Use boxes and arrows.

## 3. Component Breakdown
For each major component/module: name, responsibility, key files, and interfaces.

## 4. Data Flow
How data moves through the system from user input to storage and back.

## 5. Database Schema
Tables, relationships, and key fields (if applicable).

## 6. API Design
Key API endpoints or function interfaces.

## 7. Technology Stack
All technologies, frameworks, and tools used.

## 8. Scalability & Performance
Current bottlenecks, caching strategies, and scaling recommendations.

## 9. Security Architecture
Auth flow, data protection, and security boundaries.

## 10. Deployment Architecture
How the system is deployed and infrastructure requirements.

Be thorough, technical, and precise. Reference actual files and code patterns from the codebase.`;
    return {
      systemPrompt,
      userMessages: [{ role: "user", content: `Generate a complete system design document for this codebase:\n\n${ctx}` }],
    };
  }

  // Default "chat" mode
  const systemPrompt = `You are CodebaseGPT, an expert software architect and senior developer. Your job is to provide highly structured, in-depth, and deeply technical answers to questions about the ongoing codebase.

RULES for your responses:
1. USE STRUCTURE: Always use Markdown headers (e.g., ### Overview, ### Architecture) to organize your response cleanly.
2. BE IN-DEPTH: Do not give superficial summaries. Dive deep into the code, algorithms, patterns, and data flow.
3. USE BULLET POINTS: Use bulleted and numbered lists extensively to break down complex logic step-by-step.
4. SHOW EXAMPLES: Provide precise code snippets from the codebase to back up your points, maintaining original syntax and language hints.
5. CITE SOURCES: Always cite exact file paths and line numbers naturally (e.g., \`[src/index.ts:15-30]\`) so the developer can follow along. Every code snippet below is already labeled with its file path and line range — use that exact label.
6. BE PROFESSIONAL: Provide rigorous technical documentation and architectural reviews. Forget conversational fluff.
7. ACCURACY IS CRITICAL: The context below is a small set of semantically retrieved chunks for THIS specific question, not the entire codebase. If something relevant clearly isn't in the provided context, say so explicitly rather than guessing or inventing file paths.

RETRIEVED CONTEXT FOR THIS QUESTION:
${ctx}`;

  return {
    systemPrompt,
    userMessages: messages || [],
  };
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { messages = [], repoContext = "", action = "chat", repoId } = req.body;
    const isStreaming = action === "chat";

    // Real per-turn RAG: for conversational chat with a repoId, retrieve chunks
    // relevant to THIS question fresh every turn instead of reusing one static
    // repoContext blob for the whole conversation. Falls back to the frontend-
    // supplied repoContext if there's no repoId or retrieval comes back empty
    // (e.g. repo hasn't been ingested into the search index yet).
    let effectiveContext = repoContext;
    if (action === "chat" && repoId) {
      const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user");
      if (lastUserMessage?.content) {
        try {
          const { chunks, contextText } = await retrieveForQuery(lastUserMessage.content, repoId, { k: 8 });
          if (chunks.length > 0) {
            effectiveContext = contextText;
          }
        } catch (retrievalErr) {
          console.warn("[chat] Retrieval failed, falling back to repoContext:", retrievalErr);
        }
      }
    }

    const { systemPrompt, userMessages } = buildPrompts(action, effectiveContext, messages);

    const requestBodyMessages = [
      { role: "system", content: systemPrompt },
      ...userMessages,
    ];

    const availableProviders = getAvailableProviders();
    if (availableProviders.length === 0) {
      return res.status(429).json({
        error: "All AI providers are currently rate-limited. Please try again in ~60 seconds.",
      });
    }

    for (const provider of availableProviders) {
      const apiKey = provider.getKey()!;
      console.log(`[chat] Trying provider ${provider.name} (${provider.model}) for action: ${action}`);

      try {
        const providerRes = await fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: provider.model,
            messages: requestBodyMessages,
            stream: isStreaming,
          }),
        });

        if (providerRes.status === 429) {
          markRateLimited(provider.name);
          continue;
        }

        if (providerRes.status === 402 || providerRes.status === 403) {
          console.warn(`[chat] ${provider.name} payment/auth error (${providerRes.status}), trying next provider...`);
          continue;
        }

        if (!providerRes.ok) {
          const errText = await providerRes.text().catch(() => "");
          console.error(`[chat] ${provider.name} error ${providerRes.status}:`, errText.slice(0, 300));
          return res.status(500).json({
            error: `AI provider ${provider.name} error (${providerRes.status}): ${errText.slice(0, 200)}`,
          });
        }

        // Non-streaming response for overview, security, onboarding, system-design
        if (!isStreaming) {
          const data = (await providerRes.json()) as any;
          const content = data.choices?.[0]?.message?.content || "";
          return res.json({ content });
        }

        // SSE streaming response for chat
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        if (providerRes.body) {
          const reader = (providerRes.body as any).getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }

        return res.end();
      } catch (fetchErr) {
        console.error(`[chat] Provider ${provider.name} fetch exception:`, fetchErr);
        continue;
      }
    }

    return res.status(429).json({
      error: "All AI providers failed or are rate-limited. Please try again in ~60 seconds.",
    });
  } catch (err: any) {
    console.error("[chat route error]:", err);
    return res.status(500).json({ error: err.message || "Chat service error" });
  }
});

export default router;
