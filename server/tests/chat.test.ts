import assert from "node:assert/strict";
import { once } from "node:events";
import { request, type IncomingHttpHeaders } from "node:http";
import { test } from "node:test";
import express from "express";
import pg from "pg";

const modelCases = [
  { name: "unset", value: undefined },
  { name: "whitespace", value: " \t " },
  { name: "override", value: " offline-gemini-model " },
];

function postJson(port: number, body: object): Promise<{ status: number | undefined; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request({
      hostname: "127.0.0.1",
      port,
      path: "/api/chat",
      method: "POST",
      agent: false,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
    }, (res) => {
      res.setEncoding("utf8");
      let content = "";
      res.on("data", (chunk) => { content += chunk; });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: content }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

for (const [index, modelCase] of modelCases.entries()) {
  for (const streaming of [false, true]) {
    test(`chat ${streaming ? "SSE" : "JSON"} retains Gemini 2.0 Flash with ${modelCase.name} override`, async (t) => {
      const values = {
        GOOGLE_GEMINI_MODEL: modelCase.value,
        GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
        OPENAI_API_KEY: "offline-openai-key",
        DATABASE_URL: "postgresql://offline:offline@127.0.0.1:9/offline",
      };
      const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
      t.after(() => {
        for (const [name, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      });
      for (const [name, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }

      const poolConnect = t.mock.method(pg.Pool.prototype, "connect", () => {
        throw new Error("Database connections are prohibited in offline chat tests");
      });
      const clientConnect = t.mock.method(pg.Client.prototype, "connect", () => {
        throw new Error("Database connections are prohibited in offline chat tests");
      });
      const streamBody = 'data: {"choices":[{"delta":{"content":"Offline reply"}}]}\n\ndata: [DONE]\n\n';
      const completion = '{"narrative":"Offline overview"}';
      const upstreamFetch = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        assert.equal(String(input), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer offline-gemini-key");
        assert.equal(typeof init?.body, "string");
        const body = JSON.parse(init!.body as string);
        assert.equal(body.model, "gemini-2.0-flash");
        assert.equal(body.stream, streaming);
        assert.equal(body.messages[0].role, "system");
        assert.equal(body.messages[1].role, "user");
        assert.ok(body.messages[1].content.includes("Offline question"));
        return streaming
          ? new Response(streamBody, { headers: { "Content-Type": "text/event-stream" } })
          : Response.json({ choices: [{ message: { content: completion } }] });
      });
      const { default: router } = await import(new URL(`../src/routes/chat.ts?gemini-test=${index}-${streaming}`, import.meta.url).href);
      const app = express();
      app.use(express.json());
      app.use("/api/chat", router);
      const server = app.listen(0, "127.0.0.1");
      t.after(async () => {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      });
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await postJson(address.port, streaming
        ? { messages: [{ role: "user", content: "Offline question" }] }
        : { action: "overview", repoContext: "Offline question" });

      assert.equal(response.status, 200);
      if (streaming) {
        assert.match(response.headers["content-type"] || "", /^text\/event-stream/);
        assert.equal(response.body, streamBody);
      } else {
        assert.match(response.headers["content-type"] || "", /^application\/json/);
        assert.deepEqual(JSON.parse(response.body), { content: completion });
      }
      assert.equal(upstreamFetch.mock.callCount(), 1);
      assert.equal(poolConnect.mock.callCount(), 0);
      assert.equal(clientConnect.mock.callCount(), 0);
    });
  }
}
