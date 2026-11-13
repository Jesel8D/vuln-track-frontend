"""Real V2 API + Vite on a NEW tmpfs PostgreSQL. No manual account provisioning."""

import argparse
import os
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from contextlib import suppress
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = Path(
    os.environ.get("VULNTRACK_BACKEND_PATH", ROOT.parent / "vuln-track-backend")
)


def port_or_free(port):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", port))
        return probe.getsockname()[1]


def wait_url(url, process):
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError("Service stopped before readiness")
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(0.25)
    raise RuntimeError("Readiness timed out")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--e2e", action="store_true")
    parser.add_argument(
        "--installation", choices=["existing", "new"], default="existing"
    )
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--web-port", type=int, default=5173)
    args = parser.parse_args()
    if not all(0 <= port <= 65535 for port in (args.api_port, args.web_port)):
        parser.error("Invalid port")
    if not (ROOT / "node_modules").is_dir() or not (BACKEND / "app").is_dir():
        parser.error(
            "Backend checkout and npm ci required; use VULNTRACK_BACKEND_PATH if needed"
        )
    sys.path.insert(0, str(BACKEND))
    from scripts.disposable_v2 import DisposableV2

    api_port, web_port = port_or_free(args.api_port), port_or_free(args.web_port)
    if api_port == web_port:
        parser.error("API and web require separate ports")
    api_url, web_url = f"http://127.0.0.1:{api_port}", f"http://127.0.0.1:{web_port}"
    processes = []
    try:
        with DisposableV2(args.installation, sql_checks=False) as stack:
            with tempfile.TemporaryFile(mode="w+") as log:
                # Only the API receives its restricted DB login and HMAC/JWT secrets.
                api_env = {
                    key: value
                    for key, value in os.environ.items()
                    if not key.startswith("TEST_")
                    and key
                    not in {
                        "MIGRATION_DATABASE_URL",
                        "DATABASE_URL",
                        "TOKEN_SECRET",
                        "WORKSPACE_HMAC_KEY",
                        "NVD_API_KEY",
                        "POSTGRES_PASSWORD",
                    }
                }
                api_env.update(
                    {
                        key: value
                        for key, value in stack.environment.items()
                        if not key.startswith("TEST_")
                    }
                )
                api_env.update(CORS_ORIGINS=__import__("json").dumps([web_url]))
                if args.e2e:
                    api_env.update(
                        REGISTRATION_ATTEMPTS_PER_MINUTE="10",
                        REGISTRATION_TOTAL_PER_MINUTE="100",
                    )
                api = subprocess.Popen(
                    [
                        sys.executable,
                        "-m",
                        "uvicorn",
                        "app.main:create_app",
                        "--factory",
                        "--workers",
                        "1",
                        "--host",
                        "127.0.0.1",
                        "--port",
                        str(api_port),
                        "--no-access-log",
                        "--no-proxy-headers",
                    ],
                    cwd=BACKEND,
                    env=api_env,
                    stdout=log,
                    stderr=log,
                    start_new_session=True,
                )
                processes.append(api)
                wait_url(api_url + "/ready", api)
                web_env = {
                    key: value
                    for key, value in os.environ.items()
                    if not key.startswith("TEST_")
                    and key
                    not in {
                        "DATABASE_URL",
                        "MIGRATION_DATABASE_URL",
                        "TOKEN_SECRET",
                        "WORKSPACE_HMAC_KEY",
                        "NVD_API_KEY",
                        "POSTGRES_PASSWORD",
                    }
                }
                web_env.update(VITE_API_URL=api_url)
                if args.e2e:
                    web_env.update(
                        E2E_WEB_URL=web_url,
                        E2E_API_URL=api_url,
                        E2E_PROFILE="v2-registration",
                        TEST_DISPOSABLE_DATABASE=stack.name,
                    )
                    tests = subprocess.Popen(
                        ["npm", "run", "test:e2e"],
                        cwd=ROOT,
                        env=web_env,
                        start_new_session=True,
                    )
                    processes.append(tests)
                    return tests.wait()
                web = subprocess.Popen(
                    ["npm", "run", "dev", "--", "--port", str(web_port)],
                    cwd=ROOT,
                    env=web_env,
                    stdout=log,
                    stderr=log,
                    start_new_session=True,
                )
                processes.append(web)
                wait_url(web_url, web)
                print(
                    f"Crear cuenta: {web_url}/crear-cuenta\nAPI: {api_url}\n"
                    "PostgreSQL DESECHABLE: Ctrl+C descarta estos datos; no es persistencia local.",
                    flush=True,
                )
                while all(process.poll() is None for process in processes):
                    time.sleep(0.5)
                raise RuntimeError("Service stopped")
    except KeyboardInterrupt:
        return 0
    except (RuntimeError, OSError) as error:
        print(
            f"V2 stack failed ({type(error).__name__}); no secrets printed",
            file=sys.stderr,
        )
        return 1
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    with suppress(ProcessLookupError):
                        os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


if __name__ == "__main__":
    sys.exit(main())
