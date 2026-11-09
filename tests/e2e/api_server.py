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
import httpx  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.integrations.nvd import NVDClient, Quota  # noqa: E402
from app.main import create_app  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

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
            p for p in products if p["cpe"]["cpeNameId"].lower() == params["cpeNameId"].lower()
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
        products=matches, resultsPerPage=len(matches), totalResults=len(matches), startIndex=0
    )
    return httpx.Response(200, json=payload)


ticks = itertools.count(100, 61)
app = create_app(settings)
app.state.nvd = NVDClient(
    transport=httpx.MockTransport(controlled), quota=Quota(clock=lambda: next(ticks))
)
app.state.identifications.nvd = app.state.nvd
