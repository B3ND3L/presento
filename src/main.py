from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import os

from starlette.responses import Response
from starlette.staticfiles import StaticFiles


from starlette.middleware.sessions import SessionMiddleware

from .languageMiddleware import LanguageMiddleware

from src.models import (
    load_presentation, save_presentation,
    create_default_presentation, list_presentations,
    check_presentation_password, generate_id, collection
)

app = FastAPI()

app.mount("/assets", StaticFiles(directory=str(os.path.join(os.path.dirname(__file__), "assets"))), name="assets")

templates_dir = str(os.path.join(os.path.dirname(__file__), "templates"))
templates = Jinja2Templates(directory=templates_dir)


app.add_middleware(LanguageMiddleware, templates=templates)
app.add_middleware(SessionMiddleware, secret_key="idkwihtp")

# ── Pages ──────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html",
        {"presentations": list_presentations()})

@app.post("/pres/new")
async def create_new():
    pres = create_default_presentation()
    return RedirectResponse(url=f"/p/{pres.id}/edit", status_code=303)

@app.post("/pres/access")
async def access_presentation(request: Request):
    """Access an existing presentation by ID + optional password."""
    form = await request.form()
    pres_id = str(form.get("pres_id", "")).strip()
    password = str(form.get("password", "")).strip()
    if not pres_id:
        return templates.TemplateResponse(request, "index.html", {
            "presentations": list_presentations(),
            "access_error": "Veuillez saisir un ID de présentation."
        })
    pres = load_presentation(pres_id)
    if not pres:
        return templates.TemplateResponse(request, "index.html", {
            "presentations": list_presentations(),
            "access_error": f"Présentation « {pres_id} » introuvable."
        })
    if not check_presentation_password(pres_id, password):
        return templates.TemplateResponse(request, "index.html", {
            "presentations": list_presentations(),
            "access_error": "Mot de passe incorrect.",
            "access_pres_id": pres_id
        })
    return RedirectResponse(url=f"/p/{pres_id}/edit", status_code=303)

@app.post("/pres/{pres_id}/delete")
async def delete_pres(pres_id: str):
    collection.delete_one({"_id": pres_id})
    return RedirectResponse(url="/", status_code=303)

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