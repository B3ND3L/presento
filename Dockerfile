FROM ghcr.io/astral-sh/uv:0.11-trixie-slim as builder

COPY src ./src
COPY translations ./translations
COPY babel.cfg .
COPY pyproject.toml .
COPY uv.lock .

RUN uv sync
RUN uv run pybabel compile -d translations

FROM python:3.14-slim as final

WORKDIR /app

COPY --from=builder .venv/lib/python3.14/site-packages /usr/local/lib/python3.14
COPY --from=builder translations ./translations
COPY src ./src
COPY babel.cfg .


RUN pip install gunicorn

CMD ["gunicorn", "src.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--log-level", "info"]
