import os
import time
from contextlib import asynccontextmanager
from datetime import date
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

DATABASE_URL = os.environ["DATABASE_URL"]

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=5, open=False,
                      kwargs={"row_factory": dict_row})


def init_db() -> None:
    # La base peut mettre quelques secondes à accepter les connexions
    for attempt in range(30):
        try:
            pool.open(wait=True, timeout=5)
            break
        except Exception:
            if attempt == 29:
                raise
            time.sleep(2)
    with pool.connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS todos (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                done BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        # Migrations idempotentes (la base existante est conservée)
        conn.execute("ALTER TABLE todos ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''")
        conn.execute("ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'medium'")
        conn.execute("ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date DATE")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield
    pool.close()


app = FastAPI(title="Todo API", lifespan=lifespan)


Priority = Literal["low", "medium", "high"]


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    priority: Priority = "medium"
    due_date: date | None = None


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: Priority | None = None
    due_date: date | None = None
    done: bool | None = None


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/todos")
def list_todos():
    with pool.connection() as conn:
        return conn.execute("SELECT * FROM todos ORDER BY id").fetchall()


@app.post("/api/todos", status_code=201)
def create_todo(body: TodoCreate):
    title = body.title.strip()
    if not title:
        raise HTTPException(422, "Le titre ne peut pas être vide")
    with pool.connection() as conn:
        return conn.execute(
            """
            INSERT INTO todos (title, description, priority, due_date)
            VALUES (%s, %s, %s, %s) RETURNING *
            """,
            (title, body.description.strip(), body.priority, body.due_date),
        ).fetchone()


@app.patch("/api/todos/{todo_id}")
def update_todo(todo_id: int, body: TodoUpdate):
    # Seuls les champs envoyés sont modifiés (null permet d'effacer la date)
    changes = {k: getattr(body, k) for k in body.model_fields_set}
    for key in ("title", "description"):
        if changes.get(key) is not None:
            changes[key] = changes[key].strip()
    if "title" in changes and not changes["title"]:
        raise HTTPException(422, "Le titre ne peut pas être vide")
    for key in ("title", "description", "priority", "done"):
        if key in changes and changes[key] is None:
            raise HTTPException(422, f"{key} ne peut pas être null")
    if not changes:
        raise HTTPException(422, "Aucune modification")
    # Les noms de colonnes viennent du modèle Pydantic, jamais de l'utilisateur
    assignments = ", ".join(f"{k} = %s" for k in changes)
    with pool.connection() as conn:
        row = conn.execute(
            f"UPDATE todos SET {assignments} WHERE id = %s RETURNING *",
            (*changes.values(), todo_id),
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Todo introuvable")
    return row


@app.delete("/api/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int):
    with pool.connection() as conn:
        cur = conn.execute("DELETE FROM todos WHERE id = %s", (todo_id,))
    if cur.rowcount == 0:
        raise HTTPException(404, "Todo introuvable")
    return Response(status_code=204)
