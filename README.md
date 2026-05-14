# XBS 书源编辑器 · xiangseguige-source-editor

> 香色闺阁（XBS / xiangseguige）书源的可视化编辑与 AI 生成工具，在浏览器本地运行，无需服务器。

[![在线使用](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%BF%E7%94%A8-GitHub%20Pages-blue)](https://urzeye.github.io/xiangseguige-source-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 功能

| 功能 | 说明 |
|---|---|
| **XBS ↔ JSON 转换** | 解密 `.xbs` 书源文件为可读 JSON，或将 JSON 重新加密为 `.xbs` |
| **JSON 编辑器** | 带语法高亮的全功能 JSON 编辑，支持格式化 |
| **书源管理** | 解析书源数组，逐条查看、启用/禁用、删除，按需导出 |
| **AI 生成书源** | 输入小说网站 URL，AI 自动抓取并分析真实页面，生成完整 XBS 书源 JSON |

---

## 快速开始（在线使用）

直接访问：**[https://urzeye.github.io/xiangseguige-source-editor](https://urzeye.github.io/xiangseguige-source-editor)**

无需安装，浏览器即用。所有数据处理均在本地完成，不会上传到任何服务器。

---

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

开发服务器启动后访问 `http://localhost:5173`。

---

## 使用说明

### 一、XBS 文件编辑

1. 将 `.xbs` 文件拖拽到首页，或点击「导入 XBS」选择文件
2. 工具自动解密并展示 JSON 内容，可直接编辑
3. 编辑完成后点击「导出 XBS」重新加密下载，或「导出 JSON」保存明文

### 二、书源管理

1. 导入包含多个书源的 `.xbs` 或 `.json` 文件后，切换到「书源管理」标签
2. 可逐条查看书源详情、启用/禁用、删除
3. 支持「仅导出启用的书源」，方便精简管理

### 三、AI 生成书源

AI 生成功能会真实抓取目标网站的多个页面（首页、搜索结果、书籍详情、章节列表、章节正文），再交给大模型分析生成完整的 XBS 书源规则。

#### 配置步骤

**1. 填写 AI 模型信息**

| 字段 | 说明 |
|---|---|
| API Base URL | OpenAI 兼容接口地址，如 `https://api.openai.com/v1` |
| API Key | 你的 API Key，以 `sk-` 开头 |
| 模型 | 推荐 `gpt-4o` 或 `deepseek-chat` |

**2. 选择页面抓取代理**

由于浏览器跨域限制，工具无法直接抓取目标网站，需要通过代理中转：

- **本地开发**：选「本地开发（/api/fetch-page）」，Vite 内置代理自动处理
- **作者提供的 CF Worker**：可直接使用，无需配置（不保证稳定性）
- **自定义 Worker**：自行部署，稳定性最佳（推荐）

#### 部署自己的 Cloudflare Worker（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages
2. 点击「创建 Worker」
3. 将 [`public/cf-worker/fetch-proxy.js`](public/cf-worker/fetch-proxy.js) 的内容复制粘贴进编辑器
4. 保存并部署，复制 Worker URL
5. 在工具中选「自定义 Worker URL」，填入你的 Worker 地址

**3. 输入目标站点和测试书名**

| 字段 | 说明 | 示例 |
|---|---|---|
| 目标站点 | 小说网站主页 URL | `https://www.example.com` |
| 测试书名 | 用于搜索和实测抓取，默认《斗罗大陆》 | `斗罗大陆` |

**4. 点击「开始生成」**

AI 会依次完成 7 个步骤：

```
1. 获取站点首页
2. 搜索测试书名
3. 获取书籍详情页
4. 获取章节列表
5. 读取第一章正文
6. AI 分析生成书源 JSON
7. 解析并验证结果
```

生成完成后，复制 JSON 手动导入到香色闺阁 App，或下载后在工具中加密为 `.xbs`。

> ⚠️ 生成的书源规则基于 AI 对真实 HTML 的分析，准确率较高但不保证 100% 可用，建议在香色闺阁中测试验证后再使用。

---

## 技术栈

- [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/)
- [CodeMirror 6](https://codemirror.net/) — JSON 编辑器
- [Pinia](https://pinia.vuejs.org/) — 状态管理
- XXTEA 算法 — `.xbs` 文件加解密

---

## 关于香色闺阁 / XBS

香色闺阁（xiangseguige）是一款主流小说 & 漫画阅读 App，使用自定义书源规则（`.xbs` 格式）聚合各小说网站内容。本工具用于辅助制作和管理这些书源规则。

书源制作参考：[UFOAlastor/xiangseguige](https://github.com/UFOAlastor/xiangseguige)

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=urzeye/xiangseguige-source-editor&type=Date)](https://star-history.com/#urzeye/xiangseguige-source-editor&Date)

---

## License

MIT
