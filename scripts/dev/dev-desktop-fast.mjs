import { spawn } from "node:child_process";
import process from "node:process";

const rootDir = process.cwd();
const isWindows = process.platform === "win32";
const pnpmCommand = isWindows ? "pnpm.cmd" : "pnpm";
const rendererDevServerUrl = process.env.GORDON_RENDERER_DEV_SERVER_URL?.trim() || "http://127.0.0.1:5173";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

function waitForViteReady(child) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const settleReady = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    const settleError = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const handleOutput = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(chunk);

      if (text.includes("ready in") || text.includes("Local:")) {
        settleReady();
      }
    };

    child.stdout.on("data", handleOutput);
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    child.on("error", settleError);
    child.on("exit", (code, signal) => {
      if (!settled) {
        settleError(new Error(`Vite exited before ready with ${code ?? signal}`));
      }
    });
  });
}

function stopChild(child) {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}

await run(pnpmCommand, ["run", "build:main"]);

const vite = spawn(
  pnpmCommand,
  [
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
    "--config",
    "./apps/desktop/vite.config.mjs"
  ],
  {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  }
);

const cleanup = () => stopChild(vite);
process.once("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
process.once("exit", cleanup);

try {
  await waitForViteReady(vite);
  await run(pnpmCommand, ["exec", "electron", "./dist/apps/desktop/src/main.js"], {
    env: {
      ...process.env,
      GORDON_RENDERER_DEV_SERVER_URL: rendererDevServerUrl
    }
  });
} finally {
  cleanup();
}
