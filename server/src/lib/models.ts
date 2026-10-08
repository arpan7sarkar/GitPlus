export function getGeminiChatModel(): string {
  return (
    process.env.GOOGLE_GEMINI_MODEL_CODE?.trim() ||
    process.env.GOOGLE_GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash"
  );
}

export function getOpenAIChatModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function getGeminiEmbeddingModel(): string {
  return (
    process.env.GOOGLE_GEMINI_EMBEDDING_MODEL?.trim() ||
    process.env.GEMINI_EMBEDDING_MODEL?.trim() ||
    "gemini-embedding-001"
  );
}

export function getOpenAIEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-large";
}

export function getEmbeddingDimensions(): number {
  const raw = process.env.EMBEDDING_DIMENSIONS?.trim();
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1024;
}

export function getEmbeddingProvider(): "openai" | "gemini" {
  const forced = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (forced === "gemini" || forced === "openai") return forced;
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return "gemini";
}
