import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const rootDir = process.cwd();
const preloadSource = path.resolve(rootDir, "apps/desktop/src/preload.ts");
const preloadTarget = path.resolve(rootDir, "dist/apps/desktop/src/preload.cjs");
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
