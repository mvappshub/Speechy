import subprocess
import unittest
from pathlib import Path
from shutil import which


class GovernanceGuardTests(unittest.TestCase):
    def test_checker_fails_closed_when_git_diff_is_unavailable(self):
        repo_root = Path(__file__).resolve().parents[2]
        missing_git = repo_root / "missing-git.exe"
        script = repo_root / "scripts" / "check-governance.mjs"
        node_executable = which("node")
        self.assertIsNotNone(node_executable)

        result = subprocess.run(
            [node_executable, str(script)],
            cwd=repo_root,
            env={
                "PATH": "",
                "SystemRoot": "C:\\Windows",
                "ComSpec": "C:\\Windows\\System32\\cmd.exe",
                "GIT_EXE": str(missing_git),
            },
            capture_output=True,
            text=True,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unable to determine changed files", result.stderr)
