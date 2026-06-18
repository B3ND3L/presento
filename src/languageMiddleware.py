from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.templating import Jinja2Templates

from src.translator import set_locale, _


class LanguageMiddleware(BaseHTTPMiddleware):

    __SUPPORTED_LANGUAGES = ["en", "fr"]

    def __init__(self, app, templates: Jinja2Templates):
        super().__init__(app)
        self.templates = templates

    async def dispatch(self, request: Request, call_next):
        lang = request.session.get('language') or request.headers.get("Accept-Language", "en")
        if lang not in self.__SUPPORTED_LANGUAGES:
            lang = "en"
        await set_locale(request, lang)

        self.templates.env.globals['_'] = _
        self.templates.env.globals['lang'] = lang

        response = await call_next(request)
        return response