![Presento Logo](doc-assets/presento.png)


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux-lightgrey)]()
[![Python](https://img.shields.io/badge/Python-3.14-blue?logo=python)](https://python.org)
[![uv](https://img.shields.io/badge/managed%20with-uv-purple)](https://github.com/astral-sh/uv)

**Presento** is an open-source web application under the **MIT** license that lets you **create, edit, and present slides** directly from your browser.

Slide rendering is powered by **[reveal.js](https://revealjs.com/)**, while the backend is built with **FastAPI** (Python). Presentations are persisted in a **MongoDB** database.

---

## Features

- 📝 Create and edit presentations through a **WYSIWYG** web interface
- 🎨 Choose your reveal.js theme and transition
- 👁️ Full-screen slide viewer
- 🔒 Optional **password protection** per presentation
- 🔑 Access an existing presentation by its **ID** (+ password if required)
- 📤 **Export** a presentation to JSON and **import** it back
- 🌍 **Internationalization** (English & French)
- 🗑️ Delete presentations
- 💾 Persistent storage via MongoDB

---

## Tech Stack

| Layer                | Technology                     |
|----------------------|--------------------------------|
| Backend              | Python 3.14+, FastAPI, Uvicorn |
| Templating           | Jinja2                         |
| Internationalization | Babel / gettext                |
| Presentation         | reveal.js                      |
| Database             | MongoDB                        |
| Containerization     | Docker Compose                 |
| Python environment   | uv                             |

---

## Prerequisites

### With Docker Compose (recommended)
- [Docker](https://docs.docker.com/get-docker/)
- `docker compose` plugin

### With `uv` (local)
- Python **3.14+**
- [uv](https://docs.astral.sh/uv/) installed
- A running **MongoDB** instance (e.g. `mongodb://localhost:27017`)

---

## Running the project

### 🐳 With Docker Compose (recommended)

The `compose.yml` file starts the **entire stack** — the Presento application **and** its MongoDB
database — using the prebuilt image `ghcr.io/b3nd3l/presento`. A single command brings everything up:

```bash
docker compose up -d
```

The application is available at [http://localhost:8000](http://localhost:8000).

> To rebuild the image locally instead of pulling it, run `docker compose up -d --build`.

---

### 🐍 Locally with `uv` only

> Make sure a MongoDB instance is running locally on port `27017`.
> You can override the connection string with the `MONGO_URI` environment variable
> (default: `mongodb://localhost:27017`).

```bash
# 1. Install dependencies
uv sync

# 2. Compile the translation catalogs
uv run pybabel compile -d translations

# 3. Start the server
uv run uvicorn src.main:app --reload
```

The application is available at [http://localhost:8000](http://localhost:8000).

---

## Configuration

| Setting         | Where           | Description                                    |
|-----------------|-----------------|------------------------------------------------|
| `MONGO_URI`     | Environment var | MongoDB connection string                      |
| `trusted_hosts` | `config.toml`   | Hosts trusted by the proxy-headers middleware  |

---

## Internationalization

Presento ships with **English** and **French** translations (managed with Babel/gettext).

```bash
# Extract translatable strings into the .pot catalog
uv run pybabel extract -F babel.cfg -o translations/messages.pot .

# Update the existing language catalogs
uv run pybabel update -i translations/messages.pot -d translations

# Compile the catalogs (required before running)
uv run pybabel compile -d translations
```

The active language can be switched at runtime from the UI (`/set-lang/{lang}`)
and falls back to the browser's `Accept-Language` header.

---

## Project structure

```text
presento/
├── compose.yml                # Docker Compose (Presento + MongoDB)
├── Dockerfile                 # Production image (Gunicorn + Uvicorn workers)
├── config.toml                # Application configuration (trusted hosts)
├── babel.cfg                  # Babel extraction config
├── pyproject.toml             # Python dependencies (uv)
├── src/
│   ├── main.py                # FastAPI application (routes & JSON API)
│   ├── models.py              # MongoDB access, models & password helpers
│   ├── config.py              # TOML configuration loader
│   ├── translator.py          # gettext translation wrapper
│   ├── languageMiddleware.py  # Per-request language selection
│   ├── assets/                # Static files (CSS, JS, logo, favicon)
│   └── templates/             # Jinja2 templates (index, edit, view)
├── translations/              # i18n catalogs (en, fr)
└── doc-assets/
    └── presento.png
```

---

## License

This project is distributed under the **MIT** license.  
See the [`LICENSE`](LICENSE) file for details.

The source code is available at [github.com/B3ND3L/presento](https://github.com/B3ND3L/presento/).

