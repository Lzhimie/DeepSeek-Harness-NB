/**
 * dsh-community-plugins — host core (no cordis imports; unit-testable).
 *
 * Connects the DeepSeek Harness to the GitHub `dsh-plugin` topic community:
 *  - searches community repos through the GitHub search API with mirror fallbacks
 *  - fetches each repo's package.json (raw.githubusercontent + mirror fallbacks)
 *  - installs a repo by git-cloning it (mirror fallbacks), linking the package
 *    into the active profile's node_modules, and appending its loader patch rows
 *    to the profile's cordis.patch.yml (hot-reloaded by the host's patch watcher)
 *  - uninstalls by removing the tagged rows, unlinking, and deleting the clone
 *
 * Everything here is plain Node builtins. js-yaml is resolved lazily from the
 * harness's flat module fallback (`$DSH_HOME/profiles/node_modules`), which the
 * boot heals with symlinks for the whole app dependency closure.
 */
import { createRequire } from "node:module";
import {
  existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync,
  lstatSync, symlinkSync, unlinkSync, readdirSync, renameSync, rmdirSync, chmodSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

/**
 * Remove a tree without fs.rmSync: Electron's patched rmSync fails with
 * EPERM on trees that contain hidden/read-only entries (e.g. a git clone's
 * `.git`), while plain unlink/rmdir handles them fine. Also retries briefly,
 * since a just-exited git process or an indexer can hold transient locks.
 */
function removeTree(path, { maxRetries = 30, retryDelay = 400 } = {}) {
  const attempt = () => {
    let stat;
    try { stat = lstatSync(path); } catch { return; }
    if (stat.isSymbolicLink() || stat.isFile()) {
      unlinkSync(path);
      return;
    }
    const walk = (dir) => {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const p = join(dir, entry.name);
        if (entry.isSymbolicLink()) {
          try { unlinkSync(p); } catch { /* transient lock */ }
        } else if (entry.isDirectory()) {
          walk(p);
        } else {
          try {
            unlinkSync(p);
          } catch (error) {
            if (error.code === "EPERM" || error.code === "EACCES") {
              // Read-only (git pack files): make writable and retry once.
              try { chmodSync(p, 0o666); unlinkSync(p); } catch { /* keep going */ }
            }
          }
        }
      }
      try { rmdirSync(dir); } catch { /* transient lock; outer retry */ }
    };
    walk(path);
  };
  let lastError;
  for (let i = 0; i <= maxRetries; i += 1) {
    try {
      attempt();
      return;
    } catch (error) {
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, retryDelay);
    }
  }
  throw lastError;
}/** Default mirror chain: direct GitHub first, then public mirrors (mostly CN-friendly). */
const DEFAULT_MIRRORS = {
  api: [
    "https://api.github.com",
    "https://hub.gitmirror.com/api.github.com",
    "https://ghproxy.net/https://api.github.com",
    "https://ghfast.top/https://api.github.com",
  ],
  raw: [
    "https://raw.githubusercontent.com",
    "https://ghproxy.net/https://raw.githubusercontent.com",
    "https://ghfast.top/https://raw.githubusercontent.com",
    "https://raw.gitmirror.com",
  ],
  // Entries are base URLs *below which the github.com path is served*:
  // "https://github.com" is the origin itself, the rest are proxies that
  // re-serve github.com (and githubusercontent) paths underneath.
  clone: [
    "https://github.com",
    "https://ghproxy.net/https://github.com",
    "https://ghfast.top/https://github.com",
    "https://gitclone.com/github.com",
  ],
  // Tarball (codeload / archive) endpoints; plain HTTP GET, works through
  // any HTTP proxy even when the git smart protocol is blocked.
  archive: [
    "https://codeload.github.com",
    "https://github.com",
    "https://ghproxy.net/https://github.com",
    "https://ghfast.top/https://github.com",
  ],
};

const TOPIC_QUERY = "topic:dsh-plugin";

/**
 * Curated community skin catalog. Skins live inside monorepos (subdirectory
 * install), so they cannot be auto-discovered from the topic search alone.
 */
const SKIN_CATALOG = [
  { repo: "Small-tailqwq/dsh-deep-whale", path: "maid-atelier", name: "深海女仆工坊（鲸鱼娘）", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/miku", name: "初音未来", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/qq2006", name: "QQ2006 怀旧", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/qq98", name: "QQ2008 怀旧", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/xp", name: "Windows XP Luna", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/minecraft", name: "我的世界", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/blue-fantasy", name: "蓝色幻想", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/dragon-heir", name: "龙的传人", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/ths", name: "同花顺风格", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/trading", name: "交易终端", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/whale-song", name: "鲸吟", kind: "skin" },
  { repo: "zhu1090093659/dsh-web-ui", path: "packages/skins/skin-center", name: "皮肤中心（管理面板）", kind: "manager" },
];

export { DEFAULT_MIRRORS, SOURCES, TOPIC_QUERY, SKIN_CATALOG };

/**
 * Selectable sources. Each entry lists the endpoints it can serve per kind
 * (api/raw/clone/archive); kinds it cannot serve fall back to the auto chain.
 * `auto` is the full default chain with smart fallback.
 */
const SOURCES = {
  auto: { label: "auto", labelZh: "自动（智能回退）" },
  github: {
    label: "github", labelZh: "GitHub 直连",
    api: ["https://api.github.com"],
    raw: ["https://raw.githubusercontent.com"],
    clone: ["https://github.com"],
    archive: ["https://codeload.github.com", "https://github.com"],
  },
  ghproxy: {
    label: "ghproxy", labelZh: "ghproxy.net",
    api: ["https://ghproxy.net/https://api.github.com"],
    raw: ["https://ghproxy.net/https://raw.githubusercontent.com"],
    clone: ["https://ghproxy.net/https://github.com"],
    archive: ["https://ghproxy.net/https://github.com"],
  },
  ghfast: {
    label: "ghfast", labelZh: "ghfast.top",
    api: ["https://ghfast.top/https://api.github.com"],
    raw: ["https://ghfast.top/https://raw.githubusercontent.com"],
    clone: ["https://ghfast.top/https://github.com"],
    archive: ["https://ghfast.top/https://github.com"],
  },
  ghproxycom: {
    label: "gh-proxy", labelZh: "gh-proxy.com",
    api: ["https://gh-proxy.com/https://api.github.com"],
    raw: ["https://gh-proxy.com/https://raw.githubusercontent.com"],
    clone: ["https://gh-proxy.com/https://github.com"],
    archive: ["https://gh-proxy.com/https://github.com"],
  },
  ghps: {
    label: "ghps", labelZh: "ghps.cc",
    api: ["https://ghps.cc/https://api.github.com"],
    raw: ["https://ghps.cc/https://raw.githubusercontent.com"],
    clone: ["https://ghps.cc/https://github.com"],
    archive: ["https://ghps.cc/https://github.com"],
  },
  ghproxycc: {
    label: "ghproxy.cc", labelZh: "ghproxy.cc",
    api: ["https://ghproxy.cc/https://api.github.com"],
    raw: ["https://ghproxy.cc/https://raw.githubusercontent.com"],
    clone: ["https://ghproxy.cc/https://github.com"],
    archive: ["https://ghproxy.cc/https://github.com"],
  },
  ddlc: {
    label: "ddlc", labelZh: "gh.ddlc.top",
    raw: ["https://gh.ddlc.top/https://raw.githubusercontent.com"],
    clone: ["https://gh.ddlc.top/https://github.com"],
    archive: ["https://gh.ddlc.top/https://github.com"],
  },
  kkgithub: {
    label: "kkgithub", labelZh: "kkgithub.com",
    raw: ["https://raw.kkgithub.com"],
    clone: ["https://kkgithub.com"],
    archive: ["https://kkgithub.com"],
  },
  gitclone: {
    label: "gitclone", labelZh: "gitclone.com",
    clone: ["https://gitclone.com/github.com"],
  },
  gitmirror: {
    label: "gitmirror", labelZh: "hub.gitmirror.com",
    api: ["https://hub.gitmirror.com/api.github.com"],
    raw: ["https://raw.gitmirror.com"],
  },
};

/** Shallow clone of a plain JSON-safe value (used for manifest rows). */
function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** Deep equality for JSON-safe values (used to match patch rows). */
function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}

/** The `!!js` YAML tag used by the harness patch dialect. */
function createJsType(yaml) {
  return new yaml.Type("tag:yaml.org,2002:js", {
    kind: "scalar",
    resolve: (data) => typeof data === "string",
    construct: (data) => ({ __jsExpr: data }),
    predicate: (data) =>
      data !== null && typeof data === "object" && typeof data.__jsExpr === "string",
    represent: (data) => data.__jsExpr,
  });
}

export class CommunityCore {
  /**
   * @param options.home        DSH home directory (e.g. C:\Users\x\.dsh)
   * @param options.profileDir  active profile directory (e.g. ...\.dsh\profiles\web)
   * @param options.mirrors     optional mirror chains (see DEFAULT_MIRRORS)
   * @param options.logger      optional logger fn
   */
  constructor(options) {
    this.home = options.home;
    this.profileDir = options.profileDir;
    this.logger = options.logger ?? (() => {});
    this.mirrors = options.mirrors ?? DEFAULT_MIRRORS;
    this.settingsPath = join(this.home, "community-settings.json");
    // Priority: patch config > user setting (UI-editable) > default.
    const settings = this.readSettings();
    // Default lives INSIDE the harness module closure ($DSH_HOME/profiles/node_modules)
    // so community plugins resolve their dependencies from the app's closure.
    this.pluginsDir = options.pluginsDir || settings.pluginsDir || join(this.home, "profiles", "node_modules", "@dsh-community");
    this.manifestPath = join(this.pluginsDir, "manifest.json");
    this.patchPath = join(this.profileDir, "cordis.patch.yml");
    this.searchCache = new Map();
    this.pkgCache = new Map();
    this._yaml = undefined;
    this._schema = undefined;
    // Serialization: concurrent installs (e.g. two skins in a row) must not
    // race on manifest/patch writes, and per-repo clones share one cache dir.
    this._manifestLock = Promise.resolve();
    this._repoLocks = new Map();
    this._tasks = new Map();
    // Remove trees parked by previous runs; must run before any community
    // plugin is imported (Electron locks loaded module files).
    this.cleanTrash();
    // Heal broken install records (dangling links) before the loader touches
    // the patch rows, so a corrupted cache can never brick the next boot.
    this.selfHealManifest();
  }

  /**
   * Drop or repair manifest records whose install tree is missing. A record
   * whose cache tree still exists is re-junctioned; otherwise the record and
   * its patch rows are removed (the plugin can be re-downloaded anytime).
   */
  selfHealManifest() {
    const manifest = this.readManifest();
    let changed = false;
    for (const [key, record] of Object.entries(manifest.repos ?? {})) {
      const pkgRoot = record.path ? join(record.cloneDir, record.path) : record.cloneDir;
      if (existsSync(join(pkgRoot, "package.json"))) {
        // Tree is healthy: make sure the profile package link exists too
        // (fresh installs / copied profiles lack it, and the loader needs it
        // to resolve the plugin name from the profile closure).
        try { this.linkPackage(record.packageName, pkgRoot); } catch { /* non-fatal */ }
        continue;
      }

      const cacheRoot = record.cacheDir ? (record.path ? join(record.cacheDir, record.path) : record.cacheDir) : null;
      if (cacheRoot && existsSync(join(cacheRoot, "package.json"))) {
        try {
          if (existsSync(record.cloneDir)) removeTree(record.cloneDir);
          mkdirSync(dirname(record.cloneDir), { recursive: true });
          symlinkSync(cacheRoot, record.cloneDir, "junction");
          this.linkPackage(record.packageName, cacheRoot);
          this.logger(`[community] self-healed ${key} from cache`);
          changed = true;
          continue;
        } catch (error) {
          this.logger(`[community] self-heal re-link failed for ${key}: ${error.message}`);
        }
      }

      this.logger(`[community] self-heal: dropping broken record ${key}`);
      const entries = this.readPatchEntries();
      const kept = [];
      for (const row of entries) {
        const source = row?.["x-community"]?.repo;
        const inserted = Array.isArray(row?.insert)
          ? row.insert.some((item) => item?.["x-community"]?.repo === key)
          : false;
        if (source === key || inserted) continue;
        kept.push(row);
      }
      if (kept.length !== entries.length) {
        this.writePatchEntries(kept);
        changed = true;
      }
      try { this.unlinkPackage(record.packageName); } catch { /* ignore */ }
      delete manifest.repos[key];
      changed = true;
    }
    if (changed) this.writeManifest(manifest);
  }

  /** Run `fn` exclusively across all manifest/patch writers. */
  async withManifestLock(fn) {
    const prev = this._manifestLock;
    let release;
    this._manifestLock = new Promise((resolve) => { release = resolve; });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /** Run `fn` exclusively per repo (their clones share one cache directory). */
  async withRepoLock(repo, fn) {
    const prev = this._repoLocks.get(repo) || Promise.resolve();
    let release;
    this._repoLocks.set(repo, new Promise((resolve) => { release = resolve; }));
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this._repoLocks.get(repo) === undefined) this._repoLocks.delete(repo);
    }
  }

  /* ------------------------------------------------------------------ *
   * Download task status (visible to the UI while an install runs)
   * ------------------------------------------------------------------ */
  setTask(repo, patch) {
    const current = this._tasks.get(repo) ?? { repo, stage: "queued", progress: null, message: "", startedAt: Date.now() };
    this._tasks.set(repo, { ...current, ...patch });
  }

  clearTask(repo) {
    this._tasks.delete(repo);
  }

  listTasks() {
    return [...this._tasks.values()];
  }

  /** Host loader reference (set by index.js); used to force include reloads. */
  setLoader(loader) {
    this._loader = loader;
  }

  /**
   * Re-apply the profile patch to the live loader. The host's HMR watcher is
   * unreliable in the packaged desktop app, so every patch write we make
   * (install/uninstall/enable) is followed by an explicit include refresh.
   */
  async refreshInclude() {
    const loader = this._loader;
    if (!loader) return;
    try {
      const include = [...loader.entries()].find((entry) => entry.options.name === "include");
      if (!include) return;
      const { loadOptionalPatches } = await import("@deepseek-ai/dsh-app-boot");
      const patches = loadOptionalPatches("dsh", this.patchPath) ?? [];
      const { patches: _previous, ...includeConfig } = include.options.config;
      await include.update({ config: { ...includeConfig, patches } });
    } catch (error) {
      this.logger(`[community] include refresh failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** User settings persisted next to DSH home (independent of the profile patch). */
  readSettings() {
    try {
      const parsed = JSON.parse(readFileSync(this.settingsPath, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  getSettings() {
    const settings = this.readSettings();
    return { pluginsDir: this.pluginsDir, autoUpdate: settings.autoUpdate !== false, lastAutoUpdate: Number(settings.lastAutoUpdate ?? 0) };
  }

  /* ------------------------------------------------------------------ *
   * Custom skin settings — persisted on disk (Electron localStorage is not
   * reliably flushed before shutdown, so the backend owns the source of truth)
   * ------------------------------------------------------------------ */
  getSkinSettings() {
    try {
      const parsed = JSON.parse(readFileSync(join(this.home, "community-skin.json"), "utf8"));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  setSkinSettings(settings) {
    try {
      writeFileSync(join(this.home, "community-skin.json"), JSON.stringify(settings ?? {}, null, 2) + "\n");
      return { ok: true };
    } catch (error) {
      return { ok: false, message: `皮肤设置保存失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Persist a locally-picked background file so it survives restarts, and
   * serve it back through the same-origin web server.
   * @returns {{ok: boolean, url?: string, message?: string}}
   */
  saveSkinAsset(name, buffer) {
    const safe = String(name ?? "asset").replace(/[^A-Za-z0-9._-]/g, "_");
    try {
      const dir = join(this.pluginsDir, ".skin-assets");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, safe), buffer);
      return { ok: true, url: `/community/asset/${encodeURIComponent(safe)}` };
    } catch (error) {
      return { ok: false, message: `文件保存失败：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /** Resolve a skin asset request path (traversal-safe) to an absolute file path. */
  skinAssetPath(name) {
    const safe = String(name ?? "").replace(/[^A-Za-z0-9._-]/g, "_");
    if (!safe) return null;
    const file = join(this.pluginsDir, ".skin-assets", safe);
    return existsSync(file) ? file : null;
  }

  /**
   * Change the community plugin storage directory. Validates writability,
   * migrates the manifest (so already-installed plugins stay manageable),
   * and persists the choice for future boots.
   */
  setSettings({ pluginsDir } = {}) {
    const target = String(pluginsDir ?? "").trim();
    if (!target) return { ok: false, message: "安装位置不能为空" };
    if (!/^[A-Za-z]:[\\/]|^\\\\/.test(target) && !target.startsWith("/")) {
      return { ok: false, message: `请填写绝对路径（如 D:\\dsh-plugins）：${target}` };
    }
    try {
      mkdirSync(target, { recursive: true });
      const probe = join(target, `.dsc-probe-${Date.now()}`);
      writeFileSync(probe, "x");
      unlinkSync(probe);
    } catch (error) {
      return { ok: false, message: `目录不可写：${error instanceof Error ? error.message : String(error)}` };
    }
    if (target !== this.pluginsDir) {
      // Keep already-installed plugins visible: carry the manifest over.
      if (existsSync(this.manifestPath) && !existsSync(join(target, "manifest.json"))) {
        try { copyFileSync(this.manifestPath, join(target, "manifest.json")); } catch { /* ignore */ }
      }
      this.pluginsDir = target;
      this.manifestPath = join(target, "manifest.json");
    }
    try {
      const merged = { ...this.readSettings(), pluginsDir: target };
      writeFileSync(this.settingsPath, JSON.stringify(merged, null, 2) + "\n");
    } catch (error) {
      return { ok: false, message: `设置保存失败：${error instanceof Error ? error.message : String(error)}` };
    }
    return { ok: true, pluginsDir: target, message: `安装位置已更新：${target}（仅影响新安装的插件）` };
  }

  /** Write arbitrary settings fields (merges over the existing file). */
  writeSettings(patch) {
    try {
      const merged = { ...this.readSettings(), ...patch };
      writeFileSync(this.settingsPath, JSON.stringify(merged, null, 2) + "\n");
      return true;
    } catch {
      return false;
    }
  }

  /** The harness module closure root (flat fallback). */
  closureRoot() {
    return join(this.home, "profiles", "node_modules");
  }

  isInsideClosure(dir) {
    const root = this.closureRoot();
    return dir === root || dir.startsWith(root + "\\") || dir.startsWith(root + "/");
  }

  /**
   * When the plugin tree lives outside the module closure (custom install
   * location), junction its node_modules to the closure so its dependencies
   * resolve from the app's package closure.
   */
  ensureDependencyLink(cloneDir) {
    if (this.isInsideClosure(cloneDir)) return;
    const link = join(cloneDir, "node_modules");
    try {
      if (existsSync(link)) {
        try { unlinkSync(link); } catch { removeTree(link); }
      }
      symlinkSync(this.closureRoot(), link, "junction");
    } catch (error) {
      this.logger(`[community] dependency link failed for ${cloneDir}: ${error.message}`);
    }
  }

  removeDependencyLink(cloneDir) {
    const link = join(cloneDir, "node_modules");
    if (existsSync(link)) {
      try { unlinkSync(link); } catch { removeTree(link); }
    }
  }

  /**
   * Check that a package's declared runtime dependencies can be resolved
   * from the profile anchor (i.e. exist in the app closure). Optional
   * dependencies are skipped (loadable conditionally).
   * @returns {string[]} missing package names
   */
  missingDependencies(pkg) {
    const names = new Set();
    for (const group of [pkg.dependencies, pkg.peerDependencies]) {
      if (group && typeof group === "object") {
        for (const name of Object.keys(group)) names.add(name);
      }
    }
    const missing = [];
    const require = createRequire(join(this.profileDir, "package.json"));
    for (const name of names) {
      try {
        require.resolve(name);
      } catch {
        missing.push(name);
      }
    }
    return missing;
  }

  /**
   * Resolve the mirror chains for a selectable source. Kinds a source cannot
   * serve fall back to the auto chain; unknown sources resolve to auto.
   * @param {string} [source] - key from SOURCES
   * @returns {{api: string[], raw: string[], clone: string[], archive: string[]}}
   */
  getMirrors(source) {
    const entry = SOURCES[source] ?? null;
    if (!entry) return this.mirrors;
    const out = {};
    for (const kind of ["api", "raw", "clone", "archive"]) {
      out[kind] = Array.isArray(entry[kind]) && entry[kind].length > 0 ? entry[kind] : this.mirrors[kind];
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * YAML (resolved from the harness flat fallback so it works from any
   * clone location)
   * ------------------------------------------------------------------ */
  get yaml() {
    if (this._yaml === undefined) {
      // Resolution anchors: the profile dir (walks up to the harness's flat
      // module fallback `$DSH_HOME/profiles/node_modules`), that fallback
      // directly, and finally this module's own location (vendored layouts).
      const candidates = [
        join(this.profileDir, "cordis.yml"),
        join(this.home, "profiles", "node_modules", "js-yaml", "package.json"),
        fileURLToPath(import.meta.url),
      ];
      for (const anchor of candidates) {
        try {
          const require = createRequire(anchor);
          this._yaml = require("js-yaml");
          break;
        } catch { /* try next anchor */ }
      }
      if (this._yaml === undefined) {
        throw new Error("js-yaml is not resolvable from the profile or harness module fallback");
      }
      this._schema = this._yaml.JSON_SCHEMA.extend(createJsType(this._yaml));
    }
    return this._yaml;
  }

  get schema() {
    void this.yaml;
    return this._schema;
  }

  /* ------------------------------------------------------------------ *
   * HTTP helpers with mirror fallback
   * ------------------------------------------------------------------ */
  async fetchText(url, { timeout = 15000, headers = {} } = {}) {
    const buf = await this.fetchBuffer(url, { timeout, headers });
    return buf.toString("utf8");
  }

  async fetchBuffer(url, { timeout = 15000, headers = {}, onProgress } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "dsh-community-plugins/0.1", ...headers },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      if (!onProgress || !res.body) return Buffer.from(await res.arrayBuffer());
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress(received, total);
      }
      return Buffer.concat(chunks);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Try each base in order; returns { text, base } or throws the last error. */
  async fetchWithFallback(bases, path, { timeout = 15000, headers = {} } = {}) {
    let lastError;
    for (const base of bases) {
      try {
        const url = `${base}${path}`;
        const text = await this.fetchText(url, { timeout, headers });
        return { text, base, url };
      } catch (error) {
        lastError = error;
        this.logger(`[community] mirror failed: ${base}${path} — ${error.message}`);
      }
    }
    throw lastError ?? new Error("all mirrors failed");
  }

  /* ------------------------------------------------------------------ *
   * Community discovery
   * ------------------------------------------------------------------ */
  /** Run `fn` over items with limited concurrency, preserving order. */
  async mapConcurrent(items, limit, fn) {
    const results = new Array(items.length);
    let index = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index;
        index += 1;
        results[i] = await fn(items[i], i);
      }
    });
    await Promise.all(workers);
    return results;
  }

  /** Search the dsh-plugin topic. Returns enriched repo rows (plugin status included). */
  async listCommunity({ query = TOPIC_QUERY, perPage = 50, page = 1, sort = "stars", source } = {}) {
    const mirrors = this.getMirrors(source);
    const cacheKey = `${query}|${perPage}|${page}|${sort}|${source ?? "auto"}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 60_000) return cached.value;

    const path = `/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;
    let rows;
    let servedBy = "";
    let total = 0;
    try {
      const { text, base } = await this.fetchWithFallback(mirrors.api, path);
      const data = JSON.parse(text);
      if (!Array.isArray(data?.items)) throw new Error("unexpected search payload");
      servedBy = base;
      total = Number(data.total_count) || 0;
      rows = data.items.map((item) => this.normalizeRepo(item));
    } catch (error) {
      // Fall back to scraping the server-rendered topic page (page 1 only).
      this.logger(`[community] API search failed (${error.message}); scraping topic page`);
      rows = page === 1 ? await this.scrapeTopicPage() : [];
      servedBy = "github.com/topics (html)";
      total = rows.length;
    }

    const installed = this.installedRepos();
    rows = await this.mapConcurrent(rows, 12, (row) => this.enrich(row, installed, mirrors.raw));

    const result = {
      servedBy,
      query,
      source: source ?? "auto",
      page,
      perPage,
      total,
      rows,
      installed,
    };
    this.searchCache.set(cacheKey, { at: Date.now(), value: result });
    return result;
  }

  normalizeRepo(item) {
    return {
      repo: item.full_name,
      owner: item.owner?.login ?? "",
      name: item.name ?? "",
      description: item.description ?? "",
      stars: item.stargazers_count ?? 0,
      forks: item.forks_count ?? 0,
      language: item.language ?? "",
      branch: item.default_branch ?? "main",
      updatedAt: item.updated_at ?? "",
      homepage: item.homepage ?? "",
      url: item.html_url ?? `https://github.com/${item.full_name}`,
    };
  }

  /** Minimal fallback: scrape repo links off the topic page HTML. */
  async scrapeTopicPage() {
    const bases = ["https://github.com", "https://hub.gitmirror.com/https://github.com"];
    const path = "/topics/dsh-plugin";
    const { text } = await this.fetchWithFallback(bases, path, { timeout: 20000 });
    const repos = [];
    const seen = new Set();
    const hrefRe = /href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)"/g;
    for (const match of text.matchAll(hrefRe)) {
      const full = match[1];
      if (seen.has(full)) continue;
      seen.add(full);
      const [owner, name] = full.split("/");
      if (name === "topics") continue;
      repos.push({
        repo: full, owner, name,
        description: "", stars: 0, forks: 0, language: "",
        branch: "main", updatedAt: "", homepage: "",
        url: `https://github.com/${full}`,
      });
    }
    return repos.slice(0, 50);
  }

  /* ------------------------------------------------------------------ *
   * Per-repo package metadata (raw + mirrors, cached)
   * ------------------------------------------------------------------ */
  async fetchRaw(repo, branch, file, rawMirrors = this.mirrors.raw) {
    const path = `/${repo}/${encodeURIComponent(branch)}/${file}`;
    try {
      const { text } = await this.fetchWithFallback(rawMirrors, path, { timeout: 10000 });
      return text;
    } catch {
      return null;
    }
  }

  async readRepoPackage(repo, branch, rawMirrors) {
    const key = `${repo}@${branch}`;
    const cached = this.pkgCache.get(key);
    // TTL keeps a transient mirror outage from painting the whole list as
    // "not a plugin" for the rest of the process lifetime.
    if (cached && Date.now() - cached.at < 600_000) return cached.value;
    const text = await this.fetchRaw(repo, branch, "package.json", rawMirrors);
    let pkg = null;
    if (text !== null) {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && typeof parsed.name === "string") pkg = parsed;
      } catch {
        pkg = null;
      }
    }
    this.pkgCache.set(key, { at: Date.now(), value: pkg });
    return pkg;
  }

  /** Enrich a repo row with package metadata + install state (best effort). */
  async enrich(repo, installedByRepo, rawMirrors) {
    const base = { ...repo };
    let pkg = null;
    const branches = [];
    for (const branch of [repo.branch, "main", "master"]) {
      if (branch && !branches.includes(branch)) branches.push(branch);
    }
    for (const branch of branches) {
      pkg = await this.readRepoPackage(repo.repo, branch, rawMirrors);
      if (pkg) {
        base.branch = branch;
        break;
      }
    }
    base.packageName = pkg?.name ?? null;
    base.isPlugin = Boolean(pkg);
    base.isBundle = Boolean(pkg?.dsh?.bundle?.patch);
    base.hasClient = Boolean(pkg?.dsh?.client && pkg.exports?.["./client"]);
    // A repo counts as installed when the manifest holds it as a bare repo or
    // as any sub-package path under it (e.g. zhu1090093659/dsh-web-ui/packages/...).
    base.installed = [...installedByRepo].some(
      (key) => key === repo.repo || key.startsWith(`${repo.repo}/`),
    );
    return base;
  }

  /* ------------------------------------------------------------------ *
   * Manifest of installed community plugins
   * ------------------------------------------------------------------ */
  readManifest() {
    if (!existsSync(this.manifestPath)) return { repos: {} };
    try {
      return JSON.parse(readFileSync(this.manifestPath, "utf8"));
    } catch {
      return { repos: {} };
    }
  }

  writeManifest(manifest) {
    mkdirSync(this.pluginsDir, { recursive: true });
    writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }

  installedRepos() {
    return new Set(Object.keys(this.readManifest().repos ?? {}));
  }

  /* ------------------------------------------------------------------ *
   * Profile patch file management
   * ------------------------------------------------------------------ */
  readPatchEntries() {
    if (!existsSync(this.patchPath)) return [];
    const text = readFileSync(this.patchPath, "utf8");
    const data = this.yaml.load(text, { schema: this.schema });
    return Array.isArray(data) ? data : [];
  }

  /** Write entries back, preserving any leading comment/blank lines. */
  writePatchEntries(entries) {
    let header = "";
    if (existsSync(this.patchPath)) {
      const text = readFileSync(this.patchPath, "utf8");
      const lines = text.split(/\r?\n/);
      const head = [];
      for (const line of lines) {
        if (line.trim() === "" || line.trim().startsWith("#")) head.push(line);
        else break;
      }
      header = head.join("\n");
      if (header !== "") header += "\n";
    }
    if (header === "") {
      header = [
        "# Your patch layer for this dsh profile, applied after every bundle layer:",
        "# a top-level YAML array of loader patch entries (id-targeted config",
        "# overrides, disables, and insert lists; `!!js` expressions allowed).",
        "# Rows tagged with `x-community` are managed by dsh-community-plugins.",
        "",
      ].join("\n");
    }
    const body = this.yaml.dump(entries, { schema: this.schema, lineWidth: 200 });
    writeFileSync(this.patchPath, header + body);
  }

  /** Tag patch rows so uninstall can find exactly what a repo contributed. */
  tagRows(rows, repo) {
    const tag = { repo };
    for (const row of rows) {
      if (row && typeof row === "object") row["x-community"] = tag;
      if (row && Array.isArray(row.insert)) {
        for (const inserted of row.insert) {
          if (inserted && typeof inserted === "object") inserted["x-community"] = tag;
        }
      }
    }
    return rows;
  }

  /** Strip internal tags before reporting to callers. */
  untag(value) {
    if (Array.isArray(value)) return value.map((item) => this.untag(item));
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        if (key === "x-community") continue;
        out[key] = this.untag(item);
      }
      return out;
    }
    return value;
  }

  /* ------------------------------------------------------------------ *
   * Git operations with mirror fallback
   * ------------------------------------------------------------------ */
  async git(args, { cwd, timeout = 180000 } = {}) {
    try {
      // All community repos are public — never prompt for credentials.
      // A 401/403 (common when GitHub is intercepted) would otherwise pop
      // the system Git Credential Manager; make it fail fast instead so the
      // mirror fallback chain can try the next endpoint.
      const env = {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
      };
      const out = await execFileP("git", ["-c", "credential.helper=", ...args], { cwd, env, timeout, windowsHide: true });
      // execFile resolves to { stdout, stderr }; callers want the stdout text.
      return typeof out === "object" && out !== null ? String(out.stdout ?? "") : String(out ?? "");
    } catch (error) {
      const detail = String(error?.stderr ?? error?.message ?? error).trim();
      throw new Error(`git ${args.join(" ")} failed: ${detail}`);
    }
  }

  /**
   * Run git with progress reporting. Parses clone/fetch percentage lines
   * ("Receiving objects: 45%") from stderr into `onProgress`.
   */
  gitProgress(args, { cwd, timeout = 300000, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
      };
      const child = execFile(
        "git",
        ["-c", "credential.helper=", ...args],
        { cwd, env, timeout, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            const detail = String(stderr ?? error.message ?? error).trim();
            reject(new Error(`git ${args.join(" ")} failed: ${detail}`));
          } else {
            resolve({ stdout, stderr });
          }
        },
      );
      if (onProgress) {
        let buffer = "";
        child.stderr?.on("data", (chunk) => {
          buffer += chunk.toString("utf8");
          const lines = buffer.split(/\r|\n/);
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const m = line.match(/Receiving objects:\s*(\d+)%/);
            const d = line.match(/Resolving deltas:\s*(\d+)%/);
            if (m) onProgress({ stage: "clone", progress: Number(m[1]), message: `正在下载 ${m[1]}%` });
            else if (d) onProgress({ stage: "clone", progress: null, message: "正在解压对象…" });
          }
        });
      }
    });
  }

  /**
   * Download a repo's current tree into destDir.
   * Primary: git clone (mirror fallback); if every git mirror fails, falls
   * back to plain-HTTP tarball download + extract (mirror fallback), which
   * works through proxies that do not speak the git smart protocol.
   * @returns {{ source: "git" | "tarball", url: string }}
   */
  async cloneRepo(repo, destDir, mirrors = this.mirrors, { onProgress } = {}) {
    const cloneBases = mirrors.clone;
    let lastError;

    // Existing git checkout: refresh in place (never touches siblings).
    if (existsSync(join(destDir, ".git"))) {
      try {
        await this.git(["pull", "--ff-only"], { cwd: destDir });
        return { source: "git", url: `${cloneBases[0]}/${repo}.git`, cloneDir: destDir };
      } catch (error) {
        this.logger(`[community] pull failed via ${cloneBases[0]}: ${error.message}; re-cloning`);
      }
    }

    // Fresh download goes to a temp sibling dir and atomically replaces
    // destDir only on success. The cache dir is shared by every subpackage
    // of the repo, so a failed download must never wipe the existing cache.
    const tmpDir = join(dirname(destDir), `.${basename(destDir)}.tmp-${Date.now().toString(36)}`);
    const commit = (from) => {
      let target = destDir;
      if (existsSync(target)) {
        try {
          removeTree(target);
        } catch {
          target = join(dirname(destDir), `${basename(destDir)}-${Date.now().toString(36)}`);
          this.logger(`[community] locked tree, cloning into ${target}`);
        }
      }
      renameSync(from, target);
      return target;
    };

    for (const base of cloneBases) {
      const url = `${base}/${repo}.git`;
      try {
        if (existsSync(tmpDir)) removeTree(tmpDir);
        mkdirSync(dirname(tmpDir), { recursive: true });
        if (onProgress) onProgress({ stage: "clone", progress: null, message: `正在连接 ${base}…` });
        await this.gitProgress(["clone", "--progress", "--depth", "1", url, tmpDir], { cwd: undefined, onProgress });
        const target = commit(tmpDir);
        return { source: "git", url, cloneDir: target };
      } catch (error) {
        lastError = error;
        this.logger(`[community] clone failed via ${url}: ${error.message}`);
      }
    }
    this.logger(`[community] all git mirrors failed (${lastError?.message ?? "?"}); falling back to tarball download`);
    try {
      if (existsSync(tmpDir)) removeTree(tmpDir);
      const url = await this.downloadTarball(repo, tmpDir, mirrors.archive, ["main", "master"], { onProgress });
      const target = commit(tmpDir);
      return { source: "tarball", url, cloneDir: target };
    } catch (error) {
      if (existsSync(tmpDir)) {
        try { removeTree(tmpDir); } catch { /* keep going */ }
      }
      throw new Error(
        `git clone failed on every mirror (${lastError?.message ?? "unknown"}), ` +
        `tarball download also failed: ${error.message}`,
      );
    }
  }

  /** Build the candidate archive URLs for one repo/branch (codeload origin, github origin, then proxies). */
  tarballCandidates(repo, branch, archiveMirrors = this.mirrors.archive) {
    const candidates = [];
    for (const base of archiveMirrors) {
      const b = base.replace(/\/+$/, "");
      if (b.startsWith("https://codeload.github.com")) {
        candidates.push(`${b}/${repo}/tar.gz/refs/heads/${encodeURIComponent(branch)}`);
      } else {
        candidates.push(`${b}/${repo}/archive/refs/heads/${encodeURIComponent(branch)}.tar.gz`);
      }
    }
    return candidates;
  }

  /** Download + extract a repo tarball into destDir. Returns the URL that worked. */
  async downloadTarball(repo, destDir, archiveMirrors = this.mirrors.archive, branches = ["main", "master"], { onProgress } = {}) {
    let lastError;
    for (const branch of branches) {
      for (const url of this.tarballCandidates(repo, branch, archiveMirrors)) {
        try {
          if (onProgress) onProgress({ stage: "clone", progress: null, message: `正在下载压缩包（${new URL(url).host}）…` });
          const buf = await this.fetchBuffer(url, {
            timeout: 120000,
            onProgress: (received, total) => {
              if (onProgress && total > 0) {
                const pct = Math.min(Math.floor((received / total) * 100), 99);
                onProgress({ stage: "clone", progress: pct, message: `正在下载压缩包 ${pct}%` });
              }
            },
          });
          if (buf.length < 2 || buf.readUInt16BE(0) !== 0x1f8b) {
            // Not gzip (e.g. an HTML error page); treat as failure.
            throw new Error(`unexpected payload (${buf.length} bytes)`);
          }
          const tmp = join(dirname(destDir), `.${basename(destDir)}-tmp-${Date.now()}`);
          mkdirSync(tmp, { recursive: true });
          try {
            const archive = join(tmp, "download.tar.gz");
            writeFileSync(archive, buf);
            // --force-local: `C:\...` would otherwise be read as a remote
            // `host:path` archive spec. Forward slashes additionally keep both
            // GNU tar (msys) and Windows bsdtar happy with drive-letter paths.
            const slash = (p) => p.replace(/\\/g, "/");
            await execFileP("tar", ["--force-local", "-xzf", slash(archive), "-C", slash(tmp)], { windowsHide: true, timeout: 120000 });
            // The archive contains a single top-level folder; move its contents up.
            const entries = readdirSync(tmp).filter((name) => name !== "download.tar.gz");
            const top = entries.length === 1 ? join(tmp, entries[0]) : tmp;
            if (existsSync(destDir)) removeTree(destDir);
            mkdirSync(destDir, { recursive: true });
            if (top !== tmp) {
              const children = readdirSync(top);
              for (const child of children) {
                renameSync(join(top, child), join(destDir, child));
              }
            }
            return url;
          } finally {
            removeTree(tmp);
          }
        } catch (error) {
          lastError = error;
          this.logger(`[community] tarball failed via ${url}: ${error.message}`);
        }
      }
    }
    throw lastError ?? new Error("tarball download failed on every mirror");
  }

  /* ------------------------------------------------------------------ *
   * Profile node_modules linking
   *
   * The harness resolves loader entry names from both the profile's own
   * node_modules (client-modules uses createRequire(ctx.baseUrl)) and the
   * flat module fallback ($DSH_HOME/profiles/node_modules, used by the
   * loader's ESM import). Link into both so resolution works either way.
   * ------------------------------------------------------------------ */
  packageLinkPaths(packageName) {
    const parts = packageName.startsWith("@") ? packageName.split("/") : [packageName];
    return [
      join(this.profileDir, "node_modules", ...parts),
      join(this.home, "profiles", "node_modules", ...parts),
    ];
  }

  linkPackage(packageName, targetDir) {
    for (const link of this.packageLinkPaths(packageName)) {
      mkdirSync(dirname(link), { recursive: true });
      // lstat (not existsSync): a dangling junction's target may be gone.
      let stat = null;
      try { stat = lstatSync(link); } catch { /* not present */ }
      if (stat && (stat.isSymbolicLink() || stat.isDirectory())) {
        try { unlinkSync(link); } catch { removeTree(link); }
      }
      symlinkSync(targetDir, link, "junction");
    }
    return this.packageLinkPaths(packageName)[0];
  }

  unlinkPackage(packageName) {
    for (const link of this.packageLinkPaths(packageName)) {
      let stat = null;
      try { stat = lstatSync(link); } catch { /* not present */ }
      if (stat && (stat.isSymbolicLink() || stat.isDirectory())) {
        try { unlinkSync(link); } catch { removeTree(link); }
      }
      // Scoped packages leave an empty "@scope" parent dir behind.
      if (packageName.startsWith("@")) {
        try { rmdirSync(dirname(link)); } catch { /* not empty */ }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Install / uninstall / toggle
   * ------------------------------------------------------------------ */
  buildPatchRows(pkg, repo, slug, cloneDir) {
    if (pkg.dsh?.bundle?.patch) {
      // Bundle plugin: reuse its own patch layer (same dialect as the profile patch).
      const patchFile = join(cloneDir, String(pkg.dsh.bundle.patch));
      if (existsSync(patchFile)) {
        const rows = this.yaml.load(readFileSync(patchFile, "utf8"), { schema: this.schema });
        if (Array.isArray(rows)) return rows.map((row) => cloneValue(row));
      }
    }
    // Plain cordis plugin: mount one loader entry. Client bundles are picked
    // up automatically from the package's dsh.client + exports["./client"].
    const id = `community-${slug}`;
    return [{ insert: [{ id, name: pkg.name }] }];
  }

  /**
   * Resolve a package's host entry file relative to its clone dir.
   * Mirrors Node's bare-specifier resolution for the common shapes
   * (exports["."] string/default/import/require, main, index.js fallback).
   * @returns the absolute path, or null when the package has no entry.
   */
  resolveHostEntry(cloneDir, pkg) {
    const candidates = [];
    const dot = pkg.exports?.["."];
    if (typeof dot === "string") candidates.push(dot);
    else if (dot && typeof dot === "object") {
      for (const key of ["default", "import", "require"]) {
        if (typeof dot[key] === "string") { candidates.push(dot[key]); break; }
      }
    }
    if (typeof pkg.main === "string") candidates.push(pkg.main);
    candidates.push("index.js");
    for (const rel of candidates) {
      const path = join(cloneDir, rel);
      if (existsSync(path) && lstatSync(path).isFile()) return path;
    }
    return null;
  }

  /**
   * Preflight-load a package the way the harness loader will: resolve its
   * host entry against the profile's module roots, then import the file URL.
   * A cache-buster query keeps re-checks meaningful after an update.
   */
  async preflightImport(packageName) {
    const require = createRequire(join(this.profileDir, "package.json"));
    const entry = require.resolve(packageName, { conditions: ["import", "node", "default"] });
    await import(`${pathToFileURL(entry).href}?t=${Date.now()}`);
  }

  /**
   * Install a community repo into the active profile.
   * @returns {Promise<{ok: boolean, repo, packageName, rows, message?, needsRestart?, source?}>}
   */
  async install(repo, branch, { keepCloneOnError = false, source, path } = {}) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
      return { ok: false, repo, message: `invalid repo ${repo}` };
    }
    return this.withRepoLock(repo, async () => this._installLocked(repo, branch, { keepCloneOnError, source, path }));
  }

  async _installLocked(repo, branch, { keepCloneOnError = false, source, path } = {}) {
    // Optional subdirectory inside the repo that holds the plugin package
    // (monorepos like skin collections ship packages in subfolders).
    const sub = path && String(path).trim() ? String(path).trim().replace(/^[/\\]+|[/\\]+$/g, "") : "";
    if (sub && /\.\./.test(sub)) {
      return { ok: false, repo, message: `invalid path ${path}` };
    }
    // Install identity: subdirectories get their own key so multiple packages
    // from one monorepo can coexist (e.g. skin collections).
    const key = sub ? `${repo}/${sub}` : repo;
    const manifest = this.readManifest();
    if (manifest.repos?.[key]) {
      return { ok: false, repo, message: `${key} 已安装` };
    }

    // Clone dir per key: a tarball-installed tree has no .git, so a second
    // package from the same repo must not share (and wipe) the first one's
    // clone dir during a fresh re-clone.
    const slug = key.replace(/[^A-Za-z0-9._-]+/g, "-");
    const installDir = join(this.pluginsDir, slug);
    let pkg = null;

    try {
      // Repo-level cache: the whole repository is downloaded once and shared
      // by every subpackage (and reused after uninstall/reinstall). The
      // per-key install dir is a junction into the cache's subdirectory.
      const repoSlug = repo.replace(/[^A-Za-z0-9._-]+/g, "-");
      const cacheDir = join(this.pluginsDir, ".cache", repoSlug);
      const cacheRoot = sub ? join(cacheDir, sub) : cacheDir;
      this.setTask(repo, { stage: "check", progress: null, message: "检查本地缓存…" });
      let fetched;
      if (existsSync(join(cacheRoot, "package.json"))) {
        // Cache hit: reuse without re-downloading.
        fetched = { source: "cache", url: "", cloneDir: cacheDir };
        this.setTask(repo, { stage: "cache", progress: 100, message: "命中本地缓存" });
      } else {
        fetched = await this.cloneRepo(repo, cacheDir, this.getMirrors(source), {
          onProgress: (p) => this.setTask(repo, p),
        });
      }
      this.setTask(repo, { stage: "verify", progress: null, message: "校验插件…" });
      if (existsSync(installDir)) removeTree(installDir);
      mkdirSync(dirname(installDir), { recursive: true });
      symlinkSync(cacheRoot, installDir, "junction");
      const packageRoot = installDir;
      const clonePkgPath = join(packageRoot, "package.json");
      if (!existsSync(clonePkgPath)) {
        throw new Error(`仓库${sub ? `子目录 ${sub} 内` : "根目录"}没有 package.json，不是可安装的 DSH 插件包`);
      }
      const parsedPkg = JSON.parse(readFileSync(clonePkgPath, "utf8"));
      if (!parsedPkg || typeof parsedPkg.name !== "string" || parsedPkg.name === "") {
        throw new Error("package.json 缺少有效的 name 字段");
      }
      pkg = parsedPkg;

      const isBundle = Boolean(pkg.dsh?.bundle?.patch);
      if (!isBundle && this.resolveHostEntry(packageRoot, pkg) === null) {
        throw new Error(
          "该仓库没有可加载的插件入口（package.json 缺少 main/exports，且不是 bundle patch 包），安装后会导致 DSH 启动失败，已拒绝安装",
        );
      }

      this.linkPackage(pkg.name, packageRoot);
      // Dependency resolution follows the real path (the cache tree), so the
      // closure link must live there, not on the install junction.
      this.ensureDependencyLink(cacheRoot);

      // Runtime dependencies must resolve from the app closure; a missing one
      // would fail-loud at the next boot (bundle plugins declare deps too).
      const missing = this.missingDependencies(pkg);
      if (missing.length > 0) {
        throw new Error(`缺少依赖：${missing.join(", ")}（应用闭包中不存在，安装后会导致 DSH 启动失败）`);
      }

      // Preflight: the harness fail-louds on broken entries at boot, so make
      // sure the loader can actually import this package before committing.
      // (Bundles may reference packages outside their own repo — skip them.)
      if (!isBundle) {
        try {
          await this.preflightImport(pkg.name);
        } catch (error) {
          throw new Error(`插件入口加载失败（${pkg.name}）：${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const rows = await this.withManifestLock(async () => {
        // Re-check under the lock: another install may have won the race.
        const fresh = this.readManifest();
        if (fresh.repos?.[key]) throw new Error(`${key} 已安装`);
        const tagged = this.tagRows(this.buildPatchRows(pkg, repo, slug, packageRoot), key);
        const entries = this.readPatchEntries();
        for (const row of tagged) entries.push(row);
        this.writePatchEntries(entries);

        fresh.repos ??= {};
        fresh.repos[key] = {
          repo,
          packageName: pkg.name,
          cloneDir: installDir,
          cacheDir,
          slug,
          path: sub || null,
          type: isBundle ? "bundle" : "plugin",
          hasClient: Boolean(pkg.dsh?.client && pkg.exports?.["./client"]),
          branch: branch ?? null,
          source: fetched.source,
          sourceUrl: fetched.url,
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.writeManifest(fresh);

        // Skin mutual exclusion: installing a real skin (kind "skin") disables
        // every other installed real skin, so only one "in use" exists at a
        // time. Managers (kind "manager", e.g. the skin center panel) neither
        // trigger exclusion nor count as a skin to be excluded.
        const installedSkin = SKIN_CATALOG.find((s) => (s.path ? `${s.repo}/${s.path}` : s.repo) === key);
        if (installedSkin && installedSkin.kind === "skin") {
          const patchEntries = this.readPatchEntries();
          let changed = false;
          for (const row of patchEntries) {
            if (!Array.isArray(row?.insert)) continue;
            for (const item of row.insert) {
              const tag = item?.["x-community"]?.repo;
              if (!tag || tag === key) continue;
              if (
                SKIN_CATALOG.some(
                  (s) => s.kind === "skin" && (s.path ? `${s.repo}/${s.path}` : s.repo) === tag,
                )
              ) {
                item.disabled = true;
                changed = true;
              }
            }
          }
          if (changed) this.writePatchEntries(patchEntries);
        }
        await this.refreshInclude();
        return tagged;
      });
      this.clearTask(repo);

      return {
        ok: true,
        repo,
        key,
        packageName: pkg.name,
        type: isBundle ? "bundle" : "plugin",
        hasClient: Boolean(pkg.dsh?.client && pkg.exports?.["./client"]),
        source: fetched.source,
        rows: this.untag(cloneValue(rows)),
        message: `${key} 安装成功，已热挂载`,
      };
    } catch (error) {
      this.clearTask(repo);
      if (pkg && typeof pkg.name === "string") {
        try { this.unlinkPackage(pkg.name); } catch { /* ignore */ }
      }
      if (!keepCloneOnError && existsSync(installDir)) {
        // Only the install junction is removed; the repo cache is kept for reuse.
        try { removeTree(installDir); } catch { /* ignore */ }
      }
      return { ok: false, repo, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Re-fetch an installed repo's latest tree and re-mount it: replaces the
   * repo's tagged patch rows (in case the bundle patch file changed),
   * re-links the package, and refreshes the manifest.
   * @returns {Promise<{ok: boolean, repo, packageName, rows, message?, source?}>}
   */
  async update(repo, { source } = {}) {
    const { record, key } = this.resolveRecord(String(repo ?? ""));
    if (!record) return { ok: false, repo: key, message: `${key} 未安装` };
    return this.withRepoLock(record.repo ?? key, async () => this._updateLocked(repo, { source }));
  }

  async _updateLocked(repo, { source } = {}) {
    const { record, key } = this.resolveRecord(String(repo ?? ""));

    try {
      // Refresh the repo cache (pull / re-download); the install dir is a
      // junction into it, so the running tree updates in place.
      const cacheDir = record.cacheDir ?? record.cloneDir;
      const fetched = await this.cloneRepo(repo, cacheDir, this.getMirrors(source));
      const actualDir = fetched.cloneDir;
      const staleDir = actualDir !== cacheDir && existsSync(cacheDir) ? cacheDir : null;
      const packageRoot = record.path ? join(actualDir, record.path) : actualDir;
      const pkgPath = join(packageRoot, "package.json");
      if (!existsSync(pkgPath)) throw new Error("更新后的仓库缺少 package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (!pkg || pkg.name !== record.packageName) {
        throw new Error(`仓库 package.json 的 name 已变更（${record.packageName} → ${pkg?.name}），请先卸载再重新安装`);
      }

      this.linkPackage(pkg.name, packageRoot);
      this.ensureDependencyLink(packageRoot);

      const missing = this.missingDependencies(pkg);
      if (missing.length > 0) {
        throw new Error(`更新后的插件缺少依赖：${missing.join(", ")}（应用闭包中不存在）`);
      }

      // Preflight the NEW tree: check the updated entry loads before swapping
      // the patch rows (the boot fail-louds on broken entries).
      if (!pkg.dsh?.bundle?.patch) {
        if (this.resolveHostEntry(packageRoot, pkg) === null) {
          throw new Error("更新后的仓库没有可加载的插件入口（main/exports）");
        }
        try {
          await this.preflightImport(pkg.name);
        } catch (error) {
          throw new Error(`插件入口加载失败（${pkg.name}）：${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Replace this repo's tagged rows with freshly built ones.
      const entries = this.readPatchEntries();
      const kept = [];
      for (const row of entries) {
        const source = row?.["x-community"]?.repo;
        const insertedSource = Array.isArray(row?.insert)
          ? row.insert.some((item) => item?.["x-community"]?.repo === key)
          : false;
        if (source === key || insertedSource) continue;
        kept.push(row);
      }
      const rows = this.tagRows(this.buildPatchRows(pkg, record.repo ?? key, record.slug, packageRoot), key);
      for (const row of rows) kept.push(row);
      this.writePatchEntries(kept);

      const manifest = this.readManifest();
      manifest.repos[key] = {
        ...record,
        cloneDir: actualDir,
        type: pkg.dsh?.bundle?.patch ? "bundle" : "plugin",
        hasClient: Boolean(pkg.dsh?.client && pkg.exports?.["./client"]),
        source: fetched.source,
        sourceUrl: fetched.url,
        updatedAt: new Date().toISOString(),
      };
      this.writeManifest(manifest);

      if (staleDir) {
        // The old tree was locked (loaded by Electron); park it for boot cleanup.
        this.parkInTrash(staleDir);
      }

      return {
        ok: true,
        repo: key,
        key,
        packageName: pkg.name,
        source: fetched.source,
        rows: this.untag(cloneValue(rows)),
        message: `${key} 已更新到最新版`,
      };
    } catch (error) {
      return { ok: false, repo, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Host-side dependency check by static scan: walk the built host entry
   * (lib/index.js) and its local imports, and require every bare specifier
   * to resolve from the app closure. Client bundles (tsdown output) carry
   * their own dependencies, so package.json client-side deps (codemirror,
   * xterm, rxjs…) are intentionally not checked.
   */
  missingHostDependencies(packageRoot, pkg) {
    const entry = this.resolveHostEntry(packageRoot, pkg) ?? join(packageRoot, "lib", "index.js");
    const require = createRequire(join(this.profileDir, "package.json"));
    const seen = new Set();
    const missing = new Set();
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.shift();
      if (!file || seen.has(file) || !existsSync(file)) continue;
      seen.add(file);
      let text;
      try { text = readFileSync(file, "utf8"); } catch { continue; }
      const re = /(?:from\s*|import\s*\()\s*["']([^"']+)["']/g;
      for (const m of text.matchAll(re)) {
        const spec = m[1];
        if (!spec) continue;
        if (spec.startsWith("node:") || spec.startsWith("builtin:")) continue;
        if (spec.startsWith(".")) {
          let target = join(dirname(file), spec);
          if (!extname(target)) target += ".js";
          if (existsSync(target) && !seen.has(target)) queue.push(target);
          continue;
        }
        try { require.resolve(spec); } catch { missing.add(spec); }
      }
    }
    return [...missing];
  }

  /**
   * Install an already-built package tree (e.g. downloaded from the npm
   * registry where the published tarball ships prebuilt lib/ artifacts).
   * Reuses the same verification chain as git installs: package validation,
   * closure link, host-dependency scan, bundle patch rows, manifest commit.
   */
  async installPrebuilt({ key, repo, slug, packageRoot, cacheRoot, source = "npm" }) {
    return this.withRepoLock(repo, async () => {
      const pkgPath = join(packageRoot, "package.json");
      if (!existsSync(pkgPath)) return { ok: false, repo: key, message: "预构建包缺少 package.json" };
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (!pkg || typeof pkg.name !== "string" || pkg.name === "") {
        return { ok: false, repo: key, message: "package.json 缺少有效的 name 字段" };
      }
      const isBundle = Boolean(pkg.dsh?.bundle?.patch);
      this.linkPackage(pkg.name, packageRoot);
      this.ensureDependencyLink(cacheRoot ?? packageRoot);
      const missing = this.missingHostDependencies(packageRoot, pkg);
      if (missing.length > 0) {
        return { ok: false, repo: key, message: `缺少依赖：${missing.join(", ")}（应用闭包中不存在，安装后会导致 DSH 启动失败）` };
      }
      if (!isBundle) {
        try {
          await this.preflightImport(pkg.name);
        } catch (error) {
          return { ok: false, repo: key, message: `插件入口加载失败（${pkg.name}）：${error instanceof Error ? error.message : String(error)}` };
        }
      }
      const rows = await this.withManifestLock(async () => {
        const fresh = this.readManifest();
        if (fresh.repos?.[key]) throw new Error(`${key} 已安装`);
        const tagged = this.tagRows(this.buildPatchRows(pkg, repo, slug, packageRoot), key);
        const entries = this.readPatchEntries();
        for (const row of tagged) entries.push(row);
        this.writePatchEntries(entries);
        fresh.repos ??= {};
        fresh.repos[key] = {
          repo,
          packageName: pkg.name,
          cloneDir: packageRoot,
          cacheDir: cacheRoot ?? packageRoot,
          slug,
          path: null,
          type: isBundle ? "bundle" : "plugin",
          hasClient: Boolean(pkg.dsh?.client && pkg.exports?.["./client"]),
          branch: null,
          source,
          sourceUrl: "",
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.writeManifest(fresh);
        return tagged;
      });
      return {
        ok: true,
        repo: key,
        key,
        packageName: pkg.name,
        rows: this.untag(cloneValue(rows)),
        message: `${key} 已安装`,
      };
    });
  }

  /**
   * Auto-sync every installed plugin with GitHub. Checks the remote HEAD of
   * each installed repo (git ls-remote through the mirror chain) against the
   * local cache HEAD and updates only what changed, reusing the safe update
   * path (preflight + atomic replace). Throttled to once per 12 hours, and
   * disabled entirely when settings.autoUpdate === false. Failures never
   * touch the running install.
   */
  async checkAndUpdateAll({ force = false } = {}) {
    const settings = this.readSettings();
    if (settings.autoUpdate === false && !force) {
      return { ok: true, skipped: true, reason: "disabled" };
    }
    const last = Number(settings.lastAutoUpdate ?? 0);
    if (!force && Date.now() - last < 12 * 3600 * 1000) {
      return { ok: true, skipped: true, reason: "throttled" };
    }
    this.writeSettings({ ...settings, lastAutoUpdate: Date.now() });

    const manifest = this.readManifest();
    const repos = manifest.repos ?? {};
    const mirrors = this.getMirrors("auto");
    const results = [];
    const shared = new Map(); // repo → previous result, subpackages share one check
    for (const [key, record] of Object.entries(repos)) {
      const repo = record.repo ?? key;
      try {
        // Prebuilt (npm) installs have no git cache; a git pull would wipe
        // the shipped lib/. Skip them — they update through their own channel.
        if (record.source === "npm") {
          results.push({ repo: key, status: "up-to-date", message: "npm 预构建包" });
          continue;
        }
        if (shared.has(repo)) {
          const prev = shared.get(repo);
          results.push(prev === null ? { repo: key, status: "up-to-date" } : { repo: key, status: prev.status, message: prev.message });
          continue;
        }
        const local = await this.localHead(record.cacheDir ?? record.cloneDir);
        const remote = await this.remoteHead(repo, mirrors);
        if (!remote) {
          shared.set(repo, { status: "skip", message: "无法检查远程" });
          results.push({ repo: key, status: "skip", message: "无法检查远程" });
          continue;
        }
        if (local && local === remote) {
          shared.set(repo, null);
          results.push({ repo: key, status: "up-to-date" });
          continue;
        }
        const updated = await this.update(key, { source: "auto" });
        shared.set(repo, { status: updated.ok ? "updated" : "failed", message: updated.message });
        results.push({ repo: key, status: updated.ok ? "updated" : "failed", message: updated.message });
      } catch (error) {
        results.push({ repo: key, status: "failed", message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { ok: true, results };
  }

  /** HEAD commit of a local clone, or null when it has no git dir. */
  async localHead(dir) {
    if (!dir || !existsSync(join(dir, ".git"))) return null;
    try {
      const out = await this.git(["rev-parse", "HEAD"], { cwd: dir, timeout: 20000 });
      return String(out).trim() || null;
    } catch {
      return null;
    }
  }

  /** Remote HEAD commit via git ls-remote through the clone mirror chain. */
  async remoteHead(repo, mirrors) {
    // Prefer the smart-protocol-friendly mirrors for ls-remote probes (the
    // direct github.com entry is often unreachable from this machine's
    // network, which would waste the whole timeout budget first).
    const all = mirrors.clone ?? [];
    const fast = all.filter((u) => u.includes("ghfast") || u.includes("ghproxy") || u.includes("gitclone"));
    const rest = all.filter((u) => !fast.includes(u));
    for (const base of [...fast, ...rest]) {
      try {
        const out = await this.git(["ls-remote", `${base}/${repo}.git`, "HEAD"], { timeout: 8000 });
        const m = String(out).match(/^([0-9a-f]{40})\s+HEAD/m);
        if (m) return m[1];
      } catch { /* try next mirror */ }
    }
    // Last resort: the GitHub API fallback chain (same HTTP route the
    // community list already uses successfully from the host).
    try {
      const { text } = await this.fetchWithFallback(this.mirrors.api, `/repos/${repo}/commits?per_page=1`, { timeout: 15000 });
      const data = JSON.parse(text);
      if (Array.isArray(data) && data[0]?.sha) return String(data[0].sha);
    } catch { /* give up */ }
    return null;
  }

  /**
   * Park a tree in the manifest trash for removal at the next boot (before
   * any community plugin is imported and its files get locked by Electron).
   */
  parkInTrash(dir) {
    const manifest = this.readManifest();
    manifest.trash ??= [];
    if (!manifest.trash.includes(dir)) manifest.trash.push(dir);
    this.writeManifest(manifest);
  }

  /** Remove parked trees from previous runs. Call early, before imports. */
  cleanTrash() {
    const manifest = this.readManifest();
    const trash = manifest.trash ?? [];
    if (trash.length === 0) return;
    const kept = [];
    for (const dir of trash) {
      if (!existsSync(dir)) continue;
      try {
        removeTree(dir);
      } catch (error) {
        this.logger(`[community] trash cleanup failed for ${dir}: ${error.message}`);
        kept.push(dir);
      }
    }
    manifest.trash = kept;
    this.writeManifest(manifest);
  }

  /**
   * Resolve an install record by key, with legacy fallback: installs from
   * before subdirectory keys were introduced are stored under the plain repo.
   */
  resolveRecord(key) {
    const manifest = this.readManifest();
    if (manifest.repos?.[key]) return { record: manifest.repos[key], key };
    const parts = key.split("/");
    if (parts.length > 2) {
      const repo = parts.slice(0, 2).join("/");
      const rec = manifest.repos?.[repo];
      if (rec && (rec.path ?? null) === parts.slice(2).join("/")) return { record: rec, key: repo };
    }
    return { record: null, key };
  }

  /** Remove a repo's tagged rows, unlink, and delete the clone. */
  uninstall(repo) {
    return this.withManifestLock(() => this._uninstallLocked(repo));
  }

  async _uninstallLocked(repo) {
    const { record, key } = this.resolveRecord(repo);
    if (!record) return { ok: false, repo, message: `${repo} 未安装` };

    const entries = this.readPatchEntries();
    const kept = [];
    for (const row of entries) {
      const source = row?.["x-community"]?.repo;
      const insertedSource = Array.isArray(row?.insert)
        ? row.insert.some((item) => item?.["x-community"]?.repo === key)
        : false;
      if (source === key || insertedSource) continue;
      kept.push(row);
    }
    this.writePatchEntries(kept);
    await this.refreshInclude();

    try { this.unlinkPackage(record.packageName); } catch (error) {
      this.logger(`[community] unlink failed for ${record.packageName}: ${error.message}`);
    }
    const manifest = this.readManifest();
    delete manifest.repos[key];
    this.writeManifest(manifest);

    let cleanupNote = "";
    if (existsSync(record.cloneDir)) {
      try { removeTree(record.cloneDir); } catch (error) {
        // Electron's Node keeps loaded module files open for the process
        // lifetime, so a loaded plugin's tree cannot be deleted while the
        // host runs. Park it in the manifest trash; the next boot's cleanTrash
        // (before any community plugin is imported) removes it.
        this.logger(`[community] clone dir cleanup failed for ${repo}: ${error.message}`);
        cleanupNote = "（残留目录将在下次启动时自动清理）";
        this.parkInTrash(record.cloneDir);
      }
    }

    return { ok: true, repo, key, message: `${key} 已卸载${cleanupNote}` };
  }

  /**
   * Enable/disable an installed repo by patching its entry rows' `disabled` flag.
   */
  setEnabled(repo, enabled) {
    return this.withManifestLock(() => this._setEnabledLocked(repo, enabled));
  }

  async _setEnabledLocked(repo, enabled) {
    const { record, key } = this.resolveRecord(repo);
    if (!record) return { ok: false, repo, message: `${repo} 未安装` };
    const isSkin = SKIN_CATALOG.some(
      (s) => s.kind === "skin" && (s.path ? `${s.repo}/${s.path}` : s.repo) === key,
    );

    const entries = this.readPatchEntries();
    let touched = 0;
    for (const row of entries) {
      if (!Array.isArray(row?.insert)) continue;
      for (const item of row.insert) {
        const tag = item?.["x-community"]?.repo;
        if (enabled && isSkin && tag && tag !== key) {
          // Enabling a skin disables the other real skins (mutual exclusion).
          if (
            SKIN_CATALOG.some(
              (s) => s.kind === "skin" && (s.path ? `${s.repo}/${s.path}` : s.repo) === tag,
            )
          ) {
            item.disabled = true;
            continue;
          }
        }
        if (tag !== key) continue;
        if (enabled) delete item.disabled;
        else item.disabled = true;
        touched += 1;
      }
    }
    if (touched === 0) return { ok: false, repo, message: `未找到 ${key} 的条目` };
    this.writePatchEntries(entries);
    await this.refreshInclude();
    return { ok: true, repo, key, enabled, message: enabled ? `${key} 已启用` : `${key} 已禁用` };
  }

  /**
   * Skin market: curated catalog merged with install/live state.
   * @param {object} [loader] - optional ctx.loader for live entry state
   */
  listSkins(loader) {
    const live = new Map();
    if (loader) {
      for (const entry of loader.entries()) {
        live.set(entry.options.name, { disabled: entry.disabled, running: Boolean(entry.fiber && !entry.disabled) });
      }
    }
    return SKIN_CATALOG.map((skin) => {
      const key = skin.path ? `${skin.repo}/${skin.path}` : skin.repo;
      const { record } = this.resolveRecord(key);
      let enabled = null;
      if (record && live.has(record.packageName)) {
        const state = live.get(record.packageName);
        enabled = !state.disabled && state.running;
      }
      return {
        ...skin,
        key,
        installed: Boolean(record),
        packageName: record?.packageName ?? null,
        enabled,
      };
    });
  }

  /**
   * Live installed view, merged with loader state when a loader is available.
   * @param {object} [loader] - optional ctx.loader for live entry state
   */
  listInstalled(loader) {
    const manifest = this.readManifest();
    const result = [];
    const live = new Map();
    if (loader) {
      for (const entry of loader.entries()) {
        live.set(entry.options.id, {
          name: entry.options.name,
          disabled: entry.disabled,
          running: Boolean(entry.fiber && !entry.disabled),
        });
      }
    }
    for (const [key, record] of Object.entries(manifest.repos ?? {})) {
      const entries = live.has(`community-${record.slug}`)
        ? [live.get(`community-${record.slug}`)]
        : [...live.values()].filter((item) => item.name === record.packageName);
      result.push({
        key,
        repo: record.repo ?? key,
        path: record.path ?? null,
        packageName: record.packageName,
        type: record.type,
        hasClient: record.hasClient,
        installedAt: record.installedAt,
        entries: entries.map((item) => ({ ...item })),
        enabled: entries.length === 0 ? null : !entries.some((item) => item.disabled),
      });
    }
    return result;
  }
}
