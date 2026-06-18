from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import os
import re
import ipaddress
import socket
from urllib.parse import urlparse

import httpx

from starlette.responses import Response
from starlette.staticfiles import StaticFiles


from starlette.middleware.sessions import SessionMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from src.config import Config
from src.languageMiddleware import LanguageMiddleware

from src.models import (
    load_presentation, save_presentation,
    create_default_presentation,
    check_presentation_password, generate_id, collection
)

config = Config()
app = FastAPI()

app.mount("/assets", StaticFiles(directory=str(os.path.join(os.path.dirname(__file__), "assets"))), name="assets")

templates_dir = str(os.path.join(os.path.dirname(__file__), "templates"))
templates = Jinja2Templates(directory=templates_dir)


app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=config.get("trusted_hosts"))

@app.middleware("http")
async def set_scheme_middleware(request, call_next):
    # On récupère le protocole envoyé par Nginx Proxy Manager
    proto = request.headers.get("x-forwarded-proto", "http")
    # On force le scope de la requête pour Jinja2 et url_for
    request.scope["scheme"] = proto
    response = await call_next(request)
    return response

app.add_middleware(LanguageMiddleware, templates=templates)
app.add_middleware(SessionMiddleware, secret_key="idkwihtp")

# ── Pages ──────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    # Les présentations affichées sont déterminées côté client à partir
    # des identifiants conservés dans le localStorage du navigateur.
    return templates.TemplateResponse(request, "index.html", {})

@app.post("/pres/new")
async def create_new():
    pres = create_default_presentation()
    return RedirectResponse(url=f"/p/{pres.id}/edit", status_code=303)


@app.get("/p/{pres_id}", response_class=HTMLResponse)
async def view_presentation(request: Request, pres_id: str):
    pres = load_presentation(pres_id)
    if not pres:
        raise HTTPException(404, "Présentation introuvable")
    return templates.TemplateResponse(request, "view.html", {"pres": pres})

@app.get("/p/{pres_id}/edit", response_class=HTMLResponse)
async def edit_page(request: Request, pres_id: str):
    pres = load_presentation(pres_id)
    if not pres:
        raise HTTPException(404, "Présentation introuvable")
    return templates.TemplateResponse(request, "edit.html", {"pres": pres})

# ── Proxy d'iframe (prévisualisation de sites cross-domain) ─

# En-têtes envoyés par le site cible qui empêchent l'embarquement en iframe :
# on les retire pour pouvoir afficher la prévisualisation depuis notre origine.
_FRAME_BLOCKING_HEADERS = {
    "x-frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
    "cross-origin-opener-policy",
    "cross-origin-embedder-policy",
    "cross-origin-resource-policy",
}
# En-têtes « hop-by-hop » ou de transport à ne pas réémettre tels quels.
_SKIP_HEADERS = {
    "content-encoding", "content-length", "transfer-encoding",
    "connection", "keep-alive", "set-cookie", "strict-transport-security",
}
_PROXY_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def _is_blocked_host(host: str) -> bool:
    """Empêche le SSRF : refuse les hôtes résolvant vers une IP privée/locale."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return True
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_multicast or ip.is_reserved or ip.is_unspecified):
            return True
    return False


@app.get("/proxy")
async def proxy(url: str):
    """Récupère une page distante et la ressert depuis notre origine en
    retirant les en-têtes qui interdisent l'embarquement en iframe.

    Permet une prévisualisation de sites qui bloquent normalement le
    cross-domain (X-Frame-Options / CSP frame-ancestors)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(400, "URL invalide")
    if _is_blocked_host(parsed.hostname):
        raise HTTPException(403, "Hôte non autorisé")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            upstream = await client.get(
                url,
                headers={
                    "User-Agent": _PROXY_UA,
                    "Accept": "*/*",
                    "Accept-Language": "fr,en;q=0.8",
                },
            )
    except httpx.HTTPError:
        raise HTTPException(502, "Impossible de récupérer la page distante")

    content_type = upstream.headers.get("content-type", "application/octet-stream")
    content = upstream.content

    # Injecte une balise <base> pour que les ressources relatives se résolvent
    # par rapport à l'URL d'origine (et non par rapport à /proxy).
    if "text/html" in content_type.lower():
        base_tag = f'<base href="{url}">'
        text = content.decode(upstream.encoding or "utf-8", errors="replace")
        if re.search(r"<head[^>]*>", text, flags=re.IGNORECASE):
            text = re.sub(r"(<head[^>]*>)", r"\1" + base_tag, text,
                          count=1, flags=re.IGNORECASE)
        else:
            text = base_tag + text
        content = text.encode("utf-8")
        content_type = "text/html; charset=utf-8"

    headers = {
        k: v for k, v in upstream.headers.items()
        if k.lower() not in _FRAME_BLOCKING_HEADERS
        and k.lower() not in _SKIP_HEADERS
    }
    return Response(content=content, media_type=content_type, headers=headers)

# ── API JSON (présentations stockées côté client) ──────────

class IdsPayload(BaseModel):
    ids: list[str] = []

@app.post("/api/presentations")
async def api_presentations(payload: IdsPayload):
    """Return metadata for the presentations whose IDs are stored locally.

    Only the IDs that still exist on the server are returned, which lets the
    client clean up stale entries from its localStorage."""
    result = []
    for pres_id in payload.ids:
        pres = load_presentation(pres_id)
        if pres:
            result.append({
                "id": pres.id,
                "title": pres.meta.title,
                "theme": pres.meta.theme,
                "has_password": pres.has_password,
            })
    return result

class AccessPayload(BaseModel):
    pres_id: str
    password: str | None = ""

@app.post("/api/pres/access")
async def api_access(payload: AccessPayload):
    """Validate an ID/password couple before storing it client-side."""
    pres_id = (payload.pres_id or "").strip()
    if not pres_id:
        return JSONResponse({"error": "empty"}, status_code=400)
    if not load_presentation(pres_id):
        return JSONResponse({"error": "not_found"}, status_code=404)
    if not check_presentation_password(pres_id, (payload.password or "").strip()):
        return JSONResponse({"error": "bad_password"}, status_code=403)
    return {"id": pres_id}

@app.delete("/api/p/{pres_id}")
async def api_delete(pres_id: str):
    collection.delete_one({"_id": pres_id})
    return {"ok": True}

# ── API JSON (appelée par l'éditeur WYSIWYG) ───────────────

class SavePayload(BaseModel):
    title: str
    theme: str
    transition: str
    slides: list[dict]
    password: str | None = None   # None = keep existing, "" = remove password

@app.put("/api/p/{pres_id}")
async def api_save(pres_id: str, payload: SavePayload):
    if not load_presentation(pres_id):
        raise HTTPException(404, "Présentation introuvable")
    save_presentation(pres_id, payload.model_dump(exclude={"password"}), new_password=payload.password)
    return {"ok": True}

@app.get("/api/p/{pres_id}/export")
async def api_export(pres_id: str):
    """Return raw JSON for offline download."""
    doc = collection.find_one({"_id": pres_id})
    if not doc:
        raise HTTPException(404, "Présentation introuvable")
    export = {
        "title":      doc.get("title", ""),
        "theme":      doc.get("theme", "white"),
        "transition": doc.get("transition", "slide"),
        "slides":     doc.get("slides", [])
    }
    return JSONResponse(content=export)

class ImportPayload(BaseModel):
    title: str
    theme: str = "white"
    transition: str = "slide"
    slides: list[dict]
    password: str | None = None

@app.post("/api/import")
async def api_import(payload: ImportPayload):
    """Create a new presentation from an exported JSON."""
    pres_id = generate_id()
    data = {
        "title":      payload.title,
        "theme":      payload.theme,
        "transition": payload.transition,
        "slides":     payload.slides
    }
    save_presentation(pres_id, data, new_password=payload.password if payload.password else None)
    return {"id": pres_id}


@app.post("/set-lang/{lang}")
async def set_language(lang: str, request: Request, response: Response):
    supported_langs = ['en', 'fr']
    if lang not in supported_langs:
        raise HTTPException(status_code=400, detail=f"Invalid language. Only {', '.join(supported_langs)} are supported.")
    request.session['language'] = lang
    referer = request.headers.get('Referer')
    response = RedirectResponse(referer or "/")
    return response