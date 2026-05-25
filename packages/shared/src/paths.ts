import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function getElectronProcess(): NodeJS.Process & {
  defaultApp?: boolean;
  resourcesPath?: string;
} {
  return process as NodeJS.Process & {
    defaultApp?: boolean;
    resourcesPath?: string;
  };
}

function isPackagedElectronRuntime(): boolean {
  const electronProcess = getElectronProcess();
  return Boolean(process.versions.electron && !electronProcess.defaultApp && electronProcess.resourcesPath);
}

export function getProjectRoot(): string {
  const electronProcess = getElectronProcess();

  if (isPackagedElectronRuntime() && electronProcess.resourcesPath) {
    return electronProcess.resourcesPath;
  }

  return process.cwd();
}

export function getGordonHomeDirectoryPath(): string {
  const configuredHome = process.env.GORDON_HOME?.trim();

  if (configuredHome) {
    return path.resolve(configuredHome);
  }

  return path.join(os.homedir(), ".gord");
}

export function resolveFromGordonHome(...segments: string[]): string {
  return path.resolve(getGordonHomeDirectoryPath(), ...segments);
}

export async function ensureGordonHomeDirectory(): Promise<string> {
  const homeDirectory = getGordonHomeDirectoryPath();
  const directories = [
    homeDirectory,
    resolveFromGordonHome("config"),
    resolveFromGordonHome("data"),
    resolveFromGordonHome("data", "memory"),
    resolveFromGordonHome("data", "workbench"),
    resolveFromGordonHome("skills"),
    resolveFromGordonHome("prompts"),
    resolveFromGordonHome("logs"),
    resolveFromGordonHome("cache")
  ];

  for (const directory of directories) {
    await mkdir(directory, { recursive: true });
  }

  return homeDirectory;
}

export function getDataRoot(): string {
  const configuredDataRoot = process.env.GORDON_DATA_ROOT?.trim();

  if (configuredDataRoot) {
    return path.resolve(configuredDataRoot);
  }

  return resolveFromGordonHome("data");
}

export function resolveFromRoot(...segments: string[]): string {
  const [firstSegment, ...restSegments] = segments;

  if (firstSegment === "data") {
    return path.resolve(getDataRoot(), ...restSegments);
  }

  return path.resolve(getProjectRoot(), ...segments);
}
