#!/usr/bin/env python3
"""Own disposable PostgreSQL + real FastAPI + Vite. Never accepts an existing DB URL.

Run with ../backend/.venv/bin/python. Normal mode uses the existing getpass-based
account provisioner. --e2e generates ephemeral credentials only in child memory.
"""

import argparse
import json
import os
import re
import secrets
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
BACKEND = ROOT.parent / "backend"
DATABASE = ROOT.parent / "database"
IMAGE = (
    "postgres:16.15-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab"
)


def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_url(url, process):
    for _ in range(120):
        if process.poll() is not None:
            raise RuntimeError("Local service stopped before readiness")
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(0.25)
    raise RuntimeError("Local service readiness timed out")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--username", help="New private development account; password requested by getpass"
    )
    parser.add_argument(
        "--e2e", action="store_true", help="Real auth/SQL with controlled NVD test transport"
    )
    parser.add_argument("--api-port", type=int, default=0)
    parser.add_argument("--web-port", type=int, default=0)
    args = parser.parse_args()
    if not args.e2e and (
        not args.username or not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{0,79}", args.username)
    ):
        parser.error("Usa --username con una cuenta nueva ASCII en minúsculas")
    if args.username == "demo_operator":
        parser.error("La cuenta seed se conserva inactiva")
    for port in [args.api_port, args.web_port]:
        if not 0 <= port <= 65535:
            parser.error("Puerto no válido")
    if not (ROOT / "node_modules").is_dir():
        parser.error("Ejecutar npm ci en frontend primero")
    sys.path.insert(0, str(BACKEND))
    from uuid import uuid4

    from app.core.security import hash_password
    from app.models.database_v1 import User
    from sqlalchemy import URL, create_engine
    from sqlalchemy.orm import Session

    for chosen in [args.api_port, args.web_port]:
        if chosen:
            with socket.socket() as probe:
                try:
                    probe.bind(("127.0.0.1", chosen))
                except OSError:
                    parser.error("Puerto ocupado; usar otro o 0 para asignación automática")
    if args.api_port and args.api_port == args.web_port:
        parser.error("FastAPI y Vite requieren puertos distintos")
    name = "vulntrack-web-test-" + secrets.token_hex(6)
    database = "vulntrack_web_test"
    password = secrets.token_urlsafe(32)
    processes = []
    engine = None
    temp = tempfile.TemporaryDirectory(prefix="vulntrack-web-")
    logs = []

    def sql(source):
        return run(
            "docker",
            "exec",
            "-i",
            name,
            "psql",
            "-Xq",
            "-U",
            "postgres",
            "-d",
            database,
            "-v",
            "ON_ERROR_STOP=1",
            input=source,
        )

    try:
        run(
            "docker",
            "run",
            "-d",
            "--name",
            name,
            "--label",
            "vulntrack.disposable=true",
            "--tmpfs",
            "/var/lib/postgresql/data:rw",
            "-p",
            "127.0.0.1::5432",
            "-e",
            "POSTGRES_PASSWORD",
            "-e",
            f"POSTGRES_DB={database}",
            "-e",
            "POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256",
            IMAGE,
            env={**os.environ, "POSTGRES_PASSWORD": password},
        )
        for _ in range(120):
            if (
                subprocess.run(
                    ["docker", "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
                    capture_output=True,
                    check=False,
                ).returncode
                == 0
            ):
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("Disposable PostgreSQL startup failed")
        for relative in ["sql/001_schema.sql", "sql/002_privileges.sql"]:
            sql((DATABASE / relative).read_text())
        sql(
            "CREATE ROLE web_test_api LOGIN PASSWORD '" + password + "' NOSUPERUSER NOCREATEDB "
            "NOCREATEROLE NOREPLICATION NOBYPASSRLS; GRANT vulntrack_app TO web_test_api; "
            "GRANT SELECT(password_hash) ON vulntrack.users TO web_test_api;"
        )
        db_port = int(run("docker", "port", name, "5432").stdout.strip().rsplit(":", 1)[1])

        def url(user):
            return URL.create(
                "postgresql+psycopg",
                username=user,
                password=password,
                host="127.0.0.1",
                port=db_port,
                database=database,
            ).render_as_string(hide_password=False)

        env = {**os.environ, "MIGRATION_DATABASE_URL": url("postgres")}
        run(
            sys.executable,
            "-m",
            "alembic",
            "-x",
            "ownership_proposal=1",
            "-x",
            "mvp_a=1",
            "upgrade",
            "head",
            cwd=BACKEND,
            env=env,
        )
        engine = create_engine(url("postgres"), hide_parameters=True)
        if args.e2e:
            test_password = secrets.token_urlsafe(24)
            usernames = ["web_" + secrets.token_hex(5), "web_" + secrets.token_hex(5)]
            with Session(engine) as session, session.begin():
                session.add_all(
                    [
                        User(
                            id=uuid4(),
                            username=username,
                            active=True,
                            password_hash=hash_password(test_password),
                        )
                        for username in usernames
                    ]
                )
            env.update(
                TEST_USER=usernames[0], TEST_OTHER_USER=usernames[1], TEST_PASSWORD=test_password
            )
        else:
            # Existing account procedure, password only through private terminal input.
            result = subprocess.run(
                [sys.executable, "scripts/provision_user.py", args.username],
                cwd=BACKEND,
                env=env,
                check=False,
            )
            if result.returncode:
                raise RuntimeError("Account provisioning failed")
        api_port = args.api_port or free_port()
        web_port = args.web_port or free_port()
        while web_port == api_port:
            web_port = free_port()
        api_url, web_url = f"http://127.0.0.1:{api_port}", f"http://127.0.0.1:{web_port}"
        env.update(
            DATABASE_URL=url("web_test_api"),
            TOKEN_SECRET=secrets.token_urlsafe(48),
            CORS_ORIGINS=json.dumps([web_url]),
            ENVIRONMENT="test" if args.e2e else "development",
            TOKEN_TTL_SECONDS="60" if args.e2e else "900",
            TEST_DISPOSABLE_DATABASE=name,
            VULNTRACK_BROWSER_TEST="1" if args.e2e else "0",
            VITE_API_URL=api_url,
            E2E_API_URL=api_url,
            E2E_WEB_URL=web_url,
        )
        # Do not inherit keys or broaden this explicitly configured test/development API.
        if args.e2e:
            env.pop("NVD_API_KEY", None)
        api_log = open(Path(temp.name) / "api.log", "w+")
        logs.append(api_log)
        app_path = "tests.e2e.api_server:app" if args.e2e else "app.main:create_app"
        api_command = [sys.executable, "-m", "uvicorn", app_path]
        if not args.e2e:
            api_command.append("--factory")
        api_command += [
            "--host",
            "127.0.0.1",
            "--port",
            str(api_port),
            "--no-access-log",
            "--no-proxy-headers",
        ]
        api_env = {
            k: v
            for k, v in env.items()
            if k
            not in {
                "MIGRATION_DATABASE_URL",
                "TEST_PASSWORD",
                "TEST_USER",
                "TEST_OTHER_USER",
                "POSTGRES_PASSWORD",
            }
        }
        api_process = subprocess.Popen(
            api_command,
            cwd=ROOT if args.e2e else BACKEND,
            env=api_env,
            stdout=api_log,
            stderr=api_log,
            start_new_session=True,
        )
        processes.append(api_process)
        wait_url(api_url + "/ready", api_process)
        # Read and inspect actual OpenAPI without user/session payloads.
        with urllib.request.urlopen(api_url + "/openapi.json", timeout=5) as response:
            schema = json.load(response)
        assert "role" not in schema["components"]["schemas"]["UserRead"]["properties"]
        assert "/api/v1/cpe-candidates" in schema["paths"]
        if args.e2e:
            test_process = subprocess.Popen(
                ["npm", "run", "test:e2e"], cwd=ROOT, env=env, start_new_session=True
            )
            processes.append(test_process)
            return test_process.wait()
        web_log = open(Path(temp.name) / "web.log", "w+")
        logs.append(web_log)
        web_process = subprocess.Popen(
            ["npm", "run", "dev", "--", "--port", str(web_port)],
            cwd=ROOT,
            env={
                k: v
                for k, v in env.items()
                if k
                not in {
                    "DATABASE_URL",
                    "MIGRATION_DATABASE_URL",
                    "TOKEN_SECRET",
                    "NVD_API_KEY",
                    "POSTGRES_PASSWORD",
                    "TEST_PASSWORD",
                    "TEST_USER",
                    "TEST_OTHER_USER",
                }
            },
            stdout=web_log,
            stderr=web_log,
            start_new_session=True,
        )
        processes.append(web_process)
        wait_url(web_url, web_process)
        print(
            f"VulnTrack listo: {web_url}\nFastAPI: {api_url}\nCuenta: {args.username}", flush=True
        )
        print(
            "Solo datos temporales. Ctrl+C detiene estos servicios y descarta la base tmpfs.",
            flush=True,
        )
        while all(process.poll() is None for process in processes):
            time.sleep(0.5)
        raise RuntimeError("A local service stopped")
    except KeyboardInterrupt:
        return 0
    except (subprocess.CalledProcessError, RuntimeError) as error:
        print(
            f"Entorno detenido ({type(error).__name__}); no se muestran credenciales ni SQL.",
            file=sys.stderr,
        )
        return 1
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                with suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    with suppress(ProcessLookupError):
                        os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
        if engine:
            engine.dispose()
        for log in logs:
            log.close()
        subprocess.run(["docker", "stop", "--time", "10", name], capture_output=True, check=False)
        temp.cleanup()
        print(
            "Servicios propios detenidos; datos tmpfs descartados. No se tocaron volúmenes ajenos.",
            flush=True,
        )


if __name__ == "__main__":
    sys.exit(main())
