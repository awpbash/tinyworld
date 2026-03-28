"""Connection discovery router with SSE streaming."""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from models.database import get_db, SessionLocal
from services import connection_service, graph_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["connections"])


@router.get("/connections/stream")
async def connections_stream(
    person_a_id: int = Query(...),
    person_b_id: int = Query(...),
):
    """SSE endpoint that streams the connection discovery process.

    Creates its own DB session to avoid blocking other concurrent streams.
    """

    async def event_generator():
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

        async def emit(event: dict[str, Any]):
            await queue.put(event)

        async def run_search():
            db = SessionLocal()
            try:
                await connection_service.find_connections(
                    person_a_id, person_b_id, db, emit
                )
            except Exception as e:
                logger.error(f"Connection search failed: {e}")
                await queue.put({
                    "type": "error",
                    "message": str(e),
                })
            finally:
                db.close()
                await queue.put(None)

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


@router.get("/graph")
def get_full_graph():
    """Get full graph data for visualization (react-force-graph format)."""
    return graph_service.get_full_graph()


@router.get("/person/{person_id}/network")
def get_person_network(person_id: int, depth: int = 2):
    """Get ego network around a person."""
    return graph_service.get_person_network(person_id, depth=depth)
