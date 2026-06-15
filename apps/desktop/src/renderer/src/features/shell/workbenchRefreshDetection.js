import { BUILTIN_APPLICATION_TOOLS_MCP_ID, BUILTIN_WORKSPACE_MCP_ID } from "../../lib/presenter.js";

const WORKSPACE_MUTATION_TOOL_NAMES = new Set([
  "write_file",
  "replace_in_file",
  "move_path",
  "delete_path",
  "run_shell_command"
]);

const WORKBENCH_RESOURCE_MARKERS = [
  ".gord/data/workbench",
  "/data/workbench/",
  "\\data\\workbench\\",
  "workbench/comic-projects.json",
  "workbench\\comic-projects.json",
  "workbench/writing-books",
  "workbench\\writing-books",
  "workbench/video-projects.json",
  "workbench\\video-projects.json",
  "workbench/music-projects.json",
  "workbench\\music-projects.json",
  "workbench/weekly-progress.json",
  "workbench\\weekly-progress.json",
  "workbench/workflow-library.json",
  "workbench\\workflow-library.json",
  "workbench/model-settings.json",
  "workbench\\model-settings.json",
  "workbench/tool-configs.json",
  "workbench\\tool-configs.json",
  "workbench/agent-profiles.json",
  "workbench\\agent-profiles.json",
  "workbench/mcp-servers.json",
  "workbench\\mcp-servers.json",
  "workbench/skills.json",
  "workbench\\skills.json",
  "comic-projects.json",
  "writing-books",
  "video-projects.json",
  "music-projects.json",
  "weekly-progress.json",
  "workflow-library.json",
  "model-settings.json",
  "tool-configs.json",
  "agent-profiles.json",
  "mcp-servers.json",
  "skills.json"
];

function stringifyForRefreshDetection(value) {
  const visited = new WeakSet();

  function normalize(input) {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
      return input;
    }

    if (typeof input === "bigint" || typeof input === "symbol" || typeof input === "function") {
      return String(input);
    }

    if (Array.isArray(input)) {
      return input.map((item) => normalize(item));
    }

    if (typeof input !== "object") {
      return String(input);
    }

    if (visited.has(input)) {
      return "[Circular]";
    }

    visited.add(input);

    return Object.fromEntries(Object.entries(input).map(([key, entryValue]) => [key, normalize(entryValue)]));
  }

  try {
    return JSON.stringify(normalize(value));
  } catch {
    return String(value ?? "");
  }
}

function hasWorkbenchResourceMarker(value) {
  const haystack = stringifyForRefreshDetection(value).toLowerCase();
  return WORKBENCH_RESOURCE_MARKERS.some((marker) => haystack.includes(marker.toLowerCase()));
}

function isSuccessfulApplicationToolMutation(call) {
  return (
    call?.serverId === BUILTIN_APPLICATION_TOOLS_MCP_ID &&
    call?.isError !== true &&
    call?.structuredContent?.applied === true
  );
}

function isSuccessfulWorkspaceToolMutation(call) {
  if (call?.isError === true) {
    return false;
  }

  const serverText = `${call?.serverId ?? ""} ${call?.serverName ?? ""}`.toLowerCase();
  const toolName = String(call?.toolName ?? "").trim();

  if (call?.serverId !== BUILTIN_WORKSPACE_MCP_ID && !serverText.includes("workspace")) {
    return false;
  }

  if (!WORKSPACE_MUTATION_TOOL_NAMES.has(toolName)) {
    return false;
  }

  return hasWorkbenchResourceMarker([call?.arguments, call?.structuredContent, call?.resultText]);
}

export function didAgentMutateWorkbenchResources(result) {
  const calls = Array.isArray(result?.mcpCalls) ? result.mcpCalls : [];

  return calls.some((call) => isSuccessfulApplicationToolMutation(call) || isSuccessfulWorkspaceToolMutation(call));
}
