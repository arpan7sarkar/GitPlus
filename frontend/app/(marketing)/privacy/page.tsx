import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "CodebaseGPT Privacy Policy.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-3xl font-bold text-[#111114] mb-2" style={{ fontFamily: "var(--font-display)" }}>Privacy Policy</h1>
      <p className="text-sm text-[#5B5F66] mb-10">Last updated: July 2026</p>
      <div className="prose-gitplus space-y-6">
        <p>CodebaseGPT (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy and is committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information.</p>

        <h2>1. Information We Collect</h2>
        <p>When you use CodebaseGPT, we may collect:</p>
        <ul>
          <li><strong>GitHub profile data</strong> (username, email, avatar) when you sign in via GitHub OAuth.</li>
          <li><strong>Repository metadata</strong> (repo name, owner, stars, language) during indexing.</li>
          <li><strong>Anonymous usage analytics</strong> (page views, feature usage) to improve the product.</li>
        </ul>

        <h2>2. Code Data</h2>
        <p>Source code is processed <strong>in-memory only</strong> during your active session. We do not permanently store your source code on our servers. Code chunks may be temporarily cached in our vector database for semantic search during the session.</p>

        <h2>3. GitHub Tokens</h2>
        <p>Personal Access Tokens (PATs) you provide for private repository access are stored <strong>only in your browser&rsquo;s localStorage</strong>. They are never sent to our servers or any third-party service beyond GitHub&rsquo;s API.</p>

        <h2>4. Chat Sessions</h2>
        <p>Chat conversations may be saved to our database if you have &quot;Auto-save Chat History&quot; enabled in settings. Shared chat sessions are accessible via a unique link to anyone who has it.</p>

        <h2>5. AI Processing</h2>
        <p>We use third-party AI providers (Google Gemini, OpenAI) to process your queries. Code context sent to these providers is subject to their respective privacy policies. We recommend reviewing their data handling practices.</p>

        <h2>6. Contact</h2>
        <p>For any privacy concerns, please open an issue on our GitHub repository or contact us at privacy@codebasegpt.dev.</p>
      </div>
    </div>
  );
}
