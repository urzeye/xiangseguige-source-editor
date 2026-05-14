import { ref } from "vue";
import type { AiConfig } from "@/stores/aiConfig";

export interface GenerateStep {
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

export interface GeneratedSource {
  raw: Record<string, unknown>;
  warning?: string;
}

// ──────────────────────────────────────────────────────────
// HTTP helpers
// ──────────────────────────────────────────────────────────

async function fetchPage(url: string, proxyUrl: string): Promise<string> {
  const endpoint =
    proxyUrl.replace(/\/$/, "") + "?url=" + encodeURIComponent(url);
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error("代理请求失败: " + res.status);
  const data = (await res.json()) as {
    html?: string;
    error?: string;
    status?: number;
  };
  if (data.error) throw new Error(data.error);
  if (!data.html) throw new Error("未获取到页面内容");
  return data.html;
}

// ──────────────────────────────────────────────────────────
// HTML processing utilities
// ──────────────────────────────────────────────────────────

function cleanHtml(html: string, maxLen = 20000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/gi, "[img]")
    .replace(/\s{2,}/g, " ")
    .slice(0, maxLen);
}

function extractText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, "\n")
    .trim();
}

// ──────────────────────────────────────────────────────────
// Heuristic URL extraction
// ──────────────────────────────────────────────────────────

interface Anchor {
  href: string;
  text: string;
  score: number;
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function collectAnchors(html: string): Array<{ href: string; text: string }> {
  const re = /<a[^>]+href=["']([^"'\s>]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const results: Array<{ href: string; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("javascript") ||
      href === "/"
    )
      continue;
    results.push({ href, text });
  }
  return results;
}

function findBookUrl(searchHtml: string, siteUrl: string): string | null {
  const anchors = collectAnchors(searchHtml);
  const scored: Anchor[] = anchors.map(({ href, text }) => {
    let score = 0;
    if (/\/(book|xs|novel|info|detail|view|article|read)\//i.test(href))
      score += 5;
    if (/\/\d{3,}(\/|\.html?)?$/.test(href)) score += 4;
    if (/\.html?$/.test(href)) score += 1;
    if (/\/(search|login|register|user|category|tag|page|sort|order)/i.test(href))
      score -= 20;
    if (/\/(about|contact|help|faq|privacy|terms)/i.test(href)) score -= 10;
    if (/[?&]page?=/i.test(href)) score -= 5;
    if (text.length > 0 && text.length < 40) score += 2;
    if (text.length > 50) score -= 3;
    return { href, text, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((a) => a.score >= 3);
  if (!best) return null;
  return resolveUrl(best.href, siteUrl);
}

function findFirstChapterUrl(html: string, siteUrl: string): string | null {
  const anchors = collectAnchors(html);
  const scored: Anchor[] = anchors.map(({ href, text }) => {
    let score = 0;
    if (/^第[零一二三四五六七八九十百千\d]+章/.test(text)) score += 15;
    if (/^(序章|楔子|引子|前言|卷首语|第一章|第1章)/.test(text)) score += 13;
    if (/第.{0,4}章/.test(text)) score += 8;
    if (/\/(read|chapter|content|p|c|chap)\//i.test(href)) score += 5;
    if (/\d+\.html?$/.test(href)) score += 2;
    if (/\/(login|register|user|search|about)/i.test(href)) score -= 20;
    return { href, text, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored.find((a) => a.score >= 5);
  if (!best) return null;
  return resolveUrl(best.href, siteUrl);
}

function extractAdCandidates(chapterHtml: string): string[] {
  const text = extractText(chapterHtml);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && l.length < 200);

  const adPatterns = [
    /收藏|书签|加入书架|推荐票|月票/,
    /手机版|手机阅读|移动端|wap/i,
    /www\.|https?:|\.com|\.net|\.cn|\.org/i,
    /请记住|本书网址|本站|更新最快|最快更新/,
    /txt|epub|mobi|电子书|下载/i,
    /广告|支持正版|赞助商/,
    /回车键|章节错误|字体大小|背景颜色/,
    /关注|微信|公众号|二维码/,
    /如果你觉得.*好看|觉得不错|推荐给|分享给/,
    /温馨提示|特别声明|版权声明/,
  ];

  return lines.filter((line) => adPatterns.some((p) => p.test(line)));
}

// ──────────────────────────────────────────────────────────
// LLM communication
// ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `你是香色闺阁（XBS）书源规则专家。根据用户提供的真实小说网站 HTML，生成完整的 XBS 书源 JSON。

━━━ 完整格式模板 ━━━

{
  "sourceName": "网站名称",
  "sourceUrl": "https://www.example.com",
  "enable": 1,
  "weight": "9000",
  "lastModifyTime": 0,
  "httpHeaders": "",

  "searchBook": {
    "actionID": "searchBook",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.example.com",
    "requestInfo": "https://www.example.com/search?q=%@keyWord&page=%@pageIndex",
    "list": "//ul[@class='book-list']//li",
    "bookName": "//h3/a/text()",
    "author": "//span[@class='author']/text()",
    "detailUrl": "//h3/a/@href",
    "cover": "//img/@src",
    "desc": "//p[@class='intro']/text()",
    "state": "//span[@class='status']/text()",
    "validConfig": ""
  },

  "bookDetail": {
    "actionID": "bookDetail",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.example.com",
    "bookName": "//meta[@property='og:novel:book_name']/@content",
    "author": "//meta[@property='og:novel:author']/@content",
    "cover": "//meta[@property='og:image']/@content",
    "desc": "//meta[@property='og:description']/@content",
    "cat": "//meta[@property='og:novel:category']/@content",
    "lastChapter": "//meta[@property='og:novel:latest_chapter_name']/@content",
    "state": "//meta[@property='og:novel:status']/@content",
    "updateTime": "//span[@class='update-time']/text()",
    "wordCount": "//span[@class='wordcount']/text()",
    "validConfig": ""
  },

  "chapterList": {
    "actionID": "chapterList",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.example.com",
    "list": "//div[@id='list']//dd",
    "title": "//a/text()",
    "url": "//a/@href",
    "validConfig": ""
  },

  "chapterContent": {
    "actionID": "chapterContent",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.example.com",
    "content": "//div[@id='content']",
    "title": "//h1[@class='title']/text()",
    "filter": "广告词1&&广告词2",
    "validConfig": ""
  },

  "shupingList": {}, "shudanList": {}, "bookWorld": {},
  "shupingHome": {}, "shudanDetail": {}, "relatedWord": {}, "searchShudan": {}
}

━━━ 关键规则 ━━━

【选择器格式】
- XPath（推荐）：以 // 开头。取文本：末尾加 /text()；取属性：末尾加 /@attrName
- CSS：不以 // 开头；取属性在末尾加 @attrName
- JS 后处理：规则末尾加 " || @js: return result.replace(...);"
- 动态请求：requestInfo 以 "@js:" 开头，返回 {url:..., POST:bool, httpParams:{...}}

【searchBook】
- requestInfo：%@keyWord = 搜索词，%@pageIndex = 页码（从 1 开始）
- POST 搜索示例：@js: return {url:config.host+'/search',POST:true,httpParams:{keyword:params.keyWord}};
- list 选择器选中每本书的容器（li 或 div）
- bookName/author/detailUrl/cover/desc/state：在 list 容器内部的相对选择器

【bookDetail】
- 优先使用 og:novel:* meta 标签系列（是小说站标配）
- 没有则用 DOM 选择器

【chapterList】
- 如章节列表和书籍详情在同一页面 → 不填 requestInfo
- 如是独立页面 → requestInfo 填 URL，可用 @bookUrl@ 代表书籍详情 URL

【chapterContent.filter】
- 只支持纯文本精确匹配，多个词用 && 分隔
- 必须从提供的真实正文 HTML 中提取实际出现的广告行，不要凭空猜测

【httpHeaders】
- 如需 Cookie/UA：{"Cookie":"xxx","User-Agent":"Mozilla/5.0..."}

━━━ 输出要求 ━━━
只输出一个合法 JSON 对象，不含任何解释文字、markdown 代码块或注释。`;
}

async function callLLM(
  config: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (text: string) => void,
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      stream: !!onChunk,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API 错误 ${res.status}: ${errText.slice(0, 200)}`);
  }

  if (!onChunk) {
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? "";
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const obj = JSON.parse(data) as {
          choices: Array<{ delta: { content?: string } }>;
        };
        const delta = obj.choices[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // skip malformed SSE line
      }
    }
  }
  return full;
}

function parseJsonFromResponse(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned) as Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────
// Composable
// ──────────────────────────────────────────────────────────

export function useAiSourceGenerator() {
  const steps = ref<GenerateStep[]>([]);
  const running = ref(false);
  const streamText = ref("");
  const result = ref<GeneratedSource | null>(null);
  const error = ref<string | null>(null);

  function setStep(index: number, patch: Partial<GenerateStep>) {
    if (steps.value[index]) Object.assign(steps.value[index], patch);
  }

  async function generate(
    siteUrl: string,
    testBook: string,
    aiConfig: AiConfig,
  ): Promise<GeneratedSource | null> {
    running.value = true;
    result.value = null;
    error.value = null;
    streamText.value = "";

    const bookName = testBook.trim() || "斗罗大陆";

    let base: URL;
    try {
      base = new URL(siteUrl);
    } catch {
      error.value = "站点 URL 格式错误";
      running.value = false;
      return null;
    }

    if (!aiConfig.proxyUrl) {
      error.value =
        "请先在配置中填写页面抓取代理 URL（部署 Cloudflare Worker 后填入）";
      running.value = false;
      return null;
    }

    const proxy = aiConfig.proxyUrl;

    steps.value = [
      { label: "获取站点首页", status: "pending" },
      { label: `搜索《${bookName}》`, status: "pending" },
      { label: "获取书籍详情页", status: "pending" },
      { label: "获取章节列表", status: "pending" },
      { label: "读取第一章正文", status: "pending" },
      { label: "AI 分析生成书源", status: "pending" },
      { label: "解析并验证 JSON", status: "pending" },
    ];

    let homeHtml = "";
    let searchHtml = "";
    let bookDetailHtml = "";
    let bookDetailUrl = "";
    let chapterListHtml = "";
    let chapterListUrl = "";
    let chapterHtml = "";
    let firstChapterUrl = "";
    let adCandidates: string[] = [];

    try {
      // ── Step 0: Homepage ────────────────────────────────
      setStep(0, { status: "running" });
      try {
        homeHtml = await fetchPage(siteUrl, proxy);
        setStep(0, { status: "done", detail: `${homeHtml.length} 字符` });
      } catch (e) {
        setStep(0, { status: "error", detail: String(e) });
        throw e;
      }

      // ── Step 1: Search ──────────────────────────────────
      setStep(1, { status: "running" });
      try {
        const candidates = [
          `${base.origin}/search.html?q=${encodeURIComponent(bookName)}`,
          `${base.origin}/search?q=${encodeURIComponent(bookName)}`,
          `${base.origin}/search?key=${encodeURIComponent(bookName)}`,
          `${base.origin}/search?keyword=${encodeURIComponent(bookName)}`,
          `${base.origin}/search?searchkey=${encodeURIComponent(bookName)}`,
          `${base.origin}/modules/article/search.php?searchkey=${encodeURIComponent(bookName)}`,
          `${base.origin}/s?key=${encodeURIComponent(bookName)}`,
          `${base.origin}/so/${encodeURIComponent(bookName)}.html`,
          `${base.origin}/search/${encodeURIComponent(bookName)}/`,
        ];
        for (const url of candidates) {
          try {
            const html = await fetchPage(url, proxy);
            if (html.length > 500 && html.includes(bookName.slice(0, 2))) {
              searchHtml = html;
              break;
            }
          } catch {
            // try next
          }
        }
        setStep(1, {
          status: "done",
          detail: searchHtml
            ? `${searchHtml.length} 字符`
            : "未找到搜索结果，跳过",
        });
      } catch {
        setStep(1, { status: "done", detail: "跳过" });
      }

      // ── Step 2: Book detail ─────────────────────────────
      setStep(2, { status: "running" });
      if (searchHtml) {
        try {
          bookDetailUrl = findBookUrl(searchHtml, siteUrl) ?? "";
          if (bookDetailUrl) {
            bookDetailHtml = await fetchPage(bookDetailUrl, proxy);
            setStep(2, { status: "done", detail: bookDetailUrl });
          } else {
            setStep(2, {
              status: "done",
              detail: "未能从搜索结果提取书籍链接，跳过",
            });
          }
        } catch (e) {
          setStep(2, {
            status: "done",
            detail: `获取失败: ${String(e).slice(0, 80)}`,
          });
        }
      } else {
        setStep(2, { status: "done", detail: "无搜索结果，跳过" });
      }

      // ── Step 3: Chapter list ────────────────────────────
      setStep(3, { status: "running" });
      if (bookDetailHtml) {
        if (/第[零一二三四五六七八九十百千\d]+章|第[一1]卷/.test(bookDetailHtml)) {
          chapterListHtml = bookDetailHtml;
          chapterListUrl = bookDetailUrl;
          setStep(3, { status: "done", detail: "与书籍详情同页面" });
        } else {
          const catalogCandidates = [
            bookDetailUrl.replace(/\/info\/(\d+)\/?.*$/, "/catalog/$1/"),
            bookDetailUrl.replace(/\/book\/(\d+)\/?.*$/, "/catalog/$1/"),
            bookDetailUrl.replace(/\.html?$/, "/catalog.html"),
            bookDetailUrl.replace(/\.html?$/, "/"),
            bookDetailUrl + "catalog/",
          ].filter((u, i, arr) => u !== bookDetailUrl && arr.indexOf(u) === i);

          let found = false;
          for (const url of catalogCandidates) {
            try {
              const html = await fetchPage(url, proxy);
              if (/第[零一二三四五六七八九十百千\d]+章|第[一1]卷/.test(html)) {
                chapterListHtml = html;
                chapterListUrl = url;
                setStep(3, { status: "done", detail: `独立页面: ${url}` });
                found = true;
                break;
              }
            } catch {
              // skip
            }
          }
          if (!found) {
            chapterListHtml = bookDetailHtml;
            chapterListUrl = bookDetailUrl;
            setStep(3, {
              status: "done",
              detail: "使用书籍详情页（无独立目录页）",
            });
          }
        }
      } else {
        setStep(3, { status: "done", detail: "无书籍详情，跳过" });
      }

      // ── Step 4: First chapter ───────────────────────────
      setStep(4, { status: "running" });
      if (chapterListHtml) {
        try {
          firstChapterUrl =
            findFirstChapterUrl(chapterListHtml, siteUrl) ?? "";
          if (firstChapterUrl) {
            chapterHtml = await fetchPage(firstChapterUrl, proxy);
            adCandidates = extractAdCandidates(chapterHtml);
            setStep(4, {
              status: "done",
              detail: `${chapterHtml.length} 字符，广告候选词 ${adCandidates.length} 条`,
            });
          } else {
            setStep(4, { status: "done", detail: "未能提取章节链接，跳过" });
          }
        } catch (e) {
          setStep(4, {
            status: "done",
            detail: `获取失败: ${String(e).slice(0, 80)}`,
          });
        }
      } else {
        setStep(4, { status: "done", detail: "无章节列表，跳过" });
      }

      // ── Step 5: AI generation ───────────────────────────
      setStep(5, { status: "running" });

      const parts: string[] = [];
      parts.push(`站点主 URL: ${siteUrl}`);
      parts.push(
        `\n\n【首页 HTML】（分析网站结构、编码、导航等）\n${cleanHtml(homeHtml, 8000)}`,
      );

      if (searchHtml) {
        parts.push(
          `\n\n【搜索《${bookName}》结果页 HTML】（用于推导 searchBook 选择器）\n${cleanHtml(searchHtml, 8000)}`,
        );
      }

      if (bookDetailHtml && bookDetailHtml !== chapterListHtml) {
        parts.push(
          `\n\n【书籍详情页 HTML】（URL: ${bookDetailUrl}）（用于推导 bookDetail 选择器）\n${cleanHtml(bookDetailHtml, 6000)}`,
        );
      }

      if (chapterListHtml) {
        const isSame = chapterListHtml === bookDetailHtml;
        parts.push(
          `\n\n【${isSame ? "书籍详情 + 章节列表" : "章节列表"}页 HTML】（URL: ${chapterListUrl}）\n${cleanHtml(chapterListHtml, 8000)}`,
        );
      }

      if (chapterHtml) {
        parts.push(
          `\n\n【第一章正文 HTML】（URL: ${firstChapterUrl}）（重点分析正文选择器和广告过滤词）\n${cleanHtml(chapterHtml, 8000)}`,
        );
      }

      if (adCandidates.length > 0) {
        parts.push(
          `\n\n【从第一章正文提取的疑似广告文本行（请对照正文 HTML 确认后填入 filter 字段）】\n${adCandidates.slice(0, 20).join("\n")}`,
        );
      }

      parts.push(`\n\n请根据以上真实页面 HTML 生成完整香色闺阁书源 JSON。
注意：
1. 所有选择器必须基于真实 HTML 推导，不要凭空猜测
2. chapterContent.filter 必须使用正文 HTML 中实际存在的广告文字
3. 若章节列表与书籍详情同页，chapterList 不加 requestInfo 字段
4. 若章节 URL 是相对路径，在 url 规则末尾补 " || @js: return '${base.origin}' + result;"`);

      let llmText = "";
      try {
        llmText = await callLLM(
          aiConfig,
          buildSystemPrompt(),
          parts.join(""),
          (chunk) => {
            streamText.value += chunk;
          },
        );
        setStep(5, { status: "done" });
      } catch (e) {
        setStep(5, { status: "error", detail: String(e) });
        throw e;
      }

      // ── Step 6: Parse JSON ──────────────────────────────
      setStep(6, { status: "running" });
      let raw: Record<string, unknown>;
      try {
        raw = parseJsonFromResponse(llmText || streamText.value);
        setStep(6, { status: "done" });
      } catch (e) {
        setStep(6, {
          status: "error",
          detail: "JSON 解析失败: " + String(e),
        });
        throw new Error(
          "模型返回内容不是合法 JSON，请重试或手动调整。\n" + String(e),
        );
      }

      const warnings: string[] = [];
      if (!raw.sourceName) {
        raw.sourceName = base.hostname;
        warnings.push("sourceName 缺失，已用域名代替");
      }
      if (!raw.sourceUrl) raw.sourceUrl = siteUrl;
      if (raw.enable === undefined) raw.enable = 1;

      const out: GeneratedSource = {
        raw,
        warning: warnings.length ? warnings.join("；") : undefined,
      };
      result.value = out;
      return out;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      running.value = false;
    }
  }

  function reset() {
    steps.value = [];
    running.value = false;
    streamText.value = "";
    result.value = null;
    error.value = null;
  }

  return { steps, running, streamText, result, error, generate, reset };
}
