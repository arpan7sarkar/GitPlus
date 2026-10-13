import "dotenv/config";
import { ensureIndex, countPoints } from "../src/lib/pinecone.js";

async function main() {
  await ensureIndex();
  const count = await countPoints();
  if (count < 0) throw new Error("Pinecone index statistics are unavailable");
  console.log("Pinecone index: ready (dense, 1024 dimensions, cosine)");
  console.log(`Namespace: ${process.env.PINECONE_NAMESPACE || "gitplus"}`);
  console.log(`Vectors: ${count}`);
}

main().catch((err) => {
  console.error("Inspection failed:", err instanceof Error ? err.message : "Pinecone is unavailable");
  process.exitCode = 1;
});
