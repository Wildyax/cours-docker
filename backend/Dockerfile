ARG PYTHON_VERSION=3.13

# ---- Stage 1 : installation des dépendances dans un venv ----
FROM python:${PYTHON_VERSION}-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install -r requirements.txt

# ---- Stage 2 : image finale minimale, utilisateur non-root ----
FROM python:${PYTHON_VERSION}-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PATH="/opt/venv/bin:$PATH"
RUN useradd --system --uid 1001 --no-create-home appuser
COPY --from=builder /opt/venv /opt/venv
WORKDIR /srv
COPY app ./app
USER appuser
# Render injecte PORT ; 8000 par défaut en local
ENV PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD python -c "import os, urllib.request as u; u.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health')" || exit 1
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
