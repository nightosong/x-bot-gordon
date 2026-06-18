import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { WeeklyProgressRecord } from "../../shared/src/index.js";
import { listWeeklyProgress } from "./repository.js";

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

test("listWeeklyProgress carries planned tasks into the new weekly report", async () => {
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
      [{ title: "待开始任务", status: "planned" }]
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
