#!/usr/bin/env node
// Convenience launcher: runs the API and the web dev server together.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(name, cmd, args, cwd, color) {
  const p = spawn(cmd, args, { cwd, shell: process.platform === "win32" });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream) =>
    stream.on("data", (d) =>
      d.toString().split("\n").filter(Boolean).forEach((l) => console.log(tag + l))
    );
  pipe(p.stdout);
  pipe(p.stderr);
  p.on("exit", (code) => console.log(tag + `exited (${code})`));
  return p;
}

console.log("Starting MusicRoots (API :4000, web :5173)…");
run("api", "npm", ["start"], join(root, "server"), "36");
run("web", "npm", ["run", "dev"], join(root, "web"), "35");

process.on("SIGINT", () => process.exit(0));
