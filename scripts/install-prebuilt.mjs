/**
 * One-off: install a prebuilt npm package into the community plugin dir.
 * Usage: node scripts/install-prebuilt.mjs <tarball-dir> <key> <repo-label>
 * Example: node scripts/install-prebuilt.mjs C:/Users/28076/.dsh/tmp-sidebar/package dsh-better-sidebar omdsh-dev/DSH-better-sidebar
 */
import { CommunityCore } from "../lib/core.js";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const [srcDirRaw, keyRaw, repoRaw] = process.argv.slice(2);
if (!srcDirRaw || !keyRaw || !repoRaw) {
  console.error("usage: install-prebuilt.mjs <packageDir> <key> <repo>");
  process.exit(1);
}
const srcDir = resolve(srcDirRaw);
const key = keyRaw.trim();
const repo = repoRaw.trim();

const home = process.env.DSH_HOME || "C:/Users/28076/.dsh";
const pluginsDir = "E:/agent/DeepSeek/DeepSeek Harness/community-plugins";
const profileDir = join(home, "profiles", "web");

const core = new CommunityCore({
  home,
  profileDir,
  pluginsDir,
  logger: (...args) => console.error("[install-prebuilt]", ...args),
});

const pkgPath = join(srcDir, "package.json");
if (!existsSync(pkgPath)) {
  console.error("源目录缺少 package.json:", srcDir);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
console.log("安装目标:", pkg.name, pkg.version);

// 1) 放进仓库缓存（复制：源和缓存可能在不同磁盘，rename 会 EXDEV）
const slug = key.replace(/[^A-Za-z0-9._-]+/g, "-");
const cacheDir = join(pluginsDir, ".cache", slug);
const tmpDir = join(pluginsDir, ".cache", `.${slug}.tmp-${Date.now().toString(36)}`);
if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
const { cpSync } = await import("node:fs");
cpSync(srcDir, tmpDir, { recursive: true });
if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
renameSync(tmpDir, cacheDir);
console.log("缓存就位:", cacheDir);

// 2) 安装目录 junction → 缓存
const installDir = join(pluginsDir, slug);
const { symlinkSync } = await import("node:fs");
if (existsSync(installDir)) rmSync(installDir, { recursive: true, force: true });
symlinkSync(cacheDir, installDir, "junction");

// 3) 走 installPrebuilt 校验链
const result = await core.installPrebuilt({
  key,
  repo,
  slug,
  packageRoot: installDir,
  cacheRoot: cacheDir,
});
console.log(JSON.stringify(result, null, 1));
process.exit(result.ok ? 0 : 1);
