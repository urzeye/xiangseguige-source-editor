import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  base: "./",
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  server: {
    proxy: {
      "/api/fetch-page": {
        target: "http://localhost:5173",
        bypass(req, res) {
          const rawUrl = req.url?.replace("/api/fetch-page?url=", "");
          if (!rawUrl) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "missing url" }));
            return false;
          }
          let targetUrl: string;
          try {
            targetUrl = decodeURIComponent(rawUrl);
            new URL(targetUrl); // validate
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "invalid url" }));
            return false;
          }
          // Use dynamic import-style require for node https/http
          const https = require("https") as typeof import("https");
          const http = require("http") as typeof import("http");
          const mod = targetUrl.startsWith("https") ? https : http;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
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
              // Handle redirects
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
                  })
                );
                return;
              }
              const chunks: Buffer[] = [];
              proxyRes.on("data", (chunk: Buffer) => chunks.push(chunk));
              proxyRes.on("end", () => {
                const body = Buffer.concat(chunks);
                // Try to detect encoding from content-type
                const ct = proxyRes.headers["content-type"] || "";
                let html: string;
                if (ct.includes("gbk") || ct.includes("gb2312") || ct.includes("gb18030")) {
                  try {
                    const { TextDecoder } = require("util");
                    html = new TextDecoder("gbk").decode(body);
                  } catch {
                    html = body.toString("latin1");
                  }
                } else {
                  html = body.toString("utf-8");
                  // Auto-detect from meta charset
                  const metaCharset = html.match(/charset[=:]["']?\s*([\w-]+)/i)?.[1]?.toLowerCase();
                  if (metaCharset && (metaCharset.includes("gbk") || metaCharset.includes("gb2312") || metaCharset.includes("gb18030"))) {
                    try {
                      const { TextDecoder } = require("util");
                      html = new TextDecoder("gbk").decode(body);
                    } catch {
                      // keep utf-8 decode
                    }
                  }
                }
                // Truncate to 80KB to avoid huge LLM prompts
                if (html.length > 80000) html = html.slice(0, 80000) + "\n<!-- truncated -->";
                res.end(JSON.stringify({ html, status: proxyRes.statusCode, url: targetUrl }));
              });
            }
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
          return false;
        },
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
