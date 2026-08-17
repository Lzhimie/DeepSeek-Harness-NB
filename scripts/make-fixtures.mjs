/**
 * Create local bare-git fixture repos used by test-core.mjs.
 * Layout: <root>/<owner>/<repo>.git, cloneable via `file://` URLs, which the
 * CommunityCore clone chain accepts as a mirror base.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = "E:/test-repos";
const fixtures = {
  "owner/tiny-plugin": {
    "package.json": JSON.stringify({
      name: "dsh-tiny-plugin",
      version: "0.1.0",
      description: "Local fixture: minimal valid DSH plugin (host + client)",
      type: "module",
      main: "lib/index.js",
      exports: {
        ".": "./lib/index.js",
        "./client": "./lib/client.js",
      },
      dsh: { client: { platform: "web" } },
    }, null, 2) + "\n",
    "lib/index.js": [
      'export const name = "dsh-tiny-plugin";',
      'export const inject = [];',
      "export function apply(ctx, config = {}) {",
      "  try { ctx.logger?.info?.('[dsh-tiny-plugin] host half active'); } catch {}",
      "}",
      "",
    ].join("\n"),
    "lib/client.js": [
      'window.__ModuleLoader__.load({',
      '  id: "dsh-tiny-plugin",',
      '  factory: (require) => {',
      '    var module = { exports: {} };',
      '    var exports = module.exports;',
      '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
      '    const React = require("react");',
      '    const { jsx } = require("react/jsx-runtime");',
      '    const inject = ["slots"];',
      '    function apply(ctx) {',
      '      ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({',
      '        name: "sidebar.footer.action",',
      '        id: "tiny-plugin-action",',
      '      }, () => jsx("button", { type: "button", children: "tiny" })));',
      '    }',
      '    exports.apply = apply;',
      '    exports.inject = inject;',
      '    return module.exports;',
      '  },',
      '});',
      "",
    ].join("\n"),
  },
  "owner/noentry-plugin": {
    "package.json": JSON.stringify({
      name: "dsh-noentry-plugin",
      version: "0.1.0",
      description: "Local fixture: package with no loadable entry (must be refused)",
      type: "module",
    }, null, 2) + "\n",
  },
};

const sh = (cmd, opts = {}) => execFileSync("git", cmd, { stdio: "pipe", ...opts });

for (const [repo, files] of Object.entries(fixtures)) {
  const bare = join(root, `${repo}.git`);
  const work = join(root, `_work-${repo.replace("/", "-")}`);
  if (existsSync(bare)) rmSync(bare, { recursive: true, force: true });
  if (existsSync(work)) rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "lib"), { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    const target = join(work, file);
    mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    writeFileSync(target, content);
  }
  sh(["init", "-b", "main", work]);
  sh(["config", "user.email", "fixtures@local.test"], { cwd: work });
  sh(["config", "user.name", "Fixture Bot"], { cwd: work });
  sh(["add", "-A"], { cwd: work });
  sh(["commit", "-m", "fixture"], { cwd: work });
  sh(["clone", "--bare", work, bare]);
  rmSync(work, { recursive: true, force: true });
  console.log(`fixture ready: file:///${bare.replace(/\\/g, "/")}`);
}
