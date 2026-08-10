import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { WeeklyProgressRecord } from "../../shared/src/index.js";
import { listModelBalanceHistory, listWeeklyProgress, listWorkflowLibrary } from "./repository.js";

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(source: Date, days: number): Date {
  const next = new Date(source);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekRange(referenceDate = new Date()): { weekKey: string; startDate: string; endDate: string } {
  const date = new Date(referenceDate);
  date.setHours(0, 0, 0, 0);

  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = addDays(date, diffToMonday);
  const friday = addDays(monday, 4);

  return {
    weekKey: toDateKey(monday),
    startDate: toDateKey(monday),
    endDate: toDateKey(friday)
  };
}

test("listWeeklyProgress carries unfinished tasks into the new weekly report", async () => {
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "gordon-weekly-carry-"));

  process.env.GORDON_DATA_ROOT = dataRoot;

  try {
    const currentWeek = getWeekRange();
    const previousWeek = getWeekRange(addDays(new Date(`${currentWeek.weekKey}T00:00:00`), -7));
    const weeklyFilePath = path.join(dataRoot, "workbench", "weekly-progress.json");
    const timestamp = "2026-06-01T00:00:00.000Z";
    const previousRecord: WeeklyProgressRecord = {
      id: "weekly_previous",
      weekKey: previousWeek.weekKey,
      title: "上一周",
      startDate: previousWeek.startDate,
      endDate: previousWeek.endDate,
      content: "",
      projects: [
        {
          id: "weekly_project_previous",
          title: "项目 A",
          note: "",
          status: "in_progress",
          tasks: [
            {
              id: "weekly_task_planned",
              title: "待开始任务",
              detail: "",
              status: "planned",
              createdAt: timestamp,
              updatedAt: timestamp,
              children: []
            },
            {
              id: "weekly_task_testing",
              title: "测试中任务",
              detail: "",
              status: "testing",
              createdAt: timestamp,
              updatedAt: timestamp,
              children: []
            },
            {
              id: "weekly_task_completed",
              title: "已完成任务",
              detail: "",
              status: "completed",
              createdAt: timestamp,
              updatedAt: timestamp,
              children: []
            }
          ]
        }
      ],
      reportTemplates: [],
      selectedReportTemplateId: "",
      reportTemplate: "",
      generatedDailyReport: "",
      generatedReport: "",
      generatedPerformanceReport: "",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await mkdir(path.dirname(weeklyFilePath), { recursive: true });
    await writeFile(weeklyFilePath, `${JSON.stringify([previousRecord], null, 2)}\n`, "utf8");

    const records = await listWeeklyProgress();
    const currentRecord = records.find((record) => record.weekKey === currentWeek.weekKey);
    const archivedPreviousRecord = records.find((record) => record.weekKey === previousWeek.weekKey);

    assert.ok(currentRecord);
    assert.equal(archivedPreviousRecord?.status, "archived");
    assert.deepEqual(
      currentRecord.projects.flatMap((project) => project.tasks.map((task) => ({ title: task.title, status: task.status }))),
      [
        { title: "待开始任务", status: "planned" },
        { title: "测试中任务", status: "testing" }
      ]
    );
  } finally {
    if (previousDataRoot === undefined) {
      delete process.env.GORDON_DATA_ROOT;
    } else {
      process.env.GORDON_DATA_ROOT = previousDataRoot;
    }

    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("listWorkflowLibrary removes empty Yahoo finance candles from cached snapshots", async () => {
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "gordon-finance-candles-"));

  process.env.GORDON_DATA_ROOT = dataRoot;

  try {
    const workflowFilePath = path.join(dataRoot, "workbench", "workflow-library.json");
    const timestamp = "2026-07-13T02:07:00.000Z";

    await mkdir(path.dirname(workflowFilePath), { recursive: true });
    await writeFile(
      workflowFilePath,
      `${JSON.stringify(
        [
          {
            id: "workflow_finance_brief",
            kind: "finance-brief",
            title: "金融快报",
            summary: "",
            description: "",
            tags: [],
            status: "active",
            usageCount: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            records: [],
            financeBrief: {
              symbols: [
                {
                  id: "finance_symbol_gold_futures",
                  symbol: "GC=F",
                  displayName: "黄金期货",
                  assetKind: "commodity",
                  market: "COMEX",
                  currency: "USD",
                  provider: "yahoo",
                  notes: "",
                  sortOrder: 0,
                  updatedAt: timestamp
                }
              ],
              activeSymbolId: "finance_symbol_gold_futures",
              range: "1d",
              interval: "1m",
              updatedAt: timestamp,
              lastSnapshot: {
                symbolId: "finance_symbol_gold_futures",
                range: "1d",
                interval: "1m",
                fetchedAt: timestamp,
                sourceName: "Yahoo Finance",
                sourceUrl: "",
                quote: {
                  symbol: "GC=F",
                  displayName: "Gold Aug 26",
                  provider: "yahoo",
                  currency: "USD",
                  exchangeName: "COMEX",
                  regularMarketPrice: 0,
                  previousClose: 4070.9,
                  dayHigh: 4111.6,
                  dayLow: 0,
                  volume: null,
                  change: 0,
                  changePercent: 0,
                  fetchedAt: timestamp,
                  points: [
                    {
                      time: "2026-07-13T01:00:00.000Z",
                      open: 4050,
                      high: 4060,
                      low: null,
                      close: 4055
                    },
                    {
                      time: "2026-07-13T01:01:00.000Z",
                      open: 0,
                      high: 0,
                      low: 0,
                      close: 0
                    },
                    {
                      time: "2026-07-13T01:02:00.000Z",
                      open: 4056,
                      high: 4062,
                      low: 4052,
                      close: 4060
                    }
                  ]
                }
              }
            }
          }
        ],
        null,
        2
      )}\n`,
      "utf8"
    );

    const records = await listWorkflowLibrary();
    const financeBrief = records.find((record) => record.kind === "finance-brief")?.financeBrief;

    assert.ok(financeBrief?.lastSnapshot);
    assert.equal(financeBrief.lastSnapshot.quote.regularMarketPrice, null);
    assert.equal(financeBrief.lastSnapshot.quote.dayLow, null);
    assert.deepEqual(
      financeBrief.lastSnapshot.quote.points.map((point) => point.time),
      ["2026-07-13T01:02:00.000Z"]
    );
  } finally {
    if (previousDataRoot === undefined) {
      delete process.env.GORDON_DATA_ROOT;
    } else {
      process.env.GORDON_DATA_ROOT = previousDataRoot;
    }

    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("listModelBalanceHistory filters invalid quota snapshots", async () => {
  const previousDataRoot = process.env.GORDON_DATA_ROOT;
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "gordon-model-balance-history-"));

  process.env.GORDON_DATA_ROOT = dataRoot;

  try {
    const historyFilePath = path.join(dataRoot, "workbench", "model-balance-history.json");

    await mkdir(path.dirname(historyFilePath), { recursive: true });
    await writeFile(
      historyFilePath,
      `${JSON.stringify(
        [
          {
            id: "valid_after_quota_change",
            profileId: "model_test",
            profileName: "测试模型",
            provider: "openai_like",
            model: "gpt-test",
            snapshot: {
              remaining: 1606.236,
              used: 393.764,
              total: 2000,
              unit: "USD",
              queriedAt: "2026-07-30T12:31:59.439Z"
            },
            source: "manual",
            recordedAt: "2026-07-30T12:31:59.439Z",
            updatedAt: "2026-07-30T12:31:59.439Z"
          },
          {
            id: "invalid_negative_used",
            profileId: "model_test",
            profileName: "测试模型",
            provider: "openai_like",
            model: "gpt-test",
            snapshot: {
              remaining: 1606.236,
              used: -606.236,
              total: 1000,
              unit: "USD",
              queriedAt: "2026-07-30T12:31:24.053Z"
            },
            source: "manual",
            recordedAt: "2026-07-30T12:31:24.053Z",
            updatedAt: "2026-07-30T12:31:24.053Z"
          }
        ],
        null,
        2
      )}\n`,
      "utf8"
    );

    const history = await listModelBalanceHistory("model_test");

    assert.deepEqual(
      history.map((entry) => entry.id),
      ["valid_after_quota_change"]
    );
  } finally {
    if (previousDataRoot === undefined) {
      delete process.env.GORDON_DATA_ROOT;
    } else {
      process.env.GORDON_DATA_ROOT = previousDataRoot;
    }

    await rm(dataRoot, { recursive: true, force: true });
  }
});
