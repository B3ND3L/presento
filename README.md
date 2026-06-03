![Presento Logo](doc-assets/presento.png)


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux-lightgrey)]()
[![Python](https://img.shields.io/badge/Python-3.14-blue?logo=python)](https://python.org)
[![uv](https://img.shields.io/badge/managed%20with-uv-purple)](https://github.com/astral-sh/uv)

**Presento** is an open-source web application under the **MIT** license that lets you **create, edit, and present slides** directly from your browser.

Slide rendering is powered by **[reveal.js](https://revealjs.com/)**, while the backend is built with **FastAPI** (Python). Presentations are persisted in a **MongoDB** database.

---

## Features

- 📝 Create and edit presentations through a web interface
- 🎨 Choose your reveal.js theme and transition
- 👁️ Full-screen slide viewer
- 🗑️ Delete presentations
- 💾 Persistent storage via MongoDB

---

## Tech Stack

| Layer                | Technology                     |
|----------------------|--------------------------------|
| Backend              | Python 3.14+, FastAPI, Uvicorn |
| Templating           | Jinja2                         |
| Presentation         | reveal.js                      |
| Database             | MongoDB                        |
| Containerization     | Docker Compose                 |
| Python environment   | uv                             |

---

## Prerequisites

### With `uv` (local)
- Python **3.14+**
- [uv](https://docs.astral.sh/uv/) installed
- A running **MongoDB** instance (e.g. `mongodb://localhost:27017`)

### With Docker Compose
- [Docker](https://docs.docker.com/get-docker/)
- `docker compose` plugin

---

## Running the project

### 🐳 With Docker Compose (recommended)

The `compose.yml` file starts **MongoDB** automatically. Then simply run the Python application:

```bash
# 1. Start MongoDB
docker compose up -d

# 2. Install dependencies and start the server
uv sync
uv run pybabel compile -d translations
uv run uvicorn src.main:app --reload
```

The application is available at [http://localhost:8000](http://localhost:8000).

---

### 🐍 Locally with `uv` only

> Make sure a MongoDB instance is running locally on port `27017`.

```bash
uv sync
uv run pybabel compile -d translations
uv run uvicorn src.main:app --reload
```

---

## Project structure

```text
presento/
├── compose.yml            # Docker Compose (MongoDB)
├── pyproject.toml         # Python dependencies (uv)
├── src/
│   ├── main.py            # FastAPI application (routes)
│   ├── models.py          # MongoDB access & models
│   ├── assets/            # Static files (logo, favicon)
│   └── templates/         # Jinja2 templates (index, edit, view)
└── doc-assets/
    └── presento.png
```

---

## License

This project is distributed under the **MIT** license.  
See the [`LICENSE`](LICENSE) file for details.
