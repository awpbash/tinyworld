"""Connection discovery service with SSE streaming."""

import asyncio
import logging
from functools import partial
from typing import Any, Callable, Awaitable

from sqlalchemy.orm import Session

from config import TINYFISH_API_KEY
from models.person import Person, Relationship, Entity, PersonEntity
from scrapers import google_search, wikidata
from scrapers.tinyfish import tinyfish_search_connections, tinyfish_deep_connection_search
from services import llm_service, graph_service

logger = logging.getLogger(__name__)

EventCallback = Callable[[dict[str, Any]], Awaitable[None]]


async def _in_thread(fn, *args, **kwargs):
    """Run sync DB calls in a thread to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))


async def find_connections(
    person_a_id: int,
    person_b_id: int,
    db: Session,
    emit: EventCallback,
) -> dict[str, Any]:
    """
    Multi-layer connection discovery between two people.

    Layer 1: Direct graph path lookup
    Layer 2: Expand graph by scraping neighbors (Wikidata)
    Layer 3: TinyFish stealth search for co-mentions + LLM bridge
    """
    person_a = await _in_thread(db.query(Person).get, person_a_id)
    person_b = await _in_thread(db.query(Person).get, person_b_id)

    if not person_a or not person_b:
        await emit({
            "type": "error",
            "message": "One or both persons not found in database.",
        })
        return {"found": False, "error": "Person not found"}

    name_a = person_a.name
    name_b = person_b.name

    # ===== Layer 1: Direct graph lookup =====
    await emit({
        "type": "status", "step": "graph_lookup",
        "message": f"Checking existing graph connections between {name_a} and {name_b}...",
    })

    path = graph_service.find_connection(person_a_id, person_b_id)
    if path:
        await emit({
            "type": "status", "step": "graph_lookup",
            "message": f"Found direct path with {len(path)} steps!",
        })
        summary = await llm_service.summarize_connection(path)
        result = {
            "found": True,
            "layer": 1,
            "path": path,
            "summary": summary,
        }
        await emit({"type": "complete", "connection": result})
        return result

    await emit({
        "type": "status", "step": "graph_lookup",
        "message": "No direct path found. Expanding network...",
    })

    # ===== Layer 2: Expand graph by scraping neighbors =====
    await emit({
        "type": "status", "step": "expand",
        "message": f"Expanding network around {name_a}...",
    })

    await _expand_person_network(person_a, db, emit)

    await emit({
        "type": "status", "step": "expand",
        "message": f"Expanding network around {name_b}...",
    })

    await _expand_person_network(person_b, db, emit)

    # Emit incremental graph after expansion
    await emit({
        "type": "graph_update",
        "step": "expand",
        "message": "Network expanded — graph updated",
        "graph": graph_service.get_full_graph(),
    })

    # Re-check graph after expansion
    path = graph_service.find_connection(person_a_id, person_b_id)
    if path:
        await emit({
            "type": "status", "step": "expand",
            "message": f"Found connection after expansion! {len(path)} steps.",
        })
        summary = await llm_service.summarize_connection(path)
        result = {
            "found": True,
            "layer": 2,
            "path": path,
            "summary": summary,
        }
        await emit({"type": "complete", "connection": result})
        return result

    # ===== Layer 3: TinyFish deep connection search + LLM bridge =====
    await emit({
        "type": "status", "step": "tinyfish",
        "message": f"Launching deep connection search between {name_a} and {name_b}...",
    })

    deep_conn: dict = {}
    search_results: list[dict] = []

    if TINYFISH_API_KEY:
        try:
            deep_conn = await tinyfish_deep_connection_search(name_a, name_b, emit=emit)
            search_results = deep_conn.get("co_mentions", [])

            shared_count = len(deep_conn.get("shared_entities", []))
            event_count = len(deep_conn.get("event_connections", []))
            mutual_count = len(deep_conn.get("mutual_connections", []))

            await emit({
                "type": "result", "step": "tinyfish",
                "data": {
                    "co_mentions": len(search_results),
                    "shared_entities": shared_count,
                    "event_connections": event_count,
                    "mutual_connections": mutual_count,
                },
            })
        except Exception as e:
            logger.error(f"TinyFish deep connection search failed: {e}")
            await emit({"type": "status", "step": "tinyfish", "message": f"Deep search failed: {e}"})

    # Store deep connection entities into the graph before LLM analysis
    if deep_conn:
        _store_deep_connection_entities(db, person_a, person_b, deep_conn)

    # Fallback to basic Google scrape
    if not search_results:
        await emit({
            "type": "status", "step": "google",
            "message": f"Searching Google for co-mentions of {name_a} and {name_b}...",
        })
        try:
            search_results = await google_search.search_google(
                f'"{name_a}" "{name_b}"'
            )
            if search_results:
                await emit({
                    "type": "result", "step": "google",
                    "data": {
                        "num_results": len(search_results),
                        "top_results": [
                            {"title": r["title"], "snippet": r["snippet"]}
                            for r in search_results[:3]
                        ],
                    },
                })
        except Exception as e:
            logger.error(f"Google search failed: {e}")
            await emit({
                "type": "status", "step": "google",
                "message": f"Google search failed: {e}",
            })

    await emit({
        "type": "status", "step": "llm",
        "message": "Using AI to find potential connections...",
    })

    try:
        relationships = await llm_service.find_relationships(
            person_a.to_dict(), person_b.to_dict(), search_results
        )

        if relationships:
            # Store the best direct relationship
            best = relationships[0]
            rel = Relationship(
                person_a_id=person_a_id,
                person_b_id=person_b_id,
                relationship_type=best.get("relationship_type", "associated"),
                strength=best.get("strength", 0.3),
                description=best.get("description", ""),
                evidence_sources=best.get("evidence", []),
            )
            def _save_rel():
                db.add(rel)
                db.commit()
            await _in_thread(_save_rel)
            graph_service.add_relationship(
                person_a_id, person_b_id, rel.to_dict()
            )

            # Create shared entity nodes from LLM output
            await _in_thread(_store_shared_entities, db, person_a, person_b, relationships, emit)

            # Emit incremental graph with all new entities
            await emit({
                "type": "graph_update",
                "step": "graph",
                "message": "Connection entities added to graph",
                "graph": graph_service.get_full_graph(),
            })

            path = graph_service.find_connection(person_a_id, person_b_id)
            summary = await llm_service.summarize_connection(path or [])

            result = {
                "found": True,
                "layer": 3,
                "path": path,
                "relationships": relationships,
                "summary": summary,
                "search_results": search_results[:3],
            }
            await emit({"type": "complete", "connection": result})
            return result
    except Exception as e:
        logger.error(f"LLM connection finding failed: {e}")

    # No connection found
    result = {
        "found": False,
        "layer": 3,
        "message": f"Could not find a connection between {name_a} and {name_b}.",
        "search_results": search_results[:3],
    }
    await emit({"type": "complete", "connection": result})
    return result


# ─── Shared entity helpers ───────────────────────────────────────────

def _store_shared_entities(
    db: Session,
    person_a: Person,
    person_b: Person,
    relationships: list[dict],
    emit: EventCallback,
) -> None:
    """Extract shared entities from LLM relationship output and create
    Entity + PersonEntity records so the graph connects through them.
    """
    for rel in relationships:
        shared = rel.get("shared_entities", [])
        for se in shared:
            ent_name = se.get("name", "").strip()
            ent_type = se.get("type", "organization").strip() or "organization"
            if not ent_name:
                continue

            # Get or create entity
            existing = (
                db.query(Entity)
                .filter(Entity.name.ilike(ent_name), Entity.entity_type == ent_type)
                .first()
            )
            if not existing:
                existing = Entity(
                    name=ent_name,
                    entity_type=ent_type,
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)

            graph_service.add_entity(existing.to_dict())

            # Link person A
            _ensure_person_entity(db, person_a.id, existing.id, ent_type)
            graph_service.add_person_entity_edge(
                person_a.id, existing.id,
                {"relationship_type": _rel_type_for(ent_type)},
            )

            # Link person B
            _ensure_person_entity(db, person_b.id, existing.id, ent_type)
            graph_service.add_person_entity_edge(
                person_b.id, existing.id,
                {"relationship_type": _rel_type_for(ent_type)},
            )


def _store_deep_connection_entities(
    db: Session,
    person_a: Person,
    person_b: Person,
    deep_conn: dict,
) -> None:
    """Process deep connection search results into Entity nodes."""
    # Shared entities (schools, companies, etc.)
    for se in deep_conn.get("shared_entities", []):
        ent_name = se.get("name", "").strip()
        ent_type = se.get("type", "organization").strip() or "organization"
        if not ent_name:
            continue

        existing = (
            db.query(Entity)
            .filter(Entity.name.ilike(ent_name), Entity.entity_type == ent_type)
            .first()
        )
        if not existing:
            existing = Entity(name=ent_name, entity_type=ent_type)
            db.add(existing)
            db.commit()
            db.refresh(existing)

        graph_service.add_entity(existing.to_dict())

        # Link both persons to this entity
        for person in [person_a, person_b]:
            _ensure_person_entity(db, person.id, existing.id, ent_type)
            graph_service.add_person_entity_edge(
                person.id, existing.id,
                {"relationship_type": _rel_type_for(ent_type)},
            )

    # Event connections
    for event in deep_conn.get("event_connections", []):
        event_name = event.get("event_name", "").strip()
        if not event_name:
            continue

        existing = (
            db.query(Entity)
            .filter(Entity.name.ilike(event_name), Entity.entity_type == "event")
            .first()
        )
        if not existing:
            existing = Entity(
                name=event_name,
                entity_type="event",
                metadata_json={
                    "date": event.get("date", ""),
                    "location": event.get("location", ""),
                },
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)

        graph_service.add_entity(existing.to_dict())

        for person in [person_a, person_b]:
            _ensure_person_entity(db, person.id, existing.id, "event")
            graph_service.add_person_entity_edge(
                person.id, existing.id,
                {"relationship_type": "participated_in"},
            )


def _ensure_person_entity(
    db: Session, person_id: int, entity_id: int, entity_type: str
) -> None:
    """Create PersonEntity link if it doesn't exist."""
    exists = (
        db.query(PersonEntity)
        .filter(
            PersonEntity.person_id == person_id,
            PersonEntity.entity_id == entity_id,
        )
        .first()
    )
    if not exists:
        pe = PersonEntity(
            person_id=person_id,
            entity_id=entity_id,
            relationship_type=_rel_type_for(entity_type),
        )
        db.add(pe)
        db.commit()


def _rel_type_for(entity_type: str) -> str:
    """Map entity type to a sensible default relationship type."""
    mapping = {
        "school": "attended",
        "company": "works_at",
        "team": "member_of",
        "organization": "member_of",
        "event": "participated_in",
        "location": "located_in",
    }
    return mapping.get(entity_type, "associated")


# ─── Network expansion ──────────────────────────────────────────────

async def _expand_person_network(
    person: Person, db: Session, emit: EventCallback
) -> None:
    """Fetch related people from Wikidata and add them to the graph."""
    if not person.wikidata_id:
        return

    try:
        related = await wikidata.get_related_people(person.wikidata_id)
        await emit({
            "type": "status", "step": "expand",
            "message": f"Found {len(related)} related people for {person.name}.",
        })

        # Batch all DB writes in a thread to avoid blocking the event loop
        def _db_expand():
            for rel_person in related[:10]:
                existing = (
                    db.query(Person)
                    .filter(Person.wikidata_id == rel_person["wikidata_id"])
                    .first()
                )
                if not existing:
                    existing = Person(
                        name=rel_person["name"],
                        wikidata_id=rel_person["wikidata_id"],
                    )
                    db.add(existing)
                    db.commit()
                    db.refresh(existing)

                graph_service.add_person(existing.to_dict())
                rel_data = {
                    "relationship_type": rel_person.get("relation", "associated"),
                    "strength": 0.5,
                    "description": rel_person.get("relation", ""),
                }
                graph_service.add_relationship(person.id, existing.id, rel_data)

                exists_rel = (
                    db.query(Relationship)
                    .filter(
                        Relationship.person_a_id == person.id,
                        Relationship.person_b_id == existing.id,
                    )
                    .first()
                )
                if not exists_rel:
                    db_rel = Relationship(
                        person_a_id=person.id,
                        person_b_id=existing.id,
                        relationship_type=rel_person.get("relation", "associated"),
                        strength=0.5,
                        description=rel_person.get("relation", ""),
                    )
                    db.add(db_rel)
            db.commit()

        await _in_thread(_db_expand)

    except Exception as e:
        logger.error(f"Network expansion failed for {person.name}: {e}")
        await emit({
            "type": "status", "step": "expand",
            "message": f"Network expansion failed: {e}",
        })
