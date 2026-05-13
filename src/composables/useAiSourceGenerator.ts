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

// Fetch a page HTML via Vite dev proxy
async function fetchPage(url: string): Promise<string> {
  const res = await fetch("/api/fetch-page?url=" + encodeURIComponent(url));
  if (!res.ok) throw new Error("代理请求失败: " + res.status);
  const data = (await res.json()) as { html?: string; error?: string; status?: number };
  if (data.error) throw new Error(data.error);
  if (!data.html) throw new Error("未获取到页面内容");
  return data.html;
}

// Extract key structural HTML — keep forms, lists, tables, nav, headings, meta
// Drop script/style/svg/img to reduce token count
function extractStructure(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 30000);
}

function buildSystemPrompt(): string {
  return `你是香色闺阁（XBS）书源规则专家。
香色闺阁是一款中文小说阅读 App，其书源 JSON 格式如下（以两个真实书源为例）：

示例1 - XPath 搜索（GET 请求）:
{
  "sourceName": "零零小说网",
  "sourceUrl": "https://www.00shu.com",
  "enable": 1,
  "weight": "9000",
  "lastModifyTime": 0,
  "searchBook": {
    "actionID": "searchBook",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.00shu.com",
    "requestInfo": "https://www.00shu.com/modules/article/search.php?q=%@keyWord&p=%@pageIndex",
    "list": "//tr",
    "bookName": "//td[1][@class='odd']",
    "author": "//td[3][@class='odd']",
    "detailUrl": "//td[@class='odd']/a/@href",
    "validConfig": ""
  },
  "bookDetail": {
    "actionID": "bookDetail",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.00shu.com",
    "cover": "//meta[@property='og:image']/@content",
    "desc": "//meta[@property='og:description']/@content",
    "cat": "//meta[@property='og:novel:category']/@content",
    "validConfig": ""
  },
  "chapterList": {
    "actionID": "chapterList",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.00shu.com",
    "list": "//div[@id='list']/dl/dd",
    "title": "//a",
    "url": "//a/@href",
    "validConfig": ""
  },
  "chapterContent": {
    "actionID": "chapterContent",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "https://www.00shu.com",
    "content": "//div[@id='content']",
    "validConfig": ""
  }
}

示例2 - JS requestInfo（POST 请求）:
{
  "sourceName": "黄易小说网",
  "sourceUrl": "http://www.xhytd.com",
  "enable": 1,
  "weight": "9000",
  "lastModifyTime": 0,
  "searchBook": {
    "actionID": "searchBook",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "http://www.xhytd.com",
    "requestInfo": "@js:\\nlet url = config.host+'/search.html';\\nlet hp = {'name': params.keyWord};\\nreturn {'url': url, 'POST': false, 'httpParams': hp, forbidCookie: true, cacheTime: 3600};",
    "list": "//div[@class='novelslist2']//li",
    "bookName": "//span[@class='s2 wid']/a/text()",
    "author": "//span[@class='s4 wid']/a/text()",
    "detailUrl": "//span[@class='s2 wid']/a/@href",
    "validConfig": ""
  },
  "bookDetail": {
    "actionID": "bookDetail",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "http://www.xhytd.com",
    "cover": "//div[@id='fmimg']/img/@src",
    "validConfig": ""
  },
  "chapterList": {
    "actionID": "chapterList",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "http://www.xhytd.com",
    "list": "//div[@id='list']/dl/dd",
    "title": "//a/text()",
    "url": "//a/@href",
    "validConfig": ""
  },
  "chapterContent": {
    "actionID": "chapterContent",
    "parserID": "DOM",
    "responseFormatType": "html",
    "host": "http://www.xhytd.com",
    "content": "//div[@id='content']",
    "validConfig": ""
  }
}

规则说明：
- XPath 选择器：以 // 开头，如 //div[@id='list']//li
- CSS 选择器：直接写，如 .book-list .item
- 属性提取：XPath 用 /@src，CSS 用 @src 后缀
- 文本提取：XPath 用 /text()，CSS 省略（默认取文本）
- requestInfo 两种形式：
  1. URL 模板：%@keyWord、%@pageIndex 是占位符
  2. @js: 开头的 JS 代码：可以访问 config.host、params.keyWord、params.pageIndex
- 如果搜索是 POST 请求，用 JS requestInfo 设置 POST:true 和 httpParams
- parserID 通常为 "DOM"，responseFormatType 通常为 "html"
- 其他模块（shupingList、shudanList、bookWorld 等）留空对象 {}

返回格式：只输出一个合法 JSON 对象，不要有任何解释、markdown 代码块、注释。
JSON 必须包含以下顶层字段：
sourceName, sourceUrl, enable (=1), weight (="9000"), lastModifyTime (=0),
searchBook, bookDetail, chapterList, chapterContent,
shupingList (={}), shudanList (={}), bookWorld (={}),
shupingHome (={}), shudanDetail (={}), relatedWord (={}), searchShudan ({})`;
}

async function callLLM(
  config: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  onChunk?: (text: string) => void
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

  // Streaming
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
  // Strip markdown code blocks if present
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned) as Record<string, unknown>;
}

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
    aiConfig: AiConfig
  ): Promise<GeneratedSource | null> {
    running.value = true;
    result.value = null;
    error.value = null;
    streamText.value = "";

    steps.value = [
      { label: "获取站点首页 HTML", status: "pending" },
      { label: "获取搜索页面 HTML", status: "pending" },
      { label: "调用大模型分析生成书源", status: "pending" },
      { label: "解析并验证 JSON", status: "pending" },
    ];

    try {
      // Step 1: fetch homepage
      setStep(0, { status: "running" });
      let homeHtml: string;
      try {
        homeHtml = await fetchPage(siteUrl);
        setStep(0, { status: "done", detail: `${homeHtml.length} 字符` });
      } catch (e) {
        setStep(0, { status: "error", detail: String(e) });
        throw e;
      }

      // Step 2: try to find search page
      setStep(1, { status: "running" });
      let searchHtml = "";
      try {
        // Guess common search URL patterns
        const base = new URL(siteUrl);
        const candidates = [
          `${base.origin}/search.html`,
          `${base.origin}/search.php`,
          `${base.origin}/modules/article/search.php?q=斗罗大陆`,
          `${base.origin}/search?q=斗罗大陆`,
          `${base.origin}/s?key=斗罗大陆`,
        ];
        for (const url of candidates) {
          try {
            searchHtml = await fetchPage(url);
            if (searchHtml.length > 500) break;
          } catch {
            // try next
          }
        }
        setStep(1, {
          status: "done",
          detail: searchHtml ? `${searchHtml.length} 字符` : "未找到，跳过",
        });
      } catch {
        setStep(1, { status: "done", detail: "跳过" });
      }

      // Step 3: call LLM
      setStep(2, { status: "running" });
      const homeStructure = extractStructure(homeHtml);
      const searchStructure = searchHtml ? extractStructure(searchHtml) : "";

      const userPrompt = `请根据以下小说网站的 HTML 结构，生成完整的香色闺阁书源 JSON。

站点 URL: ${siteUrl}

【首页 HTML（结构）】
${homeStructure.slice(0, 15000)}

${searchStructure ? `【搜索页 HTML（结构）】（使用关键词"斗罗大陆"测试）\n${searchStructure.slice(0, 12000)}` : "（未能获取搜索页）"}

请仔细分析 HTML 结构，推导出正确的 XPath 或 CSS 选择器，生成完整书源 JSON。`;

      let llmText = "";
      try {
        llmText = await callLLM(
          aiConfig,
          buildSystemPrompt(),
          userPrompt,
          (chunk) => {
            streamText.value += chunk;
          }
        );
        setStep(2, { status: "done" });
      } catch (e) {
        setStep(2, { status: "error", detail: String(e) });
        throw e;
      }

      // Step 4: parse JSON
      setStep(3, { status: "running" });
      let raw: Record<string, unknown>;
      try {
        raw = parseJsonFromResponse(llmText || streamText.value);
        setStep(3, { status: "done" });
      } catch (e) {
        setStep(3, { status: "error", detail: "JSON 解析失败: " + String(e) });
        throw new Error("模型返回的内容不是合法 JSON，请重试或手动调整。\n" + String(e));
      }

      // Ensure required fields
      const warnings: string[] = [];
      if (!raw.sourceName) {
        raw.sourceName = new URL(siteUrl).hostname;
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
