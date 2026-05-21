import { spawn } from "node:child_process";
import readline from "node:readline";

const SEARCH_TIMEOUT_MS = 12_000;
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_MAX_BYTES = 2 * 1024 * 1024;
const PAGE_TEXT_MAX_CHARS = 18_000;
const SEARCH_LIMIT = 8;
const RESEARCH_SEARCH_LIMIT = 12;
const RESEARCH_PAGE_LIMIT = 4;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const API_PROVIDER_ORDER = ["tavily", "brave", "serper", "searxng"];
const HTML_PROVIDER_ORDER = ["bing", "baidu", "google"];
const SEARCH_PROVIDERS = new Set(["auto", ...API_PROVIDER_ORDER, ...HTML_PROVIDER_ORDER]);
const TIME_RANGE_VALUES = new Set(["day", "week", "month", "year"]);
const DOCUMENTATION_HINTS = [
  "api",
  "docs",
  "documentation",
  "developer",
  "developers",
  "reference",
  "guide",
  "guides",
  "learn",
  "manual",
  "model",
  "models",
  "sdk"
];

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function ok(id, result) {
  send({
    jsonrpc: "2.0",
    id,
    result
  });
}

function fail(id, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message
    }
  });
}

function buildTextResult(text, structuredContent = undefined) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ],
    ...(structuredContent ? { structuredContent } : {})
  };
}

function clampInteger(value, defaultValue, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function getString(value) {
  return String(value ?? "").trim();
}

function normalizeLanguage(value, fallback = "zh-CN") {
  const rawValue = getString(value);
  if (!rawValue) {
    return fallback;
  }

  const normalized = rawValue.replace("_", "-");
  const [language, country] = normalized.split("-");
  if (!country) {
    return language.toLowerCase();
  }

  return `${language.toLowerCase()}-${country.toUpperCase()}`;
}

function normalizeCountry(value, language = "") {
  const rawValue = getString(value);
  if (rawValue) {
    return rawValue.toUpperCase();
  }

  const countryFromLanguage = getString(language).split("-")[1];
  if (countryFromLanguage) {
    return countryFromLanguage.toUpperCase();
  }

  return getString(language).toLowerCase().startsWith("en") ? "US" : "CN";
}

function buildSearchLocale(options = {}) {
  const language = normalizeLanguage(options.language);
  const country = normalizeCountry(options.country, language);
  const languagePart = language.split("-")[0] || "zh";
  const market = language.includes("-") ? language : `${languagePart}-${country}`;

  return {
    language,
    languagePart,
    country,
    countryLower: country.toLowerCase(),
    market
  };
}

function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_match, code) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
      const value = Number.parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(text) {
  return decodeHtmlEntities(String(text || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function truncateByChars(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) {
    return {
      text: value,
      truncated: false
    };
  }
  return {
    text: value.slice(0, maxChars),
    truncated: true
  };
}

function truncateByBytes(text, maxBytes) {
  const buffer = Buffer.from(String(text || ""), "utf8");
  if (buffer.byteLength <= maxBytes) {
    return String(text || "");
  }
  return buffer.subarray(0, maxBytes).toString("utf8");
}

async function readResponseTextWithLimit(response, maxBytes) {
  if (!response.body?.getReader) {
    return truncateByBytes(await response.text(), maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytesRead += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (bytesRead >= maxBytes) {
      break;
    }
  }

  text += decoder.decode();
  try {
    await reader.cancel();
  } catch {
    // ignore cancel failures
  }
  return truncateByBytes(text, maxBytes);
}

async function fetchTextWithFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = clampInteger(options.timeoutMs, FETCH_TIMEOUT_MS, 1_000, 60_000);
  const maxBytes = clampInteger(options.maxBytes, FETCH_MAX_BYTES, 16 * 1024, FETCH_MAX_BYTES);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,text/xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        ...(options.headers ?? {})
      },
      body: options.body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await readResponseTextWithLimit(response, maxBytes);
  } finally {
    clearTimeout(timeout);
  }
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timeoutMs = clampInteger(options.timeoutMs, FETCH_TIMEOUT_MS, 1_000, 60_000);
    const maxOutputBytes = clampInteger(options.maxOutputBytes, FETCH_MAX_BYTES, 16 * 1024, FETCH_MAX_BYTES);
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      child.kill("SIGTERM");
      settled = true;
      resolve({
        exitCode: null,
        stdout,
        stderr: stderr || `命令超时（${timeoutMs}ms）`
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= maxOutputBytes) {
        stdout += chunk.toString("utf8");
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxOutputBytes) {
        stderr += chunk.toString("utf8");
      }
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      clearTimeout(timeout);
      settled = true;
      resolve({
        exitCode: null,
        stdout,
        stderr: error.message
      });
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }
      clearTimeout(timeout);
      settled = true;
      resolve({
        exitCode,
        stdout,
        stderr
      });
    });
  });
}

async function fetchTextWithCurl(url, options = {}) {
  const timeoutMs = clampInteger(options.timeoutMs, FETCH_TIMEOUT_MS, 1_000, 60_000);
  const maxBytes = clampInteger(options.maxBytes, FETCH_MAX_BYTES, 16 * 1024, FETCH_MAX_BYTES);
  const result = await runProcess(
    "curl",
    [
      "-L",
      "-sS",
      "--compressed",
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      "-A",
      USER_AGENT,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml,text/xml,application/json;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: zh-CN,zh;q=0.9,en;q=0.7",
      url
    ],
    {
      timeoutMs,
      maxOutputBytes: maxBytes
    }
  );

  if (result.exitCode === 0 && result.stdout.trim()) {
    return result.stdout;
  }

  throw new Error(result.stderr.trim() || `curl exit ${result.exitCode ?? "unknown"}`);
}

async function fetchText(url, options = {}) {
  try {
    return await fetchTextWithFetch(url, options);
  } catch (fetchError) {
    if (options.method && options.method !== "GET") {
      throw fetchError;
    }
    try {
      return await fetchTextWithCurl(url, options);
    } catch (curlError) {
      throw new Error(
        `fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}; curl failed: ${
          curlError instanceof Error ? curlError.message : String(curlError)
        }`
      );
    }
  }
}

function normalizeHttpUrl(value, label = "url") {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) {
    throw new Error(`${label} 不能为空`);
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} 必须是有效 URL`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} 仅支持 http 或 https`);
  }

  return parsed.toString();
}

function safeDecodeUrl(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSearchUrl(url) {
  const trimmed = safeDecodeUrl(String(url || "").trim());

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/url?")) {
    try {
      const parsed = new URL(trimmed, "https://www.google.com");
      return parsed.searchParams.get("q") || trimmed;
    } catch {
      return trimmed;
    }
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return "";
  }

  return trimmed;
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./u, "");
  } catch {
    return "";
  }
}

function canonicalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|spm|from|ref|fbclid|gclid)/iu.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return normalizeSearchUrl(url);
  }
}

function resultMatchesDomainFilters(url, includeDomains = [], excludeDomains = []) {
  const hostname = getHostname(url);
  if (!hostname) {
    return false;
  }

  if (includeDomains.length && !includeDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return false;
  }

  if (excludeDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return false;
  }

  return true;
}

function normalizeDomainFilters(values) {
  return toStringArray(values)
    .map((value) => value.replace(/^https?:\/\//iu, "").replace(/^www\./iu, "").split("/")[0].trim().toLowerCase())
    .filter(Boolean);
}

function normalizeSearchResult(candidate, provider, query) {
  const title = stripHtml(candidate?.title || candidate?.name || "");
  const url = canonicalizeUrl(normalizeSearchUrl(candidate?.url || candidate?.link || candidate?.href || ""));
  const snippet = stripHtml(candidate?.snippet || candidate?.description || candidate?.content || "");
  const publishedAt = getString(candidate?.publishedAt || candidate?.date || candidate?.age || "");

  if (!title || !url) {
    return null;
  }

  return {
    title,
    url,
    snippet,
    provider,
    query,
    domain: getHostname(url),
    publishedAt,
    score: 0
  };
}

function pushSearchResult(results, seenUrls, candidate, limit) {
  if (!candidate?.title || !candidate?.url || seenUrls.has(candidate.url)) {
    return;
  }
  seenUrls.add(candidate.url);
  results.push(candidate);
  if (results.length > limit) {
    results.length = limit;
  }
}

function extractRssResults(xml, provider, query, limit = SEARCH_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const itemPattern = /<item\b[\s\S]*?<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) && results.length < limit) {
    const item = match[0];
    const result = normalizeSearchResult(
      {
        title: decodeHtmlEntities(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""),
        url: decodeHtmlEntities(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || ""),
        snippet: decodeHtmlEntities(item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || ""),
        publishedAt: decodeHtmlEntities(item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || "")
      },
      provider,
      query
    );
    pushSearchResult(results, seenUrls, result, limit);
  }

  return results;
}

function extractGoogleResults(html, provider, query, limit = SEARCH_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const blockPattern = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/gi;
  let match;

  while ((match = blockPattern.exec(html)) && results.length < limit) {
    const url = normalizeSearchUrl(match[1]);

    if (!url || url.includes("google.") || url.startsWith("#")) {
      continue;
    }

    const afterBlock = html.slice(match.index + match[0].length, match.index + match[0].length + 900);
    const snippet = afterBlock.match(/<div[^>]*>([\s\S]{0,420}?)<\/div>/i)?.[1] || "";
    pushSearchResult(results, seenUrls, normalizeSearchResult({ title: match[2], url, snippet }, provider, query), limit);
  }

  return results;
}

function extractBingResults(html, provider, query, limit = SEARCH_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const pattern =
    /<li[^>]*class="[^"]*\bb_algo\b[^"]*"[\s\S]*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  let match;

  while ((match = pattern.exec(html)) && results.length < limit) {
    pushSearchResult(results, seenUrls, normalizeSearchResult({ title: match[2], url: match[1], snippet: match[3] || "" }, provider, query), limit);
  }

  return results;
}

function extractBaiduResults(html, provider, query, limit = SEARCH_LIMIT) {
  const results = [];
  const seenUrls = new Set();
  const blockPattern = /<div[^>]+(?:class|tpl)="[^"]*(?:result|c-container)[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi;
  let match;

  while ((match = blockPattern.exec(html)) && results.length < limit) {
    const block = match[0];
    const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i);

    if (!titleMatch) {
      continue;
    }

    const snippet =
      block.match(/<(?:span|div)[^>]+class="[^"]*(?:c-abstract|content-right|content-left|result-desc)[^"]*"[^>]*>([\s\S]{0,700}?)<\/(?:span|div)>/i)?.[1] ||
      block.match(/<div[^>]+class="[^"]*c-span-last[^"]*"[^>]*>([\s\S]{0,700}?)<\/div>/i)?.[1] ||
      "";
    pushSearchResult(results, seenUrls, normalizeSearchResult({ title: titleMatch[2], url: titleMatch[1], snippet }, provider, query), limit);
  }

  if (results.length) {
    return results;
  }

  const fallbackPattern = /<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/gi;

  while ((match = fallbackPattern.exec(html)) && results.length < limit) {
    pushSearchResult(results, seenUrls, normalizeSearchResult({ title: match[2], url: match[1], snippet: "" }, provider, query), limit);
  }

  return results;
}

function buildHtmlSearchUrl(provider, query, options = {}) {
  const encodedQuery = encodeURIComponent(query);
  const timeRange = getString(options.timeRange);
  const locale = buildSearchLocale(options);

  if (provider === "bing-rss") {
    return `https://www.bing.com/search?q=${encodedQuery}&format=rss&setlang=${encodeURIComponent(locale.language)}&cc=${encodeURIComponent(locale.country)}&mkt=${encodeURIComponent(locale.market)}`;
  }

  if (provider === "bing") {
    return `https://www.bing.com/search?q=${encodedQuery}&setlang=${encodeURIComponent(locale.language)}&cc=${encodeURIComponent(locale.country)}&mkt=${encodeURIComponent(locale.market)}`;
  }

  if (provider === "baidu") {
    return `https://www.baidu.com/s?wd=${encodedQuery}&rn=10&ie=utf-8`;
  }

  const timeParam = timeRange === "day" ? "&tbs=qdr:d" : timeRange === "week" ? "&tbs=qdr:w" : timeRange === "month" ? "&tbs=qdr:m" : timeRange === "year" ? "&tbs=qdr:y" : "";
  return `https://www.google.com/search?hl=${encodeURIComponent(locale.language)}&gl=${encodeURIComponent(locale.countryLower)}&num=10&q=${encodedQuery}${timeParam}`;
}

async function searchHtmlProvider(provider, query, limit, options = {}) {
  const collectionLimit = Math.min(Math.max(limit, 10) * 2, 30);
  const attempts =
    provider === "bing"
      ? [
          { provider: "bing", mode: "rss", url: buildHtmlSearchUrl("bing-rss", query, options) },
          { provider: "bing", mode: "html", url: buildHtmlSearchUrl("bing", query, options) }
        ]
      : [{ provider, mode: "html", url: buildHtmlSearchUrl(provider, query, options) }];
  const errors = [];
  const combinedResults = [];
  const seenUrls = new Set();

  for (const attempt of attempts) {
    try {
      const payload = await fetchText(attempt.url, {
        timeoutMs: SEARCH_TIMEOUT_MS
      });
      const results =
        attempt.mode === "rss"
          ? extractRssResults(payload, attempt.provider, query, collectionLimit)
          : attempt.provider === "bing"
            ? extractBingResults(payload, attempt.provider, query, collectionLimit)
            : attempt.provider === "baidu"
              ? extractBaiduResults(payload, attempt.provider, query, collectionLimit)
              : extractGoogleResults(payload, attempt.provider, query, collectionLimit);

      for (const result of results) {
        pushSearchResult(combinedResults, seenUrls, result, collectionLimit);
      }

      if (combinedResults.length && (attempt.provider !== "bing" || attempt.mode !== "rss")) {
        return {
          provider: attempt.provider,
          sourceUrl: attempt.url,
          results: combinedResults,
          errors
        };
      }

      if (!results.length) {
        errors.push(`${attempt.provider}/${attempt.mode}: 未解析到结果`);
      }
    } catch (error) {
      errors.push(`${attempt.provider}/${attempt.mode}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    provider,
    sourceUrl: buildHtmlSearchUrl(provider, query, options),
    results: combinedResults,
    errors
  };
}

function buildProviderHeaders(provider, apiKey) {
  if (provider === "brave") {
    return {
      Accept: "application/json",
      "X-Subscription-Token": apiKey
    };
  }

  if (provider === "serper") {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-KEY": apiKey
    };
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

function getProviderApiKey(provider) {
  if (provider === "brave") {
    return getString(process.env.BRAVE_SEARCH_API_KEY);
  }
  if (provider === "tavily") {
    return getString(process.env.TAVILY_API_KEY);
  }
  if (provider === "serper") {
    return getString(process.env.SERPER_API_KEY);
  }
  return "";
}

function getProviderBaseUrl(provider) {
  if (provider === "searxng") {
    return getString(process.env.SEARXNG_BASE_URL);
  }
  return "";
}

function buildFreshness(provider, timeRange) {
  if (!TIME_RANGE_VALUES.has(timeRange)) {
    return "";
  }

  if (provider === "brave") {
    return {
      day: "pd",
      week: "pw",
      month: "pm",
      year: "py"
    }[timeRange];
  }

  if (provider === "tavily") {
    return timeRange;
  }

  return timeRange;
}

async function searchApiProvider(provider, query, limit, options = {}) {
  const timeRange = getString(options.timeRange);
  const freshness = buildFreshness(provider, timeRange);
  const locale = buildSearchLocale(options);

  if (provider === "brave") {
    const apiKey = getProviderApiKey(provider);
    if (!apiKey) {
      return { provider, sourceUrl: "", results: [], errors: ["brave: 缺少 BRAVE_SEARCH_API_KEY"] };
    }
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(limit, 20)));
    url.searchParams.set("country", locale.country);
    url.searchParams.set("search_lang", locale.language.toLowerCase());
    url.searchParams.set("safesearch", getString(options.safeSearch) || "moderate");
    if (freshness) {
      url.searchParams.set("freshness", freshness);
    }

    try {
      const payload = await fetchTextWithFetch(url.toString(), {
        headers: buildProviderHeaders(provider, apiKey),
        timeoutMs: SEARCH_TIMEOUT_MS
      });
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed?.web?.results) ? parsed.web.results : [];
      return {
        provider,
        sourceUrl: url.toString(),
        results: items
          .map((item) =>
            normalizeSearchResult(
              {
                title: item.title,
                url: item.url,
                snippet: item.description,
                publishedAt: item.age
              },
              provider,
              query
            )
          )
          .filter(Boolean)
          .slice(0, limit),
        errors: []
      };
    } catch (error) {
      return { provider, sourceUrl: url.toString(), results: [], errors: [`brave: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  if (provider === "tavily") {
    const apiKey = getProviderApiKey(provider);
    if (!apiKey) {
      return { provider, sourceUrl: "", results: [], errors: ["tavily: 缺少 TAVILY_API_KEY"] };
    }
    const body = {
      api_key: apiKey,
      query,
      search_depth: options.searchDepth === "basic" ? "basic" : "advanced",
      max_results: Math.min(limit, 20),
      include_answer: false,
      include_raw_content: false,
      ...(freshness ? { time_range: freshness } : {}),
      ...(options.includeDomains?.length ? { include_domains: options.includeDomains } : {}),
      ...(options.excludeDomains?.length ? { exclude_domains: options.excludeDomains } : {})
    };

    try {
      const payload = await fetchTextWithFetch("https://api.tavily.com/search", {
        method: "POST",
        headers: buildProviderHeaders(provider, apiKey),
        body: JSON.stringify(body),
        timeoutMs: SEARCH_TIMEOUT_MS
      });
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed?.results) ? parsed.results : [];
      return {
        provider,
        sourceUrl: "https://api.tavily.com/search",
        results: items
          .map((item) =>
            normalizeSearchResult(
              {
                title: item.title,
                url: item.url,
                snippet: item.content,
                publishedAt: item.published_date
              },
              provider,
              query
            )
          )
          .filter(Boolean)
          .slice(0, limit),
        errors: []
      };
    } catch (error) {
      return { provider, sourceUrl: "https://api.tavily.com/search", results: [], errors: [`tavily: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  if (provider === "serper") {
    const apiKey = getProviderApiKey(provider);
    if (!apiKey) {
      return { provider, sourceUrl: "", results: [], errors: ["serper: 缺少 SERPER_API_KEY"] };
    }
    const body = {
      q: query,
      num: Math.min(limit, 20),
      gl: locale.countryLower,
      hl: locale.languagePart
    };

    try {
      const payload = await fetchTextWithFetch("https://google.serper.dev/search", {
        method: "POST",
        headers: buildProviderHeaders(provider, apiKey),
        body: JSON.stringify(body),
        timeoutMs: SEARCH_TIMEOUT_MS
      });
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed?.organic) ? parsed.organic : [];
      return {
        provider,
        sourceUrl: "https://google.serper.dev/search",
        results: items
          .map((item) =>
            normalizeSearchResult(
              {
                title: item.title,
                url: item.link,
                snippet: item.snippet,
                publishedAt: item.date
              },
              provider,
              query
            )
          )
          .filter(Boolean)
          .slice(0, limit),
        errors: []
      };
    } catch (error) {
      return { provider, sourceUrl: "https://google.serper.dev/search", results: [], errors: [`serper: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  if (provider === "searxng") {
    const baseUrl = getProviderBaseUrl(provider);
    if (!baseUrl) {
      return { provider, sourceUrl: "", results: [], errors: ["searxng: 缺少 SEARXNG_BASE_URL"] };
    }
    const url = new URL("/search", baseUrl.replace(/\/+$/u, ""));
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", locale.language);
    url.searchParams.set("safesearch", getString(options.safeSearch) === "off" ? "0" : "1");
    if (freshness) {
      url.searchParams.set("time_range", freshness);
    }

    try {
      const payload = await fetchTextWithFetch(url.toString(), {
        timeoutMs: SEARCH_TIMEOUT_MS
      });
      const parsed = JSON.parse(payload);
      const items = Array.isArray(parsed?.results) ? parsed.results : [];
      return {
        provider,
        sourceUrl: url.toString(),
        results: items
          .map((item) =>
            normalizeSearchResult(
              {
                title: item.title,
                url: item.url,
                snippet: item.content,
                publishedAt: item.publishedDate
              },
              provider,
              query
            )
          )
          .filter(Boolean)
          .slice(0, limit),
        errors: []
      };
    } catch (error) {
      return { provider, sourceUrl: url.toString(), results: [], errors: [`searxng: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  return searchHtmlProvider(provider, query, limit, options);
}

function buildProviderOrder(requestedProvider) {
  if (requestedProvider && requestedProvider !== "auto") {
    return [requestedProvider];
  }

  return [
    ...API_PROVIDER_ORDER.filter((provider) => provider === "searxng" ? Boolean(getProviderBaseUrl(provider)) : Boolean(getProviderApiKey(provider))),
    ...HTML_PROVIDER_ORDER
  ];
}

function tokenizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bsite:[^\s]+/g, " ")
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !["the", "and", "for", "with", "official"].includes(token));
}

function isLikelyDocsQuery(query) {
  const text = String(query || "").toLowerCase();
  return DOCUMENTATION_HINTS.some((hint) => new RegExp(`\\b${hint}\\b`, "i").test(text));
}

function isHomepageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}

function buildDomainQueryVariants(query, options = {}) {
  if (/\bsite:/iu.test(query)) {
    return [];
  }

  const domains = uniqueStrings([
    ...normalizeDomainFilters(options.includeDomains),
    ...normalizeDomainFilters(options.preferredDomains)
  ]).slice(0, 4);
  if (!domains.length) {
    return [];
  }

  const docsQuery = isLikelyDocsQuery(query);
  const variants = [];

  for (const domain of domains) {
    variants.push(`site:${domain} ${query}`);
    if (docsQuery) {
      variants.push(`site:${domain} ${query} api docs reference`);
      variants.push(`site:${domain}/docs ${query}`);
    }
  }

  return uniqueStrings(variants);
}

function countPreferredDomainResults(results, options = {}) {
  const preferredDomains = uniqueStrings([
    ...normalizeDomainFilters(options.includeDomains),
    ...normalizeDomainFilters(options.preferredDomains)
  ]);
  if (!preferredDomains.length) {
    return results.length;
  }

  return results.filter((result) => preferredDomains.some((domain) => result.domain === domain || result.domain.endsWith(`.${domain}`))).length;
}

function scoreSearchResult(result, options = {}) {
  const domain = result.domain || getHostname(result.url);
  const url = String(result.url || "").toLowerCase();
  const title = String(result.title || "").toLowerCase();
  const snippet = String(result.snippet || "").toLowerCase();
  const query = String(result.query || options.query || "").toLowerCase();
  const preferredDomains = normalizeDomainFilters(options.preferredDomains);
  const officialHints = [...DOCUMENTATION_HINTS, "news", "blog", "press", "release"];
  const lowSignalDomains = ["zhihu.com", "reddit.com", "github.com", "medium.com", "csdn.net", "jianshu.com"];
  let score = 1;

  if (preferredDomains.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    score += 3;
  }

  if (officialHints.some((hint) => url.includes(`/${hint}`) || domain.includes(hint) || title.includes(hint))) {
    score += 1.2;
  }

  const queryTokens = tokenizeSearchText(query).slice(0, 8);
  const matchedTokens = queryTokens.filter((token) => url.includes(token) || title.includes(token) || snippet.includes(token));
  score += Math.min(1.2, matchedTokens.length * 0.2);

  if (isLikelyDocsQuery(query) && isHomepageUrl(result.url)) {
    score -= 1.1;
  }

  if (/\.gov$|\.edu$|\.org$/u.test(domain)) {
    score += 0.7;
  }

  if (result.provider === "tavily" || result.provider === "brave" || result.provider === "serper") {
    score += 0.5;
  }

  if (lowSignalDomains.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    score -= 0.7;
  }

  if (!result.snippet) {
    score -= 0.2;
  }

  return Number(score.toFixed(3));
}

function dedupeAndRankResults(results, options = {}) {
  const includeDomains = normalizeDomainFilters(options.includeDomains);
  const excludeDomains = normalizeDomainFilters(options.excludeDomains);
  const seenUrls = new Set();
  const output = [];

  for (const result of results) {
    if (!result?.url || seenUrls.has(result.url)) {
      continue;
    }
    if (!resultMatchesDomainFilters(result.url, includeDomains, excludeDomains)) {
      continue;
    }
    seenUrls.add(result.url);
    output.push({
      ...result,
      score: scoreSearchResult(result, options)
    });
  }

  return output.sort((left, right) => right.score - left.score);
}

async function searchSingleQueryAcrossProviders(argumentsObject, defaultLimit = SEARCH_LIMIT) {
  const query = getString(argumentsObject?.query);
  const provider = getString(argumentsObject?.provider || argumentsObject?.engine || "auto").toLowerCase();
  const limit = clampInteger(argumentsObject?.limit, defaultLimit, 1, 20);

  if (!query) {
    throw new Error("搜索需要提供 query");
  }
  if (!SEARCH_PROVIDERS.has(provider)) {
    throw new Error("provider 仅支持 auto、tavily、brave、serper、searxng、bing、baidu、google");
  }

  const options = {
    includeDomains: normalizeDomainFilters(argumentsObject?.includeDomains),
    excludeDomains: normalizeDomainFilters(argumentsObject?.excludeDomains),
    preferredDomains: normalizeDomainFilters(argumentsObject?.preferredDomains),
    timeRange: getString(argumentsObject?.timeRange),
    country: getString(argumentsObject?.country),
    language: getString(argumentsObject?.language),
    safeSearch: getString(argumentsObject?.safeSearch),
    searchDepth: getString(argumentsObject?.searchDepth)
  };
  const providerOrder = buildProviderOrder(provider);
  const attemptErrors = [];
  const allResults = [];
  const attemptedProviders = [];
  const wantsPreferredDomains = Boolean(options.includeDomains.length || options.preferredDomains.length);

  for (const providerName of providerOrder) {
    attemptedProviders.push(providerName);
    const result = await searchApiProvider(providerName, query, Math.max(limit, 10), options);
    attemptErrors.push(...(result.errors ?? []));
    allResults.push(...(result.results ?? []));

    if (provider !== "auto" && result.results?.length) {
      break;
    }

    const rankedResults = dedupeAndRankResults(allResults, { ...options, query });
    if (
      provider === "auto" &&
      rankedResults.length >= limit &&
      (!wantsPreferredDomains || countPreferredDomainResults(rankedResults, options) >= Math.min(3, limit))
    ) {
      break;
    }
  }

  const rankedResults = dedupeAndRankResults(allResults, { ...options, query }).slice(0, limit);

  return {
    query,
    queries: [query],
    provider,
    attemptedProviders,
    limit,
    results: rankedResults,
    errors: uniqueStrings(attemptErrors).slice(0, 20)
  };
}

async function searchAcrossProviders(argumentsObject, defaultLimit = SEARCH_LIMIT) {
  const query = getString(argumentsObject?.query);
  const limit = clampInteger(argumentsObject?.limit, defaultLimit, 1, 20);

  if (!query) {
    throw new Error("搜索需要提供 query");
  }

  const queryVariants = uniqueStrings([
    query,
    ...toStringArray(argumentsObject?.queries),
    ...buildDomainQueryVariants(query, argumentsObject)
  ]).slice(0, 8);
  const combinedResults = [];
  const attemptErrors = [];
  const attemptedProviders = new Set();

  for (const currentQuery of queryVariants) {
    const result = await searchSingleQueryAcrossProviders(
      {
        ...argumentsObject,
        query: currentQuery,
        queries: []
      },
      defaultLimit
    );

    result.attemptedProviders.forEach((provider) => attemptedProviders.add(provider));
    attemptErrors.push(...(result.errors ?? []));
    combinedResults.push(...(result.results ?? []));
  }

  const rankedResults = dedupeAndRankResults(combinedResults, {
    includeDomains: argumentsObject?.includeDomains,
    excludeDomains: argumentsObject?.excludeDomains,
    preferredDomains: argumentsObject?.preferredDomains,
    query
  }).slice(0, limit);

  return {
    query,
    queries: queryVariants,
    provider: getString(argumentsObject?.provider || argumentsObject?.engine || "auto").toLowerCase(),
    attemptedProviders: Array.from(attemptedProviders),
    limit,
    results: rankedResults,
    errors: uniqueStrings(attemptErrors).slice(0, 20)
  };
}

function formatSearchResultList(results) {
  if (!results.length) {
    return "未解析到可用搜索结果。";
  }

  return results
    .map((result, index) =>
      [
        `${index + 1}. ${result.title}`,
        result.url,
        result.snippet,
        `source=${result.provider}${result.domain ? ` / domain=${result.domain}` : ""} / score=${result.score}`
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

async function webSearchV2(argumentsObject) {
  const result = await searchAcrossProviders(argumentsObject, SEARCH_LIMIT);
  const text = [
    `query: ${result.query}`,
    result.queries?.length > 1 ? `queries: ${result.queries.join(" | ")}` : "",
    `providers: ${result.attemptedProviders.join(", ") || "none"}`,
    "",
    formatSearchResultList(result.results),
    result.errors.length ? "" : "",
    result.errors.length ? "errors:" : "",
    ...result.errors.map((error) => `- ${error}`)
  ]
    .filter((line) => line !== "")
    .join("\n");

  return buildTextResult(text, {
    ...result,
    count: result.results.length
  });
}

function getHtmlAttribute(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = String(tag || "").match(pattern);
  return decodeHtmlEntities(match?.[1] || match?.[2] || match?.[3] || "").trim();
}

function extractMetaContent(html, candidates) {
  const candidateSet = new Set(candidates.map((candidate) => candidate.toLowerCase()));
  const metaPattern = /<meta\b[^>]*>/gi;
  let match;

  while ((match = metaPattern.exec(html))) {
    const tag = match[0];
    const name = getHtmlAttribute(tag, "name").toLowerCase();
    const property = getHtmlAttribute(tag, "property").toLowerCase();

    if (candidateSet.has(name) || candidateSet.has(property)) {
      const content = getHtmlAttribute(tag, "content");
      if (content) {
        return stripHtml(content);
      }
    }
  }

  return "";
}

function extractPageTitle(html) {
  const ogTitle = extractMetaContent(html, ["og:title", "twitter:title"]);
  if (ogTitle) {
    return ogTitle;
  }
  return stripHtml(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function htmlToReadableText(html) {
  const withoutNoise = String(html || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutNoise
    .replace(/<(?:br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|header|footer|main|aside|nav|li|h[1-6]|tr|blockquote|pre)>/gi, "\n");

  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractPageLinks(html, sourceUrl, limit = 80) {
  const links = [];
  const seenUrls = new Set();
  const linkPattern = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) && links.length < limit) {
    const href = getHtmlAttribute(match[1], "href");
    if (!href || /^(?:javascript|mailto|tel):/i.test(href) || href.startsWith("#")) {
      continue;
    }

    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }

    if (!/^https?:\/\//i.test(absoluteUrl) || seenUrls.has(absoluteUrl)) {
      continue;
    }

    const text = stripHtml(match[2]).slice(0, 120);
    seenUrls.add(absoluteUrl);
    links.push({
      text,
      url: absoluteUrl
    });
  }

  return links;
}

async function readPageForResearch(url, maxChars = PAGE_TEXT_MAX_CHARS) {
  const sourceUrl = normalizeHttpUrl(url);
  const html = await fetchText(sourceUrl, {
    maxBytes: FETCH_MAX_BYTES,
    timeoutMs: FETCH_TIMEOUT_MS
  });
  const title = extractPageTitle(html);
  const description = extractMetaContent(html, ["description", "og:description", "twitter:description"]);
  const readableText = htmlToReadableText(html);
  const excerpt = truncateByChars(readableText, maxChars);
  const links = extractPageLinks(html, sourceUrl);

  return {
    url: sourceUrl,
    domain: getHostname(sourceUrl),
    title,
    description,
    text: excerpt.text,
    textTruncated: excerpt.truncated,
    links,
    bytesRead: Buffer.byteLength(html, "utf8")
  };
}

function buildResearchQueries(argumentsObject) {
  const baseQuery = getString(argumentsObject?.query);
  const userQueries = toStringArray(argumentsObject?.queries);

  return uniqueStrings([baseQuery, ...userQueries]).slice(0, 6);
}

function scoreDiscoveredLink(link, argumentsObject = {}) {
  const url = String(link?.url || "").toLowerCase();
  const text = String(link?.text || "").toLowerCase();
  const domain = getHostname(link?.url);
  const preferredDomains = uniqueStrings([
    ...normalizeDomainFilters(argumentsObject?.includeDomains),
    ...normalizeDomainFilters(argumentsObject?.preferredDomains)
  ]);
  const queryTokens = tokenizeSearchText(argumentsObject?.query).slice(0, 10);
  let score = 0;

  if (preferredDomains.some((item) => domain === item || domain.endsWith(`.${item}`))) {
    score += 3;
  }

  for (const hint of DOCUMENTATION_HINTS) {
    if (url.includes(hint) || text.includes(hint)) {
      score += 0.7;
    }
  }

  for (const token of queryTokens) {
    if (url.includes(token) || text.includes(token)) {
      score += 0.25;
    }
  }

  if (isHomepageUrl(link?.url)) {
    score -= 1;
  }

  return Number(score.toFixed(3));
}

function buildDiscoveredSourceQueueItems(page, argumentsObject = {}, seenUrls = new Set()) {
  return page.links
    .map((link) => ({
      title: link.text || link.url,
      url: canonicalizeUrl(link.url),
      snippet: `从 ${page.title || page.url} 页面发现的相关链接`,
      provider: "page-link",
      query: getString(argumentsObject?.query),
      domain: getHostname(link.url),
      publishedAt: "",
      score: scoreDiscoveredLink(link, argumentsObject),
      discoveredFrom: page.url
    }))
    .filter((item) => item.score >= 2 && item.url && !seenUrls.has(item.url))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

async function webResearch(argumentsObject) {
  const query = getString(argumentsObject?.query);
  if (!query) {
    throw new Error("web_research 需要提供 query");
  }

  const provider = getString(argumentsObject?.provider || argumentsObject?.engine || "auto").toLowerCase();
  const searchLimit = clampInteger(argumentsObject?.maxSearchResults ?? argumentsObject?.limit, RESEARCH_SEARCH_LIMIT, 3, 30);
  const pageLimit = clampInteger(argumentsObject?.maxPagesToRead, RESEARCH_PAGE_LIMIT, 0, 8);
  const pageMaxChars = clampInteger(argumentsObject?.pageMaxChars, PAGE_TEXT_MAX_CHARS, 2_000, 40_000);
  const queries = buildResearchQueries(argumentsObject);
  const searchErrors = [];
  const combinedResults = [];
  const searchedProviders = new Set();
  const executedQueries = new Set();

  for (const currentQuery of queries) {
    const searchResult = await searchAcrossProviders(
      {
        ...argumentsObject,
        query: currentQuery,
        queries: [],
        provider,
        limit: searchLimit
      },
      searchLimit
    );
    searchErrors.push(...searchResult.errors);
    searchResult.attemptedProviders.forEach((item) => searchedProviders.add(item));
    searchResult.queries?.forEach((item) => executedQueries.add(item));
    combinedResults.push(...searchResult.results);
  }

  const rankedResults = dedupeAndRankResults(combinedResults, {
    includeDomains: argumentsObject?.includeDomains,
    excludeDomains: argumentsObject?.excludeDomains,
    preferredDomains: argumentsObject?.preferredDomains,
    query
  }).slice(0, searchLimit);
  const pages = [];
  const pageErrors = [];
  const sourceQueue = [...rankedResults];
  const queuedUrls = new Set(sourceQueue.map((result) => result.url));
  const visitedUrls = new Set();

  for (let sourceIndex = 0; sourceIndex < sourceQueue.length && pages.length < pageLimit; sourceIndex += 1) {
    const result = sourceQueue[sourceIndex];
    if (!result?.url || visitedUrls.has(result.url)) {
      continue;
    }
    visitedUrls.add(result.url);

    try {
      const page = await readPageForResearch(result.url, pageMaxChars);
      pages.push({
        ...page,
        sourceTitle: result.title,
        sourceSnippet: result.snippet,
        searchProvider: result.provider,
        searchScore: result.score
      });
      for (const discoveredSource of buildDiscoveredSourceQueueItems(page, argumentsObject, queuedUrls).reverse()) {
        queuedUrls.add(discoveredSource.url);
        sourceQueue.splice(sourceIndex + 1, 0, discoveredSource);
      }
    } catch (error) {
      pageErrors.push(`${result.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const uniqueSearchErrors = uniqueStrings(searchErrors).slice(0, 30);
  const uniquePageErrors = uniqueStrings(pageErrors).slice(0, 30);
  const text = [
    `research query: ${query}`,
    `queries: ${Array.from(executedQueries).join(" | ") || queries.join(" | ")}`,
    `providers: ${Array.from(searchedProviders).join(", ") || "none"}`,
    "",
    "ranked sources:",
    formatSearchResultList(rankedResults),
    pages.length ? "" : "",
    pages.length ? "page excerpts:" : "",
    ...pages.map((page, index) =>
      [
        `[${index + 1}] ${page.title || page.sourceTitle || page.url}`,
        page.url,
        page.description ? `description: ${page.description}` : "",
        page.textTruncated ? `text: 前 ${pageMaxChars} 字符` : "text:",
        page.text || "未提取到可读正文"
      ]
        .filter(Boolean)
        .join("\n")
    ),
    uniqueSearchErrors.length || uniquePageErrors.length ? "" : "",
    uniqueSearchErrors.length || uniquePageErrors.length ? "warnings:" : "",
    ...uniqueSearchErrors.map((error) => `- search: ${error}`),
    ...uniquePageErrors.map((error) => `- page: ${error}`)
  ]
    .filter((line) => line !== "")
    .join("\n\n");

  return buildTextResult(text, {
    query,
    queries: Array.from(executedQueries).length ? Array.from(executedQueries) : queries,
    provider,
    attemptedProviders: Array.from(searchedProviders),
    rankedSources: rankedResults,
    pages,
    errors: {
      search: uniqueSearchErrors,
      pages: uniquePageErrors
    },
    counts: {
      sources: rankedResults.length,
      pages: pages.length
    }
  });
}

function buildGithubRepositoryQuery(argumentsObject) {
  const query = getString(argumentsObject?.query);
  const language = getString(argumentsObject?.language);
  const topic = getString(argumentsObject?.topic);
  const minStars = clampInteger(argumentsObject?.minStars, 0, 0, 1_000_000);
  const qualifiers = [];

  if (!query) {
    throw new Error("github_search_repositories 需要提供 query");
  }

  if (language && !/\blanguage:/iu.test(query)) {
    qualifiers.push(`language:${language}`);
  }
  if (topic && !/\btopic:/iu.test(query)) {
    qualifiers.push(`topic:${topic}`);
  }
  if (minStars > 0 && !/\bstars:/iu.test(query)) {
    qualifiers.push(`stars:>=${minStars}`);
  }

  return [query, ...qualifiers].join(" ");
}

async function githubSearchRepositories(argumentsObject) {
  const query = buildGithubRepositoryQuery(argumentsObject);
  const limit = clampInteger(argumentsObject?.limit, 10, 1, 20);
  const sort = ["stars", "updated", "forks", "best-match"].includes(getString(argumentsObject?.sort))
    ? getString(argumentsObject?.sort)
    : "stars";
  const order = getString(argumentsObject?.order).toLowerCase() === "asc" ? "asc" : "desc";
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  if (sort !== "best-match") {
    url.searchParams.set("sort", sort);
    url.searchParams.set("order", order);
  }
  url.searchParams.set("per_page", String(limit));

  const githubToken = getString(process.env.GITHUB_TOKEN);
  const payload = await fetchTextWithFetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {})
    },
    timeoutMs: SEARCH_TIMEOUT_MS
  });
  const parsed = JSON.parse(payload);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const repositories = items.slice(0, limit).map((item) => ({
    fullName: getString(item.full_name),
    url: getString(item.html_url),
    description: getString(item.description),
    stars: Number(item.stargazers_count || 0),
    forks: Number(item.forks_count || 0),
    openIssues: Number(item.open_issues_count || 0),
    language: getString(item.language),
    topics: Array.isArray(item.topics) ? item.topics.map((topic) => getString(topic)).filter(Boolean) : [],
    license: getString(item.license?.spdx_id || item.license?.name),
    updatedAt: getString(item.updated_at),
    pushedAt: getString(item.pushed_at)
  }));

  const text = [
    `github query: ${query}`,
    `sort: ${sort}${sort === "best-match" ? "" : ` ${order}`}`,
    "",
    repositories.length
      ? repositories
          .map((repo, index) =>
            [
              `${index + 1}. ${repo.fullName}`,
              repo.url,
              repo.description,
              `stars=${repo.stars} / forks=${repo.forks}${repo.language ? ` / language=${repo.language}` : ""}${repo.license ? ` / license=${repo.license}` : ""}`,
              repo.topics.length ? `topics=${repo.topics.slice(0, 8).join(", ")}` : "",
              repo.updatedAt ? `updated=${repo.updatedAt}` : ""
            ]
              .filter(Boolean)
              .join("\n")
          )
          .join("\n\n")
      : "未找到可用 GitHub 仓库结果。"
  ].join("\n");

  return buildTextResult(text, {
    query,
    sort,
    order,
    repositories,
    count: repositories.length,
    totalCount: Number(parsed?.total_count || 0),
    incompleteResults: Boolean(parsed?.incomplete_results)
  });
}

function getTools() {
  return [
    {
      name: "web_search_v2",
      description:
        "高质量联网搜索，优先使用已配置的 Tavily / Brave / Serper / SearXNG API，缺少 API Key 时回退到 Bing、Baidu、Google HTML/RSS；返回去重、评分后的标题、链接、摘要和结构化来源。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "搜索关键词" },
          provider: {
            type: "string",
            enum: ["auto", "tavily", "brave", "serper", "searxng", "bing", "baidu", "google"],
            description: "搜索来源，默认 auto；auto 优先 API provider，再回退到 HTML/RSS"
          },
          limit: { type: "integer", description: "最多返回结果数，1-20，默认 8" },
          timeRange: { type: "string", enum: ["day", "week", "month", "year"], description: "可选时间范围" },
          includeDomains: { type: "array", items: { type: "string" }, description: "只保留这些域名下的结果" },
          excludeDomains: { type: "array", items: { type: "string" }, description: "排除这些域名" },
          preferredDomains: { type: "array", items: { type: "string" }, description: "提高这些域名的排序权重" },
          language: { type: "string", description: "语言偏好，例如 zh-CN 或 en" },
          country: { type: "string", description: "国家/地区偏好，例如 CN 或 US" }
        }
      }
    },
    {
      name: "web_research",
      description:
        "复合联网研究：执行多查询、多 provider 搜索、去重评分、读取前几条落地页正文并返回证据包；适合最新事实、产品/技术调研、资料汇总和需要引用来源的问题。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "研究主题或问题" },
          queries: { type: "array", items: { type: "string" }, description: "可选补充查询词，工具会和主查询一起检索" },
          provider: {
            type: "string",
            enum: ["auto", "tavily", "brave", "serper", "searxng", "bing", "baidu", "google"],
            description: "搜索来源，默认 auto"
          },
          maxSearchResults: { type: "integer", description: "最多保留来源数，3-30，默认 12" },
          maxPagesToRead: { type: "integer", description: "读取前几个落地页正文，0-8，默认 4" },
          pageMaxChars: { type: "integer", description: "每个页面最多返回正文字符，2000-40000，默认 18000" },
          timeRange: { type: "string", enum: ["day", "week", "month", "year"], description: "可选时间范围" },
          includeDomains: { type: "array", items: { type: "string" }, description: "只保留这些域名下的结果" },
          excludeDomains: { type: "array", items: { type: "string" }, description: "排除这些域名" },
          preferredDomains: { type: "array", items: { type: "string" }, description: "提高这些域名的排序权重，如官方域名" },
          language: { type: "string", description: "语言偏好，例如 zh-CN 或 en" },
          country: { type: "string", description: "国家/地区偏好，例如 CN 或 US" }
        }
      }
    },
    {
      name: "github_search_repositories",
      description:
        "搜索 GitHub 开源仓库，适合查找优秀项目、技术参考实现、生态对比和可复用工具；返回仓库链接、简介、stars、forks、语言、topic、license 和更新时间。可选 GITHUB_TOKEN 提升 GitHub API 限额。",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "GitHub repository search 查询词，支持 GitHub qualifiers" },
          language: { type: "string", description: "可选语言限定，例如 TypeScript、Python、Go" },
          topic: { type: "string", description: "可选 topic 限定，例如 mcp、search、agent" },
          minStars: { type: "integer", description: "可选最低 stars 数" },
          limit: { type: "integer", description: "最多返回仓库数，1-20，默认 10" },
          sort: {
            type: "string",
            enum: ["stars", "updated", "forks", "best-match"],
            description: "排序方式，默认 stars"
          },
          order: { type: "string", enum: ["desc", "asc"], description: "排序方向，默认 desc" }
        }
      }
    }
  ];
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", async (line) => {
  if (!line.trim()) {
    return;
  }

  let request;
  try {
    request = JSON.parse(line);
  } catch (error) {
    fail(null, `JSON 解析失败：${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const id = request.id ?? null;
  const method = request.method;
  const params = request.params ?? {};

  try {
    if (method === "initialize") {
      ok(id, {
        protocolVersion: "2025-11-25",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "search-tools",
          version: "0.1.0"
        }
      });
      return;
    }

    if (method === "tools/list") {
      ok(id, {
        tools: getTools()
      });
      return;
    }

    if (method === "tools/call") {
      const toolName = getString(params?.name);
      const args = params?.arguments ?? {};

      if (toolName === "web_search_v2") {
        ok(id, await webSearchV2(args));
        return;
      }

      if (toolName === "web_research") {
        ok(id, await webResearch(args));
        return;
      }

      if (toolName === "github_search_repositories") {
        ok(id, await githubSearchRepositories(args));
        return;
      }

      throw new Error(`未知工具：${toolName}`);
    }

    ok(id, {});
  } catch (error) {
    fail(id, error instanceof Error ? error.message : String(error));
  }
});
