"""Search router with SSE streaming."""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from models.database import get_db, SessionLocal
from models.person import Person
from services import search_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search/stream")
async def search_stream(q: str = Query(...)):
    """SSE endpoint that streams the person search process.

    Each stream creates its own DB session so multiple concurrent
    searches don't block each other on SQLite's write lock.
    """

    async def event_generator():
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

        async def emit(event: dict[str, Any]):
            await queue.put(event)

        async def run_search():
            # Own session per search — prevents mutex with other agents
            db = SessionLocal()
            try:
                await search_service.search_person(q, db, emit)
            except Exception as e:
                logger.error(f"Search failed: {e}")
                await queue.put({
                    "type": "error",
                    "message": str(e),
                })
            finally:
                db.close()
                await queue.put(None)  # sentinel

        task = asyncio.create_task(run_search())

        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield {
                    "event": event.get("type", "message"),
                    "data": json.dumps(event, default=str),
                }
        finally:
            if not task.done():
                task.cancel()

    return EventSourceResponse(event_generator())


@router.get("/persons/{person_id}")
def get_person(person_id: int, db: Session = Depends(get_db)):
    """Get a cached person profile by ID."""
    person = db.query(Person).get(person_id)
    if not person:
        return {"error": "Person not found"}, 404
    return person.to_dict()


@router.get("/persons")
def list_persons(db: Session = Depends(get_db)):
    """List all persons in the database."""
    persons = db.query(Person).order_by(Person.created_at.desc()).limit(100).all()
    return [p.to_dict() for p in persons]
