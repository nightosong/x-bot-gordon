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

test("comic_create_project persists source metadata and initial novel chapters", async () => {
  await withTempGordonHome(async () => {
    const definitions = listApplicationToolDefinitions(APPLICATION_SERVER);
    assert.ok(definitions.some((definition) => definition.name === "comic_create_project"));

    const createResult = await callApplicationTool(APPLICATION_SERVER, {
      serverId: APPLICATION_SERVER.id,
      toolName: "comic_create_project",
      arguments: {
        title: "霜刃江湖漫画版",
        format: "serial",
        genre: "高武奇幻",
        summary: "把原小说转换为连载漫画项目。",
        visualStyle: "统一为东方奇幻高武彩绘，固定人物造型和场景光影。",
        episodePlan: "先导入正文，再每 10 章提取素材，逐章拆分分镜。",
        source: {
          sourceType: "web",
          sourceUrl: "https://example.test/book/1/",
          sourceTitle: "霜刃江湖",
          chapterCount: 2,
          extractionStatus: "partial"
        },
        chapters: [
          {
            index: 1,
            title: "雪夜入山",
            summary: "主角雪夜入山，遭遇第一场江湖追杀。",
            content: "雪落山门，刀光从林间亮起。",
            sourceRefs: [
              {
                sourceType: "chapter",
                sourceUrl: "https://example.test/book/1/1.html",
                chapterIndex: 1,
                chapterTitle: "雪夜入山"
              }
            ]
          },
          {
            index: 2,
            title: "旧剑出鞘",
            summary: "主角得到旧剑，第一次看见高武世界的尺度。",
            content: "剑匣开时，满城灯火都像被霜压低。",
            sourceRefs: [
              {
                sourceType: "chapter",
                sourceUrl: "https://example.test/book/1/2.html",
                chapterIndex: 2,
                chapterTitle: "旧剑出鞘"
              }
            ]
          }
        ],
        dryRun: false
      }
    });

    assert.equal(createResult.isError, false);
    assert.equal(createResult.structuredContent?.applied, true);
    assert.equal(createResult.structuredContent?.resourceType, "project");

    const savedProject = createResult.structuredContent?.savedProject as
      | { chapterCount?: number; source?: { sourceUrl?: string; sourceTitle?: string; extractionStatus?: string } }
      | undefined;
    assert.equal(savedProject?.chapterCount, 2);
    assert.equal(savedProject?.source?.sourceUrl, "https://example.test/book/1/");
    assert.equal(savedProject?.source?.sourceTitle, "霜刃江湖");
    assert.equal(savedProject?.source?.extractionStatus, "partial");

    const readResult = await callApplicationTool(APPLICATION_SERVER, {
      serverId: APPLICATION_SERVER.id,
      toolName: "comic_read_project",
      arguments: {
        projectIdOrTitle: "霜刃江湖漫画版",
        chapterIndex: 1,
        includeAssets: false,
        includeImages: false
      }
    });
    const project = readResult.structuredContent?.project as
      | { chapterCount?: number; selectedChapters?: Array<{ title?: string; content?: string; sourceRefs?: Array<{ sourceUrl?: string }> }> }
      | undefined;

    assert.equal(project?.chapterCount, 2);
    assert.equal(project?.selectedChapters?.[0]?.title, "雪夜入山");
    assert.match(project?.selectedChapters?.[0]?.content ?? "", /雪落山门/u);
    assert.equal(project?.selectedChapters?.[0]?.sourceRefs?.[0]?.sourceUrl, "https://example.test/book/1/1.html");
  });
});

test("comic_import_chapters batch upserts chapter content and asset variants survive", async () => {
  await withTempGordonHome(async () => {
    await upsertComicProject({
      ...createTestComicProject(),
      assets: [
        {
          id: "comic_asset_hero",
          name: "刀梦",
          type: "character",
          description: "少年刀客。",
          prompt: "黑发少年刀客，冷色外袍。",
          variantLabel: "初始形象",
          chapterStartIndex: 1,
          chapterEndIndex: 10,
          views: [{ id: "comic_asset_view_hero", kind: "turnaround", label: "三视图", src: "", prompt: "初始三视图" }],
          variants: [
            {
              id: "comic_asset_variant_battle",
              label: "夜战装",
              chapterStartIndex: 11,
              chapterEndIndex: 20,
              description: "披深色斗篷，刀鞘有裂纹。",
              prompt: "夜战装三视图",
              views: [{ id: "comic_asset_view_battle", kind: "turnaround", label: "三视图", src: "", prompt: "夜战装" }],
              updatedAt: "2026-06-01T00:00:00.000Z"
            }
          ],
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    });

    const definitions = listApplicationToolDefinitions(APPLICATION_SERVER);
    assert.ok(definitions.some((definition) => definition.name === "comic_import_chapters"));

    const importResult = await callApplicationTool(APPLICATION_SERVER, {
      serverId: APPLICATION_SERVER.id,
      toolName: "comic_import_chapters",
      arguments: {
        projectIdOrTitle: "寂寞青梅",
        mode: "upsert",
        source: {
          sourceType: "web",
          sourceUrl: "https://example.test/book/2/",
          sourceTitle: "寂寞青梅原文",
          chapterCount: 3,
          extractionStatus: "partial"
        },
        chapters: [
          {
            index: 1,
            title: "青梅旧影",
            summary: "更新后的第一章简介。",
            content: "第一章正文已从线上小说导入。",
            sourceRefs: [{ sourceType: "chapter", sourceUrl: "https://example.test/book/2/1.html", chapterIndex: 1 }]
          },
          {
            index: 2,
            title: "青城山下",
            summary: "新增第二章简介。",
            content: "第二章正文已从线上小说导入。"
          },
          {
            index: 3,
            title: "夜雨试刀",
            summary: "新增第三章简介。",
            content: "第三章正文已从线上小说导入。"
          }
        ],
        dryRun: false
      }
    });

    assert.equal(importResult.isError, false);
    assert.equal(importResult.structuredContent?.applied, true);
    const stats = importResult.structuredContent?.stats as { createdCount?: number; updatedCount?: number } | undefined;
    assert.equal(stats?.createdCount, 2);
    assert.equal(stats?.updatedCount, 1);

    const readResult = await callApplicationTool(APPLICATION_SERVER, {
      serverId: APPLICATION_SERVER.id,
      toolName: "comic_read_project",
      arguments: {
        projectIdOrTitle: "寂寞青梅",
        chapterIndex: 1,
        includeAssets: true,
        includeImages: false
      }
    });
    const project = readResult.structuredContent?.project as
      | {
          chapterCount?: number;
          assetCount?: number;
          source?: { sourceTitle?: string; chapterCount?: number };
          assets?: Array<{
            name?: string;
            variantLabel?: string;
            variants?: Array<{ label?: string }>;
            chapterStartIndex?: number;
            chapterEndIndex?: number;
          }>;
          selectedChapters?: Array<{ content?: string; sourceRefs?: Array<{ sourceUrl?: string }> }>;
        }
      | undefined;

    assert.equal(project?.chapterCount, 3);
    assert.equal(project?.source?.sourceTitle, "寂寞青梅原文");
    assert.equal(project?.source?.chapterCount, 3);
    assert.match(project?.selectedChapters?.[0]?.content ?? "", /第一章正文/u);
    assert.equal(project?.selectedChapters?.[0]?.sourceRefs?.[0]?.sourceUrl, "https://example.test/book/2/1.html");
    assert.equal(project?.assets?.[0]?.variantLabel, "初始形象");
    assert.equal(project?.assets?.[0]?.chapterStartIndex, 1);
    assert.equal(project?.assets?.[0]?.chapterEndIndex, 10);
    assert.equal(project?.assets?.[0]?.variants?.length, 1);
  });
});
