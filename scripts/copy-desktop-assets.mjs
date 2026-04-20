import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.resolve(rootDir, "apps/desktop/src/renderer");
const targetDir = path.resolve(rootDir, "dist/apps/desktop/src/renderer");
const preloadSource = path.resolve(rootDir, "apps/desktop/src/preload.cjs");
const preloadTarget = path.resolve(rootDir, "dist/apps/desktop/src/preload.cjs");
const splineRuntimeSource = path.resolve(rootDir, "node_modules/@splinetool/runtime/build");
const splineRuntimeTarget = path.resolve(rootDir, "dist/apps/desktop/src/renderer/vendor/spline-runtime");

await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });
await cp(preloadSource, preloadTarget);
await mkdir(path.dirname(splineRuntimeTarget), { recursive: true });
await cp(splineRuntimeSource, splineRuntimeTarget, { recursive: true });
