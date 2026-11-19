"""POST /documents/render/{fmt}: canonical JSON -> downloadable office file."""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import Response

from config import Settings, get_settings
from documents.models import Deck, Doc, Workbook
from documents.render import render_docx, render_pptx, render_xlsx

router = APIRouter()
MIME = {
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _auth(x_ai_internal_secret: Annotated[str | None, Header()] = None, s: Settings = Depends(get_settings)) -> None:
    if x_ai_internal_secret != s.ai_internal_secret:
        raise HTTPException(status_code=401, detail="Invalid internal secret")


@router.post("/render/{fmt}", dependencies=[Depends(_auth)])
async def render(fmt: Literal["pptx", "docx", "xlsx"], body: dict) -> Response:
    try:
        data = {"pptx": lambda: render_pptx(Deck.model_validate(body)),
                "docx": lambda: render_docx(Doc.model_validate(body)),
                "xlsx": lambda: render_xlsx(Workbook.model_validate(body))}[fmt]()
    except ValueError as exc:  # pydantic ValidationError subclasses ValueError
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(content=data, media_type=MIME[fmt])
