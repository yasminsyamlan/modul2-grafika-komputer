/* Lab 3 step 6: reproduce-from-clean. Copies ONLY tracked files into a temp dir
 * (git ls-files if this is a git repo, else everything except node_modules/out),
 * then runs  npm install -> npm test  there and saves the transcript.
 *   node tools/verify_clean_clone.mjs            # writes CLEAN_CLONE_TRANSCRIPT.txt
 * For the literal `git clone` version, run the commands in SELESAIKAN.md instead. */
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const files = [];
try { files.push(...execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean)); }
catch {
  const walk = (d) => { for (const n of readdirSync(d)) {
    if (["node_modules", "out", ".git", "_site"].includes(n)) continue;
    const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
  walk(".");
}
const dir = mkdtempSync(join(tmpdir(), "m2-clean-"));
for (const f of files) { mkdirSync(join(dir, dirname(f)), { recursive: true }); copyFileSync(f, join(dir, f)); }

let log = `# clean-copy transcript  ${new Date().toISOString()}\n# node ${process.version}  ${process.platform}\n# dir ${dir}  (${files.length} files)\n`;
const run = (cmd) => {
  log += `\n$ ${cmd}\n`;
  const r = spawnSync(cmd, { cwd: dir, shell: true, encoding: "utf8" });
  log += (r.stdout || "") + (r.stderr || ""); log += `[exit ${r.status}]\n`; return r.status === 0;
};
const ok = run("npm install") && run("npm test");
writeFileSync("CLEAN_CLONE_TRANSCRIPT.txt", log);
console.log(log.split("\n").slice(-14).join("\n"));
console.log(ok ? "\nRESULT: clean copy is GREEN -> paste CLEAN_CLONE_TRANSCRIPT.txt into LAPORAN A6"
               : "\nRESULT: FAILED -> fix what needed human intervention, then re-run");
process.exit(ok ? 0 : 1);
