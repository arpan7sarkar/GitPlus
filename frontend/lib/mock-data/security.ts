import type { SecurityFinding } from "../api";

// SEC-001 through SEC-012 — one demo finding per check

export const MOCK_SECURITY_FINDINGS: SecurityFinding[] = [
  {
    id: "SEC-001",
    title: "Hardcoded Secret Key",
    severity: "critical",
    description:
      "A hardcoded API secret was detected in the repository. Secrets should never be committed to source control as they can be extracted from the git history even after removal.",
    file: "packages/next/src/server/config.ts",
    line: 42,
    recommendation:
      "Move this value to an environment variable (e.g., process.env.NEXT_SECRET_KEY) and add the file to .gitignore. Rotate the compromised secret immediately.",
  },
  {
    id: "SEC-002",
    title: "CORS Wildcard Origin",
    severity: "high",
    description:
      "The server allows all origins via CORS (Access-Control-Allow-Origin: *). This allows any website to make credentialed requests to your API.",
    file: "packages/next/src/server/next-server.ts",
    line: 118,
    recommendation:
      "Restrict allowed origins to a whitelist of known domains. Use allowedOrigins: ['https://yourdomain.com'] and avoid wildcards for authenticated APIs.",
  },
  {
    id: "SEC-003",
    title: "SQL Injection Risk",
    severity: "high",
    description:
      "User-supplied input is being interpolated directly into a database query string without parameterization. This could allow attackers to modify or exfiltrate data.",
    file: "examples/with-postgres/lib/db.ts",
    line: 23,
    recommendation:
      "Use parameterized queries or a query builder. Replace string interpolation with prepared statements: db.query('SELECT * FROM users WHERE id = $1', [userId]).",
  },
  {
    id: "SEC-004",
    title: "Cross-Site Scripting (XSS) via dangerouslySetInnerHTML",
    severity: "high",
    description:
      "React's dangerouslySetInnerHTML is used with user-provided content without sanitization. This can allow injected scripts to execute in the victim's browser.",
    file: "examples/cms-contentful/components/content-renderer.tsx",
    line: 67,
    recommendation:
      "Sanitize all HTML content before rendering using a library like DOMPurify. Consider using a markdown renderer instead of raw HTML.",
  },
  {
    id: "SEC-005",
    title: "Missing Input Validation on API Route",
    severity: "medium",
    description:
      "An API route accepts and processes user input without validating field types, lengths, or allowed values. This could lead to unexpected behavior or DoS conditions.",
    file: "packages/next/src/server/api-utils/node/index.ts",
    line: 89,
    recommendation:
      "Add schema validation using zod or yup. Validate all incoming request body fields before processing them.",
  },
  {
    id: "SEC-006",
    title: "Weak Authentication Pattern",
    severity: "medium",
    description:
      "Session tokens are generated using Math.random() which is not cryptographically secure. This makes session tokens predictable.",
    file: "packages/next/src/server/lib/auth.ts",
    line: 14,
    recommendation:
      "Use crypto.randomUUID() or crypto.getRandomValues() for generating session tokens. Consider using a proven auth library like NextAuth.js.",
  },
  {
    id: "SEC-007",
    title: "Missing Rate Limiting on Authentication Endpoint",
    severity: "medium",
    description:
      "The login endpoint does not implement rate limiting, making it vulnerable to brute-force attacks.",
    file: "packages/next/src/server/route-handlers/auth.ts",
    line: 31,
    recommendation:
      "Implement rate limiting using a library like upstash/ratelimit. Limit to 10 attempts per minute per IP and return 429 Too Many Requests.",
  },
  {
    id: "SEC-008",
    title: "Sensitive Data Exposure in Error Messages",
    severity: "medium",
    description:
      "Error responses in development mode include full stack traces and internal file paths. These should not be exposed in production.",
    file: "packages/next/src/server/lib/error-handler.ts",
    line: 56,
    recommendation:
      "Ensure NODE_ENV=production strips stack traces from error responses. Use a generic error message for clients and log details server-side only.",
  },
  {
    id: "SEC-009",
    title: "Outdated Dependency with Known CVE",
    severity: "medium",
    description:
      "Package 'semver@5.7.1' has a known ReDoS vulnerability (CVE-2022-25883). The regex in semver's parse function can cause excessive CPU usage.",
    file: "package.json",
    recommendation:
      "Update semver to >= 7.5.2. Run npm audit fix to automatically resolve this and other known vulnerabilities.",
  },
  {
    id: "SEC-010",
    title: "Missing CSRF Protection",
    severity: "low",
    description:
      "State-mutating API routes do not verify CSRF tokens. Attackers could trick authenticated users into making unintended requests.",
    file: "packages/next/src/server/route-handlers/",
    recommendation:
      "Add CSRF token validation for all POST/PUT/DELETE routes. Next.js provides built-in CSRF protection via SameSite cookies — ensure cookies use SameSite=Strict or SameSite=Lax.",
  },
  {
    id: "SEC-011",
    title: "Unrestricted File Upload",
    severity: "low",
    description:
      "The file upload handler does not restrict file types or validate MIME types. Users could upload malicious files including executable scripts.",
    file: "examples/with-uploadthing/app/api/uploadthing/route.ts",
    line: 12,
    recommendation:
      "Validate file extensions and MIME types on upload. Restrict allowed types to a whitelist. Store uploads outside the webroot and scan with an antivirus service.",
  },
  {
    id: "SEC-012",
    title: "Missing Row-Level Security on Database Queries",
    severity: "info",
    description:
      "Database queries fetch data without tenant isolation. In a multi-tenant setup, this could expose one customer's data to another.",
    file: "examples/with-supabase/lib/supabase-server.ts",
    line: 28,
    recommendation:
      "Enable Row Level Security (RLS) in Supabase/PostgreSQL. Add policies that restrict access based on auth.uid(). Test with a non-admin role.",
  },
];
