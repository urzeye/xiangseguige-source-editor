import { ref, computed } from "vue";
import type { BookSource } from "@/lib/types";

export type CheckStatus = "pending" | "checking" | "ok" | "err" | "skip";

export interface CheckResult {
  key: string;
  name: string;
  sourceUrl: string;
  status: CheckStatus;
  detail: string;
  ms?: number;
}

// Parse @js: requestInfo and build search URL
function buildSearchUrl(
  raw: Record<string, unknown>,
  keyword: string,
): { url: string; method: "GET" | "POST" } | null {
  const sb = raw.searchBook as Record<string, unknown> | undefined;
  if (!sb?.requestInfo) return null;

  const code = String(sb.requestInfo).replace(/^@js:\s*/, "");
  const host = String(sb.host || raw.sourceUrl || "");
  const config = { host, httpHeaders: {} };
  const params = { keyWord: keyword };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("config", "params", code);
    const result = fn(config, params) as {
      url?: string;
      POST?: boolean;
      httpParams?: Record<string, string>;
    };
    if (!result?.url) return null;

    const method: "GET" | "POST" = result.POST ? "POST" : "GET";
    let url = result.url;
    if (!result.POST && result.httpParams) {
      const qs = new URLSearchParams(result.httpParams).toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }
    return { url, method };
  } catch {
    return null;
  }
}

async function checkOne(
  source: BookSource,
  keyword: string,
  timeout: number,
  signal: AbortSignal,
): Promise<Omit<CheckResult, "key" | "name" | "sourceUrl">> {
  const t0 = Date.now();

  const req = buildSearchUrl(source._raw, keyword);
  if (!req) return { status: "skip", detail: "无搜索配置" };

  // Mixed content: HTTPS page cannot fetch HTTP URLs
  if (location.protocol === "https:" && req.url.startsWith("http:")) {
    return { status: "skip", detail: "HTTP 源在 HTTPS 页面无法检测" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout * 1000);
  // Chain with outer signal
  signal.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const resp = await fetch(req.url, {
      method: req.method,
      mode: "no-cors",
      signal: controller.signal,
    });
    const ms = Date.now() - t0;
    clearTimeout(timer);
    // Opaque response (no-cors) = server reachable
    if (resp.type === "opaque" || resp.ok) {
      return { status: "ok", detail: "服务器可达", ms };
    }
    return { status: "err", detail: `HTTP ${resp.status}`, ms };
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const name = (e as Error).name;
    if (name === "AbortError") return { status: "err", detail: "超时", ms };
    return { status: "err", detail: "网络不可达", ms };
  }
}

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker),
  );
  return results;
}

export function useSourceChecker() {
  const results = ref<CheckResult[]>([]);
  const running = ref(false);
  const keyword = ref("");
  const concurrency = ref(5);
  const timeout = ref(10);
  let controller: AbortController | null = null;

  const summary = computed(() => {
    const total = results.value.length;
    const ok = results.value.filter((r) => r.status === "ok").length;
    const err = results.value.filter((r) => r.status === "err").length;
    const skip = results.value.filter((r) => r.status === "skip").length;
    const done = ok + err + skip;
    return { total, ok, err, skip, done };
  });

  async function start(sources: BookSource[]) {
    if (!keyword.value.trim()) return;
    controller = new AbortController();
    running.value = true;

    results.value = sources.map((s) => ({
      key: s._key,
      name: s.sourceName,
      sourceUrl: s.sourceUrl,
      status: "pending" as CheckStatus,
      detail: "等待中",
    }));

    const kw = keyword.value.trim();
    const signal = controller.signal;

    const tasks = sources.map((source, i) => async () => {
      results.value[i] = {
        ...results.value[i],
        status: "checking",
        detail: "检测中…",
      };
      const r = await checkOne(source, kw, timeout.value, signal);
      results.value[i] = { ...results.value[i], ...r };
    });

    await withConcurrency(tasks, concurrency.value);
    running.value = false;
    controller = null;
  }

  function stop() {
    controller?.abort();
    running.value = false;
    // Mark remaining pending/checking as skipped
    results.value = results.value.map((r) =>
      r.status === "pending" || r.status === "checking"
        ? { ...r, status: "err" as CheckStatus, detail: "已中断" }
        : r,
    );
  }

  return {
    results,
    running,
    keyword,
    concurrency,
    timeout,
    summary,
    start,
    stop,
  };
}
