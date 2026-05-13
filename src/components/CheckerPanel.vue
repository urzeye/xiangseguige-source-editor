<template>
  <Teleport to="body">
    <Transition name="checker-slide">
      <div
        v-if="open"
        class="checker-panel"
      >
        <!-- Header -->
        <div class="cp-head">
          <span class="cp-title">🔍 有效性检测</span>
          <div class="cp-head-note">通过搜索 API 检测书源是否可达</div>
          <button
            class="cp-close"
            @click="$emit('close')"
          >
            ✕
          </button>
        </div>

        <!-- Controls -->
        <div class="cp-controls">
          <input
            v-model="checker.keyword.value"
            class="cp-input"
            placeholder="输入搜索关键词，如：斗破苍穹"
            :disabled="checker.running.value"
            @keydown.enter="tryStart"
          />
          <label class="cp-opt">
            <span>并发</span>
            <select
              v-model.number="checker.concurrency.value"
              :disabled="checker.running.value"
            >
              <option
                v-for="n in [1, 3, 5, 10, 20]"
                :key="n"
                :value="n"
              >
                {{ n }}
              </option>
            </select>
          </label>
          <label class="cp-opt">
            <span>超时 (s)</span>
            <select
              v-model.number="checker.timeout.value"
              :disabled="checker.running.value"
            >
              <option
                v-for="n in [5, 8, 10, 15, 20]"
                :key="n"
                :value="n"
              >
                {{ n }}
              </option>
            </select>
          </label>
          <button
            v-if="!checker.running.value"
            class="btn btn-sm btn-primary"
            :disabled="!checker.keyword.value.trim()"
            @click="tryStart"
          >
            开始检测
          </button>
          <button
            v-else
            class="btn btn-sm btn-danger"
            @click="checker.stop"
          >
            停止
          </button>
        </div>

        <!-- Progress bar -->
        <div
          class="cp-progress-wrap"
          v-if="checker.results.value.length > 0"
        >
          <div class="cp-progress-bar">
            <div
              class="cp-progress-fill"
              :style="{ width: progress + '%' }"
            />
          </div>
          <div class="cp-summary">
            <span class="sum-ok">✓ {{ checker.summary.value.ok }}</span>
            <span class="sum-err">✗ {{ checker.summary.value.err }}</span>
            <span class="sum-skip">— {{ checker.summary.value.skip }}</span>
            <span class="sum-total">/ {{ checker.summary.value.total }}</span>
          </div>
        </div>

        <!-- Results list -->
        <div class="cp-list">
          <div
            v-if="checker.results.value.length === 0"
            class="cp-empty"
          >
            输入关键词并点击「开始检测」
          </div>
          <div
            v-for="r in checker.results.value"
            :key="r.key"
            class="cp-row"
            :class="r.status"
          >
            <span class="cp-status-icon">{{ statusIcon(r.status) }}</span>
            <span
              class="cp-name"
              :title="r.name"
              >{{ r.name }}</span
            >
            <span class="cp-detail"
              >{{ r.detail }}<span v-if="r.ms"> · {{ r.ms }}ms</span></span
            >
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSourceChecker } from "@/composables/useSourceChecker";
import type { BookSource } from "@/lib/types";

const props = defineProps<{ open: boolean; sources: BookSource[] }>();
defineEmits<{ close: [] }>();

const checker = useSourceChecker();

const progress = computed(() => {
  const { done, total } = checker.summary.value;
  return total > 0 ? Math.round((done / total) * 100) : 0;
});

function statusIcon(status: string) {
  return (
    { pending: "○", checking: "⌛", ok: "✓", err: "✗", skip: "—" }[status] ??
    "?"
  );
}

function tryStart() {
  if (!checker.keyword.value.trim() || checker.running.value) return;
  checker.start(props.sources);
}
</script>

<style scoped>
.checker-panel {
  position: fixed;
  bottom: 0;
  left: 220px; /* sidebar width */
  right: 0;
  height: 420px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.1);
  z-index: 150;
  display: flex;
  flex-direction: column;
}

.cp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  flex-shrink: 0;
}
.cp-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.cp-head-note {
  font-size: 12px;
  color: var(--text3);
  flex: 1;
}
.cp-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text2);
  padding: 4px 8px;
  border-radius: 6px;
}
.cp-close:hover {
  background: var(--surface2);
}

.cp-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.cp-input {
  flex: 1;
  min-width: 200px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.cp-input:focus {
  border-color: var(--accent);
}
.cp-input:disabled {
  opacity: 0.6;
}
.cp-opt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text2);
  white-space: nowrap;
}
.cp-opt select {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.cp-opt select:focus {
  border-color: var(--accent);
}

.cp-progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.cp-progress-bar {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.cp-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.cp-summary {
  display: flex;
  gap: 10px;
  font-size: 12px;
  font-weight: 600;
}
.sum-ok {
  color: var(--green);
}
.sum-err {
  color: var(--red);
}
.sum-skip {
  color: var(--text3);
}
.sum-total {
  color: var(--text2);
}

.cp-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
.cp-list::-webkit-scrollbar {
  width: 4px;
}
.cp-list::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.cp-empty {
  text-align: center;
  color: var(--text3);
  padding: 32px;
  font-size: 13px;
}

.cp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  transition: background 0.1s;
}
.cp-row:hover {
  background: var(--surface2);
}
.cp-row.ok {
  border-left: 3px solid var(--green);
}
.cp-row.err {
  border-left: 3px solid var(--red);
}
.cp-row.checking {
  border-left: 3px solid var(--yellow);
}
.cp-row.skip {
  border-left: 3px solid var(--border);
}
.cp-row.pending {
  border-left: 3px solid transparent;
}

.cp-status-icon {
  flex-shrink: 0;
  width: 18px;
  text-align: center;
  font-size: 12px;
}
.cp-row.ok .cp-status-icon {
  color: var(--green);
}
.cp-row.err .cp-status-icon {
  color: var(--red);
}
.cp-row.checking .cp-status-icon {
  color: var(--yellow);
}

.cp-name {
  flex: 0 0 200px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-detail {
  color: var(--text3);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Transition */
.checker-slide-enter-active,
.checker-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.checker-slide-enter-from,
.checker-slide-leave-to {
  transform: translateY(100%);
}
</style>
