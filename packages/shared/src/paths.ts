import path from "node:path";

export function getProjectRoot(): string {
  return process.cwd();
}

export function resolveFromRoot(...segments: string[]): string {
  return path.resolve(getProjectRoot(), ...segments);
}
