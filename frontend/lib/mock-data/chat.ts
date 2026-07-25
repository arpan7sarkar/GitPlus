export const MOCK_CHAT_RESPONSE = `Great question! Let me walk you through how App Router handles React Server Components in Next.js 14+.

## How App Router Renders React Server Components

The key file is \`packages/next/src/server/app-render/app-render.tsx:45-120\`. This module is the entry point for all RSC rendering.

### The Rendering Pipeline

1. **Request arrives** at \`packages/next/src/server/next-server.ts:118-145\`. The server parses the URL and dispatches to the appropriate renderer.

2. **RSC Payload generation** — The server calls \`renderToReadableStream()\` from React, streaming the component tree to the client as a serialized RSC payload (not HTML).

3. **Hydration on client** — The client receives the RSC payload and hydrates only Client Components (those marked with \`"use client"\`). Server Components never run on the client.

### Key Architectural Points

- **Server Components** run exclusively on the server and can access databases, file systems, and secrets directly
- **Client Components** are bundled and sent to the browser for interactivity
- **The boundary** is the \`"use client"\` directive — crossing it serializes props

### Code Example

\`\`\`typescript
// packages/next/src/server/app-render/app-render.tsx:52-78
export async function renderToHTMLOrFlight(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  query: NextParsedUrlQuery,
  renderOpts: RenderOpts
): Promise<RenderResult> {
  const { Component, params } = await resolveRouteComponent(pathname);
  // Render server component tree
  const stream = await createStaticStream(Component, { params });
  return new RenderResult(stream, renderOpts);
}
\`\`\`

This is why Next.js App Router is so fast — Server Components ship zero JavaScript to the client by default.`;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  citations?: Citation[];
}

export interface Citation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
}
