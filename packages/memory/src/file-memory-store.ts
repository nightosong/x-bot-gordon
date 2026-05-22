import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { resolveFromRoot } from "../../shared/src/index.js";
import type { MemoryEntry, MemoryScope } from "../../shared/src/index.js";

function resolveMemoryPath(scope: MemoryScope): string {
  return resolveFromRoot("data", "memory", `${scope}.json`);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export async function listMemoryEntries(scope: MemoryScope): Promise<MemoryEntry[]> {
  try {
    return await readJsonFile<MemoryEntry[]>(resolveMemoryPath(scope));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function appendMemoryEntry(
  scope: MemoryScope,
  input: Pick<MemoryEntry, "title" | "summary" | "tags">
): Promise<MemoryEntry> {
  const filePath = resolveMemoryPath(scope);
  const directory = resolveFromRoot("data", "memory");
  const currentEntries = await listMemoryEntries(scope);

  const nextEntry: MemoryEntry = {
    id: randomUUID(),
    scope,
    title: input.title,
    summary: input.summary,
    tags: input.tags,
    updatedAt: new Date().toISOString()
  };

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify([nextEntry, ...currentEntries], null, 2)}\n`, "utf8");

  return nextEntry;
}
