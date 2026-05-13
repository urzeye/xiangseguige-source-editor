<template>
  <Teleport to="body">
    <Transition name="ai-panel-slide">
      <div v-if="open" class="ai-panel">
        <div class="ai-panel-header">
          <span>🤖 AI 生成书源</span>
          <button class="btn btn-sm btn-muted" @click="$emit('close')">✕</button>
        </div>

        <div class="ai-panel-body">
          <!-- Left: config + input -->
          <div class="ai-left">
            <div class="section-title">AI 模型配置</div>
            <label class="field-label">API Base URL</label>
            <input
              v-model="localConfig.baseUrl"
              class="ai-input"
              placeholder="https://api.openai.com/v1"
              @blur="saveConfig"
            />
            <label class="field-label">API Key</label>
            <input
              v-model="localConfig.apiKey"
              class="ai-input"
              type="password"
              placeholder="sk-..."
              @blur="saveConfig"
            />
            <label class="field-label">模型名称</label>
            <input
              v-model="localConfig.model"
              class="ai-input"
              placeholder="gpt-4o"
              @blur="saveConfig"
            />

            <div class="section-title" style="margin-top:16px">站点地址</div>
            <input
              v-model="siteUrl"
              class="ai-input"
              placeholder="https://www.example.com"
              @keyup.enter="startGenerate"
              :disabled="running"
            />
            <button
              class="btn btn-primary"
              style="margin-top:8px;width:100%"
              :disabled="running || !siteUrl || !localConfig.apiKey"
              @click="startGenerate"
            >
              {{ running ? "生成中..." : "开始生成" }}
            </button>
            <button
              v-if="running"
              class="btn btn-danger"
              style="margin-top:6px;width:100%"
              @click="generator.reset()"
            >
              取消
            </button>
          </div>

          <!-- Right: steps + result -->
          <div class="ai-right">
            <!-- Steps -->
            <div v-if="steps.length" class="steps-list">
              <div
                v-for="(step, i) in steps"
                :key="i"
                class="step-row"
                :class="step.status"
              >
                <span class="step-icon">
                  {{ step.status === 'done' ? '✓' : step.status === 'error' ? '✗' : step.status === 'running' ? '⏳' : '○' }}
                </span>
                <span class="step-label">{{ step.label }}</span>
                <span v-if="step.detail" class="step-detail">{{ step.detail }}</span>
              </div>
            </div>

            <!-- Stream output preview -->
            <div v-if="streamText" class="stream-preview">
              <div class="stream-label">模型输出（实时）</div>
              <pre class="stream-text">{{ streamText.slice(-2000) }}</pre>
            </div>

            <!-- Error -->
            <div v-if="errorMsg" class="ai-error">{{ errorMsg }}</div>

            <!-- Result -->
            <div v-if="result" class="result-area">
              <div class="result-header">
                <span>✅ 生成完成</span>
                <span v-if="result.warning" class="result-warn">⚠ {{ result.warning }}</span>
              </div>
              <textarea
                class="result-json"
                :value="resultJson"
                readonly
                rows="12"
              ></textarea>
              <div class="result-actions">
                <button class="btn btn-success" @click="addSource">
                  ✚ 添加到书源列表
                </button>
                <button class="btn btn-muted" style="margin-left:8px" @click="copyJson">
                  复制 JSON
                </button>
                <button class="btn btn-muted" style="margin-left:8px" @click="regenerate">
                  重新生成
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useAiConfigStore } from "@/stores/aiConfig";
import { useAiSourceGenerator } from "@/composables/useAiSourceGenerator";
import { useEditorStore } from "@/stores/editor";
import type { AiConfig } from "@/stores/aiConfig";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void; (e: "added"): void }>();

const aiConfigStore = useAiConfigStore();
const editorStore = useEditorStore();
const generator = useAiSourceGenerator();

const { steps, running, streamText, result, error: errorMsg } = generator;

const localConfig = ref<AiConfig>({ ...aiConfigStore.config });
const siteUrl = ref("");

// Sync store into local when panel opens
watch(
  () => props.open,
  (val) => {
    if (val) localConfig.value = { ...aiConfigStore.config };
  }
);

function saveConfig() {
  aiConfigStore.save(localConfig.value);
}

async function startGenerate() {
  if (!siteUrl.value || !localConfig.value.apiKey) return;
  saveConfig();
  generator.reset();
  await generator.generate(siteUrl.value.trim(), localConfig.value);
}

function regenerate() {
  generator.reset();
}

const resultJson = computed(() =>
  result.value ? JSON.stringify(result.value.raw, null, 2) : ""
);

function addSource() {
  if (!result.value) return;
  editorStore.addSourceRaw(result.value.raw);
  emit("added");
  emit("close");
}

async function copyJson() {
  await navigator.clipboard.writeText(resultJson.value);
}
</script>

<style scoped>
.ai-panel {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  z-index: 2000;
}

.ai-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 14px;
}

.ai-panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.ai-left {
  width: 260px;
  min-width: 220px;
  padding: 16px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.ai-right {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
  margin-bottom: 2px;
  display: block;
}

.ai-input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  box-sizing: border-box;
}
.ai-input:focus {
  outline: none;
  border-color: var(--primary);
}
.ai-input:disabled {
  opacity: 0.5;
}

/* Steps */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--bg2);
}

.step-row.done .step-icon { color: var(--success); }
.step-row.error .step-icon { color: var(--danger); }
.step-row.running .step-icon { color: var(--primary); }
.step-row.pending .step-icon { color: var(--text-muted); }

.step-icon { font-size: 14px; width: 18px; }
.step-label { flex: 1; }
.step-detail { font-size: 11px; color: var(--text-muted); }

/* Stream */
.stream-preview {
  background: var(--bg2);
  border-radius: 6px;
  overflow: hidden;
  flex: 0 0 auto;
  max-height: 200px;
}
.stream-label {
  font-size: 11px;
  color: var(--text-muted);
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.stream-text {
  font-size: 11px;
  font-family: monospace;
  padding: 8px 10px;
  margin: 0;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
}

.ai-error {
  background: #fee;
  color: #c00;
  border: 1px solid #fcc;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 13px;
  white-space: pre-wrap;
}

/* Result */
.result-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
}
.result-warn {
  color: #b97000;
  font-weight: normal;
  font-size: 12px;
}
.result-json {
  width: 100%;
  font-family: monospace;
  font-size: 12px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg2);
  color: var(--text);
  resize: vertical;
  box-sizing: border-box;
}
.result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Transition */
.ai-panel-slide-enter-active,
.ai-panel-slide-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.ai-panel-slide-enter-from,
.ai-panel-slide-leave-to {
  opacity: 0;
  transform: translateX(40px);
}
</style>
