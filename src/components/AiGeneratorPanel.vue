<template>
  <Teleport to="body">
    <Transition name="ai-panel-slide">
      <div
        v-if="open"
        class="ai-panel"
      >
        <!-- ── Header ── -->
        <div class="ai-header">
          <div class="ai-header-left">
            <span class="ai-header-icon">✨</span>
            <span class="ai-header-title">AI 生成书源</span>
            <span
              v-if="running"
              class="status-badge running"
            >
              <span class="badge-dot"></span>生成中
            </span>
            <span
              v-else-if="result"
              class="status-badge done"
              >✓ 已完成</span
            >
          </div>
          <button
            class="ai-close"
            title="关闭"
            @click="$emit('close')"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <line
                x1="3"
                y1="3"
                x2="13"
                y2="13"
              />
              <line
                x1="13"
                y1="3"
                x2="3"
                y2="13"
              />
            </svg>
          </button>
        </div>

        <div class="ai-body">
          <!-- ── Left Sidebar ── -->
          <aside class="ai-sidebar">
            <!-- Model config -->
            <div class="config-card">
              <div class="card-heading">
                <span class="card-heading-icon">⚙</span> 模型配置
              </div>
              <label class="field-label">API Base URL</label>
              <input
                v-model="localConfig.baseUrl"
                class="ai-input"
                placeholder="https://api.openai.com/v1"
                @blur="saveConfig"
              />
              <label class="field-label">API Key</label>
              <div class="input-wrap">
                <input
                  v-model="localConfig.apiKey"
                  class="ai-input"
                  :type="showKey ? 'text' : 'password'"
                  placeholder="sk-..."
                  @blur="saveConfig"
                />
                <button
                  class="eye-btn"
                  @click="showKey = !showKey"
                  type="button"
                >
                  {{ showKey ? "🙈" : "👁" }}
                </button>
              </div>
              <label class="field-label">模型</label>
              <input
                v-model="localConfig.model"
                class="ai-input"
                placeholder="gpt-4o"
                @blur="saveConfig"
              />
            </div>

            <!-- Proxy -->
            <div class="config-card">
              <div class="card-heading">
                <span class="card-heading-icon">🔗</span> 页面抓取代理
              </div>
              <select
                v-model="proxyPreset"
                class="ai-input"
                @change="onProxyPresetChange"
              >
                <option value="dev">本地开发（/api/fetch-page）</option>
                <option value="public">作者的 CF Worker</option>
                <option value="custom">自定义 Worker URL</option>
              </select>
              <input
                v-if="proxyPreset === 'custom'"
                v-model="localConfig.proxyUrl"
                class="ai-input"
                style="margin-top: 6px"
                placeholder="https://your.worker.dev"
                @blur="saveConfig"
              />
              <div class="proxy-note">
                GitHub Pages 无后端，需代理抓取 HTML。
                <br />
                <a
                  href="cf-worker/fetch-proxy.js"
                  target="_blank"
                  rel="noopener"
                  class="note-link"
                  >获取 Worker 脚本 ↗</a
                >
              </div>
            </div>

            <!-- Site + generate -->
            <div class="config-card generate-card">
              <div class="card-heading">
                <span class="card-heading-icon">🌐</span> 目标站点
              </div>
              <input
                v-model="siteUrl"
                class="ai-input"
                placeholder="https://www.example.com"
                :disabled="running"
                @keyup.enter="startGenerate"
              />
              <label
                class="field-label"
                style="margin-top: 8px"
                >测试书名（用于实测抓取）</label
              >
              <input
                v-model="testBook"
                class="ai-input"
                placeholder="斗罗大陆"
                :disabled="running"
              />
              <button
                class="btn-generate"
                :disabled="running || !siteUrl || !localConfig.apiKey"
                @click="startGenerate"
              >
                <span
                  v-if="running"
                  class="spinner"
                ></span>
                {{ running ? "生成中..." : "🚀 开始生成" }}
              </button>
              <button
                v-if="running"
                class="btn-stop"
                @click="generator.reset()"
              >
                停止
              </button>
            </div>
          </aside>

          <!-- ── Main Area ── -->
          <main class="ai-main">
            <!-- Empty state -->
            <div
              v-if="!steps.length && !errorMsg"
              class="empty-state"
            >
              <div class="empty-icon">🤖</div>
              <div class="empty-title">AI 书源生成器</div>
              <div class="empty-desc">
                填写左侧配置，输入小说网站地址后点击「开始生成」。<br />
                AI 将自动抓取 HTML，分析页面结构并生成完整书源规则。
              </div>
            </div>

            <!-- Steps -->
            <div
              v-if="steps.length"
              class="steps-card"
            >
              <div
                v-for="(step, i) in steps"
                :key="i"
                class="step-row"
                :class="step.status"
              >
                <div class="step-indicator">
                  <div
                    class="step-dot"
                    :class="step.status"
                  >
                    <span
                      v-if="step.status === 'running'"
                      class="spin-ring"
                    ></span>
                    <span
                      v-else-if="step.status === 'done'"
                      class="dot-check"
                      >✓</span
                    >
                    <span
                      v-else-if="step.status === 'error'"
                      class="dot-x"
                      >✗</span
                    >
                    <span
                      v-else
                      class="dot-num"
                      >{{ i + 1 }}</span
                    >
                  </div>
                  <div
                    v-if="i < steps.length - 1"
                    class="step-line"
                    :class="step.status"
                  ></div>
                </div>
                <div class="step-content">
                  <span class="step-label">{{ step.label }}</span>
                  <span
                    v-if="step.detail"
                    class="step-detail"
                    >{{ step.detail }}</span
                  >
                </div>
              </div>
            </div>

            <!-- Stream output -->
            <div
              v-if="streamText"
              class="stream-card"
            >
              <div class="stream-card-header">
                <span class="live-dot"></span>
                <span>模型实时输出</span>
              </div>
              <pre class="stream-body">{{ streamText.slice(-3000) }}</pre>
            </div>

            <!-- Error -->
            <div
              v-if="errorMsg"
              class="error-card"
            >
              <div class="error-card-header">⚠ 生成失败</div>
              <pre class="error-body">{{ errorMsg }}</pre>
            </div>

            <!-- Result -->
            <div
              v-if="result"
              class="result-card"
            >
              <div class="result-card-header">
                <div class="result-title-row">
                  <span class="result-badge">✅ 生成完成</span>
                  <span
                    v-if="result.warning"
                    class="result-warn"
                    >⚠ {{ result.warning }}</span
                  >
                </div>
                <div class="result-actions">
                  <button
                    class="ra-btn"
                    @click="copyJson"
                  >
                    {{ copied ? "✓ 已复制" : "复制 JSON" }}
                  </button>
                  <button
                    class="ra-btn"
                    @click="regenerate"
                  >
                    ↺ 重新生成
                  </button>
                </div>
              </div>
              <textarea
                class="result-json"
                :value="resultJson"
                readonly
              ></textarea>
            </div>
          </main>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useAiConfigStore, DEV_PROXY, PUBLIC_PROXY } from "@/stores/aiConfig";
import { useAiSourceGenerator } from "@/composables/useAiSourceGenerator";
import type { AiConfig } from "@/stores/aiConfig";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const aiConfigStore = useAiConfigStore();
const generator = useAiSourceGenerator();

const { steps, running, streamText, result, error: errorMsg } = generator;

const localConfig = ref<AiConfig>({ ...aiConfigStore.config });
const siteUrl = ref("");
const testBook = ref("");
const showKey = ref(false);
const copied = ref(false);

function proxyToPreset(url: string): "dev" | "public" | "custom" {
  if (url === DEV_PROXY) return "dev";
  if (url === PUBLIC_PROXY) return "public";
  return "custom";
}

const proxyPreset = ref<"dev" | "public" | "custom">(
  proxyToPreset(localConfig.value.proxyUrl),
);

function onProxyPresetChange() {
  if (proxyPreset.value === "dev") localConfig.value.proxyUrl = DEV_PROXY;
  else if (proxyPreset.value === "public")
    localConfig.value.proxyUrl = PUBLIC_PROXY;
  saveConfig();
}

watch(
  () => props.open,
  (val) => {
    if (val) {
      localConfig.value = { ...aiConfigStore.config };
      proxyPreset.value = proxyToPreset(localConfig.value.proxyUrl);
    }
  },
);

function saveConfig() {
  aiConfigStore.save(localConfig.value);
}

async function startGenerate() {
  if (!siteUrl.value || !localConfig.value.apiKey) return;
  saveConfig();
  generator.reset();
  await generator.generate(
    siteUrl.value.trim(),
    testBook.value.trim() || "斗罗大陆",
    localConfig.value,
  );
}

function regenerate() {
  generator.reset();
}

const resultJson = computed(() =>
  result.value ? JSON.stringify(result.value.raw, null, 2) : "",
);

async function copyJson() {
  await navigator.clipboard.writeText(resultJson.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1800);
}
</script>

<style scoped>
/* ── Panel Shell ── */
.ai-panel {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  z-index: 2000;
}

/* ── Header ── */
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 52px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ai-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ai-header-icon {
  font-size: 18px;
}
.ai-header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
}
.status-badge.running {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.status-badge.done {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.ai-close {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  border-radius: 8px;
  color: var(--text2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
  flex-shrink: 0;
}
.ai-close svg {
  width: 14px;
  height: 14px;
  pointer-events: none;
}
.ai-close:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

/* ── Body Layout ── */
.ai-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Sidebar ── */
.ai-sidebar {
  width: 280px;
  min-width: 240px;
  padding: 16px 12px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface2);
}

.config-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.generate-card {
  gap: 8px;
}

.card-heading {
  font-size: 11px;
  font-weight: 700;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.card-heading-icon {
  font-size: 13px;
}

.field-label {
  font-size: 11px;
  color: var(--text3);
  margin-top: 8px;
  margin-bottom: 3px;
  display: block;
  font-weight: 500;
}

.ai-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.ai-input:focus {
  outline: none;
  border-color: var(--border-focus);
}
.ai-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
select.ai-input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.input-wrap {
  position: relative;
}
.input-wrap .ai-input {
  padding-right: 32px;
}
.eye-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px;
  line-height: 1;
  color: var(--text3);
}

.proxy-note {
  font-size: 11px;
  color: var(--text3);
  margin-top: 7px;
  line-height: 1.5;
}
.note-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.note-link:hover {
  text-decoration: underline;
}

.btn-generate {
  width: 100%;
  padding: 9px 0;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition:
    background 0.15s,
    opacity 0.15s;
}
.btn-generate:hover:not(:disabled) {
  background: var(--accent-hover);
}
.btn-generate:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-stop {
  width: 100%;
  padding: 7px 0;
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 7px;
  font-size: 12px;
  color: #dc2626;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.15s;
}
.btn-stop:hover {
  background: #fef2f2;
}

.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Main ── */
.ai-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px;
  gap: 10px;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 4px;
}
.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
}
.empty-desc {
  font-size: 13px;
  color: var(--text3);
  line-height: 1.7;
  max-width: 380px;
}

/* Steps Card */
.steps-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
}
.step-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.step-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  position: relative;
  border: 2px solid var(--border);
  background: var(--surface2);
  color: var(--text3);
  flex-shrink: 0;
}
.step-dot.done {
  background: #f0fdf4;
  border-color: #86efac;
  color: #16a34a;
}
.step-dot.error {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}
.step-dot.running {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #2563eb;
}
.spin-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #3b82f6;
  animation: spin 0.7s linear infinite;
}
.dot-check,
.dot-x,
.dot-num {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
.step-line {
  width: 2px;
  flex: 1;
  min-height: 18px;
  background: var(--border);
  margin: 3px 0;
}
.step-line.done {
  background: #86efac;
}
.step-content {
  padding: 4px 0 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.step-row:last-child .step-content {
  padding-bottom: 0;
}
.step-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.step-row.pending .step-label {
  color: var(--text3);
}
.step-detail {
  font-size: 11px;
  color: var(--text3);
}

/* Stream Card */
.stream-card {
  background: #0f1117;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #2a2d3a;
}
.stream-card-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  border-bottom: 1px solid #2a2d3a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34d399;
  animation: pulse 1.2s ease-in-out infinite;
  flex-shrink: 0;
}
.stream-body {
  font-size: 11px;
  font-family: "JetBrains Mono", "Fira Code", "Menlo", monospace;
  padding: 12px 14px;
  margin: 0;
  max-height: 260px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: #e2e8f0;
  line-height: 1.6;
}

/* Error Card */
.error-card {
  background: #fff5f5;
  border: 1px solid #fecaca;
  border-radius: 10px;
  overflow: hidden;
}
.error-card-header {
  padding: 9px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #dc2626;
  border-bottom: 1px solid #fecaca;
  background: #fef2f2;
}
.error-body {
  font-size: 12px;
  padding: 12px 14px;
  margin: 0;
  white-space: pre-wrap;
  color: #7f1d1d;
  font-family: monospace;
  line-height: 1.6;
}

/* Result Card */
.result-card {
  background: var(--surface);
  border: 1px solid #86efac;
  border-radius: 10px;
  overflow: hidden;
}
.result-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: #f0fdf4;
}
.result-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.result-badge {
  font-size: 13px;
  font-weight: 600;
  color: #15803d;
}
.result-warn {
  font-size: 11px;
  color: #92400e;
  background: #fef9c3;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #fde68a;
}
.result-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.ra-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  transition:
    background 0.15s,
    border-color 0.15s;
}
.ra-btn:hover {
  background: var(--surface2);
}
.ra-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.ra-btn.primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
.result-json {
  width: 100%;
  min-height: 280px;
  font-family: "JetBrains Mono", "Fira Code", "Menlo", monospace;
  font-size: 12px;
  padding: 14px 16px;
  border: none;
  background: #fafafa;
  color: var(--text);
  resize: vertical;
  box-sizing: border-box;
  line-height: 1.65;
  outline: none;
}

/* Transition */
.ai-panel-slide-enter-active,
.ai-panel-slide-leave-active {
  transition:
    opacity 0.22s,
    transform 0.22s;
}
.ai-panel-slide-enter-from,
.ai-panel-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
