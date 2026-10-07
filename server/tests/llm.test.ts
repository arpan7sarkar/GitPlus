import assert from "node:assert/strict";
import { test } from "node:test";

const modelCases = [
  { name: "unset", value: undefined, expected: "gemini-2.5-flash" },
  { name: "whitespace", value: " \t ", expected: "gemini-2.5-flash" },
  { name: "override", value: " offline-gemini-model ", expected: "offline-gemini-model" },
];

for (const [index, modelCase] of modelCases.entries()) {
  test(`completeText uses the ${modelCase.name} Gemini model setting`, async (t) => {
    const values = {
      GOOGLE_GEMINI_MODEL: modelCase.value,
      GOOGLE_GEMINI_API_KEY: "offline-gemini-key",
      OPENAI_API_KEY: "offline-openai-key",
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

    const upstreamFetch = t.mock.method(globalThis, "fetch", async (input, init) => {
      assert.equal(String(input), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer offline-gemini-key");
      assert.equal(typeof init?.body, "string");
      const body = JSON.parse(init!.body as string);
      assert.equal(body.model, modelCase.expected);
      assert.equal(body.max_tokens, 32);
      assert.equal(body.temperature, 0.1);
      assert.deepEqual(body.messages, [
        { role: "system", content: "Offline system prompt" },
        { role: "user", content: "Offline user prompt" },
      ]);
      return Response.json({ choices: [{ message: { content: "  Offline completion\n" } }] });
    });
    const { completeText } = await import(new URL(`../src/lib/llm.ts?gemini-test=${index}`, import.meta.url).href);
    const result = await completeText({
      systemPrompt: "Offline system prompt",
      userContent: "Offline user prompt",
      maxTokens: 32,
      temperature: 0.1,
    });

    assert.equal(result, "Offline completion");
    assert.equal(upstreamFetch.mock.callCount(), 1);
  });
}
