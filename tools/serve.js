import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp" };
createServer(async (req, res) => {
  try {
    // Exercise the same repository subpath used by GitHub Pages.
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (!pathname.startsWith("/gtnhnei/")) { res.writeHead(404).end(); return; }
    const path = resolve(root, pathname.slice("/gtnhnei/".length) || "index.html");
    if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { "Content-Type": mime[extname(path)] || "application/octet-stream", "Content-Length": body.length });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4173, "127.0.0.1", () => console.log("Preview: http://127.0.0.1:4173/gtnhnei/"));
