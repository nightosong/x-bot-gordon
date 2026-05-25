import { access, copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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

function getDefaultDataRoot(): string {
  return resolveFromGordonHome("data");
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

  await migrateLegacyDataRootsToCurrentDataRoot();

  await mkdir(resolveFromRoot("data", "memory"), { recursive: true });
  await mkdir(resolveFromRoot("data", "workbench"), { recursive: true });

  return homeDirectory;
}

export function getDataRoot(): string {
  const configuredDataRoot = process.env.GORDON_DATA_ROOT?.trim();

  if (configuredDataRoot) {
    return path.resolve(configuredDataRoot);
  }

  return getDefaultDataRoot();
}

export function resolveFromRoot(...segments: string[]): string {
  const [firstSegment, ...restSegments] = segments;

  if (firstSegment === "data") {
    return path.resolve(getDataRoot(), ...restSegments);
  }

  return path.resolve(getProjectRoot(), ...segments);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeComparablePath(targetPath: string): string {
  return path.resolve(targetPath);
}

function isSamePath(leftPath: string, rightPath: string): boolean {
  return normalizeComparablePath(leftPath) === normalizeComparablePath(rightPath);
}

function buildDataMigrationBackupStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function hasLegacyDataSignature(dataRoot: string): Promise<boolean> {
  return (await pathExists(path.join(dataRoot, "workbench"))) || (await pathExists(path.join(dataRoot, "memory")));
}

function getLegacyProjectDataRoot(): string {
  return path.resolve(getProjectRoot(), "data");
}

function getLegacyPackagedDataRoot(): string {
  return path.join(getPackagedUserDataRoot(), "data");
}

function getLegacyDataRootCandidates(): string[] {
  return [getLegacyPackagedDataRoot(), getLegacyProjectDataRoot()];
}

async function areSameFileContent(leftPath: string, rightPath: string): Promise<boolean> {
  try {
    const [leftStats, rightStats] = await Promise.all([stat(leftPath), stat(rightPath)]);

    if (!leftStats.isFile() || !rightStats.isFile() || leftStats.size !== rightStats.size) {
      return false;
    }

    const [leftContent, rightContent] = await Promise.all([readFile(leftPath), readFile(rightPath)]);
    return Buffer.compare(leftContent, rightContent) === 0;
  } catch {
    return false;
  }
}

async function backupExistingMigrationTarget(targetPath: string, relativePath: string, backupStamp: string): Promise<void> {
  const backupPath = path.join(resolveFromGordonHome("data-migration-backups", backupStamp), relativePath);
  await mkdir(path.dirname(backupPath), { recursive: true });
  await cp(targetPath, backupPath, { recursive: true, force: true });
  await rm(targetPath, { recursive: true, force: true });
}

async function copyLegacyDataEntry(
  sourceRoot: string,
  targetRoot: string,
  relativePath: string,
  backupStamp: string
): Promise<void> {
  const sourcePath = path.join(sourceRoot, relativePath);
  const targetPath = path.join(targetRoot, relativePath);
  const sourceStats = await stat(sourcePath);

  if (sourceStats.isDirectory()) {
    if (await pathExists(targetPath)) {
      const targetStats = await stat(targetPath);

      if (!targetStats.isDirectory()) {
        await backupExistingMigrationTarget(targetPath, relativePath, backupStamp);
      }
    }

    await mkdir(targetPath, { recursive: true });

    const entries = await readdir(sourcePath);

    for (const entry of entries) {
      await copyLegacyDataEntry(sourceRoot, targetRoot, path.join(relativePath, entry), backupStamp);
    }

    return;
  }

  if (!sourceStats.isFile()) {
    return;
  }

  if (await pathExists(targetPath)) {
    if (await areSameFileContent(sourcePath, targetPath)) {
      return;
    }

    await backupExistingMigrationTarget(targetPath, relativePath, backupStamp);
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}

async function copyLegacyDataRoot(sourceRoot: string, targetRoot: string, backupStamp: string): Promise<void> {
  await mkdir(targetRoot, { recursive: true });

  const entries = await readdir(sourceRoot);

  for (const entry of entries) {
    await copyLegacyDataEntry(sourceRoot, targetRoot, entry, backupStamp);
  }
}

function getLegacyDataMigrationMarkerPath(targetDataRoot: string): string {
  return path.join(targetDataRoot, ".migration", "legacy-data-roots.json");
}

async function readMigratedLegacyDataRootSet(targetDataRoot: string): Promise<Set<string>> {
  try {
    const markerContent = await readFile(getLegacyDataMigrationMarkerPath(targetDataRoot), "utf8");
    const marker = JSON.parse(markerContent) as unknown;

    if (!Array.isArray(marker)) {
      return new Set();
    }

    return new Set(marker.map((entry) => String(entry ?? "").trim()).filter(Boolean));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Set();
    }

    throw error;
  }
}

async function writeMigratedLegacyDataRootSet(targetDataRoot: string, migratedRoots: Set<string>): Promise<void> {
  const markerPath = getLegacyDataMigrationMarkerPath(targetDataRoot);
  await mkdir(path.dirname(markerPath), { recursive: true });
  await writeFile(markerPath, `${JSON.stringify(Array.from(migratedRoots).sort(), null, 2)}\n`, "utf8");
}

async function migrateLegacyDataRootsToCurrentDataRoot(): Promise<void> {
  const targetDataRoot = getDataRoot();
  const visitedRoots = new Set<string>();
  const migratedRoots = await readMigratedLegacyDataRootSet(targetDataRoot);
  const backupStamp = buildDataMigrationBackupStamp();

  for (const legacyDataRoot of getLegacyDataRootCandidates()) {
    const normalizedLegacyRoot = normalizeComparablePath(legacyDataRoot);

    if (visitedRoots.has(normalizedLegacyRoot) || migratedRoots.has(normalizedLegacyRoot) || isSamePath(legacyDataRoot, targetDataRoot)) {
      continue;
    }

    visitedRoots.add(normalizedLegacyRoot);

    if (!(await pathExists(legacyDataRoot)) || !(await hasLegacyDataSignature(legacyDataRoot))) {
      continue;
    }

    await copyLegacyDataRoot(legacyDataRoot, targetDataRoot, backupStamp);
    migratedRoots.add(normalizedLegacyRoot);
    await writeMigratedLegacyDataRootSet(targetDataRoot, migratedRoots);
  }
}
