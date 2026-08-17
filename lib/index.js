/**
 * dsh-community-plugins — host half.
 *
 * Provides the `/community` HTTP surface on the harness web server:
 *   GET  /community/list      → topic search (mirror-aware) + install state
 *   GET  /community/installed → installed community plugins + live loader state
 *   POST /community/install   → { repo, branch? } download + mount into the profile
 *   POST /community/uninstall → { repo }
 *   POST /community/set-enabled → { repo, enabled }
 *
 * The entry itself is mounted through the profile's cordis.patch.yml insert
 * layer, so it hot-loads without restarting the harness.
 */
import { fileURLToPath } from "node:url";
import { dirname, extname } from "node:path";
import { readFileSync } from "node:fs";
import { CommunityCore, SOURCES } from "./core.js";

const extensionOf = (name) => extname(name).toLowerCase();

const NAME = "community-manager";
const inject = ["webServer", "loader"];

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error(`invalid JSON body: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function apply(ctx, config = {}) {
  const baseUrl = ctx.baseUrl;
  if (typeof baseUrl !== "string") throw new Error(`${NAME}: ctx.baseUrl is unset`);
  const profileDir = fileURLToPath(baseUrl);
  const home = dirname(dirname(profileDir));

  const core = new CommunityCore({
    home,
    profileDir,
    pluginsDir: typeof config.pluginsDir === "string" && config.pluginsDir.trim() ? config.pluginsDir.trim() : undefined,
    mirrors: config.mirrors ?? undefined,
    logger: (...args) => {
      try { ctx.logger?.info?.(...args); } catch { /* ignore */ }
      try { console.error("[community]", ...args.map((a) => (typeof a === "string" ? a : JSON.stringify(a)))); } catch { /* ignore */ }
    },
  });
  // The loader drives live include reloads after our patch writes.
  ctx.effect(() => {
    core.setLoader(ctx.get("loader"));
  }, "community-manager: loader reference");

  const route = (path, handler) => {
    ctx.effect(() => ctx.webServer.register({
      kind: "prefix",
      path: "/community",
      handler: async (req, res) => {
        const url = new URL(req.url ?? "/", "http://x");
        const suffix = url.pathname.slice("/community".length) || "/";
        const method = req.method ?? "GET";
        const send = (status, body) => {
          res.writeHead(status, {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          });
          res.end(JSON.stringify(body));
        };
        try {
          if (suffix === "/tasks" && method === "GET") {
            send(200, { ok: true, value: core.listTasks() });
            return;
          }
          if (suffix === "/skins" && method === "GET") {
            send(200, { ok: true, value: core.listSkins(ctx.get("loader")) });
            return;
          }
          if (suffix === "/sources" && method === "GET") {
            send(200, {
              ok: true,
              value: Object.entries(SOURCES).map(([key, entry]) => ({
                key,
                label: entry.label,
                labelZh: entry.labelZh ?? entry.label,
              })),
            });
            return;
          }
          if (suffix === "/settings" && method === "GET") {
            send(200, { ok: true, value: core.getSettings() });
            return;
          }
          if (suffix === "/settings" && method === "POST") {
            const body = await readJsonBody(req);
            // autoUpdate toggle merges into the same settings file.
            if (typeof body.autoUpdate === "boolean" && body.pluginsDir === undefined) {
              core.writeSettings({ autoUpdate: body.autoUpdate });
              send(200, { ok: true, value: core.getSettings() });
              return;
            }
            const result = core.setSettings(body);
            send(result.ok ? 200 : 400, {
              ok: result.ok,
              message: result.message,
              value: { pluginsDir: result.pluginsDir },
            });
            return;
          }
          if (suffix === "/skin" && method === "GET") {
            send(200, { ok: true, value: core.getSkinSettings() });
            return;
          }
          if (suffix === "/skin" && method === "POST") {
            const body = await readJsonBody(req);
            const result = core.setSkinSettings(body);
            send(result.ok ? 200 : 400, result);
            return;
          }
          if (suffix === "/asset" && method === "POST") {
            const name = url.searchParams.get("name") || "asset.bin";
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const result = core.saveSkinAsset(name, Buffer.concat(chunks));
            send(result.ok ? 200 : 400, result);
            return;
          }
          if (suffix.startsWith("/asset/") && method === "GET") {
            const name = decodeURIComponent(suffix.slice("/asset/".length));
            const file = core.skinAssetPath(name);
            if (!file) {
              send(404, { ok: false, error: { code: "not-found", message: "asset not found" } });
              return;
            }
            const mime = {
              ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
              ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
            }[extensionOf(name)] ?? "application/octet-stream";
            try {
              const data = readFileSync(file);
              res.writeHead(200, { "content-type": mime, "cache-control": "no-cache" });
              res.end(data);
            } catch (error) {
              send(500, { ok: false, error: { code: "internal", message: error.message } });
            }
            return;
          }
          if (suffix === "/list" && method === "GET") {
            const query = url.searchParams.get("q") || undefined;
            const perPage = Math.min(Math.max(Number(url.searchParams.get("per_page") || 100), 1), 100);
            const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
            const source = url.searchParams.get("source") || undefined;
            const result = await core.listCommunity({ query, perPage, page, source });
            send(200, { ok: true, value: result });
            return;
          }
          if (suffix === "/installed" && method === "GET") {
            send(200, { ok: true, value: core.listInstalled(ctx.get("loader")) });
            return;
          }
          if (suffix === "/install" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await core.install(
              String(body.repo ?? ""),
              body.branch ? String(body.branch) : undefined,
              {
                source: body.source ? String(body.source) : undefined,
                path: body.path ? String(body.path) : undefined,
              },
            );
            send(result.ok ? 200 : 400, result);
            return;
          }
          if (suffix === "/update" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await core.update(String(body.repo ?? ""), { source: body.source ? String(body.source) : undefined });
            send(result.ok ? 200 : 400, result);
            return;
          }
          if (suffix === "/auto-update" && (method === "POST" || method === "GET")) {
            const body = method === "POST" ? await readJsonBody(req) : {};
            const result = await core.checkAndUpdateAll({ force: body.force === true });
            send(200, result);
            return;
          }
          if (suffix === "/uninstall" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await core.uninstall(String(body.repo ?? ""));
            send(result.ok ? 200 : 400, result);
            return;
          }
          if (suffix === "/set-enabled" && method === "POST") {
            const body = await readJsonBody(req);
            const result = await core.setEnabled(String(body.repo ?? ""), Boolean(body.enabled));
            send(result.ok ? 200 : 400, result);
            return;
          }
          send(404, { ok: false, error: { code: "not-found", message: `${method} /community${suffix}` } });
        } catch (error) {
          send(500, {
            ok: false,
            error: { code: "internal", message: error instanceof Error ? error.message : String(error) },
          });
        }
      },
    }), `community: routes`);
  };

  // Single prefix registration covers all subpaths.
  route("/", () => {});
}

// No `default` export: the loader's unwrapExports would collapse the module
// to its default and drop the named `inject` export (codebase convention).
export { apply, inject, NAME as name };
