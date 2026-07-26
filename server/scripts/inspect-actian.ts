/**
 * Actian VectorAI Inspector
 * There's no bundled web dashboard for this Actian image (unlike e.g. Qdrant's
 * UI), and the REST port isn't published by the running container — this talks
 * to the same gRPC endpoint (ACTIAN_VECTOR_PORT) the app's own SDK client uses.
 *
 * Usage:
 *   npm run actian:inspect                 -- lists collections + point counts
 *   npm run actian:inspect -- <collection>  -- also dumps a sample of points
 */

import "dotenv/config";
import { actianClient } from "../src/lib/actian.js";

async function main() {
  const targetCollection = process.argv[2];

  const names = await actianClient.collections.list();
  if (names.length === 0) {
    console.log("No collections found.");
    return;
  }

  for (const name of names) {
    const info = await actianClient.collections.getInfo(name).catch(() => null);
    const count = await actianClient.points.count(name).catch(() => -1);
    console.log(`\n${name}`);
    console.log(`  points: ${count}`);
    if (info) console.log(`  info:`, JSON.stringify(info, null, 2).split("\n").join("\n  "));
  }

  if (targetCollection) {
    console.log(`\n--- sample points from "${targetCollection}" ---`);
    const page = await actianClient.points.scroll(targetCollection, { limit: 10, with_payload: true } as any);
    for (const p of page.points) {
      console.log(`\n[${p.id}]`);
      console.log(JSON.stringify(p.payload, null, 2));
    }
  } else {
    console.log(`\nTip: pass a collection name to see sample points, e.g.:`);
    console.log(`  npm run actian:inspect -- gitplus_nodes_v3`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Inspection failed:", err);
    process.exit(1);
  });
