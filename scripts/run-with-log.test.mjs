import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("run-with-log writes command output to the requested log file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "run-with-log-"));
  const logFile = path.join(tempDir, "output.log");
  const scriptFile = path.resolve("scripts/run-with-log.mjs");

  const result = spawnSync(
    process.execPath,
    [scriptFile, logFile, process.execPath, "-e", "console.log('hello-from-log-script')"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /hello-from-log-script/);
  assert.equal(fs.readFileSync(logFile, "utf8").trim(), "hello-from-log-script");
});
