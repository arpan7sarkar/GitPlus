# VexReview — AI-Powered PR Reviewer & Summarizer

<p align="center">
  <img src="docs/images/emerald_logo_fixed.png" alt="VexReview Logo" width="200"/>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Part of CodebaseGPT](https://img.shields.io/badge/CodebaseGPT-Ecosystem-6366f1?style=flat&logo=databricks)](https://github.com/devsouvik/codebasegpt)

---

## Overview

**VexReview** is an AI-powered code reviewer and summarizer for GitHub pull requests — built as a core component of the [CodebaseGPT](https://github.com/devsouvik/codebasegpt) ecosystem, powered by **Actan Vector DB** for deep semantic codebase understanding.

It runs as a **GitHub Action**, automatically reviewing every pull request with the intelligence of Gemini 1.5 or OpenAI models — giving your team production-grade code reviews on every merge.

---

## ✨ Features

- **📝 PR Summarization** — Generates a structured summary and release notes for every PR.
- **🔍 Line-by-line Code Review** — Reviews changes hunk by hunk and provides actionable suggestions.
- **🔄 Continuous Incremental Reviews** — Runs on each new commit push, not just once at PR open.
- **⚡ Cost-Efficient** — Uses Gemini's large context window strategically; a "light" model for summaries and a "heavy" model for reviews.
- **💬 Chat with the Bot** — Reply to any review comment or tag `@vexreview` to start a conversation.
- **🤖 Smart Review Skipping** — Automatically skips trivial changes (typo fixes, whitespace) to reduce noise.
- **🎛️ Fully Customizable Prompts** — Override `system_message`, `summarize`, and `summarize_release_notes` prompts.
- **🛡️ Path Filters** — Fine-grained control over which files are reviewed.

---

## 🚀 Quick Start

Add this file to your repository at `.github/workflows/vexreview.yml`:

```yaml
name: VexReview — AI Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
  pull_request_review_comment:
    types: [created]

concurrency:
  group:
    ${{ github.repository }}-${{ github.event.number || github.head_ref ||
    github.sha }}-${{ github.workflow }}-${{ github.event_name ==
    'pull_request_review_comment' && 'pr_comment' || 'pr' }}
  cancel-in-progress: ${{ github.event_name != 'pull_request_review_comment' }}

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: devsouvik/vexreview@latest
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        with:
          debug: false
          review_simple_changes: false
          review_comment_lgtm: false
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | Automatically available in GitHub Actions. Used to post review comments. |
| `GEMINI_API_KEY` | Your Google Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey). Add to your repo secrets. |

---

## 🤖 Models

| Role | Recommended Model |
|---|---|
| Summarization (light) | `gemini-1.5-flash` |
| Code Review (heavy) | `gemini-1.5-pro` |

Configure via `gemini_light_model` and `gemini_heavy_model` inputs in `action.yml`.

---

## 💬 Chatting with VexReview

Reply to any review comment the bot posts, or tag it anywhere in a PR comment:

```
@vexreview Can you suggest a better approach for this algorithm?
```

```
@vexreview Please generate a test plan for this file.
```

### Ignoring a PR

Add the following anywhere in the PR description to pause VexReview:

```
@vexreview: ignore
```

---

## ⚙️ Configuration

All inputs and default prompts are defined in [`action.yml`](./action.yml). Key options:

| Input | Default | Description |
|---|---|---|
| `max_files` | `150` | Max files to summarize/review. `0` = unlimited. |
| `review_simple_changes` | `false` | Review even trivially simple changes. |
| `review_comment_lgtm` | `false` | Post comments even when code looks good. |
| `disable_review` | `false` | Only produce summaries; skip line-by-line review. |
| `disable_release_notes` | `false` | Skip auto-generation of release notes. |
| `language` | `en-US` | ISO code for response language. |

---

## 🏗️ Part of the CodebaseGPT Ecosystem

VexReview is designed to work alongside **CodebaseGPT** — a full-stack developer toolset for understanding, navigating, and maintaining large codebases using AI + **Actan Vector DB**.

| Tool | Role |
|---|---|
| **CodebaseGPT Dashboard** | Visual codebase explorer, AI chat, security scans |
| **VexReview** | Automated AI PR reviews integrated into GitHub Workflows |
| **CodebaseGPT CLI** | Terminal-based indexing, scanning, and analysis |

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Package for distribution
npm run package

# Run all checks
npm run all
```

---

## 📄 License

MIT — see [LICENSE](./LICENSE)

---

> **Disclaimer**: Code is sent to external AI APIs (Gemini / OpenAI) for processing. Review your organization's data policies before use.
