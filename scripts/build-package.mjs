/**
 * Assemble the portable package directory (robocopy-based, junction-aware):
 *   E:\111111项目\DeepSeek\DeepSeek Harness 聚合\DeepSeek Harness\
 */
import { existsSync, lstatSync, readlinkSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";

const SRC_APP = "E:/agent/DeepSeek/DeepSeek Harness";
const SRC_DEV = "E:/111111项目/DeepSeek/dsh-community-plugins";
const OUT_ROOT = "E:/111111项目/DeepSeek/DeepSeek Harness 聚合";
const OUT_APP = join(OUT_ROOT, "DeepSeek Harness");

const ALLOWED_KEYS = new Set([
  "zhu1090093659/dsh-web-ui/packages/dsh-git-graph",
  "zhu1090093659/dsh-web-ui/packages/dsh-task-board",
  "zhu1090093659/dsh-web-ui/packages/dsh-live-stats",
  "GanyuanRan/Aegis",
  "NanmiCoder/dsh-auto-mode",
  "liustack/modlens",
  "dsh-better-sidebar",
]);

const log = (...a) => console.log("[build]", ...a);
const t0 = Date.now();
const secs = () => Math.round((Date.now() - t0) / 1000) + "s";

function robo(src, dest, extra = []) {
  try {
    execFileSync("robocopy", [src, dest, "/E", "/COPY:DAT", "/R:1", "/W:1", "/XJ", "/NFL", "/NDL", "/NP", "/MT:16", ...extra], { stdio: "ignore", windowsHide: true });
  } catch (e) {
    if (e.status == null || e.status > 7) throw e;
  }
}

// ---------- 1. app root ----------
log("复制应用本体（robocopy）…");
rmSync(OUT_APP, { recursive: true, force: true });
mkdirSync(OUT_APP, { recursive: true });
for (const name of readdirSync(SRC_APP)) {
  if (name === "community-plugins" || name === "Uninstall DeepSeek Harness.exe") continue;
  const src = join(SRC_APP, name);
  const st = lstatSync(src);
  if (st.isDirectory()) robo(src, join(OUT_APP, name));
  else copyFileSync(src, join(OUT_APP, name));
}
log("应用本体完成", secs());

// ---------- 2. community-plugins ----------
const SRC_CP = join(SRC_APP, "community-plugins");
const OUT_CP = join(OUT_APP, "community-plugins");
log("复制社区插件目录…");
mkdirSync(OUT_CP, { recursive: true });
const manifestPath = join(OUT_CP, "manifest.json");
const sourceManifest = JSON.parse(readFileSync(join(SRC_CP, "manifest.json"), "utf8"));
const sourceRepos = Object.fromEntries(Object.entries(sourceManifest.repos || {}).filter(([key]) => ALLOWED_KEYS.has(key)));
writeFileSync(manifestPath, JSON.stringify({ repos: sourceRepos }, null, 2) + "\n");
// 只复制 manifest 中保留的插件目录（按 slug），跳过 .cache / .skin-assets / 皮肤与未安装插件目录
const slugDirs = new Set(Object.values(sourceRepos).map((r) => r.slug));
for (const name of readdirSync(SRC_CP)) {
  const src = join(SRC_CP, name);
  const st = lstatSync(src);
  if (st.isDirectory() && !slugDirs.has(name)) continue;
  if (st.isSymbolicLink() && !slugDirs.has(name)) continue;
  if (st.isDirectory()) {
    robo(src, join(OUT_CP, name));
  } else if (st.isSymbolicLink()) {
    let target = readlinkSync(src);
    if (target.startsWith("/e/")) target = "E:" + target.slice(2);
    target = resolve(target);
    if (!existsSync(target)) { log("跳过悬空 junction:", name); continue; }
    robo(target, join(OUT_CP, name));
  } else {
    if (name === "manifest.json") continue; // 已由过滤后的内容写入
    copyFileSync(src, join(OUT_CP, name));
  }
}
log("社区插件目录完成", secs());

// ---------- 3. .git 瘦身（已不打包 .cache，直接跳过） ----------
log("跳过 .git 瘦身（发行包不含 .cache）", secs());

// ---------- 4. modules/dsh-community-plugins ----------
log("复制插件中心代码…");
const OUT_MOD = join(OUT_APP, "modules", "dsh-community-plugins");
mkdirSync(OUT_MOD, { recursive: true });
robo(join(SRC_DEV, "lib"), join(OUT_MOD, "lib"));
mkdirSync(join(OUT_MOD, "scripts"), { recursive: true });
copyFileSync(join(SRC_DEV, "scripts", "portable-fixup.mjs"), join(OUT_MOD, "scripts", "portable-fixup.mjs"));
copyFileSync(join(SRC_DEV, "scripts", "启动.bat"), join(OUT_APP, "启动.bat"));
copyFileSync(join(SRC_DEV, "package.json"), join(OUT_MOD, "package.json"));
log("插件中心代码完成", secs());

// ---------- 5. clean profile/.dsh ----------
log("生成干净 profile 数据…");
const OUT_PROFILE = join(OUT_APP, "profile", ".dsh");
mkdirSync(join(OUT_PROFILE, "profiles", "web"), { recursive: true });
const DSH = "C:/Users/28076/.dsh";
copyFileSync(join(DSH, "profiles", "web", "package.json"), join(OUT_PROFILE, "profiles", "web", "package.json"));
const sourcePatch = readFileSync(join(DSH, "profiles", "web", "cordis.patch.yml"), "utf8");
const header = sourcePatch.match(/^.*?(?=^- (?:insert:|id:))/ms)?.[0] || "# Clean functional plugin profile\n";
const blocks = sourcePatch.split(/(?=^- (?:insert:|id:))/m).filter((block) =>
  /dsh-community-plugins|ui-git-graph|ui-task-board|live-stats|aegis-method-pack|permission|auto-permission-mode|modlens|better-sidebar/.test(block),
);
writeFileSync(join(OUT_PROFILE, "profiles", "web", "cordis.patch.yml"), header + blocks.join(""));
writeFileSync(join(OUT_PROFILE, "community-skin.json"), JSON.stringify({}) + "\n");
writeFileSync(join(OUT_PROFILE, "community-settings.json"), JSON.stringify({ pluginsDir: "__PLACEHOLDER__" }, null, 2) + "\n");
log("干净 profile 完成", secs());

// ---------- 6. 校验 ----------
log("校验干净发行内容…");
const checks = [
  [join(OUT_APP, "DeepSeek Harness.exe"), "主程序"],
  [join(OUT_APP, "resources", "app.asar"), "app.asar"],
  [join(OUT_APP, "resources", "host", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"), "宿主入口"],
  [join(OUT_CP, "manifest.json"), "manifest.json"],
  [join(OUT_CP, "zhu1090093659-dsh-web-ui-packages-dsh-git-graph", "package.json"), "git-graph 插件"],
  [join(OUT_CP, "dsh-better-sidebar", "package.json"), "better-sidebar 插件"],
  [join(OUT_MOD, "lib", "core.js"), "插件中心 core.js"],
];
let ok = true;
for (const [p, label] of checks) { const good = existsSync(p); if (!good) ok = false; log(good ? "  ✓" : "  ✗", label, p); }
const cleanManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const cleanSkin = readFileSync(join(OUT_PROFILE, "community-skin.json"), "utf8").trim();
const noSkins = !existsSync(join(OUT_CP, ".cache")) && !existsSync(join(OUT_CP, ".skin-assets")) &&
  readdirSync(OUT_CP).every((name) => !name.includes("-skins-") && name !== "Small-tailqwq-dsh-deep-whale-maid-atelier");
const clean =
  Object.keys(cleanManifest.repos).length === ALLOWED_KEYS.size &&
  Object.keys(cleanManifest.repos).every((key) => ALLOWED_KEYS.has(key)) &&
  noSkins &&
  cleanSkin === "{}";
if (!clean) ok = false;
log(clean ? "  ✓ 7 个功能插件齐全、无皮肤插件与个人资源" : "  ✗ 插件清单或个人资源校验失败");
if (!ok) process.exitCode = 1;
log(ok ? "全部校验通过" : "存在缺失文件！");
log("打包目录:", OUT_APP, secs());
