import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const rootDir = process.cwd();
const preloadSource = path.resolve(rootDir, "apps/desktop/src/preload.ts");
const preloadTarget = path.resolve(rootDir, "dist/apps/desktop/src/preload.cjs");
const appIconPngSource = path.resolve(rootDir, "apps/desktop/src/renderer/assets/gordon.icns");
const appIconPngTarget = path.resolve(rootDir, "dist/apps/desktop/assets/gordon.icns");
const appIconIcoSource = path.resolve(rootDir, "apps/desktop/src/renderer/assets/gordon.ico");
const appIconIcoTarget = path.resolve(rootDir, "dist/apps/desktop/assets/gordon.ico");
const preloadSourceCode = await readFile(preloadSource, "utf8");
const { outputText } = ts.transpileModule(preloadSourceCode, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true,
    verbatimModuleSyntax: false
  },
  fileName: preloadSource
});

await mkdir(path.dirname(preloadTarget), { recursive: true });
await writeFile(preloadTarget, outputText, "utf8");
await mkdir(path.dirname(appIconPngTarget), { recursive: true });
await copyFile(appIconPngSource, appIconPngTarget);
await copyFile(appIconIcoSource, appIconIcoTarget);
