// A static server over the built site, with the SPA fallback the app expects,
// on a port of the OS's choosing. No caching, so a rebuilt file is what the
// next shot sees.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".wasm": "application/wasm",
  ".txt": "text/plain",
};

export async function serveDir(root) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(root, path));
    const headers = { "cache-control": "no-store" };
    try {
      if (!file.startsWith(root)) throw new Error("outside root");
      const body = await readFile(file);
      res.writeHead(200, {
        ...headers,
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      });
      res.end(body);
    } catch {
      if (extname(path)) {
        res.writeHead(404, headers);
        res.end();
        return;
      }
      res.writeHead(200, { ...headers, "content-type": TYPES[".html"] });
      res.end(await readFile(join(root, "index.html")));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
