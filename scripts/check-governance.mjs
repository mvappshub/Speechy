import { execSync } from "node:child_process";

const protectedFiles = new Set([
  "docs/constitution.md",
  "docs/architecture.md",
  "docs/governance.md",
  "AGENTS.md",
  "scripts/check-architecture.mjs",
  "scripts/check-governance.mjs",
  "package.json",
]);

let changed = [];
const gitExe = process.env.GIT_EXE || (process.platform === "win32" ? "C:\\Program Files\\Git\\cmd\\git.exe" : "git");
try {
  changed = execSync(`"${gitExe}" diff --name-only HEAD`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split(/\r?\n/)
    .filter(Boolean);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Unable to determine changed files for governance check: ${reason}`);
  process.exit(1);
}

const touchedProtected = changed.some((file) => protectedFiles.has(file));
if (!touchedProtected) process.exit(0);

if (!changed.includes(".governance/GOVERNANCE_CHANGE.md")) {
  console.error("Governance-protected files changed without updating .governance/GOVERNANCE_CHANGE.md");
  process.exit(1);
}
