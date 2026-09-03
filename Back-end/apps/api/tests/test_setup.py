"""Contrato dos scripts: cwd independente, sem segredos e sem falso sucesso.

As instalacoes usam requirements vazios ou um pacote inexistente com rede
desabilitada. Nenhum instalador global, banco ou servico externo e executado.
"""

import os
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


def run_setup(shell, repo, *, check=False):
    kind, executable = shell
    python = Path(sys.executable).as_posix()
    if kind == "powershell":
        command = [executable, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                   "-File", str(repo / "setup.ps1"), "-Target", "Backend", "-PythonExecutable", python]
        if check:
            command.append("-Check")
    else:
        command = [executable, (repo / "setup.sh").as_posix(), "--target", "backend", "--python", python]
        if check:
            command.append("--check")
    env = {**os.environ, "PIP_NO_INDEX": "1", "PIP_CONFIG_FILE": os.devnull,
           "PIP_DISABLE_PIP_VERSION_CHECK": "1"}
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
