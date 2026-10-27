import os

import pytest
from fastapi.testclient import TestClient

# Les tests nécessitent une vraie base PostgreSQL (DATABASE_URL)
if "DATABASE_URL" not in os.environ:
    pytest.exit("DATABASE_URL doit pointer vers une base PostgreSQL de test", returncode=2)

from app.main import app, pool  # noqa: E402


@pytest.fixture(scope="session")
def client():
    # Le context manager déclenche le lifespan (création de la table)
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_db(client):
    with pool.connection() as conn:
        conn.execute("TRUNCATE todos RESTART IDENTITY")
    yield
