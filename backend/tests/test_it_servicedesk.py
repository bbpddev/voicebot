"""Backend tests for IT Service Desk Voice Agent"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestHealth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"

class TestTickets:
    def test_list_tickets(self):
        r = requests.get(f"{BASE_URL}/api/tickets")
        assert r.status_code == 200
        tickets = r.json()
        assert isinstance(tickets, list)
        ids = [t["ticket_id"] for t in tickets]
        assert "TKT-001" in ids
        assert "TKT-002" in ids
        assert "TKT-003" in ids

    def test_get_single_ticket(self):
        r = requests.get(f"{BASE_URL}/api/tickets/TKT-001")
        assert r.status_code == 200
        data = r.json()
        assert data["ticket_id"] == "TKT-001"
        assert "title" in data

    def test_update_ticket_status(self):
        r = requests.patch(f"{BASE_URL}/api/tickets/TKT-001", json={"status": "in_progress"})
        assert r.status_code == 200
        assert r.json()["success"] == True

    def test_create_and_delete_ticket(self):
        # Create
        r = requests.post(f"{BASE_URL}/api/tickets", json={
            "title": "TEST_Ticket",
            "description": "Test description",
            "priority": "low",
            "category": "general",
            "user": "TestUser"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        ticket_id = data["ticket_id"]

        # Delete
        r2 = requests.delete(f"{BASE_URL}/api/tickets/{ticket_id}")
        assert r2.status_code == 200

        # Verify deleted
        r3 = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}")
        assert r3.status_code == 404

    def test_filter_tickets_by_status(self):
        r = requests.get(f"{BASE_URL}/api/tickets?status=open")
        assert r.status_code == 200
        tickets = r.json()
        for t in tickets:
            assert t["status"] == "open"

class TestKnowledgeBase:
    def test_list_kb_articles(self):
        r = requests.get(f"{BASE_URL}/api/kb")
        assert r.status_code == 200
        articles = r.json()
        assert len(articles) >= 8

    def test_kb_search(self):
        r = requests.get(f"{BASE_URL}/api/kb/search?q=vpn")
        assert r.status_code == 200

    def test_create_kb_article(self):
        r = requests.post(f"{BASE_URL}/api/kb", json={
            "title": "TEST_KB Article",
            "content": "Test content",
            "category": "general",
            "tags": ["test"]
        })
        assert r.status_code == 200
        data = r.json()
        assert "article_id" in data
        article_id = data["article_id"]

        # Cleanup
        requests.delete(f"{BASE_URL}/api/kb/{article_id}")
