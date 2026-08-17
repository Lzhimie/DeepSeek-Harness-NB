/**
 * Zip the portable package dir into
 *   E:\111111项目\DeepSeek\DeepSeek Harness 聚合\DeepSeek-Harness-Portable-0.1.0.zip
 */
import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import { resolve } from "node:path";
const archiver = createRequire(import.meta.url)("archiver");

const SRC = "E:/111111项目/DeepSeek/DeepSeek Harness 聚合/DeepSeek Harness";
const OUT = "E:/111111项目/DeepSeek/DeepSeek Harness 聚合/DeepSeek-Harness-Portable-0.1.0.zip";

const output = createWriteStream(OUT);
const archive = archiver("zip", { zlib: { level: 1 } }); // 内容多为已压缩二进制，低压缩率求速度
output.on("close", () => {
  console.log("ZIP 完成:", OUT, "大小:", (archive.pointer() / 1024 / 1024).toFixed(0) + "MB");
});
archive.on("warning", (e) => { if (e.code !== "ENOENT") console.warn("[zip warn]", e.message); });
archive.on("error", (e) => { console.error("[zip error]", e.message); process.exit(1); });
archive.pipe(output);

// 顶层文件夹名固定为 "DeepSeek Harness"（解压即用）
archive.directory(resolve(SRC), "DeepSeek Harness");
await archive.finalize();
