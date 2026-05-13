<template>
  <div class="sources-view">
    <!-- Toolbar -->
    <div class="s-toolbar">
      <div class="s-stats">
        共 <strong>{{ store.sourceCount }}</strong> 个书源， 启用
        <strong class="green">{{ store.enabledCount }}</strong
        >， 禁用
        <strong class="muted">{{
          store.sourceCount - store.enabledCount
        }}</strong>
      </div>
      <input
        v-model="search"
        class="s-search"
        placeholder="搜索书源名称或网址…"
        @input="resetPage"
      />
      <div class="s-actions">
        <button
          class="btn btn-xs btn-success"
          @click="store.setAllEnabled(true)"
        >
          全部启用
        </button>
        <button
          class="btn btn-xs btn-muted"
          @click="store.setAllEnabled(false)"
        >
          全部禁用
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th
              @click="setSort('sourceName')"
              :class="sortClass('sourceName')"
            >
              书源名称
            </th>
            <th
              @click="setSort('sourceUrl')"
              :class="sortClass('sourceUrl')"
            >
              网址
            </th>
            <th
              @click="setSort('enable')"
              :class="sortClass('enable')"
            >
              状态
            </th>
            <th
              @click="setSort('weight')"
              :class="sortClass('weight')"
            >
              权重
            </th>
            <th
              @click="setSort('lastModifyTime')"
              :class="sortClass('lastModifyTime')"
            >
              修改时间
            </th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in pagedRows"
            :key="row._key"
          >
            <td
              class="td-name"
              :title="row.sourceName"
            >
              {{ row.sourceName }}
            </td>
            <td class="td-url">
              <a
                v-if="row.sourceUrl"
                :href="row.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ row.sourceUrl }}
              </a>
              <span
                v-else
                class="muted"
                >—</span
              >
            </td>
            <td>
              <span :class="['badge', row.enable ? 'badge-on' : 'badge-off']">
                {{ row.enable ? "启用" : "禁用" }}
              </span>
            </td>
            <td>{{ row.weight }}</td>
            <td class="td-date">{{ formatDate(row.lastModifyTime) }}</td>
            <td class="td-ops">
              <button
                class="btn btn-xs"
                :class="row.enable ? 'btn-warn' : 'btn-success'"
                @click="store.toggleSource(row._key)"
              >
                {{ row.enable ? "禁用" : "启用" }}
              </button>
              <button
                class="btn btn-xs btn-danger"
                @click="confirmDelete(row._key, row.sourceName)"
              >
                删除
              </button>
            </td>
          </tr>
          <tr v-if="filteredRows.length === 0">
            <td
              colspan="6"
              class="empty"
            >
              未找到匹配书源
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="pagination"
    >
      <button
        class="btn btn-xs btn-muted"
        :disabled="page <= 1"
        @click="page--"
      >
        ‹ 上一页
      </button>
      <span class="page-info"
        >{{ page }} / {{ totalPages }}（共 {{ filteredRows.length }} 条）</span
      >
      <button
        class="btn btn-xs btn-muted"
        :disabled="page >= totalPages"
        @click="page++"
      >
        下一页 ›
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditorStore } from "@/stores/editor";
import type { BookSource } from "@/lib/types";

const store = useEditorStore();

const search = ref("");
const sortKey = ref<keyof BookSource>("sourceName");
const sortDir = ref<1 | -1>(1);
const page = ref(1);
const PAGE_SIZE = 20;

function setSort(key: keyof BookSource) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1;
  else {
    sortKey.value = key;
    sortDir.value = 1;
  }
  page.value = 1;
}

function sortClass(key: string) {
  if (sortKey.value !== key) return "sortable";
  return sortDir.value === 1 ? "sort-asc" : "sort-desc";
}

function resetPage() {
  page.value = 1;
}

const filteredRows = computed(() => {
  const q = search.value.toLowerCase();
  let rows = store.sources;
  if (q)
    rows = rows.filter(
      (r) =>
        r.sourceName.toLowerCase().includes(q) ||
        r.sourceUrl.toLowerCase().includes(q),
    );
  return [...rows].sort((a, b) => {
    let av: unknown = a[sortKey.value],
      bv: unknown = b[sortKey.value];
    if (typeof av === "boolean") av = av ? 1 : 0;
    if (typeof bv === "boolean") bv = bv ? 1 : 0;
    if ((av as number | string) < (bv as number | string))
      return -sortDir.value;
    if ((av as number | string) > (bv as number | string)) return sortDir.value;
    return 0;
  });
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)),
);

const pagedRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return filteredRows.value.slice(start, start + PAGE_SIZE);
});

function formatDate(v: string | number): string {
  if (!v) return "—";
  const d = new Date(typeof v === "number" ? v : Number(v) || v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("zh-CN");
}

function confirmDelete(key: string, name: string) {
  if (confirm(`确定删除书源「${name}」？`)) store.deleteSource(key);
}
</script>

<style scoped>
.sources-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 0;
}

.s-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.s-stats {
  font-size: 13px;
  color: var(--text2);
  flex-shrink: 0;
}
.s-stats strong {
  color: var(--text);
}
.s-stats strong.green {
  color: var(--green);
}
.s-stats strong.muted {
  color: var(--text3);
}
.s-search {
  flex: 1;
  min-width: 200px;
  max-width: 320px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 6px 12px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.s-search:focus {
  border-color: var(--accent);
}
.s-search::placeholder {
  color: var(--text3);
}
.s-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.table-scroll {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
.table-scroll::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.table-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th {
  padding: 9px 14px;
  text-align: left;
  color: var(--text3);
  font-weight: 600;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}
th.sortable {
  cursor: pointer;
}
th.sortable:hover {
  color: var(--text);
}
th.sort-asc::after {
  content: " ↑";
  color: var(--accent);
}
th.sort-desc::after {
  content: " ↓";
  color: var(--accent);
}

td {
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
tr:last-child td {
  border-bottom: none;
}
tr:hover td {
  background: rgba(108, 143, 255, 0.04);
}

.td-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.td-url {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.td-url a {
  color: var(--accent);
  text-decoration: none;
  font-size: 12px;
}
.td-url a:hover {
  text-decoration: underline;
}
.td-date {
  white-space: nowrap;
  color: var(--text3);
  font-size: 12px;
}
.td-ops {
  display: flex;
  gap: 5px;
  white-space: nowrap;
}
.muted {
  color: var(--text3);
}
.empty {
  text-align: center;
  color: var(--text3);
  padding: 32px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}
.badge-on {
  background: rgba(52, 211, 153, 0.15);
  color: var(--green);
}
.badge-off {
  background: rgba(100, 116, 139, 0.15);
  color: var(--text3);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface2);
  flex-shrink: 0;
}
.page-info {
  font-size: 13px;
  color: var(--text3);
}

</style>
