<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import mdContent from "../../香色闺阁书源规则.md?raw";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const htmlContent = computed(() => marked(mdContent) as string);
</script>

<template>
  <div class="docs-outer">
    <div class="docs-scroll">
      <article class="docs-article" v-html="htmlContent"></article>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.docs-outer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
}

.docs-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 48px 24px 80px;
}

.docs-article {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.75;
  color: var(--text);
  font-size: 15px;
}

/* ── Headings ── */
.docs-article :deep(h1) {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin: 0 0 8px;
  line-height: 1.2;
}

.docs-article :deep(h1 + p) {
  color: var(--text2);
  font-size: 0.9375rem;
  margin-top: 0;
  margin-bottom: 40px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 24px;
}

.docs-article :deep(h2) {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--text);
  margin: 48px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border);
  position: relative;
}

.docs-article :deep(h2)::before {
  content: "";
  display: inline-block;
  width: 3px;
  height: 1.375rem;
  background: var(--accent);
  border-radius: 2px;
  margin-right: 10px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}

.docs-article :deep(h3) {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text);
  margin: 32px 0 12px;
}

.docs-article :deep(h4) {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  margin: 24px 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.8125rem;
  color: var(--text3);
}

/* ── Paragraphs & Body Text ── */
.docs-article :deep(p) {
  margin: 12px 0;
  color: var(--text);
}

.docs-article :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: opacity 0.15s;
}
.docs-article :deep(a:hover) {
  opacity: 0.65;
}

/* ── Lists ── */
.docs-article :deep(ul),
.docs-article :deep(ol) {
  padding-left: 1.5em;
  margin: 12px 0;
}

.docs-article :deep(li) {
  margin: 6px 0;
  line-height: 1.7;
}

.docs-article :deep(li > ul),
.docs-article :deep(li > ol) {
  margin: 4px 0;
}

/* ── Code ── */
.docs-article :deep(code) {
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace;
  font-size: 0.85em;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
  color: #c7254e;
  white-space: nowrap;
}

.docs-article :deep(pre) {
  background: #1a1a1a;
  border-radius: 10px;
  padding: 20px 24px;
  margin: 20px 0;
  overflow-x: auto;
  box-shadow: var(--shadow-md);
  position: relative;
}

.docs-article :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  color: #e2e8f0;
  font-size: 0.8125rem;
  line-height: 1.7;
  white-space: pre;
  word-break: normal;
}

/* ── Blockquote ── */
.docs-article :deep(blockquote) {
  border-left: 3px solid var(--accent);
  margin: 20px 0;
  padding: 12px 20px;
  background: var(--surface2);
  border-radius: 0 8px 8px 0;
  color: var(--text2);
}

.docs-article :deep(blockquote p) {
  margin: 0;
  font-style: italic;
}

/* ── Table ── */
.docs-article :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0;
  font-size: 0.875rem;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--border);
}

.docs-article :deep(thead) {
  background: var(--surface2);
}

.docs-article :deep(th) {
  padding: 10px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
}

.docs-article :deep(td) {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: top;
}

.docs-article :deep(tr:last-child td) {
  border-bottom: none;
}

.docs-article :deep(tr:nth-child(even)) {
  background: #fcfcfc;
}

.docs-article :deep(tr:hover td) {
  background: var(--surface2);
  transition: background 0.1s;
}

/* ── Horizontal Rule ── */
.docs-article :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 40px 0;
}

/* ── Strong & Em ── */
.docs-article :deep(strong) {
  font-weight: 600;
  color: var(--text);
}

.docs-article :deep(em) {
  font-style: italic;
  color: var(--text2);
}
</style>
