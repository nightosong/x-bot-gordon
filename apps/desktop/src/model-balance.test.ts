import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBalanceSnapshot } from "./model-balance.js";

test("normalizeBalanceSnapshot derives usage from current total and remaining", () => {
  const snapshot = normalizeBalanceSnapshot({
    planName: "Maas 中台",
    remaining: 1606.236,
    total: 2000,
    unit: "USD"
  });

  assert.equal(snapshot.planName, "Maas 中台");
  assert.equal(snapshot.remaining, 1606.236);
  assert.equal(Number(snapshot.used.toFixed(3)), 393.764);
  assert.equal(snapshot.total, 2000);
});

test("normalizeBalanceSnapshot rejects stale total after quota increase", () => {
  assert.throws(
    () =>
      normalizeBalanceSnapshot({
        remaining: 1606.236,
        used: -606.236,
        total: 1000,
        unit: "USD"
      }),
    /used 不能为负数/u
  );

  assert.throws(
    () =>
      normalizeBalanceSnapshot({
        remaining: 1606.236,
        used: 393.764,
        total: 1000,
        unit: "USD"
      }),
    /remaining 不能大于 total/u
  );
});
