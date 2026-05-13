<template>
  <div class="editor-view">
    <!-- Upload area (shown when no files loaded) -->
    <div
      v-if="!store.jsonText"
      class="upload-area"
    >
      <div class="upload-grid">
        <DropZone
          accept=".xbs"
          icon="🔒"
          title="导入 XBS"
          sub="自动解密并展示为 JSON"
          @file="store.loadXbsFile"
        />
        <div class="upload-or">or</div>
        <DropZone
          accept=".json"
          icon="📝"
          title="导入 JSON"
          sub="加载现有明文 JSON"
          @file="store.loadJsonFile"
        />
      </div>
      <p class="upload-hint">
        拖拽文件到此处，或点击选择 · 系统会在浏览器本地处理，不上传数据
      </p>
    </div>

    <!-- Editor panel -->
    <div
      v-else
      class="panels"
    >
      <!-- Single Full-Width JSON editor -->
      <div class="panel">
        <div class="panel-head">
          <span class="panel-label">
            <span class="dot dot-green"></span>书源内容 (JSON)
          </span>
          <span
            v-if="store.jsonSize"
            class="panel-meta"
            >{{ store.jsonFileName }}.json · {{ store.jsonSize }}</span
          >
          <div class="panel-acts">
            <label
              class="btn btn-sm btn-muted"
              title="导入 JSON 文件"
            >
              📂
              <input
                type="file"
                accept=".json"
                @change="onJsonFile"
              />
            </label>
            <button
              class="btn btn-sm btn-muted"
              @click="store.formatJson"
            >
              ✨ 格式化 JSON
            </button>
          </div>
        </div>
        <JsonEditor
          v-model="jsonTextProxy"
          class="flex-fill"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useEditorStore } from "@/stores/editor";
import DropZone from "@/components/DropZone.vue";
import JsonEditor from "@/components/JsonEditor.vue";

const store = useEditorStore();

const jsonTextProxy = computed({
  get: () => store.jsonText,
  set: (v) => {
    store.jsonText = v;
  },
});

function onJsonFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) {
    store.loadJsonFile(f);
    (e.target as HTMLInputElement).value = "";
  }
}
</script>

<style scoped>
.editor-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* Upload landing */
.upload-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px 24px;
}
.upload-grid {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 680px;
}
.upload-grid > :first-child,
.upload-grid > :last-child {
  flex: 1;
}
.upload-or {
  color: var(--text3);
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.upload-hint {
  font-size: 12px;
  color: var(--text3);
  text-align: center;
}

/* Panels layout */
.panels {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.panel-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  flex-shrink: 0;
}
.panel-meta {
  font-size: 11.5px;
  color: var(--text3);
  font-weight: 400;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.panel-acts {
  margin-left: auto;
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}
.panel-acts label {
  cursor: pointer;
}
.panel-acts input {
  display: none;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-blue {
  background: var(--accent);
}
.dot-green {
  background: var(--green);
}

/* Hex view */

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--text3);
  font-size: 13px;
}
.empty-hint span {
  font-size: 36px;
}
.mt {
  margin-top: 8px;
}

/* Center column */

/* Flex fill for JsonEditor */
.flex-fill {
  flex: 1;
  min-height: 0;
}
</style>
