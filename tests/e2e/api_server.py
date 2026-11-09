"""Browser-test-only entrypoint. Real JWT/SQL/ownership, controlled NVD transport.

Not part of src, Vite builds or normal FastAPI startup. No test HTTP endpoints.
"""

import itertools
import json
import os
import sys
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT.parent / "backend"))
if os.environ.get("VULNTRACK_BROWSER_TEST") != "1" or not os.environ.get(
    "TEST_DISPOSABLE_DATABASE", ""
).startswith("vulntrack-web-test-"):
    raise RuntimeError("Only controlled disposable browser-test environment allowed")
import httpx
from app.core.config import Settings
from app.integrations.nvd import NVDClient, Quota
from app.main import create_app
from sqlalchemy.engine import make_url

settings = Settings(_env_file=None, login_attempts_per_minute=100)
if make_url(settings.database_url.get_secret_value()).database != "vulntrack_web_test":
    raise RuntimeError("Disposable database name required")
fixture_dir = ROOT.parent / "backend/tests/fixtures"
first = json.loads((fixture_dir / "nvd_cpe_verified.json").read_text())
second = json.loads((fixture_dir / "nvd_cpe_alternative_verified.json").read_text())
products = [first["products"][0], second["products"][0]]


def controlled(request):
    params = request.url.params
    if "cpeNameId" in params:
        matches = [
            p
            for p in products
            if p["cpe"]["cpeNameId"].lower() == params["cpeNameId"].lower()
        ]
    else:
        query = params.get("keywordSearch", "")
        if query == "fallo-nvd":
            return httpx.Response(503, text="controlled upstream failure")
        if query == "timeout-nvd":
            raise httpx.ReadTimeout("controlled timeout", request=request)
        matches = [] if query == "sin-coincidencias" else products
    payload = deepcopy(first)
    payload.update(
        products=matches,
        resultsPerPage=len(matches),
        totalResults=len(matches),
        startIndex=0,
    )
    return httpx.Response(200, json=payload)


ticks = itertools.count(100, 61)
app = create_app(settings)
app.state.nvd = NVDClient(
    transport=httpx.MockTransport(controlled), quota=Quota(clock=lambda: next(ticks))
)
app.state.identifications.nvd = app.state.nvd

# MVP-B: same real SQL queue/worker as normal startup, only upstream transport is controlled.
# Never imported by the product entrypoint. Model labels select explicit test scenarios.
import time

from app.integrations.nvd_cve import CVEClient
from app.models.database_v1 import AnalysisRun, Asset
from sqlalchemy import select

cve_fixture = json.loads((fixture_dir / "nvd_cve_verified.json").read_text())


def controlled_cve(request):
    if (
        request.url.host != "services.nvd.nist.gov"
        or request.url.path != "/rest/json/cves/2.0"
    ):
        raise RuntimeError("Unexpected test upstream destination")
    with app.state.session_factory() as session:
        scenario = (
            session.scalar(
                select(Asset.model)
                .join(AnalysisRun, AnalysisRun.asset_id == Asset.id)
                .where(AnalysisRun.status == "running")
                .order_by(AnalysisRun.started_at.desc())
                .limit(1)
            )
            or ""
        )
    start = int(request.url.params["startIndex"])
    # Bounded latency gives the browser a real queued/running interval, without a fake status endpoint.
    time.sleep(1.2 if scenario != "CVE-progress" else 3)
    if scenario == "CVE-failed" or scenario == "CVE-partial" and start:
        return httpx.Response(400, text="controlled invalid upstream page")
    total = (
        0
        if scenario == "CVE-empty"
        else 101
        if scenario == "CVE-partial"
        else 22
        if scenario == "CVE-many"
        else 1
    )
    count = min(100, max(0, total - start))
    data = deepcopy(cve_fixture)
    data.update(
        totalResults=total, startIndex=start, resultsPerPage=count, vulnerabilities=[]
    )
    for index in range(count):
        record = deepcopy(cve_fixture["vulnerabilities"][0])
        if total != 1:
            record["cve"]["id"] = f"CVE-2026-{91000 + start + index}"
        if scenario == "CVE-no-cvss":
            record["cve"]["metrics"] = {}
            record["cve"]["references"] = []
        if scenario == "CVE-potential":
            record["cve"]["configurations"] = [
                {
                    "nodes": [
                        {
                            "operator": "OR",
                            "negate": False,
                            "cpeMatch": [
                                {
                                    "vulnerable": True,
                                    "criteria": products[0]["cpe"]["cpeName"],
                                    "matchCriteriaId": "8750A439-1D5F-4D40-9875-D5CD0C116C11",
                                }
                            ],
                        }
                    ]
                }
            ]
        data["vulnerabilities"].append(record)
    return httpx.Response(200, json=data)


app.state.cve = CVEClient(
    transport=httpx.MockTransport(controlled_cve), quota=app.state.nvd.quota
)
app.state.cve_worker.client = app.state.cve
