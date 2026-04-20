import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const preloadSource = path.resolve(rootDir, "apps/desktop/src/preload.cjs");
const preloadTarget = path.resolve(rootDir, "dist/apps/desktop/src/preload.cjs");

await mkdir(path.dirname(preloadTarget), { recursive: true });
await cp(preloadSource, preloadTarget);
