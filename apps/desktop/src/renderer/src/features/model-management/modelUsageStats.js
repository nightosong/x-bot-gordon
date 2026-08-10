const MODEL_USAGE_DAILY_WINDOW_DAYS = 30;
const MODEL_USAGE_DAY_START_HOUR = 1;
const MODEL_USAGE_VALUE_EPSILON = 1e-6;

export function formatBalanceNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "--";
}

export function formatOptionalBalanceNumber(value) {
  return value == null ? "--" : formatBalanceNumber(value);
}

export function getModelUsageLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getModelUsageDayStart(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (date.getHours() < MODEL_USAGE_DAY_START_HOUR) {
    date.setDate(date.getDate() - 1);
  }

  date.setHours(MODEL_USAGE_DAY_START_HOUR, 0, 0, 0);
  return date;
}

export function formatModelUsageDayLabel(date) {
  return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
}

function isValidModelUsageSnapshotPoint(point) {
  if (point.used < -MODEL_USAGE_VALUE_EPSILON) {
    return false;
  }

  if (point.total != null && point.total < -MODEL_USAGE_VALUE_EPSILON) {
    return false;
  }

  return !(point.total != null && point.remaining != null && point.remaining - point.total > MODEL_USAGE_VALUE_EPSILON);
}

export function toUsageSnapshotPoint(entry) {
  const queriedAt = new Date(entry?.snapshot?.queriedAt ?? entry?.recordedAt ?? "");
  const used = Number(entry?.snapshot?.used);
  const remaining = Number(entry?.snapshot?.remaining);
  const total = Number(entry?.snapshot?.total);
  const point = {
    queriedAt,
    used,
    remaining: Number.isFinite(remaining) ? remaining : null,
    total: Number.isFinite(total) ? total : null,
    unit: String(entry?.snapshot?.unit ?? "USD").trim() || "USD"
  };

  if (Number.isNaN(queriedAt.getTime()) || !Number.isFinite(used) || !isValidModelUsageSnapshotPoint(point)) {
    return null;
  }

  return {
    ...point,
    used: Math.abs(point.used) <= MODEL_USAGE_VALUE_EPSILON ? 0 : point.used
  };
}

export function buildModelUsageDayWindows(dayCount, referenceDate = new Date()) {
  const currentDayStart = getModelUsageDayStart(referenceDate);

  return Array.from({ length: dayCount }, (_item, index) => {
    const start = new Date(currentDayStart);
    start.setDate(currentDayStart.getDate() - (dayCount - index - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    return {
      dateKey: getModelUsageLocalDateKey(start),
      start,
      end,
      label: formatModelUsageDayLabel(start),
      shortLabel: String(start.getDate()).padStart(2, "0")
    };
  });
}

export function buildModelUsageDailySeries(
  entries,
  dayCount = MODEL_USAGE_DAILY_WINDOW_DAYS,
  referenceDate = new Date()
) {
  const points = (Array.isArray(entries) ? entries : [])
    .map(toUsageSnapshotPoint)
    .filter(Boolean)
    .sort((left, right) => left.queriedAt.getTime() - right.queriedAt.getTime());

  return buildModelUsageDayWindows(dayCount, referenceDate).map((day) => {
    const pointsBeforeDay = points.filter((point) => point.queriedAt < day.start);
    const pointsInDay = points.filter((point) => point.queriedAt >= day.start && point.queriedAt < day.end);
    const baseline = pointsBeforeDay[pointsBeforeDay.length - 1] ?? null;
    let previousUsed = baseline?.used ?? pointsInDay[0]?.used ?? null;
    let used = 0;

    pointsInDay.forEach((point) => {
      if (previousUsed == null) {
        previousUsed = point.used;
        return;
      }

      const delta = point.used - previousUsed;

      if (delta >= 0) {
        used += delta;
      } else {
        used += Math.max(0, point.used);
      }

      previousUsed = point.used;
    });

    const latestPoint = pointsInDay[pointsInDay.length - 1] ?? baseline;

    return {
      ...day,
      used,
      remaining: latestPoint?.remaining ?? null,
      total: latestPoint?.total ?? null,
      unit: latestPoint?.unit ?? "USD"
    };
  });
}

export function buildModelUsageSummary(days, entries) {
  const normalizedDays = Array.isArray(days) ? days : [];
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const totalUsed = normalizedDays.reduce((sum, day) => sum + Math.max(0, Number(day.used) || 0), 0);
  const maxUsed = normalizedDays.reduce((max, day) => Math.max(max, Number(day.used) || 0), 0);
  const latestEntry = normalizedEntries[normalizedEntries.length - 1] ?? null;
  const latestSnapshot = latestEntry?.snapshot ?? null;
  const unit = latestSnapshot?.unit ?? normalizedDays.find((day) => day.unit)?.unit ?? "USD";

  return {
    totalUsed,
    averageUsed: normalizedDays.length ? totalUsed / normalizedDays.length : 0,
    maxUsed,
    unit,
    latestUsageText: latestSnapshot
      ? `${formatBalanceNumber(latestSnapshot.used)} / ${formatBalanceNumber(latestSnapshot.remaining)}`
      : "-- / --"
  };
}
