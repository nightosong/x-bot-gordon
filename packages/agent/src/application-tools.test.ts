import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { upsertComicProject } from "../../workbench/src/index.js";
import type { ComicProject, McpServerConfig } from "../../shared/src/index.js";

import { callApplicationTool, listApplicationToolDefinitions } from "./application-tools.js";

const APPLICATION_SERVER: McpServerConfig = {
  id: "builtin:mcp:application-tools",
  name: "Application Tools",
  description: "Read and write application assets",
  transport: "stdio",
  command: "application-tools",
  env: {},
  toolAllowlist: [],
  enabled: true,
  updatedAt: "2026-06-01T00:00:00.000Z"
};

async function withTempGordonHome<T>(run: () => Promise<T>): Promise<T> {
  const previousHome = process.env.GORDON_HOME;
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const tempHome = await mkdtemp(path.join(tmpdir(), "gordon-application-tools-"));

  try {
    process.env.GORDON_HOME = tempHome;
    process.env.GORDON_DATA_ROOT = path.join(tempHome, "data");
    await mkdir(path.join(tempHome, "data", "workbench"), { recursive: true });
    return await run();
  } finally {
    process.env.GORDON_HOME = previousHome;
    process.env.GORDON_DATA_ROOT = previousDataRoot;
    await rm(tempHome, { recursive: true, force: true });
  }
}

function createTestComicProject(): ComicProject {
  const now = "2026-06-01T00:00:00.000Z";

  return {
    id: "comic_project_test",
    title: "寂寞青梅",
    format: "serial",
    palette: "color",
    genre: "古风武侠",
    status: "新建",
    summary: "刀梦与小梅的青梅旧事。",
    visualStyle: "古风武侠彩绘分镜。",
    episodePlan: "四章首卷规划。",
    pageCount: 24,
    coverTone: "ink",
    coverUrl: "",
    coverPrompt: "",
    coverShouldShowTitle: true,
    assets: [],
    chapters: [
      {
        id: "comic_chapter_1",
        index: 1,
        title: "青梅旧影",
        summary: "第一章简介。",
        prompt: "",
        content: "",
        storyboards: [],
        images: [],
        status: "inProgress",
        assetRefs: [],
        updatedAt: now
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}

test("comic_create_chapter creates a persisted chapter entity and readback sees it", async () => {
  await withTempGordonHome(async () => {
    await upsertComicProject(createTestComicProject());

    const definitions = listApplicationToolDefinitions(APPLICATION_SERVER);
    assert.ok(definitions.some((definition) => definition.name === "comic_create_chapter"));

    const createResult = await callApplicationTool(APPLICATION_SERVER, {
      serverId: APPLICATION_SERVER.id,
      toolName: "comic_create_chapter",
      arguments: {
        projectIdOrTitle: "寂寞青梅",
        chapterIndex: 2,
        title: "青城山下",
        summary: "刀梦抵达青城山下，小梅旧信再现。",
        prompt: "拆成 24 页古风武侠彩绘分镜。",
        dryRun: false
      }
    });

    assert.equal(createResult.isError, false);
    assert.equal(createResult.structuredContent?.applied, true);
    assert.equal(createResult.structuredContent?.resourceType, "chapter");
    const savedProject = createResult.structuredContent?.savedProject as { chapterCount?: number } | undefined;
    assert.equal(savedProject?.chapterCount, 2);

    const readResult = await callApplicationTool(APPLICATION_SERVER, {
      serverId: APPLICATION_SERVER.id,
      toolName: "comic_read_project",
      arguments: {
        projectIdOrTitle: "寂寞青梅",
        chapterIndex: 2,
        includeAssets: false,
        includeImages: false
      }
    });
    const project = readResult.structuredContent?.project as { chapterCount?: number; selectedChapters?: Array<{ title?: string }> } | undefined;

    assert.equal(project?.chapterCount, 2);
    assert.equal(project?.selectedChapters?.[0]?.title, "青城山下");
  });
});
