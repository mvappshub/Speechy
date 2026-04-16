import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [, , logFileArg, command, ...args] = process.argv;

if (!logFileArg || !command) {
  console.error("Usage: node scripts/run-with-log.mjs <log-file> <command> [args...]");
  process.exit(1);
}

const logFile = path.resolve(logFileArg);
fs.mkdirSync(path.dirname(logFile), { recursive: true });
const logStream = fs.createWriteStream(logFile, { flags: "a" });
const shouldUseShell = !path.isAbsolute(command) && !command.includes(path.sep);

const child = spawn(command, args, {
  stdio: ["inherit", "pipe", "pipe"],
  shell: shouldUseShell,
});

const writeChunk = (chunk, target) => {
  target.write(chunk);
  logStream.write(chunk);
};

child.stdout.on("data", (chunk) => writeChunk(chunk, process.stdout));
child.stderr.on("data", (chunk) => writeChunk(chunk, process.stderr));

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("close", (code) => {
  logStream.end(() => {
    process.exit(code ?? 1);
  });
});
