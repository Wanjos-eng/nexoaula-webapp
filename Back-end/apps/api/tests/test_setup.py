"""Contrato dos scripts: cwd independente, sem segredos e sem falso sucesso.

As instalacoes usam requirements vazios ou um pacote inexistente com rede
desabilitada. Nenhum instalador global, banco ou servico externo e executado.
"""

import os
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[4]


def available_shells():
    shells = []
    if os.name == "nt":
        powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
        if powershell.is_file():
            shells.append(("powershell", str(powershell)))
        git_bash = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Git/bin/bash.exe"
        if git_bash.is_file():
            shells.append(("bash", str(git_bash)))
    elif shutil.which("bash"):
        shells.append(("bash", shutil.which("bash")))
    return shells


SHELLS = available_shells()


@pytest.fixture
def setup_repo(tmp_path_factory):
    # Nomes curtos evitam MAX_PATH do Windows nos arquivos internos do ensurepip.
    repo = tmp_path_factory.mktemp("setup") / "repo com espacos"
    api = repo / "Back-end/apps/api"
    api.mkdir(parents=True)
    (api / "requirements.txt").write_text("# sem dependencias neste teste\n", encoding="utf-8")
    (api / ".env").write_text("SENTINEL=preservar\n", encoding="utf-8")
    for script in ("setup.ps1", "setup.sh"):
        shutil.copyfile(REPO_ROOT / script, repo / script)
    return repo


def run_setup(shell, repo, *, check=False, target="backend", python_path=None, extra_env=None):
    kind, executable = shell
    python = Path(python_path or sys.executable).as_posix()
    if kind == "powershell":
        command = [executable, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                   "-File", str(repo / "setup.ps1"), "-Target", target, "-PythonExecutable", python]
        if check:
            command.append("-Check")
    else:
        command = [executable, (repo / "setup.sh").as_posix(), "--target", target, "--python", python]
        if check:
            command.append("--check")
    env = {**os.environ, "PIP_NO_INDEX": "1", "PIP_CONFIG_FILE": os.devnull,
           "PIP_DISABLE_PIP_VERSION_CHECK": "1", "npm_config_offline": "true",
           "npm_config_audit": "false", "npm_config_fund": "false", **(extra_env or {})}
    return subprocess.run(command, cwd=repo.parent, env=env, capture_output=True,
                          text=True, encoding="utf-8", errors="replace", timeout=120)


def test_at_least_one_setup_shell_is_available():
    assert SHELLS, "Instale Bash ou execute no Windows com PowerShell."


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_check_from_another_directory_does_not_install(shell, setup_repo):
    result = run_setup(shell, setup_repo, check=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Pre-requisitos verificados" in result.stdout
    assert not (setup_repo / "Back-end/apps/api/.venv").exists()


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_missing_requirements_fails_without_success(shell, setup_repo):
    (setup_repo / "Back-end/apps/api/requirements.txt").unlink()
    result = run_setup(shell, setup_repo)
    assert result.returncode != 0
    assert "Setup concluido" not in result.stdout


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_installation_failure_is_not_reported_as_success(shell, setup_repo):
    (setup_repo / "Back-end/apps/api/requirements.txt").write_text(
        "nexoaula-nonexistent-review-fixture==0.0.0\n", encoding="utf-8"
    )
    result = run_setup(shell, setup_repo)
    assert result.returncode != 0
    assert "Setup concluido" not in result.stdout
    assert "nexoaula-nonexistent-review-fixture" in result.stdout + result.stderr


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_backend_only_setup_preserves_env_and_uses_correct_path(shell, setup_repo):
    result = run_setup(shell, setup_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Setup concluido" in result.stdout
    api = setup_repo / "Back-end/apps/api"
    assert (api / ".venv/pyvenv.cfg").is_file()
    assert (api / ".env").read_text(encoding="utf-8") == "SENTINEL=preservar\n"
    before = (api / ".venv/pyvenv.cfg").read_bytes()
    again = run_setup(shell, setup_repo)
    assert again.returncode == 0, again.stdout + again.stderr
    assert (api / ".venv/pyvenv.cfg").read_bytes() == before
    assert (api / ".env").read_text(encoding="utf-8") == "SENTINEL=preservar\n"


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_missing_python_has_corrective_hint(shell, setup_repo):
    result = run_setup(shell, setup_repo, python_path=setup_repo / "missing-python", check=True)
    assert result.returncode != 0
    assert "Instale Python 3.11" in result.stdout + result.stderr
    assert not (setup_repo / "Back-end/apps/api/.venv").exists()


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_all_preflight_checks_frontend_before_installing_backend(shell, setup_repo):
    result = run_setup(shell, setup_repo, target="all")
    assert result.returncode != 0
    assert "clone completo" in result.stdout + result.stderr
    assert not (setup_repo / "Back-end/apps/api/.venv").exists()


def make_frontend(repo, *, fail_install=False):
    frontend = repo / "Front-end"
    frontend.mkdir()
    package = {"name": "setup-test-fixture", "version": "1.0.0", "private": True}
    if fail_install:
        package["scripts"] = {"preinstall": "node -e process.exit(23)"}
    (frontend / "package.json").write_text(json.dumps(package), encoding="utf-8")
    lock = {"name": package["name"], "version": "1.0.0", "lockfileVersion": 3,
            "requires": True, "packages": {"": {"name": package["name"], "version": "1.0.0"}}}
    (frontend / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")
    (frontend / ".env.local").write_text("SENTINEL=preservar\n", encoding="utf-8")
    return frontend


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_npm_failure_has_actionable_error_and_no_success(shell, setup_repo):
    make_frontend(setup_repo, fail_install=True)
    result = run_setup(shell, setup_repo, target="frontend")
    assert result.returncode != 0
    assert "Setup concluido" not in result.stdout
    assert "package.json/package-lock.json" in result.stdout + result.stderr
    assert not (setup_repo / "Back-end/apps/api/.venv").exists()


@pytest.mark.parametrize("shell", SHELLS, ids=[item[0] for item in SHELLS])
def test_frontend_only_is_repeatable_and_preserves_inputs(shell, setup_repo):
    frontend = make_frontend(setup_repo)
    before = {path.name: path.read_bytes() for path in frontend.iterdir()}
    for _ in range(2):
        result = run_setup(shell, setup_repo, target="frontend")
        assert result.returncode == 0, result.stdout + result.stderr
        assert {name: (frontend / name).read_bytes() for name in before} == before
    assert not (setup_repo / "Back-end/apps/api/.venv").exists()


@pytest.mark.parametrize("tool", ["node", "npm.cmd"])
def test_missing_windows_node_or_npm_has_install_hint(setup_repo, tool):
    if os.name != "nt":
        pytest.skip("Windows PATH isolation")
    shell = next(item for item in SHELLS if item[0] == "powershell")
    make_frontend(setup_repo)
    # Keep only Node when testing missing npm. PowerShell uses an absolute path.
    isolated = setup_repo / "tools"
    isolated.mkdir()
    if tool == "npm.cmd":
        shutil.copyfile(shutil.which("node"), isolated / "node.exe")
    result = run_setup(shell, setup_repo, target="frontend", check=True, extra_env={"PATH": str(isolated)})
    assert result.returncode != 0
    assert "Ferramenta ausente" in result.stdout + result.stderr
    assert "Instale" in result.stdout + result.stderr
    assert "Setup concluido" not in result.stdout
