import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "E:/agent/DeepSeek/DeepSeek Harness/community-plugins/dsh-better-sidebar/lib/client.js",
  "E:/agent/DeepSeek/DeepSeek Harness/community-plugins/dsh-better-sidebar/lib/client-registry.js",
  "E:/agent/DeepSeek/DeepSeek Harness/community-plugins/dsh-better-sidebar/lib/client-terminal.js",
  "E:/agent/DeepSeek/DeepSeek Harness/community-plugins/dsh-better-sidebar/lib/client-editor.js",
];
const oldCss = ".W-zNGW_toggleCluster{top:calc(var(--dsh-title-bar-strip,40px) + 3px)}";
const newCss = ".W-zNGW_toggleCluster{top:calc(var(--dsh-title-bar-strip,40px) + 12px);-webkit-app-region:no-drag}";
for (const f of files) {
  let t = readFileSync(f, "utf8");
  const n = t.split(oldCss).length - 1;
  if (n > 0) {
    t = t.replaceAll(oldCss, newCss);
    writeFileSync(f, t);
    console.log(`patched ${n}x: ${f}`);
  } else {
    console.log(`not found: ${f}`);
  }
}
