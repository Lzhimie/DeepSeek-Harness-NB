/**
 * Standalone smoke test for lib/core.js — uses a TEMP home/profile so the
 * real DSH profile is untouched. Network-free except section [4] (community
 * search) and [9] (real GitHub clone); the install/update/disable/uninstall
 * happy paths run against LOCAL bare-git fixture repos (see scripts/make-fixtures.mjs).
 */
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, rmSync, lstatSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { CommunityCore, DEFAULT_MIRRORS } from "./lib/core.js";

let failures = 0;
function assert(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else { failures += 1; console.error(`  ✗ ${label}`); }
}

const home = mkdtempSync(join(tmpdir(), "dsh-community-test-"));
const profileDir = join(home, "profiles", "web");
mkdirSync(profileDir, { recursive: true });
// Mirror the production layout: the harness flat module fallback provides js-yaml.
const realFallback = "C:\\Users\\28076\\.dsh\\profiles\\node_modules";
if (existsSync(realFallback)) {
  mkdirSync(join(home, "profiles"), { recursive: true });
  symlinkSync(realFallback, join(home, "profiles", "node_modules"), "junction");
}
writeFileSync(join(profileDir, "cordis.patch.yml"), "# test header\n# second line\n[]\n");
writeFileSync(join(profileDir, "package.json"), JSON.stringify({ name: "dsh-profile-web", private: true, dependencies: {}, dsh: { profile: { bundles: [] } } }, null, 2));

const testPluginsDir = join(home, "community-test-plugins");
const core = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, logger: (m) => console.log("    [log]", m) });
console.log("temp home:", home);

console.log("\n[1] patch file write/read round-trip");
core.writePatchEntries([{ insert: [{ id: "community-test", name: "test-pkg" }] }]);
let entries = core.readPatchEntries();
assert(entries.length === 1 && entries[0].insert[0].name === "test-pkg", "write+read basic");
const text1 = readFileSync(join(profileDir, "cordis.patch.yml"), "utf8");
assert(text1.includes("# test header"), "header comment preserved");

console.log("\n[2] !!js expression round-trip");
const withJs = [{ id: "community-js", name: "pkg", config: { path: { __jsExpr: "ctx.baseUrl" } } }];
core.writePatchEntries([...entries, ...withJs]);
const entries2 = core.readPatchEntries();
assert(entries2.some((e) => e.id === "community-js"), "!!js row readable");
core.writePatchEntries(entries2);
assert(existsSync(join(profileDir, "cordis.patch.yml")), "rewrite with !!js ok");

console.log("\n[3] tag/untag");
const tagged = core.tagRows([{ insert: [{ id: "community-x", name: "x" }] }], "owner/repo");
assert(tagged[0].insert[0]["x-community"].repo === "owner/repo", "row tagged");
const clean = core.untag(tagged);
assert(clean[0].insert[0]["x-community"] === undefined, "untag strips");

console.log("\n[4] community search (network)");
try {
  const list = await core.listCommunity({ perPage: 8 });
  console.log(`    rows=${list.rows.length} servedBy=${list.servedBy}`);
  assert(list.rows.length > 0, "search returned rows");
  if (list.rows.length > 0) {
    const enriched = await core.enrich(list.rows[0], core.installedRepos());
    console.log("    first:", JSON.stringify({ repo: enriched.repo, packageName: enriched.packageName, isBundle: enriched.isBundle, hasClient: enriched.hasClient }).slice(0, 200));
  }
} catch (e) {
  assert(false, "search: " + e.message);
}

console.log("\n[5] install → update → disable → enable → uninstall (local git mirror)");
const localMirrors = { ...DEFAULT_MIRRORS, clone: ["file:///E:/test-repos"] };
const coreLocal = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, mirrors: localMirrors, logger: () => {} });
{
  const res = await coreLocal.install("owner/tiny-plugin");
  console.log("    install:", res.ok, "|", res.source, "|", res.message);
  if (res.ok) {
    assert(res.source === "git", "cloned via git mirror");
    assert(res.packageName === "dsh-tiny-plugin", "package name returned");
    assert(coreLocal.listInstalled().length === 1, "manifest lists it");
    const rows = coreLocal.readPatchEntries();
    assert(rows.some((r) => JSON.stringify(r).includes("dsh-tiny-plugin")), "patch rows written");
    assert(existsSync(join(profileDir, "node_modules", "dsh-tiny-plugin")), "profile link created");
    assert(existsSync(join(home, "profiles", "node_modules", "dsh-tiny-plugin")), "flat fallback link created");

    const upd = await coreLocal.update("owner/tiny-plugin");
    console.log("    update:", upd.ok, "|", upd.message);
    assert(upd.ok, "update ok");

    const dis = await coreLocal.setEnabled("owner/tiny-plugin", false);
    assert(dis.ok, "disable ok");
    const afterDisable = coreLocal.readPatchEntries();
    assert(JSON.stringify(afterDisable).includes('"disabled":true'), "disabled flag in patch");
    assert(!coreLocal.listInstalled().some((i) => i.enabled === true), "disabled reported");

    const en = await coreLocal.setEnabled("owner/tiny-plugin", true);
    assert(en.ok, "enable ok");
    const afterEnable = coreLocal.readPatchEntries();
    assert(!JSON.stringify(afterEnable).includes("disabled"), "disabled flag removed");

    const un = await coreLocal.uninstall("owner/tiny-plugin");
    assert(un.ok, "uninstall ok");
    const after = coreLocal.readPatchEntries();
    assert(!after.some((e) => JSON.stringify(e).includes("dsh-tiny-plugin")), "rows removed from patch");
    assert(after.some((e) => Array.isArray(e.insert) && e.insert.some((i) => i.id === "community-test")), "untagged user rows preserved");
    assert(!coreLocal.listInstalled().some((i) => i.repo === "owner/tiny-plugin"), "manifest cleaned");
    assert(!existsSync(join(profileDir, "node_modules", "dsh-tiny-plugin")), "profile link removed");
    assert(!existsSync(join(home, "profiles", "node_modules", "dsh-tiny-plugin")), "flat fallback link removed");
  } else {
    assert(false, "install failed: " + res.message);
  }
}

console.log("\n[6] non-plugin repo refused (no loadable entry)");
{
  const res = await coreLocal.install("owner/noentry-plugin");
  console.log("    install:", res.ok, "|", res.message.slice(0, 120));
  assert(res.ok === false, "install refused");
  assert(res.message.includes("插件入口"), "message names the missing entry");
  assert(coreLocal.listInstalled().length === 0, "manifest untouched");
  const rows = coreLocal.readPatchEntries();
  assert(!rows.some((r) => JSON.stringify(r).includes("dsh-noentry-plugin")), "no patch rows written");
  assert(!existsSync(join(profileDir, "node_modules", "dsh-noentry-plugin")), "no profile link left behind");
}

console.log("\n[7] tarball-only fallback with local HTTP archive server");
{
  // Build the archive exactly like codeload: a single top-level folder.
  const work = join(home, "tar-src");
  const top = join(work, "tiny-plugin-main");
  mkdirSync(join(top, "lib"), { recursive: true });
  const pkg = { name: "dsh-tiny-plugin", version: "0.1.0", type: "module", main: "lib/index.js", exports: { ".": "./lib/index.js" } };
  writeFileSync(join(top, "package.json"), JSON.stringify(pkg, null, 2));
  writeFileSync(join(top, "lib", "index.js"), 'export const name = "dsh-tiny-plugin";\nexport const inject = [];\nexport function apply() {}\n');
  const tarPath = join(home, "tiny-plugin.tar.gz");
  execFileSync("tar", ["--force-local", "-czf", tarPath.replace(/\\/g, "/"), "-C", work.replace(/\\/g, "/"), "tiny-plugin-main"], { stdio: "pipe" });
  const bytes = readFileSync(tarPath);

  const server = createServer((req, res) => {
    if (req.url.startsWith("/owner/tiny-plugin/")) {
      res.writeHead(200, { "content-type": "application/x-gzip" });
      res.end(bytes);
    } else {
      res.writeHead(404); res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const tarballMirrors = {
    ...DEFAULT_MIRRORS,
    clone: ["http://127.0.0.1:9/github.com"], // always broken
    archive: [`http://127.0.0.1:${port}`],
  };
  const coreTar = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, mirrors: tarballMirrors, logger: () => {} });
  const t = await coreTar.install("owner/tiny-plugin");
  console.log("    install:", t.ok, "|", t.source, "|", t.message);
  if (t.ok) {
    assert(t.source === "tarball", "fell back to tarball download");
    assert(existsSync(join(profileDir, "node_modules", "dsh-tiny-plugin")), "linked after tarball install");
    const un = await coreTar.uninstall("owner/tiny-plugin");
    assert(un.ok, "tarball-installed repo uninstalls");
  } else {
    assert(false, "tarball install failed: " + t.message);
  }
  server.close();
}

console.log("\n[8] entry that throws at import is refused (preflight)");
{
  const work = join(home, "broken-src");
  mkdirSync(join(work, "lib"), { recursive: true });
  writeFileSync(join(work, "package.json"), JSON.stringify({ name: "dsh-broken-plugin", version: "0.1.0", type: "module", main: "lib/index.js", exports: { ".": "./lib/index.js" } }, null, 2));
  writeFileSync(join(work, "lib", "index.js"), "throw new Error('boom');\nexport const name = 'dsh-broken-plugin';\n");
  const repoPath = join(home, "owner", "broken.git");
  mkdirSync(dirname(repoPath), { recursive: true });
  execFileSync("git", ["init", "-b", "main", work], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "f@l.test"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "F"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["add", "-A"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "broken"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["clone", "--bare", work, repoPath], { stdio: "pipe" });
  const brokenMirrors = { ...DEFAULT_MIRRORS, clone: ["file:///" + home.replace(/\\/g, "/")] };
  const coreBroken = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, mirrors: brokenMirrors, logger: () => {} });
  const r = await coreBroken.install("owner/broken");
  console.log("    install:", r.ok, "|", r.message.slice(0, 120));
  assert(r.ok === false, "install refused");
  assert(r.message.includes("boom"), "preflight surfaced the import error");
}

console.log("\n[10] custom install location: closure dependency link works");
{
  const work = join(home, "dep-src");
  mkdirSync(join(work, "lib"), { recursive: true });
  writeFileSync(join(work, "package.json"), JSON.stringify({
    name: "dsh-dep-plugin", version: "0.1.0", type: "module",
    main: "lib/index.js", exports: { ".": "./lib/index.js" },
    dependencies: { clsx: "^2.0.0" }, // clsx exists in the real closure
  }, null, 2));
  writeFileSync(join(work, "lib", "index.js"),
    "import { clsx } from 'clsx';\nexport const name = 'dsh-dep-plugin';\nexport const inject = [];\nexport function apply() { if (typeof clsx !== 'function') throw new Error('clsx broken'); }\n");
  const repoPath = join(home, "owner", "dep-plugin.git");
  mkdirSync(dirname(repoPath), { recursive: true });
  execFileSync("git", ["init", "-b", "main", work], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "f@l.test"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "F"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["add", "-A"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "dep"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["clone", "--bare", work, repoPath], { stdio: "pipe" });

  const customDir = join(home, "custom-plugins");
  const depMirrors = { ...DEFAULT_MIRRORS, clone: ["file:///" + home.replace(/\\/g, "/")] };
  const coreDep = new CommunityCore({ home, profileDir, pluginsDir: customDir, mirrors: depMirrors, logger: () => {} });
  const r = await coreDep.install("owner/dep-plugin");
  console.log("    install:", r.ok, "|", r.message);
  assert(r.ok, "install with closure dependency succeeds outside closure");
  if (r.ok) {
    const cloneDir = join(customDir, "owner-dep-plugin");
    assert(existsSync(join(cloneDir, "node_modules")), "dependency junction created");
    const st = lstatSync(join(cloneDir, "node_modules"));
    assert(st.isSymbolicLink(), "dependency junction is a link");
    const un = await coreDep.uninstall("owner/dep-plugin");
    assert(un.ok, "uninstall ok");
    assert(!existsSync(join(cloneDir, "node_modules")), "dependency junction removed with tree");
  }
}

console.log("\n[11] missing dependency refused (would fail-loud at next boot)");
{
  const work = join(home, "missdep-src");
  mkdirSync(join(work, "lib"), { recursive: true });
  writeFileSync(join(work, "package.json"), JSON.stringify({
    name: "dsh-missdep-plugin", version: "0.1.0", type: "module",
    main: "lib/index.js", exports: { ".": "./lib/index.js" },
    dependencies: { "no-such-package-xyz": "^1.0.0" },
  }, null, 2));
  writeFileSync(join(work, "lib", "index.js"), "export const name = 'dsh-missdep-plugin';\nexport function apply() {}\n");
  const repoPath = join(home, "owner", "missdep-plugin.git");
  mkdirSync(dirname(repoPath), { recursive: true });
  execFileSync("git", ["init", "-b", "main", work], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "f@l.test"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "F"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["add", "-A"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "missdep"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["clone", "--bare", work, repoPath], { stdio: "pipe" });
  const coreMiss = new CommunityCore({ home, profileDir, mirrors: { ...DEFAULT_MIRRORS, clone: ["file:///" + home.replace(/\\/g, "/")] }, logger: () => {} });
  const r = await coreMiss.install("owner/missdep-plugin");
  console.log("    install:", r.ok, "|", r.message.slice(0, 100));
  assert(r.ok === false, "install refused");
  assert(r.message.includes("缺少依赖"), "message names the missing dependency");
  assert(!coreMiss.listInstalled().some((i) => i.repo === "owner/missdep-plugin"), "manifest untouched");
}

console.log("\n[12] same-repo subpackages do not wipe each other (monorepo skins)");
{
  // Build a local monorepo: owner/monorepo with two plugin subpackages a/ and b/.
  const work = join(home, "mono-src");
  const mk = (dir) => { mkdirSync(join(work, dir), { recursive: true }); };
  mk("a/lib");
  mk("b/lib");
  const pkgA = { name: "mono-pkg-a", version: "0.1.0", type: "module", main: "lib/index.js", exports: { ".": "./lib/index.js" } };
  const pkgB = { name: "mono-pkg-b", version: "0.1.0", type: "module", main: "lib/index.js", exports: { ".": "./lib/index.js" } };
  writeFileSync(join(work, "a", "package.json"), JSON.stringify(pkgA, null, 2));
  writeFileSync(join(work, "a", "lib", "index.js"), "export const name = 'mono-pkg-a';\nexport function apply() {}\n");
  writeFileSync(join(work, "b", "package.json"), JSON.stringify(pkgB, null, 2));
  writeFileSync(join(work, "b", "lib", "index.js"), "export const name = 'mono-pkg-b';\nexport function apply() {}\n");
  const repoPath = join(home, "owner", "monorepo.git");
  mkdirSync(dirname(repoPath), { recursive: true });
  execFileSync("git", ["init", "-b", "main", work], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "f@l.test"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "F"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["add", "-A"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["commit", "-m", "mono"], { cwd: work, stdio: "pipe" });
  execFileSync("git", ["clone", "--bare", work, repoPath], { stdio: "pipe" });

  const monoMirrors = { ...DEFAULT_MIRRORS, clone: ["file:///" + home.replace(/\\/g, "/")] };
  const coreMono = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, mirrors: monoMirrors, logger: () => {} });
  const r1 = await coreMono.install("owner/monorepo", undefined, { path: "a" });
  const r2 = await coreMono.install("owner/monorepo", undefined, { path: "b" });
  console.log("    install a:", r1.ok, "| b:", r2.ok, "|", r2.message);
  assert(r1.ok && r2.ok, "both subpackages install");
  if (r1.ok && r2.ok) {
    const recA = coreMono.readManifest().repos["owner/monorepo/a"];
    const recB = coreMono.readManifest().repos["owner/monorepo/b"];
    assert(recA && recB, "both records in manifest");
    assert(recA.cloneDir !== recB.cloneDir, "independent install dirs");
    assert(recA.cacheDir === recB.cacheDir, "shared repo cache");
    const stA = lstatSync(recA.cloneDir);
    assert(stA.isSymbolicLink(), "install dir is a junction into the cache");
    assert(existsSync(join(recA.cloneDir, "package.json")), "a's files intact after installing b");
    assert(existsSync(join(recB.cloneDir, "package.json")), "b's files present");
    assert(existsSync(join(recA.cacheDir, "a", "package.json")), "cache holds a's tree");
    const un = await coreMono.uninstall("owner/monorepo/a");
    assert(un.ok, "uninstall a ok");
    assert(existsSync(join(recB.cloneDir, "package.json")), "b untouched by a's uninstall");
    assert(existsSync(join(recA.cacheDir, "a", "package.json")), "cache kept after uninstall (reuse)");
    const un2 = await coreMono.uninstall("owner/monorepo/b");
    assert(un2.ok, "uninstall b ok");
    // Reinstall from cache: must NOT re-download (source === "cache").
    const r3 = await coreMono.install("owner/monorepo", undefined, { path: "a" });
    console.log("    reinstall from cache:", r3.ok, "| source:", r3.source);
    assert(r3.ok && r3.source === "cache", "reinstall reuses the repo cache");
    await coreMono.uninstall("owner/monorepo/a");
  }
}

console.log("\n[13] concurrent installs of same-repo subpackages keep both (race protection)");
{
  const concMirrors = { ...DEFAULT_MIRRORS, clone: ["file:///" + home.replace(/\\/g, "/")] };
  const coreConc = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, mirrors: concMirrors, logger: () => {} });
  const [ra, rb] = await Promise.all([
    coreConc.install("owner/monorepo", undefined, { path: "a" }),
    coreConc.install("owner/monorepo", undefined, { path: "b" }),
  ]);
  console.log("    a:", ra.ok, "| b:", rb.ok);
  assert(ra.ok && rb.ok, "both concurrent installs succeed");
  const m = coreConc.readManifest();
  assert(m.repos["owner/monorepo/a"] && m.repos["owner/monorepo/b"], "both records survive the race");
  const patchJson = JSON.stringify(coreConc.readPatchEntries());
  assert(patchJson.includes("mono-pkg-a") && patchJson.includes("mono-pkg-b"), "both patch rows survive the race");
  await coreConc.uninstall("owner/monorepo/a");
  await coreConc.uninstall("owner/monorepo/b");
  const after = coreConc.readManifest();
  assert(!after.repos["owner/monorepo/a"] && !after.repos["owner/monorepo/b"], "cleanup ok");
}

console.log("\n[14] failed download does not wipe the shared repo cache");
{
  const mirrors = { ...DEFAULT_MIRRORS, clone: ["file:///" + home.replace(/\\/g, "/")] };
  const core14 = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, mirrors, logger: () => {} });
  const r1 = await core14.install("owner/monorepo", undefined, { path: "a" });
  assert(r1.ok, "install a ok");
  const recA = core14.readManifest().repos["owner/monorepo/a"];
  // 模拟 tarball 安装（缓存无 .git）：后续下载无法 pull，只能重下。
  rmSync(join(recA.cacheDir, ".git"), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  // 用全部损坏的源尝试装缓存里不存在的子包 c：下载必须失败，且 a 的安装目录和共享缓存必须完好。
  const badMirrors = { ...DEFAULT_MIRRORS, clone: ["http://127.0.0.1:9/github.com"], archive: ["http://127.0.0.1:9/codeload"] };
  const coreBad = new CommunityCore({ home, profileDir, pluginsDir: testPluginsDir, mirrors: badMirrors, logger: () => {} });
  const r2 = await coreBad.install("owner/monorepo", undefined, { path: "c" });
  console.log("    c install:", r2.ok, "|", String(r2.message).slice(0, 60));
  assert(r2.ok === false, "c install fails with broken sources");
  assert(existsSync(join(recA.cloneDir, "package.json")), "a's install intact after failed download");
  assert(existsSync(join(recA.cacheDir, "a", "package.json")), "shared cache intact after failed download");
  await core14.uninstall("owner/monorepo/a");
}

console.log("\n[9] real GitHub: valid-plugin check via topic search (network)");
try {
  const rows = (await core.listCommunity({ perPage: 20 })).rows;
  const candidate = rows.find((row) => row.repo === "zhu1090093659/dsh-web-ui");
  assert(Boolean(candidate), "known repo present in topic search");
  if (candidate) {
    const enriched = await core.enrich(candidate, core.installedRepos());
    console.log("    enriched:", JSON.stringify({ repo: enriched.repo, packageName: enriched.packageName, isPlugin: enriched.isPlugin }).slice(0, 160));
    assert(enriched.repo === "zhu1090093659/dsh-web-ui", "enrich resolves metadata");
  }
} catch (e) {
  assert(false, "network search: " + e.message);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
