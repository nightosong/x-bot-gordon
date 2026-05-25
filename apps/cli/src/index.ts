import { appendMemoryEntry } from "../../../packages/memory/src/index.js";
import { buildWorkbenchSnapshot } from "../../../packages/core/src/index.js";
import { ensureGordonHomeDirectory } from "../../../packages/shared/src/index.js";
import type { MemoryEntry, MemoryScope } from "../../../packages/shared/src/index.js";

function printHelp(): void {
  console.log(`
gord <command>

Commands:
  summary
  providers
  modules
  tasks
  memory list <references|experience>
  memory add <references|experience> <title> <summary> [tag1,tag2]
  help
`.trim());
}

function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => (row[index] ?? "").length)
    )
  );

  const formatRow = (row: string[]): string =>
    row.map((cell, index) => cell.padEnd(widths[index], " ")).join(" | ");

  console.log(formatRow(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("-|-"));

  for (const row of rows) {
    console.log(formatRow(row));
  }
}

function printMemoryEntries(entries: MemoryEntry[]): void {
  if (entries.length === 0) {
    console.log("No memory entries yet.");
    return;
  }

  printTable(
    ["Title", "Tags", "Updated At"],
    entries.map((entry) => [entry.title, entry.tags.join(","), entry.updatedAt])
  );
}

async function run(): Promise<void> {
  await ensureGordonHomeDirectory();

  const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
  const [command = "help", subcommand, ...restArgs] = rawArgs;

  if (command === "help") {
    printHelp();
    return;
  }

  const snapshot = await buildWorkbenchSnapshot();

  switch (command) {
    case "summary":
      console.log(`${snapshot.blueprint.identity.primaryName} (${snapshot.blueprint.identity.nicknames.join(", ")})`);
      console.log(snapshot.blueprint.identity.mission);
      console.log(`Surfaces: ${snapshot.blueprint.runtimeSurfaces.join(", ")}`);
      console.log(`Modules: ${snapshot.modules.map((module) => module.label).join(", ")}`);
      console.log(`Providers: ${snapshot.providers.map((provider) => provider.label).join(", ")}`);
      return;

    case "providers":
      printTable(
        ["Provider", "Kind", "Mode", "Setup Fields"],
        snapshot.providers.map((provider) => [
          provider.label,
          provider.kind,
          provider.integrationMode,
          provider.setupFields.join(", ")
        ])
      );
      return;

    case "modules":
      printTable(
        ["Module", "Status", "Surfaces", "Value"],
        snapshot.modules.map((module) => [
          module.label,
          module.status,
          module.surfaces.join(", "),
          module.value
        ])
      );
      return;

    case "tasks":
      printTable(
        ["Task", "Status", "Rewrite", "Daily Report Hint"],
        snapshot.tasks.map((task) => [
          task.title,
          task.status,
          task.needsRewrite ? "yes" : "no",
          task.dailyReportHint
        ])
      );
      return;

    case "memory":
      if (subcommand === "list") {
        const scope = restArgs[0] as MemoryScope | undefined;

        if (scope !== "references" && scope !== "experience") {
          console.error("Usage: gord memory list <references|experience>");
          process.exitCode = 1;
          return;
        }

        printMemoryEntries(snapshot.memory[scope]);
        return;
      }

      if (subcommand === "add") {
        const [scope, title, summary, tagsInput] = restArgs as [MemoryScope | undefined, string | undefined, string | undefined, string | undefined];

        if ((scope !== "references" && scope !== "experience") || !title || !summary) {
          console.error("Usage: gord memory add <references|experience> <title> <summary> [tag1,tag2]");
          process.exitCode = 1;
          return;
        }

        const created = await appendMemoryEntry(scope, {
          title,
          summary,
          tags: tagsInput ? tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean) : []
        });

        console.log(`Added ${created.scope} memory: ${created.title}`);
        return;
      }

      console.error("Usage: gord memory <list|add> ...");
      process.exitCode = 1;
      return;

    default:
      printHelp();
      process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error("gord failed:", error);
  process.exitCode = 1;
});
