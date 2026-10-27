def create(client, **overrides):
    body = {"title": "Tâche", **overrides}
    res = client.post("/api/todos", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_list_empty(client):
    assert client.get("/api/todos").json() == []


def test_create_with_defaults(client):
    todo = create(client, title="  Acheter du pain  ")
    assert todo["title"] == "Acheter du pain"
    assert todo["description"] == ""
    assert todo["priority"] == "medium"
    assert todo["due_date"] is None
    assert todo["done"] is False


def test_create_with_all_fields(client):
    todo = create(client, description="détails", priority="high", due_date="2026-12-01")
    assert (todo["description"], todo["priority"], todo["due_date"]) == ("détails", "high", "2026-12-01")


def test_list_ordered_by_id(client):
    ids = [create(client, title=f"t{i}")["id"] for i in range(3)]
    assert [t["id"] for t in client.get("/api/todos").json()] == ids


def test_create_rejects_invalid_input(client):
    assert client.post("/api/todos", json={"title": "   "}).status_code == 422
    assert client.post("/api/todos", json={"title": ""}).status_code == 422
    assert client.post("/api/todos", json={"title": "x" * 201}).status_code == 422
    assert client.post("/api/todos", json={"title": "ok", "priority": "urgent"}).status_code == 422
    assert client.post("/api/todos", json={"title": "ok", "due_date": "pas-une-date"}).status_code == 422
    assert client.get("/api/todos").json() == []


def test_patch_only_changes_sent_fields(client):
    todo = create(client, description="d", priority="low", due_date="2026-12-01")
    res = client.patch(f"/api/todos/{todo['id']}", json={"done": True})
    assert res.status_code == 200
    updated = res.json()
    assert updated["done"] is True
    assert (updated["title"], updated["description"], updated["priority"], updated["due_date"]) == (
        "Tâche", "d", "low", "2026-12-01")


def test_patch_can_clear_due_date_and_description(client):
    todo = create(client, description="d", due_date="2026-12-01")
    res = client.patch(f"/api/todos/{todo['id']}", json={"due_date": None, "description": ""})
    assert res.json()["due_date"] is None
    assert res.json()["description"] == ""


def test_patch_validation(client):
    todo = create(client)
    url = f"/api/todos/{todo['id']}"
    assert client.patch(url, json={}).status_code == 422
    assert client.patch(url, json={"title": "  "}).status_code == 422
    assert client.patch(url, json={"title": None}).status_code == 422
    assert client.patch(url, json={"priority": "urgent"}).status_code == 422


def test_patch_unknown_id(client):
    assert client.patch("/api/todos/999", json={"done": True}).status_code == 404


def test_delete(client):
    todo = create(client)
    assert client.delete(f"/api/todos/{todo['id']}").status_code == 204
    assert client.get("/api/todos").json() == []
    assert client.delete(f"/api/todos/{todo['id']}").status_code == 404
