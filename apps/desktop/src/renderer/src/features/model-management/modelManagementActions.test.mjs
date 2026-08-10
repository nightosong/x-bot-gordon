import assert from "node:assert/strict";
import test from "node:test";

import { buildModelUsageDailySeries, toUsageSnapshotPoint } from "./modelUsageStats.js";

function historyEntry(queriedAt, used, remaining, total) {
  return {
    snapshot: {
      queriedAt,
      used,
      remaining,
      total,
      unit: "USD"
    },
    recordedAt: queriedAt
  };
}

test("toUsageSnapshotPoint ignores stale quota snapshots", () => {
  assert.equal(toUsageSnapshotPoint(historyEntry("2026-07-30T12:31:24.053Z", -606.236, 1606.236, 1000)), null);
  assert.equal(toUsageSnapshotPoint(historyEntry("2026-07-30T12:31:24.053Z", 393.764, 1606.236, 1000)), null);
});

test("buildModelUsageDailySeries skips stale quota snapshots during quota increase", () => {
  const entries = [
    historyEntry("2026-07-29T11:15:49.427Z", 351.533, 648.467, 1000),
    historyEntry("2026-07-29T21:35:25.905Z", 354.455, 645.545, 1000),
    historyEntry("2026-07-30T11:48:26.255Z", 393.492, 606.508, 1000),
    historyEntry("2026-07-30T12:31:24.053Z", -606.236, 1606.236, 1000),
    historyEntry("2026-07-30T12:31:59.439Z", 393.764, 1606.236, 2000),
    historyEntry("2026-07-30T15:11:17.166Z", 395.22, 1604.78, 2000)
  ];
  const series = buildModelUsageDailySeries(entries, 2, new Date("2026-07-31T08:00:00+08:00"));
  const july30 = series.find((day) => day.dateKey === "2026-07-30");

  assert.ok(july30);
  assert.equal(Number(july30.used.toFixed(3)), 43.687);
});
