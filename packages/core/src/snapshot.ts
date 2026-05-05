import { listMemoryEntries } from "../../memory/src/index.js";
import { providerCatalog } from "../../providers/src/index.js";
import {
  workModules,
  listAgentProfiles,
  listAgentRunLogs,
  listCommandWorkshopSessions,
  listDatabaseConnections,
  listWorkflowLibrary,
  listWritingBooks,
  listMcpServers,
  listSkillDefinitions,
  listTasks,
  listWeeklyProgress
} from "../../workbench/src/index.js";
import type { WorkbenchSnapshot } from "../../shared/src/index.js";

import { createGordonBlueprint } from "./blueprint.js";

export async function buildWorkbenchSnapshot(): Promise<WorkbenchSnapshot> {
  const [
    references,
    experience,
    tasks,
    weeklyProgress,
    databaseConnections,
    workflowLibrary,
    writingBooks,
    skillDefinitions,
    mcpServers,
    agentProfiles,
    agentRunLogs,
    commandWorkshopSessions
  ] =
    await Promise.all([
      listMemoryEntries("references"),
      listMemoryEntries("experience"),
      listTasks(),
      listWeeklyProgress(),
      listDatabaseConnections(),
      listWorkflowLibrary(),
      listWritingBooks(),
      listSkillDefinitions(),
      listMcpServers(),
      listAgentProfiles(),
      listAgentRunLogs(),
      listCommandWorkshopSessions()
    ]);

  return {
    blueprint: createGordonBlueprint(),
    providers: providerCatalog,
    modules: workModules,
    memory: {
      references,
      experience
    },
    tasks,
    weeklyProgress,
    databaseConnections,
    workflowLibrary,
    writingBooks,
    skillDefinitions,
    mcpServers,
    agentProfiles,
    agentRunLogs,
    commandWorkshopSessions
  };
}
