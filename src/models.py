import os
import uuid
import hashlib
import secrets
from pydantic import BaseModel
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["presento"]
collection = db["presentations"]

class PresentationMeta(BaseModel):
    title: str = "Nouvelle présentation"
    theme: str = "white"
    transition: str = "slide"

class Presentation(BaseModel):
    id: str
    meta: PresentationMeta
    slides: list[dict]
    has_password: bool = False

def generate_id() -> str:
    return str(uuid.uuid4())[:8]

# ── Password helpers ───────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Returns True if password matches, or if stored_hash is empty (no password set)."""
    if not stored_hash:
        return True
    try:
        salt, hashed = stored_hash.split(":", 1)
        return hashlib.sha256((salt + password).encode()).hexdigest() == hashed
    except Exception:
        return False

def check_presentation_password(pres_id: str, password: str) -> bool:
    """Returns True if password is correct (or presentation has no password)."""
    doc = collection.find_one({"_id": pres_id})
    if not doc:
        return False
    stored = doc.get("password_hash", "")
    return verify_password(password, stored)

def presentation_has_password(pres_id: str) -> bool:
    """Lightweight check: does the presentation require a password?"""
    doc = collection.find_one({"_id": pres_id}, {"password_hash": 1})
    return bool(doc and doc.get("password_hash", ""))

# ── CRUD ───────────────────────────────────────────────────────────────────────
def save_presentation(pres_id: str, data: dict, new_password: str | None = None) -> None:
    """data = { title, theme, transition, slides }
       new_password: if provided, hash and store it; if empty string, clear it; if None, keep existing."""
    payload: dict = {k: v for k, v in data.items() if k in ("title", "theme", "transition", "slides")}

    if new_password is not None:
        payload["password_hash"] = "" if new_password == "" else hash_password(new_password)

    collection.update_one(
        {"_id": pres_id},
        {"$set": payload},
        upsert=True
    )

def load_presentation(pres_id: str) -> "Presentation | None":
    doc = collection.find_one({"_id": pres_id})
    if not doc:
        return None
    return Presentation(
        id=pres_id,
        meta=PresentationMeta(
            title=doc.get("title", "Sans titre"),
            theme=doc.get("theme", "white"),
            transition=doc.get("transition", "slide"),
        ),
        slides=doc.get("slides", []),
        has_password=bool(doc.get("password_hash", ""))
    )

def list_presentations() -> list["Presentation"]:
    return [
        Presentation(
            id=doc["_id"],
            meta=PresentationMeta(
                title=doc.get("title", "Sans titre"),
                theme=doc.get("theme", "white"),
                transition=doc.get("transition", "slide"),
            ),
            slides=doc.get("slides", []),
            has_password=bool(doc.get("password_hash", ""))
        )
        for doc in collection.find()
    ]

def create_default_presentation() -> "Presentation":
    pres_id = generate_id()
    data = {
        "title": "Ma présentation",
        "theme": "white",
        "transition": "slide",
        "slides": [
            {
                "bg": "",
                "elements": [
                    {
                        "id": "el_1", "type": "text",
                        "x": 80, "y": 180, "w": 800, "h": 80,
                        "text": "Ma présentation", "html": "Ma présentation",
                        "fontSize": 52, "fontWeight": "bold",
                        "fontFamily": "inherit", "color": "",
                        "align": "center", "bg": "transparent", "zIndex": 1
                    },
                    {
                        "id": "el_2", "type": "text",
                        "x": 80, "y": 290, "w": 800, "h": 40,
                        "text": "Sous-titre ou accroche",
                        "html": "Sous-titre ou accroche",
                        "fontSize": 22, "fontWeight": "normal",
                        "fontFamily": "inherit", "color": "",
                        "align": "center", "bg": "transparent", "zIndex": 2
                    }
                ]
            }
        ]
    }
    save_presentation(pres_id, data)
    return load_presentation(pres_id)