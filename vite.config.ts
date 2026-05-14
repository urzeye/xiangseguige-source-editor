import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import https from "node:https";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

function fetchPageMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  if (!req.url?.startsWith("/api/fetch-page")) return next();

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const qs = req.url.includes("?")
    ? req.url.slice(req.url.indexOf("?") + 1)
    : "";
  const rawUrl = new URLSearchParams(qs).get("url");

  if (!rawUrl) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "missing url" }));
    return;
  }

  let targetUrl: string;
  try {
    new URL(rawUrl);
    targetUrl = rawUrl;
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "invalid url" }));
    return;
  }

  const mod = targetUrl.startsWith("https") ? https : http;
  const request = mod.get(
    targetUrl,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      timeout: 15000,
    },
    (proxyRes) => {
      // Follow redirects by re-fetching the location
      if (
        proxyRes.statusCode &&
        proxyRes.statusCode >= 300 &&
        proxyRes.statusCode < 400 &&
        proxyRes.headers.location
      ) {
        res.end(
          JSON.stringify({
            error: "redirect",
            location: proxyRes.headers.location,
          }),
        );
        return;
      }
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const body = Buffer.concat(chunks);
        const ct = proxyRes.headers["content-type"] || "";
        let html: string;
        if (
          ct.includes("gbk") ||
          ct.includes("gb2312") ||
          ct.includes("gb18030")
        ) {
          try {
            html = new TextDecoder("gbk").decode(body);
          } catch {
            html = body.toString("latin1");
          }
        } else {
          html = body.toString("utf-8");
          const metaCharset = html
            .match(/charset[=:]["']?\s*([\w-]+)/i)?.[1]
            ?.toLowerCase();
          if (
            metaCharset &&
            (metaCharset.includes("gbk") ||
              metaCharset.includes("gb2312") ||
              metaCharset.includes("gb18030"))
          ) {
            try {
              html = new TextDecoder("gbk").decode(body);
            } catch {
              // keep utf-8
            }
          }
        }
        if (html.length > 80000)
          html = html.slice(0, 80000) + "\n<!-- truncated -->";
        res.end(
          JSON.stringify({ html, status: proxyRes.statusCode, url: targetUrl }),
        );
      });
    },
  );
  request.on("error", (err: Error) => {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: err.message }));
  });
  request.on("timeout", () => {
    request.destroy();
    res.statusCode = 504;
    res.end(JSON.stringify({ error: "timeout" }));
  });
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: "fetch-page-proxy",
      configureServer(server) {
        server.middlewares.use(fetchPageMiddleware);
      },
    },
  ],
  base: "./",
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
