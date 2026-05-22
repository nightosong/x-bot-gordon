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

function getPackagedUserDataRoot(): string {
  const appDataName = process.env.GORDON_APP_DATA_NAME?.trim() || "x-bot-gordon";

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appDataName);
  }

  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), appDataName);
  }

  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), appDataName);
}

export function getProjectRoot(): string {
  const electronProcess = getElectronProcess();

  if (isPackagedElectronRuntime() && electronProcess.resourcesPath) {
    return electronProcess.resourcesPath;
  }

  return process.cwd();
}

export function getDataRoot(): string {
  const configuredDataRoot = process.env.GORDON_DATA_ROOT?.trim();

  if (configuredDataRoot) {
    return path.resolve(configuredDataRoot);
  }

  if (isPackagedElectronRuntime()) {
    return path.join(getPackagedUserDataRoot(), "data");
  }

  return path.resolve(process.cwd(), "data");
}

export function resolveFromRoot(...segments: string[]): string {
  const [firstSegment, ...restSegments] = segments;

  if (firstSegment === "data") {
    return path.resolve(getDataRoot(), ...restSegments);
  }

  return path.resolve(getProjectRoot(), ...segments);
}
