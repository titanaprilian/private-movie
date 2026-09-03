import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { MVP_MEDIA_OPENAPI } from "../src/media-openapi";

const outPath = resolve(
  import.meta.dirname,
  "..",
  "openapi",
  "mvp-media.openapi.json",
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(MVP_MEDIA_OPENAPI, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
