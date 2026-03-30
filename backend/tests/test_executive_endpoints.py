"""Integration tests for custom executive Mission Control endpoints.

These tests hit the running local backend (localhost:8000).
Requires: pm2 mc-backend running.
"""

import httpx
import pytest

BASE = "http://localhost:8000"
AUTH = {"Authorization": "Bearer 22d989338f932ae11b79622426e5798934589a1e93f31a82ffef1d8121354b08"}


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE, timeout=30.0) as c:
        yield c


# ─── Auth Failure Tests ───────────────────────────────────────────────


def test_no_auth_returns_401(client):
    endpoints = [
        "/api/v1/executive-agents",
        "/api/v1/overview",
        "/api/v1/documents",
        "/api/v1/improvements",
    ]
    for path in endpoints:
        resp = client.get(path)
        assert resp.status_code in (401, 403), f"GET {path} returned {resp.status_code} without auth"


def test_invalid_token_returns_401(client):
    resp = client.get(
        "/api/v1/executive-agents",
        headers={"Authorization": "Bearer invalid-token-that-is-definitely-long-enough-for-validation-purposes"},
    )
    assert resp.status_code in (401, 403)


# ─── Executive Agents ─────────────────────────────────────────────────


def test_list_executive_agents(client):
    resp = client.get("/api/v1/executive-agents", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 5


def test_get_executive_agent(client):
    agents = client.get("/api/v1/executive-agents", headers=AUTH).json()
    assert len(agents) > 0
    agent_id = agents[0]["id"]
    resp = client.get(f"/api/v1/executive-agents/{agent_id}", headers=AUTH)
    assert resp.status_code == 200
    agent = resp.json()
    assert agent["id"] == agent_id
    assert "display_name" in agent


def test_refresh_all_agents(client):
    resp = client.post("/api/v1/executive-agents/refresh-all", headers=AUTH)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ─── Overview ─────────────────────────────────────────────────────────


def test_overview(client):
    resp = client.get("/api/v1/overview", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    for key in ("what_matters_now", "waiting_on_michael", "agent_snapshots", "risks_and_alerts", "what_changed"):
        assert key in data
    assert isinstance(data["agent_snapshots"], list)


# ─── Documents ────────────────────────────────────────────────────────


def test_documents_crud(client):
    # Create
    resp = client.post("/api/v1/documents", headers=AUTH, json={
        "title": "Test Doc", "content": "# Hello", "doc_type": "markdown",
    })
    assert resp.status_code == 201
    doc_id = resp.json()["id"]

    # List
    resp = client.get("/api/v1/documents", headers=AUTH)
    assert resp.status_code == 200
    assert any(d["id"] == doc_id for d in resp.json())

    # Get
    resp = client.get(f"/api/v1/documents/{doc_id}", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["content"] == "# Hello"

    # Update
    resp = client.patch(f"/api/v1/documents/{doc_id}", headers=AUTH, json={"title": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"

    # Archive
    resp = client.delete(f"/api/v1/documents/{doc_id}", headers=AUTH)
    assert resp.status_code == 204


# ─── Improvements ─────────────────────────────────────────────────────


def test_improvements_crud(client):
    resp = client.post("/api/v1/improvements", headers=AUTH, json={
        "title": "Test Improvement", "priority": "normal", "category": "process",
    })
    assert resp.status_code == 201
    imp_id = resp.json()["id"]

    resp = client.get("/api/v1/improvements", headers=AUTH)
    assert resp.status_code == 200

    resp = client.get("/api/v1/improvements/stats", headers=AUTH)
    assert resp.status_code == 200
    assert "proposed" in resp.json()

    resp = client.patch(f"/api/v1/improvements/{imp_id}", headers=AUTH, json={"status": "reviewing"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "reviewing"


# ─── Agent Chat ───────────────────────────────────────────────────────


def test_agent_chat_messages(client):
    agents = client.get("/api/v1/executive-agents", headers=AUTH).json()
    agent_id = agents[0]["id"]

    # List messages
    resp = client.get(f"/api/v1/agent-chat/{agent_id}/messages", headers=AUTH)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # Receive (simulate agent response)
    resp = client.post(f"/api/v1/agent-chat/{agent_id}/receive", headers=AUTH, json={
        "content": "Test response from test suite",
    })
    assert resp.status_code == 200
    assert resp.json()["role"] == "agent"


# ─── Agent Files ──────────────────────────────────────────────────────


def test_agent_files_list(client):
    resp = client.get("/api/v1/agent-files/main", headers=AUTH)
    assert resp.status_code == 200
    files = resp.json()
    assert isinstance(files, list)
    names = [f["name"] for f in files]
    assert "SOUL.md" in names


def test_agent_files_read(client):
    resp = client.get("/api/v1/agent-files/main/SOUL.md", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "SOUL.md"
    assert len(data["content"]) > 0


# ─── Schedules ────────────────────────────────────────────────────────


def test_schedules_list(client):
    resp = client.get("/api/v1/schedules", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert "jobs" in data
    assert isinstance(data["jobs"], list)


# ─── Security: Schedule job_id validation ─────────────────────────────


def test_schedule_invalid_job_id_rejected(client):
    resp = client.post("/api/v1/schedules/test;rm -rf/run", headers=AUTH)
    assert resp.status_code in (400, 404, 422)


# ─── Health (public) ──────────────────────────────────────────────────


def test_health_endpoints_public(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get("/readyz")
    assert resp.status_code == 200
