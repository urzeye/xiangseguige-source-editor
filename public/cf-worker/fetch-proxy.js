/**
 * XBS Editor — Cloudflare Worker 页面抓取代理
 *
 * 部署步骤：
 * 1. 登录 https://dash.cloudflare.com，进入 Workers & Pages
 * 2. 点击「创建 Worker」，将此文件内容粘贴进编辑器，保存并部署
 * 3. 复制 Worker 的 URL（如 https://fetch-proxy.xxx.workers.dev）
 * 4. 在 XBS Editor 的「AI 生成配置 → 页面抓取代理 URL」中填入该地址
 *
 * 接口：GET /?url=<encoded_target_url>
 * 响应：{ html: string, status: number } | { error: string }
 */

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...CORS_HEADERS,
		},
	});
}

export default {
	async fetch(request) {
		// CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: CORS_HEADERS });
		}

		const { searchParams } = new URL(request.url);
		const targetUrl = searchParams.get("url");

		if (!targetUrl) return json({ error: "missing url param" }, 400);

		let parsedUrl;
		try {
			parsedUrl = new URL(targetUrl);
		} catch {
			return json({ error: "invalid url" }, 400);
		}

		// Only allow http / https
		if (!["http:", "https:"].includes(parsedUrl.protocol)) {
			return json({ error: "unsupported protocol" }, 400);
		}

		try {
			const res = await fetch(parsedUrl.toString(), {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
				},
				redirect: "follow",
				signal: AbortSignal.timeout(15000),
			});

			const html = await res.text();
			return json({ html, status: res.status });
		} catch (e) {
			return json({ error: String(e) }, 500);
		}
	},
};
