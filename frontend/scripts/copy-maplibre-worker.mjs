// MapLibre's web worker must be served as a plain file; the bundler cannot inline it.
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs"));
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), new URL("../public/maplibre-gl-worker.mjs", import.meta.url));
console.log("copied maplibre-gl-worker.mjs to public/");
