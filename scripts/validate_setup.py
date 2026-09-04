"""Validate the real monorepo setup twice in a disposable, space-containing path.

No user .env or installed environment is copied. Output contains only synthetic
configuration and dependency versions. Requires Python 3.11 and supported Node/npm.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
INPUTS = (
    "setup.ps1", "setup.sh", "Front-end/package.json", "Front-end/package-lock.json",
    "Back-end/apps/api/requirements.txt",
)
SENTINELS = ("Front-end/.env", "Front-end/.env.local", "Back-end/apps/api/.env")


def run(command, cwd, *, capture=False):
    print("+", " ".join(map(str, command)), flush=True)
    result = subprocess.run(command, cwd=cwd, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None,
                            timeout=600)
    return result.stdout.strip() if capture else None


def fingerprint(repo):
    return {name: hashlib.sha256((repo / name).read_bytes()).hexdigest()
            for name in (*INPUTS, *SENTINELS)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shell", choices=("powershell", "bash"), required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 11):
        parser.error("Use Python 3.11 to validate the supported setup.")

    if args.shell == "powershell":
        if os.name != "nt":
            parser.error("PowerShell validation requires Windows.")
        shell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    elif os.name == "nt":
        shell = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git/bin/bash.exe"
    else:
        shell = Path(shutil.which("bash") or "/bin/bash")
    if not shell.is_file():
        parser.error(f"Shell unavailable: {shell}")

    # PowerShell policy override applies to this process only, never the machine.
    with tempfile.TemporaryDirectory(prefix="nx9-") as temporary:
        repo = Path(temporary) / "repo com espacos"
        for name in INPUTS:
            destination = repo / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, destination)
        for name in SENTINELS:
            (repo / name).write_text("SETUP_VALIDATION_SENTINEL=synthetic\n", encoding="utf-8")
        if args.shell == "powershell":
            command = [str(shell), "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                       "-File", str(repo / "setup.ps1"), "-PythonExecutable", sys.executable]
            check = [*command, "-Check"]
        else:
            command = [str(shell), (repo / "setup.sh").as_posix(), "--python", Path(sys.executable).as_posix()]
            check = [*command, "--check"]
        api = repo / "Back-end/apps/api"
        frontend = repo / "Front-end"
        python = api / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        node = shutil.which("node")
        if not npm or not node:
            parser.error("Install supported Node.js with npm before running validation.")

        before = fingerprint(repo)
        global_before = run([sys.executable, "-m", "pip", "freeze", "--all"], repo.parent, capture=True)
        run(check, repo.parent)
        if (api / ".venv").exists() or (frontend / "node_modules").exists() or before != fingerprint(repo):
            raise AssertionError("Preflight must not install or change configuration")

        snapshots = []
        for attempt in (1, 2):
            print(f"=== REAL SETUP RUN {attempt} / {args.shell} ===", flush=True)
            run(command, repo.parent)
            run([str(python), "-m", "pip", "check"], repo.parent)
            python_packages = run([str(python), "-m", "pip", "freeze", "--all"], repo.parent, capture=True)
            # npm's complete dependency tree also includes versions of transitives.
            node_packages = json.loads(run([npm, "ls", "--all", "--json"], frontend, capture=True))
            snapshots.append({"python": sorted(python_packages.splitlines()), "node": node_packages,
                              "venv": (api / ".venv/pyvenv.cfg").read_text(encoding="utf-8")})
            if fingerprint(repo) != before:
                raise AssertionError("Setup changed manifests, scripts or synthetic .env files")
        if snapshots[0] != snapshots[1]:
            raise AssertionError("Reexecution changed resolved dependencies or venv configuration")
        if global_before != run([sys.executable, "-m", "pip", "freeze", "--all"], repo.parent, capture=True):
            raise AssertionError("Global Python packages changed")
        report = {"result": "passed", "shell": args.shell, "platform": sys.platform,
                  "python": sys.version, "node": run([node, "--version"], repo.parent, capture=True),
                  "npm": run([npm, "--version"], repo.parent, capture=True), "runs": 2,
                  "unchanged_inputs": before, "dependencies_identical": True,
                  "global_python_unchanged": True, "cwd_outside_repository": True,
                  "human_teammate_validation": False}
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
