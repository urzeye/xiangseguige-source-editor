<template>
  <div id="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">📖</span>
        <div class="logo-text">
          <div class="logo-main">XBS Editor</div>
          <div class="logo-sub">香色闺阁书源</div>
        </div>
      </div>

      <nav class="nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-item"
          :class="{ active: store.activeTab === item.key }"
          @click="store.activeTab = item.key as any"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span
            v-if="item.key === 'sources' && store.sourceCount > 0"
            class="nav-badge"
          >
            {{ store.sourceCount }}
          </span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <a
          href="https://github.com/urzeye/xbs-editor"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
        >
          <span>GitHub</span>
          <span class="ext-icon">↗</span>
        </a>
        <div class="footer-note">本地处理 · 无服务器</div>
      </div>
    </aside>

    <!-- Main content -->
    <div class="main-area">
      <!-- Top bar -->
      <header class="topbar">
        <div class="topbar-title">
          <span>{{ currentNavItem?.icon }}</span>
          {{ currentNavItem?.label }}
        </div>
        <div class="topbar-actions">
          <template v-if="store.activeTab === 'editor'">
            <label class="btn btn-sm btn-muted">
              📂 导入 XBS
              <input
                type="file"
                accept=".xbs"
                @change="onXbsFile"
              />
            </label>
            <label class="btn btn-sm btn-muted">
              📄 导入 JSON
              <input
                type="file"
                accept=".json"
                @change="onJsonFile"
              />
            </label>
            <button
              class="btn btn-sm btn-primary"
              :disabled="!store.jsonText"
              @click="store.downloadXbs"
            >
              ⬇ 导出 XBS
            </button>
            <button
              class="btn btn-sm btn-success"
              :disabled="!store.jsonText"
              @click="store.downloadJson"
            >
              ⬇ 导出 JSON
            </button>
          </template>
        </div>
      </header>

      <!-- Tab content -->
      <div class="content">
        <EditorView v-show="store.activeTab === 'editor'" />
        <div
          v-show="store.activeTab === 'sources'"
          class="sources-wrap"
        >
          <SourceTable v-if="store.sourceCount > 0" />
          <div
            v-else
            class="empty-sources"
          >
            <span>📚</span>
            <p>暂无书源数据</p>
            <p class="hint">请先在编辑器中导入并解密 XBS 文件</p>
            <button
              class="btn btn-sm btn-primary mt"
              @click="store.activeTab = 'editor'"
            >
              前往编辑器
            </button>
          </div>
        </div>
      </div>
    </div>

    <ToastContainer :toasts="store.toasts" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useEditorStore } from "@/stores/editor";
import EditorView from "@/views/EditorView.vue";
import SourceTable from "@/components/SourceTable.vue";
import ToastContainer from "@/components/ToastContainer.vue";

const store = useEditorStore();

const navItems = [
  { key: "editor", icon: "⚡", label: "格式转换" },
  { key: "sources", icon: "📚", label: "书源管理" },
];

const currentNavItem = computed(() =>
  navItems.find((n) => n.key === store.activeTab),
);

function onXbsFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) {
    store.loadXbsFile(f);
    (e.target as HTMLInputElement).value = "";
  }
}
function onJsonFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) {
    store.loadJsonFile(f);
    (e.target as HTMLInputElement).value = "";
  }
}
</script>

<style>
/* ── Global Reset & CSS Variables (Modern Vercel / Linear Minimalist) ── */
:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --surface2: #f3f4f6;
  --border: #eaeaea;
  --border-focus: #999999;
  --accent: #000000;
  --accent-hover: #333333;
  --accent-light: #ebebeb;
  --green: #0070f3; /* Pure clean blue for success/primary actions */
  --green-hover: #0051b3;
  --red: #e00;
  --red-hover: #c00;
  --yellow: #f5a623;
  --text: #000000;
  --text2: #666666;
  --text3: #888888;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md:
    0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  --shadow-lg:
    0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-float: 0 12px 24px rgba(0, 0, 0, 0.15);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
html,
body,
#app {
  height: 100%;
}
body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", "PingFang SC",
    sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
</style>

<style scoped>
#app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ── Sidebar ── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 1px 0 10px rgba(0, 0, 0, 0.02);
  z-index: 10;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px 20px;
  border-bottom: none;
}
.logo-icon {
  font-size: 24px;
}
.logo-text {
  display: flex;
  flex-direction: column;
}
.logo-main {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.3px;
}
.logo-sub {
  font-size: 11.5px;
  color: var(--text3);
  font-weight: 500;
  margin-top: 2px;
}

.nav {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text2);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.nav-item:hover {
  background: var(--surface2);
  color: var(--text);
}
.nav-item.active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}
.nav-icon {
  font-size: 16px;
  flex-shrink: 0;
}
.nav-label {
  flex: 1;
}
.nav-badge {
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 12px;
  min-width: 22px;
  text-align: center;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.footer-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text3);
  text-decoration: none;
  font-size: 12px;
  font-weight: 500;
  padding: 6px 0;
  transition: color 0.15s;
}
.footer-link:hover {
  color: var(--accent);
}
.ext-icon {
  font-size: 11px;
}
.footer-note {
  font-size: 11.5px;
  color: #8792a2;
  margin-top: 6px;
}

/* ── Main area ── */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--bg);
}

/* ── Topbar (Glassmorphism) ── */
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 60px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  z-index: 5;
}
.topbar-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.2px;
}
.topbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.topbar-actions label {
  cursor: pointer;
}
.topbar-actions input {
  display: none;
}

/* ── Content Area ── */
.content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
}

.sources-wrap {
  flex: 1;
  min-height: 0;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.empty-sources {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text3);
}
.empty-sources span {
  font-size: 44px;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
}
.empty-sources p {
  font-size: 16px;
  color: var(--text);
  font-weight: 500;
}
.empty-sources .hint {
  font-size: 13.5px;
  color: var(--text3);
  font-weight: 400;
}
.mt {
  margin-top: 12px;
}
</style>

<style>
/* ── Global Buttons (Vercel/Linear Style) ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
  font-family: inherit;
}
.btn:active {
  transform: scale(0.97);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-xs {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  box-shadow: var(--shadow-md);
}

.btn-success {
  background: var(--green);
  color: #fff;
  border-color: var(--green);
  box-shadow: var(--shadow-sm);
}
.btn-success:hover:not(:disabled) {
  background: var(--green-hover);
  border-color: var(--green-hover);
  box-shadow: var(--shadow-md);
}

.btn-warn {
  background: var(--yellow);
  color: #fff;
  border-color: var(--yellow);
  box-shadow: var(--shadow-sm);
}
.btn-warn:hover:not(:disabled) {
  filter: brightness(0.9);
  box-shadow: var(--shadow-md);
}

.btn-danger {
  background: var(--red);
  color: #fff;
  border-color: var(--red);
  box-shadow: var(--shadow-sm);
}
.btn-danger:hover:not(:disabled) {
  background: var(--red-hover);
  border-color: var(--red-hover);
  box-shadow: var(--shadow-md);
}

.btn-muted {
  background: var(--surface);
  color: var(--text2);
  border: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}
.btn-muted:hover:not(:disabled) {
  border-color: var(--border-focus);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
</style>
