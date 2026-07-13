<template>
  <div
    class="workflow-finance-terminal-chart"
    :class="{
      'is-refreshing': isRefreshing,
      'is-fresh': freshPulse,
      'is-up': hoveredBarTone === 'is-up',
      'is-down': hoveredBarTone === 'is-down'
    }"
  >
    <div class="workflow-finance-chart-legend" aria-live="polite">
      <time>{{ hoveredTimeLabel }}</time>
      <span><small>开</small><strong>{{ formatNumber(hoveredBar?.open) }}</strong></span>
      <span><small>高</small><strong>{{ formatNumber(hoveredBar?.high) }}</strong></span>
      <span><small>低</small><strong>{{ formatNumber(hoveredBar?.low) }}</strong></span>
      <span><small>收</small><strong>{{ formatNumber(hoveredBar?.close) }}</strong></span>
      <span v-if="showVolume"><small>量</small><strong>{{ formatCompactNumber(hoveredBar?.volume) }}</strong></span>
    </div>

    <div ref="chartRootRef" class="workflow-finance-chart-host" aria-label="可缩放 K 线与成交量图"></div>

    <div v-if="showVolume" class="workflow-finance-volume-mark" aria-hidden="true">VOL</div>
    <div v-if="isRefreshing" class="workflow-finance-chart-refresh-sweep" aria-hidden="true"></div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart
} from "lightweight-charts";

const props = defineProps({
  rows: { type: Array, default: () => [] },
  snapshot: { type: Object, default: null },
  isRefreshing: { type: Boolean, default: false },
  showMa5: { type: Boolean, default: false },
  showMa20: { type: Boolean, default: false },
  showVolume: { type: Boolean, default: true },
  focused: { type: Boolean, default: false },
  formatNumber: { type: Function, required: true },
  formatCompactNumber: { type: Function, required: true }
});

const chartRootRef = ref(null);
const hoveredBar = ref(null);
const freshPulse = ref(false);
let chart = null;
let candleSeries = null;
let volumeSeries = null;
let ma5Series = null;
let ma20Series = null;
let rowByTimestamp = new Map();
let freshPulseTimer = 0;
let datasetKey = "";

const hoveredBarTone = computed(() => {
  const open = Number(hoveredBar.value?.open);
  const close = Number(hoveredBar.value?.close);

  if (!Number.isFinite(open) || !Number.isFinite(close)) {
    return "";
  }

  return close >= open ? "is-up" : "is-down";
});

const hoveredTimeLabel = computed(() => {
  const timestamp = Number(hoveredBar.value?.time);

  if (!Number.isFinite(timestamp)) {
    return "--";
  }

  return formatChartTimestamp(timestamp, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
});

function getSnapshotTimeZone() {
  const value = String(props.snapshot?.quote?.exchangeTimezoneName ?? "").trim();

  if (!value) {
    return undefined;
  }

  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return undefined;
  }
}

function toTimestampDate(timestamp) {
  const numericValue = Number(timestamp);

  if (Number.isFinite(numericValue)) {
    return new Date(numericValue * 1000);
  }

  return new Date(timestamp ?? "");
}

function formatChartTimestamp(timestamp, options) {
  const date = toTimestampDate(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    ...options,
    ...(getSnapshotTimeZone() ? { timeZone: getSnapshotTimeZone() } : {})
  }).format(date);
}

function formatTickMark(timestamp, tickMarkType) {
  if (tickMarkType === TickMarkType.Year) {
    return formatChartTimestamp(timestamp, { year: "numeric" });
  }

  if (tickMarkType === TickMarkType.Month) {
    return formatChartTimestamp(timestamp, { year: "2-digit", month: "2-digit" });
  }

  if (tickMarkType === TickMarkType.DayOfMonth) {
    return formatChartTimestamp(timestamp, { month: "2-digit", day: "2-digit" });
  }

  return formatChartTimestamp(timestamp, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
}

function getPricePrecision() {
  const latestPrice = Number(props.rows.at(-1)?.close ?? props.snapshot?.quote?.regularMarketPrice);

  if (!Number.isFinite(latestPrice)) {
    return 2;
  }

  if (Math.abs(latestPrice) < 1) {
    return 4;
  }

  return Math.abs(latestPrice) < 10 ? 3 : 2;
}

function normalizeChartRows() {
  const normalized = [];

  for (const row of props.rows) {
    const timestamp = Math.floor(new Date(row?.time ?? "").getTime() / 1000);
    const open = Number(row?.open);
    const high = Number(row?.high);
    const low = Number(row?.low);
    const close = Number(row?.close);
    const volume = Number(row?.volume);

    if (
      !Number.isFinite(timestamp) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const entry = {
      time: timestamp,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0
    };
    const previous = normalized.at(-1);

    if (previous?.time === timestamp) {
      normalized[normalized.length - 1] = entry;
    } else {
      normalized.push(entry);
    }
  }

  return normalized;
}

function buildMovingAverage(rows, period) {
  const result = [];
  let rollingTotal = 0;

  for (let index = 0; index < rows.length; index += 1) {
    rollingTotal += rows[index].close;

    if (index >= period) {
      rollingTotal -= rows[index - period].close;
    }

    if (index >= period - 1) {
      result.push({
        time: rows[index].time,
        value: rollingTotal / period
      });
    }
  }

  return result;
}

function applyChartOptions() {
  if (!chart || !candleSeries) {
    return;
  }

  const precision = getPricePrecision();

  chart.applyOptions({
    localization: {
      locale: "zh-CN",
      priceFormatter: (price) => props.formatNumber(price),
      timeFormatter: (time) => formatChartTimestamp(time, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      })
    },
    timeScale: {
      timeVisible: ["1m", "5m", "15m", "30m", "60m"].includes(String(props.snapshot?.interval ?? "")),
      tickMarkFormatter: formatTickMark
    }
  });
  candleSeries.applyOptions({
    priceFormat: {
      type: "price",
      precision,
      minMove: 10 ** -precision
    }
  });
}

function syncSeriesVisibility() {
  ma5Series?.applyOptions({ visible: props.showMa5 });
  ma20Series?.applyOptions({ visible: props.showMa20 });
  volumeSeries?.applyOptions({ visible: props.showVolume });
}

function pulseFreshData() {
  freshPulse.value = false;
  window.clearTimeout(freshPulseTimer);

  nextTick(() => {
    freshPulse.value = true;
    freshPulseTimer = window.setTimeout(() => {
      freshPulse.value = false;
    }, 720);
  });
}

function syncChartData(forceFit = false) {
  if (!chart || !candleSeries || !volumeSeries || !ma5Series || !ma20Series) {
    return;
  }

  const rows = normalizeChartRows();
  const nextDatasetKey = [
    props.snapshot?.quote?.symbol,
    props.snapshot?.range,
    props.snapshot?.interval
  ].join("|");
  const visibleRange = datasetKey === nextDatasetKey ? chart.timeScale().getVisibleLogicalRange() : null;

  rowByTimestamp = new Map(rows.map((row) => [row.time, row]));
  candleSeries.setData(rows.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  volumeSeries.setData(rows.map(({ time, volume, close, open }) => ({
    time,
    value: volume,
    color: close >= open ? "rgba(92, 225, 194, 0.42)" : "rgba(255, 126, 107, 0.38)"
  })));
  ma5Series.setData(buildMovingAverage(rows, 5));
  ma20Series.setData(buildMovingAverage(rows, 20));
  hoveredBar.value = rows.at(-1) ?? null;
  applyChartOptions();
  syncSeriesVisibility();

  if (forceFit || datasetKey !== nextDatasetKey || !visibleRange) {
    chart.timeScale().fitContent();
  } else {
    chart.timeScale().setVisibleLogicalRange(visibleRange);
  }

  datasetKey = nextDatasetKey;
  pulseFreshData();
}

function handleCrosshairMove(params) {
  const candle = candleSeries ? params.seriesData.get(candleSeries) : null;

  if (!candle || !params.time || !("open" in candle)) {
    hoveredBar.value = Array.from(rowByTimestamp.values()).at(-1) ?? null;
    return;
  }

  const source = rowByTimestamp.get(Number(params.time));
  hoveredBar.value = {
    time: Number(params.time),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    volume: Number(source?.volume ?? 0)
  };
}

function fitContent() {
  chart?.timeScale().fitContent();
}

function createTerminalChart() {
  if (!chartRootRef.value) {
    return;
  }

  chart = createChart(chartRootRef.value, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "#071019" },
      textColor: "rgba(214, 226, 230, 0.62)",
      fontSize: 11,
      fontFamily: '"SFMono-Regular", "JetBrains Mono", "Menlo", monospace',
      panes: {
        enableResize: false,
        separatorColor: "rgba(151, 182, 216, 0.1)",
        separatorHoverColor: "rgba(92, 225, 194, 0.18)"
      },
      attributionLogo: false
    },
    grid: {
      vertLines: { color: "rgba(151, 182, 216, 0.055)", style: LineStyle.Solid },
      horzLines: { color: "rgba(151, 182, 216, 0.065)", style: LineStyle.Solid }
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "rgba(245, 200, 107, 0.56)",
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: true,
        labelBackgroundColor: "#9b7a36"
      },
      horzLine: {
        color: "rgba(188, 248, 234, 0.42)",
        width: 1,
        style: LineStyle.Dashed,
        labelVisible: true,
        labelBackgroundColor: "#1c7669"
      }
    },
    rightPriceScale: {
      visible: true,
      borderVisible: true,
      borderColor: "rgba(151, 182, 216, 0.12)",
      textColor: "rgba(214, 226, 230, 0.68)",
      ticksVisible: false,
      scaleMargins: { top: 0.12, bottom: 0.08 }
    },
    timeScale: {
      rightOffset: 3,
      barSpacing: 5.5,
      minBarSpacing: 0.8,
      borderVisible: true,
      borderColor: "rgba(151, 182, 216, 0.12)",
      timeVisible: true,
      secondsVisible: false,
      ticksVisible: false,
      uniformDistribution: true,
      allowBoldLabels: false,
      rightBarStaysOnScroll: true,
      shiftVisibleRangeOnNewBar: true
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true
    }
  });

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#5ce1c2",
    downColor: "#ff7e6b",
    borderVisible: false,
    wickUpColor: "rgba(154, 246, 224, 0.88)",
    wickDownColor: "rgba(255, 165, 148, 0.88)",
    priceLineVisible: true,
    priceLineColor: "rgba(245, 200, 107, 0.72)",
    priceLineStyle: LineStyle.Dashed,
    lastValueVisible: true
  }, 0);
  ma5Series = chart.addSeries(LineSeries, {
    color: "rgba(245, 200, 107, 0.9)",
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  }, 0);
  ma20Series = chart.addSeries(LineSeries, {
    color: "rgba(118, 166, 255, 0.88)",
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false
  }, 0);
  volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: "volume" },
    priceLineVisible: false,
    lastValueVisible: false
  }, 1);

  candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.08 } });
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.18, bottom: 0 } });
  chart.panes()[0]?.setStretchFactor(0.78);
  chart.panes()[1]?.setStretchFactor(0.22);
  chart.subscribeCrosshairMove(handleCrosshairMove);
  chartRootRef.value.addEventListener("dblclick", fitContent);
  syncChartData(true);
}

onMounted(() => {
  createTerminalChart();
});

watch(
  () => props.rows,
  () => syncChartData(),
  { deep: false }
);

watch(
  () => [props.snapshot?.quote?.symbol, props.snapshot?.range, props.snapshot?.interval],
  () => syncChartData(true)
);

watch(
  () => [props.showMa5, props.showMa20, props.showVolume],
  syncSeriesVisibility
);

watch(
  () => props.focused,
  () => nextTick(() => chart?.timeScale().fitContent())
);

onBeforeUnmount(() => {
  window.clearTimeout(freshPulseTimer);

  if (chartRootRef.value) {
    chartRootRef.value.removeEventListener("dblclick", fitContent);
  }

  if (chart) {
    chart.unsubscribeCrosshairMove(handleCrosshairMove);
    chart.remove();
  }

  chart = null;
  candleSeries = null;
  volumeSeries = null;
  ma5Series = null;
  ma20Series = null;
});

defineExpose({ fitContent });
</script>
