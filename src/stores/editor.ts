import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { xbs2json, json2xbs } from "@/lib/xxtea";
import { downloadBlob, formatBytes } from "@/lib/utils";
import type { BookSource, ToastItem, ToastType } from "@/lib/types";

let toastId = 0;

export const useEditorStore = defineStore("editor", () => {
  // ── State ──────────────────────────────────────────
  const xbsBuffer = ref<ArrayBuffer | null>(null);
  const xbsFileName = ref("output");
  const jsonText = ref("");
  const jsonFileName = ref("output");
  const sources = ref<BookSource[]>([]);
  const toasts = ref<ToastItem[]>([]);
  const isConverting = ref(false);
  const activeTab = ref<"editor" | "sources">("editor");

  // ── Computed ───────────────────────────────────────
  const xbsSize = computed(() =>
    xbsBuffer.value ? formatBytes(xbsBuffer.value.byteLength) : null,
  );
  const jsonSize = computed(() =>
    jsonText.value
      ? formatBytes(new TextEncoder().encode(jsonText.value).length)
      : null,
  );
  const sourceCount = computed(() => sources.value.length);
  const enabledCount = computed(
    () => sources.value.filter((s) => s.enable).length,
  );

  // ── Toast ──────────────────────────────────────────
  function toast(msg: string, type: ToastType = "ok") {
    const id = ++toastId;
    toasts.value.push({ id, msg, type });
    setTimeout(() => {
      const idx = toasts.value.findIndex((t) => t.id === id);
      if (idx >= 0) toasts.value.splice(idx, 1);
    }, 3500);
  }

  // ── Load files ─────────────────────────────────────
  function loadXbsFile(file: File) {
    xbsFileName.value = file.name.replace(/\.xbs$/i, "");
    const reader = new FileReader();
    reader.onload = (e) => {
      xbsBuffer.value = e.target!.result as ArrayBuffer;
      convertXbs2Json(); // Automatically decrypt when loaded
    };
    reader.readAsArrayBuffer(file);
  }

  function loadJsonFile(file: File) {
    jsonFileName.value = file.name.replace(/\.json$/i, "");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string;
        const parsed = JSON.parse(text);
        jsonText.value = JSON.stringify(parsed, null, 2);
        parseSources(parsed);
        toast(`已载入 ${file.name}`, "ok");
      } catch (err) {
        toast(`JSON 解析失败: ${(err as Error).message}`, "err");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  // ── Convert ────────────────────────────────────────
  function convertXbs2Json() {
    if (!xbsBuffer.value) {
      toast("请先导入 XBS 文件", "err");
      return;
    }
    isConverting.value = true;
    const t0 = performance.now();
    try {
      const json = xbs2json(xbsBuffer.value);
      const parsed = JSON.parse(json);
      jsonText.value = JSON.stringify(parsed, null, 2);
      jsonFileName.value = xbsFileName.value;
      parseSources(parsed);
      const ms = Math.round(performance.now() - t0);
      toast(`解密成功 · ${sourceCount.value} 个书源 · ${ms}ms`, "ok");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      isConverting.value = false;
    }
  }

  function convertJson2Xbs() {
    if (!jsonText.value.trim()) {
      toast("JSON 内容为空", "err");
      return;
    }
    isConverting.value = true;
    const t0 = performance.now();
    try {
      JSON.parse(jsonText.value); // validate
      const encrypted = json2xbs(jsonText.value);
      xbsBuffer.value = encrypted.buffer.slice(0) as ArrayBuffer;
      xbsFileName.value = jsonFileName.value;
      const ms = Math.round(performance.now() - t0);
      toast(`加密成功 · ${formatBytes(encrypted.length)} · ${ms}ms`, "ok");
    } catch (err) {
      toast(`加密失败: ${(err as Error).message}`, "err");
    } finally {
      isConverting.value = false;
    }
  }

  // ── Download ───────────────────────────────────────
  function downloadXbs() {
    if (!jsonText.value.trim()) {
      toast("没有 JSON 内容可供导出为 XBS", "err");
      return;
    }
    // Automatically encrypt before downloading
    convertJson2Xbs();

    if (!xbsBuffer.value) {
      toast("XBS 转换失败", "err");
      return;
    }
    downloadBlob(
      xbsBuffer.value,
      `${xbsFileName.value}.xbs`,
      "application/octet-stream",
    );
  }

  function downloadJson() {
    if (!jsonText.value.trim()) {
      toast("没有 JSON 内容可下载", "err");
      return;
    }
    downloadBlob(
      jsonText.value,
      `${jsonFileName.value}.json`,
      "application/json",
    );
  }

  function downloadJsonEnabled() {
    const enabled = sources.value.filter((s) => s.enable).map((s) => s._raw);
    if (enabled.length === 0) {
      toast("没有启用的书源", "warn");
      return;
    }
    const text = JSON.stringify(enabled, null, 2);
    downloadBlob(
      text,
      `${jsonFileName.value || "sources"}-enabled.json`,
      "application/json",
    );
    toast(`已导出 ${enabled.length} 个启用书源`, "ok");
  }

  function downloadXbsEnabled() {
    const enabled = sources.value.filter((s) => s.enable).map((s) => s._raw);
    if (enabled.length === 0) {
      toast("没有启用的书源", "warn");
      return;
    }
    const text = JSON.stringify(enabled);
    isConverting.value = true;
    try {
      const encrypted = json2xbs(text);
      downloadBlob(
        encrypted.buffer.slice(0) as ArrayBuffer,
        `${jsonFileName.value || "sources"}-enabled.xbs`,
        "application/octet-stream",
      );
      toast(`已导出 ${enabled.length} 个启用书源 (XBS)`, "ok");
    } catch (err) {
      toast(`加密失败: ${(err as Error).message}`, "err");
    } finally {
      isConverting.value = false;
    }
  }

  // ── Format ─────────────────────────────────────────
  function formatJson() {
    try {
      jsonText.value = JSON.stringify(JSON.parse(jsonText.value), null, 2);
      toast("格式化成功", "ok");
    } catch (e) {
      toast("JSON 格式错误: " + (e as Error).message, "err");
    }
  }

  // ── Sources ────────────────────────────────────────
  function parseSources(parsed: unknown) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    const obj = parsed as Record<string, Record<string, unknown>>;
    sources.value = Object.entries(obj).map(([k, v]) => ({
      _key: k,
      sourceName: (v.sourceName as string) || k,
      sourceUrl: (v.sourceUrl as string) || "",
      enable: v.enable !== false,
      weight: typeof v.weight === "number" ? v.weight : 0,
      lastModifyTime: (v.lastModifyTime as string | number) || "",
      _raw: v,
    }));
  }

  function syncSourcesToJson() {
    const obj: Record<string, unknown> = {};
    sources.value.forEach((s) => {
      obj[s._key] = s._raw;
    });
    jsonText.value = JSON.stringify(obj, null, 2);
  }

  function toggleSource(key: string) {
    const s = sources.value.find((x) => x._key === key);
    if (!s) return;
    s.enable = !s.enable;
    s._raw.enable = s.enable;
    syncSourcesToJson();
  }

  function deleteSource(key: string) {
    const idx = sources.value.findIndex((x) => x._key === key);
    if (idx < 0) return;
    sources.value.splice(idx, 1);
    syncSourcesToJson();
    toast("已删除书源", "info");
  }

  function setAllEnabled(val: boolean) {
    sources.value.forEach((s) => {
      s.enable = val;
      s._raw.enable = val;
    });
    syncSourcesToJson();
    toast(
      val
        ? `已启用全部 ${sourceCount.value} 个书源`
        : `已禁用全部 ${sourceCount.value} 个书源`,
      "ok",
    );
  }

  function setSourceEnabled(key: string, val: boolean) {
    const s = sources.value.find((x) => x._key === key);
    if (!s) return;
    s.enable = val;
    s._raw.enable = val;
    syncSourcesToJson();
  }

  function updateSource(key: string, raw: Record<string, unknown>) {
    const s = sources.value.find((x) => x._key === key);
    if (!s) return;
    s._raw = raw;
    s.sourceName = String(raw.sourceName ?? s.sourceName);
    s.sourceUrl = String(raw.sourceUrl ?? s.sourceUrl);
    s.enable = Boolean(raw.enable ?? s.enable);
    s.weight = Number(raw.weight ?? s.weight);
    s.lastModifyTime =
      (raw.lastModifyTime as string | number) ?? s.lastModifyTime;
    syncSourcesToJson();
    toast("已保存", "ok");
  }

  function addSource(data: {
    sourceName: string;
    sourceUrl: string;
    weight: number;
    enable: boolean;
    lastModifyTime: number;
  }) {
    const raw: Record<string, unknown> = { ...data };
    const key = `new-${Date.now()}`;
    sources.value.unshift({
      _key: key,
      sourceName: data.sourceName,
      sourceUrl: data.sourceUrl,
      enable: data.enable,
      weight: data.weight,
      lastModifyTime: data.lastModifyTime,
      _raw: raw,
    });
    syncSourcesToJson();
    toast(`已创建书源「${data.sourceName}」`, "ok");
  }

  /** Add a source from a raw Record (e.g., AI-generated) */
  function addSourceRaw(raw: Record<string, unknown>) {
    const sourceName = String(raw.sourceName ?? "未命名书源");
    const sourceUrl = String(raw.sourceUrl ?? "");
    const key = `new-${Date.now()}`;
    sources.value.unshift({
      _key: key,
      sourceName,
      sourceUrl,
      enable: raw.enable === 0 ? false : true,
      weight: Number(raw.weight ?? 0),
      lastModifyTime: Number(raw.lastModifyTime ?? 0),
      _raw: raw,
    });
    syncSourcesToJson();
    toast(`已添加书源「${sourceName}」`, "ok");
  }

  return {
    xbsBuffer,
    xbsFileName,
    jsonText,
    jsonFileName,
    sources,
    toasts,
    isConverting,
    activeTab,
    xbsSize,
    jsonSize,
    sourceCount,
    enabledCount,
    toast,
    loadXbsFile,
    loadJsonFile,
    convertXbs2Json,
    convertJson2Xbs,
    downloadXbs,
    downloadJson,
    downloadXbsEnabled,
    downloadJsonEnabled,
    formatJson,
    parseSources,
    syncSourcesToJson,
    toggleSource,
    deleteSource,
    setAllEnabled,
    setSourceEnabled,
    updateSource,
    addSource,
    addSourceRaw,
  };
});
