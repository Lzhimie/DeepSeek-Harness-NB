/**
 * CDP inspector: connect to the desktop app's debug port and dump the
 * computed background situation of the main layout regions, so we can see
 * exactly why the custom skin background does/doesn't show through.
 * Usage: node scripts/cdp-inspect.mjs [ws-url] [--find "text"]
 */
import { createRequire } from "node:module";
const r = createRequire("C:/Users/28076/.dsh/profiles/web/cordis.yml");
const WebSocket = r("ws");

const wsUrl = process.argv[2] || "ws://127.0.0.1:9222/devtools/page/FBE828789A616566D42FBA4933BCA22F";
const findText = process.argv.find((a) => a.startsWith("--find="))?.slice(7);

const ws = new WebSocket(wsUrl, { maxPayload: 64 * 1024 * 1024 });
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  }
});

ws.on("open", async () => {
  try {
    const evalJs = async (expression) => {
      const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      return res.result?.value;
    };

    console.log("== skin state ==");
    console.log(await evalJs(`JSON.stringify({ skinOn: document.documentElement.classList.contains('dsc-skin-on'), skinRoot: !!document.getElementById('dsc-skin-root'), styleTag: !!document.getElementById('dsc-skin-css'), localStorage: localStorage.getItem('dsc.skin') })`));

    console.log("\n== CSS vars on :root ==");
    console.log(await evalJs(`JSON.stringify({
      bgBase: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-base').trim(),
      bgLayer1: getComputedStyle(document.documentElement).getPropertyValue('--dsw-alias-bg-layer-1').trim(),
      sidebar: getComputedStyle(document.documentElement).getPropertyValue('--dsw-specific-sidebar-fill').trim(),
    })`));

    console.log("\n== body & root ==");
    console.log(await evalJs(`JSON.stringify({
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyBgImg: getComputedStyle(document.body).backgroundImage,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    })`));

    // Find the conversation region: the largest text-bearing container on the right side.
    console.log("\n== regions ==");
    const regions = await evalJs(`(() => {
      const out = [];
      const all = document.querySelectorAll('*');
      const byWidth = new Map();
      for (const el of all) {
        if (el.children.length > 40) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 300 || r.height < 200) continue;
        const text = (el.textContent || '').trim();
        if (text.length < 20) continue;
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor;
        const bgImg = cs.backgroundImage;
        const z = cs.zIndex;
        const pos = cs.position;
        byWidth.set(el, { cls: el.className?.toString().slice(0, 60), bg, bgImg: bgImg.slice(0, 60), z, pos, w: Math.round(r.width), h: Math.round(r.height) });
      }
      return JSON.stringify([...byWidth.entries()].sort((a,b) => b[1].w - a[1].w).slice(0, 12).map(([el, info]) => ({ tag: el.tagName, ...info })));
    })()`);
    console.log(regions);

    if (findText) {
      console.log(`\n== ancestors of element containing "${findText}" ==`);
      const chain = await evalJs(`(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n; const out = [];
        while (n = walker.nextNode()) {
          if (n.textContent.includes(${JSON.stringify(findText)})) {
            let el = n.parentElement; let depth = 0;
            while (el && depth < 8) {
              const cs = getComputedStyle(el);
              out.push({ depth, tag: el.tagName, cls: el.className?.toString().slice(0, 70), bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0, 70), z: cs.zIndex, pos: cs.position });
              el = el.parentElement; depth++;
            }
            break;
          }
        }
        return JSON.stringify(out);
      })()`);
      console.log(chain);
    }
  } catch (e) {
    console.error("ERR", e.message);
  } finally {
    ws.close();
    process.exit(0);
  }
});
