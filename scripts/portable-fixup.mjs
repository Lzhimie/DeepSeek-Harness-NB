import {
  existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync,
  symlinkSync, lstatSync, readdirSync, rmSync, readlinkSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";

// 发行包预装的插件集合；用户后续自行安装的插件不在其中，
// 由插件中心自行管理，初始化时原样保留、不干预。
const PREINSTALLED_KEYS = new Set([
  "zhu1090093659/dsh-web-ui/packages/dsh-git-graph",
  "zhu1090093659/dsh-web-ui/packages/dsh-task-board",
  "zhu1090093659/dsh-web-ui/packages/dsh-live-stats",
  "GanyuanRan/Aegis",
  "NanmiCoder/dsh-auto-mode",
  "liustack/modlens",
  "dsh-better-sidebar",
]);

const appDirRaw = process.argv[2] || process.env.DSH_APP_DIR;
if (!appDirRaw) throw new Error("usage: portable-fixup.mjs <appDir>");
const appDir = resolve(appDirRaw);
const pluginsDir = join(appDir, "community-plugins");
// DSH_HOME 优先；未设置时默认放在应用目录内（便携模式）。
// 启动脚本在安装目录不可写（如 Program Files）时会改用 LOCALAPPDATA。
const home = process.env.DSH_HOME ? resolve(process.env.DSH_HOME) : join(appDir, "profile", ".dsh-runtime");
const profileDir = join(home, "profiles", "web");
const seedProfile = join(appDir, "profile", ".dsh");
const log = (...args) => console.error("[fixup]", ...args);

function linkTarget(target, linkPath) {
  mkdirSync(dirname(linkPath), { recursive: true });
  try {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const current = resolve(dirname(linkPath), readlinkSync(linkPath));
      if (current === target && existsSync(current)) return "kept";
    }
    rmSync(linkPath, { recursive: true, force: true });
  } catch { /* missing */ }
  symlinkSync(target, linkPath, "junction");
  return "created";
}

const manifestPath = join(pluginsDir, "manifest.json");
if (!existsSync(manifestPath)) throw new Error("缺少社区插件 manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const entries = Object.entries(manifest.repos || {});
const preinstalled = entries.filter(([key]) => PREINSTALLED_KEYS.has(key));

// 1. 规范化预装插件记录：cloneDir/cacheDir 指向包内 slug 目录、path 置空，
//    并为每个预装插件创建双模块根目录链接。仅当记录有变化时才写回 manifest
//    （安装在 Program Files 等只读位置时，普通用户启动不应触发写入）。
const roots = [join(profileDir, "node_modules"), join(home, "profiles", "node_modules")];
let linked = 0, manifestChanged = false;
for (const [key, record] of preinstalled) {
  const packageRoot = join(pluginsDir, record.slug);
  if (!existsSync(join(packageRoot, "package.json"))) throw new Error(`缺少预装插件文件：${record.packageName}`);
  if (record.cloneDir !== packageRoot || record.cacheDir !== packageRoot || record.path !== null) {
    record.cloneDir = packageRoot;
    record.cacheDir = packageRoot;
    record.path = null;
    manifestChanged = true;
  }
  for (const root of roots) if (linkTarget(packageRoot, join(root, record.packageName)) === "created") linked++;
}
if (manifestChanged) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

// 2. 插件中心指向与 profile 种子文件
writeFileSync(join(home, "community-settings.json"), JSON.stringify({ pluginsDir }, null, 2) + "\n");
mkdirSync(profileDir, { recursive: true });
for (const [src, dest] of [
  [join(seedProfile, "profiles", "web", "cordis.patch.yml"), join(profileDir, "cordis.patch.yml")],
  [join(seedProfile, "profiles", "web", "package.json"), join(profileDir, "package.json")],
  [join(seedProfile, "community-skin.json"), join(home, "community-skin.json")],
]) {
  if (!existsSync(dest) && existsSync(src)) copyFileSync(src, dest);
}

// 3. 宿主闭包镜像：逐包 junction
const closureDir = join(appDir, "resources", "host", "node_modules");
const closureRoot = join(home, "profiles", "node_modules");
let closureLinks = 0;
for (const name of readdirSync(closureDir)) {
  const target = join(closureDir, name);
  let stat;
  try { stat = lstatSync(target); } catch { continue; }
  if (stat.isSymbolicLink()) continue;
  if (name.startsWith("@")) {
    for (const sub of readdirSync(target)) if (linkTarget(join(target, sub), join(closureRoot, name, sub)) === "created") closureLinks++;
  } else if (linkTarget(target, join(closureRoot, name)) === "created") {
    closureLinks++;
  }
}

// 4. 预装插件树的 node_modules 指向闭包（依赖解析），仅处理包内插件
let depLinks = 0;
for (const [, record] of preinstalled) {
  if (linkTarget(closureRoot, join(pluginsDir, record.slug, "node_modules")) === "created") depLinks++;
}

// 5. 插件中心 hub 链接（双根）
const hubTarget = join(appDir, "modules", "dsh-community-plugins");
for (const root of roots) if (linkTarget(hubTarget, join(root, "dsh-community-plugins")) === "created") linked++;
log(`完成：${preinstalled.length} 个预装插件（manifest 共 ${entries.length} 条），新增 ${linked} 个插件链接、${closureLinks} 个闭包链接和 ${depLinks} 个依赖链接。DSH home = ${home}`);
