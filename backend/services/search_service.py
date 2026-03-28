"""Orchestrator: coordinates scrapers, LLM, DB, and graph for person search."""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from functools import partial
from typing import Any, Callable, Awaitable

from sqlalchemy.orm import Session

from config import CACHE_TTL_SECONDS, TINYFISH_API_KEY
from models.person import Person, Entity, PersonEntity, SearchCache
from scrapers import wikipedia, wikidata
from scrapers.tinyfish import tinyfish_web_search, tinyfish_scrape_profile, tinyfish_deep_search
from services import llm_service, graph_service

logger = logging.getLogger(__name__)

# Type alias for the SSE event callback
EventCallback = Callable[[dict[str, Any]], Awaitable[None]]


async def _in_thread(fn, *args, **kwargs):
    """Run a sync function in a thread so it doesn't block the event loop.

    This is critical: SQLAlchemy sync calls (db.query, db.commit) block the
    entire asyncio event loop, preventing the other agent's coroutine from
    making progress. By running DB work in a thread, both agents can operate
    concurrently.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))


async def search_person(
    name: str,
    db: Session,
    emit: EventCallback,
) -> dict[str, Any]:
    """
    Full person search pipeline with SSE streaming.

    Steps:
      0. Cache check
      1. TinyFish deep search (Google + social + news + profile scrape)
      2. Wikipedia search (fast, structured)
      3. Wikidata SPARQL
      4. LLM extraction (enhanced schema: education, organizations, locations)
      5. Store entities and link to person
      6. Add person + entities to graph
    """
    # ----- Step 0: Check if person already in DB -----
    await emit({"type": "status", "step": "cache", "message": f"Checking cache for '{name}'..."})

    existing = await _in_thread(
        lambda: db.query(Person).filter(Person.name.ilike(f"%{name}%")).first()
    )
    if existing:
        await emit({
            "type": "status", "step": "cache",
            "message": f"Found '{existing.name}' in local database!",
        })
        person_dict = existing.to_dict()
        await emit({"type": "complete", "person": person_dict})
        return person_dict

    # ----- Step 1: Wikipedia search (fast, no browser needed) -----
    await emit({"type": "status", "step": "wikipedia", "message": f"Searching Wikipedia for '{name}'..."})

    wiki_page: dict[str, Any] = {}
    try:
        wiki_cache = await _in_thread(_get_cache, db, name, "wikipedia")
        if wiki_cache:
            await emit({"type": "status", "step": "wikipedia", "message": "Using cached Wikipedia data."})
            wiki_page = wiki_cache
        else:
            search_results = await wikipedia.search_wikipedia(name)
            if search_results:
                top_title = search_results[0]["title"]
                await emit({
                    "type": "status", "step": "wikipedia",
                    "message": f"Found Wikipedia article: {top_title}",
                })
                wiki_page = await wikipedia.get_wikipedia_page(top_title)
                await _in_thread(_set_cache, db, name, "wikipedia", wiki_page)

        if wiki_page:
            await emit({
                "type": "result", "step": "wikipedia",
                "data": {
                    "title": wiki_page.get("title", ""),
                    "summary": (wiki_page.get("summary", ""))[:500],
                    "image_url": wiki_page.get("image_url", ""),
                },
            })
    except Exception as e:
        logger.error(f"Wikipedia scrape failed: {e}")
        await emit({"type": "status", "step": "wikipedia", "message": f"Wikipedia search failed: {e}"})

    # ----- Step 2: Wikidata search (fast, no browser needed) -----
    await emit({"type": "status", "step": "wikidata", "message": "Querying Wikidata for structured facts..."})

    wiki_data: dict[str, Any] = {}
    wikidata_id = wiki_page.get("wikidata_id", "")
    try:
        if wikidata_id:
            wiki_data_cache = await _in_thread(_get_cache, db, wikidata_id, "wikidata")
            if wiki_data_cache:
                await emit({"type": "status", "step": "wikidata", "message": "Using cached Wikidata."})
                wiki_data = wiki_data_cache
            else:
                wiki_data = await wikidata.get_wikidata_entity(wikidata_id)
                await _in_thread(_set_cache, db, wikidata_id, "wikidata", wiki_data)
        else:
            wd_results = await wikidata.search_wikidata(name)
            if wd_results:
                wikidata_id = wd_results[0]["id"]
                wiki_data = await wikidata.get_wikidata_entity(wikidata_id)
                await _in_thread(_set_cache, db, wikidata_id, "wikidata", wiki_data)

        if wiki_data and wiki_data.get("found"):
            await emit({
                "type": "result", "step": "wikidata",
                "data": {
                    "birth_date": wiki_data.get("birth_date", ""),
                    "nationalities": wiki_data.get("nationalities", []),
                    "occupations": wiki_data.get("occupations", []),
                },
            })
    except Exception as e:
        logger.error(f"Wikidata scrape failed: {e}")
        await emit({"type": "status", "step": "wikidata", "message": f"Wikidata query failed: {e}"})

    # ----- Step 3: TinyFish Deep Search (stealth browser — runs last) -----
    deep_results: dict = {}
    tinyfish_results: list[dict] = []
    tinyfish_profile: dict = {}

    if TINYFISH_API_KEY:
        await emit({"type": "status", "step": "tinyfish", "message": f"Launching TinyFish stealth search for '{name}'..."})
        try:
            deep_results = await tinyfish_deep_search(name, emit=emit)
            tinyfish_results = deep_results.get("google_results", [])
            tinyfish_profile = deep_results.get("profile_data", {})

            social_count = len(deep_results.get("social_profiles", []))
            news_count = len(deep_results.get("news_mentions", []))
            await emit({
                "type": "result", "step": "tinyfish",
                "data": {
                    "google_results": len(tinyfish_results),
                    "social_profiles": social_count,
                    "news_mentions": news_count,
                    "has_profile_data": bool(tinyfish_profile),
                },
            })
        except Exception as e:
            logger.error(f"TinyFish deep search failed: {e}")
            await emit({"type": "status", "step": "tinyfish", "message": f"Deep search failed: {e}"})
    else:
        await emit({"type": "status", "step": "tinyfish", "message": "TinyFish API key not set -- skipping stealth search."})

    # ----- Step 4: LLM extraction -----
    await emit({"type": "status", "step": "llm", "message": "Extracting structured profile with AI..."})

    llm_data: dict[str, Any] = {}
    try:
        raw_text = _build_raw_text(name, wiki_page, wiki_data, tinyfish_results, tinyfish_profile, deep_results)
        llm_data = await llm_service.extract_person_info(raw_text)
        if llm_data:
            await emit({
                "type": "result", "step": "llm",
                "data": {"extracted_fields": list(llm_data.keys())},
            })
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        await emit({"type": "status", "step": "llm", "message": f"AI extraction failed: {e}"})

    # ----- Step 5: Merge & store person -----
    await emit({"type": "status", "step": "store", "message": "Saving profile to database..."})

    person = await _in_thread(_merge_and_store, db, name, wiki_page, wiki_data, llm_data, tinyfish_profile)

    # ----- Step 6: Store entities & add to graph (incremental) -----
    await emit({"type": "status", "step": "graph", "message": "Adding to knowledge graph..."})
    graph_service.add_person(person.to_dict())

    # Emit the person node immediately so frontend can render it
    await emit({
        "type": "graph_update",
        "step": "graph",
        "message": f"Added {person.name} to graph",
        "graph": graph_service.get_full_graph(),
    })

    # Create Entity records for education, organizations, locations
    await _in_thread(_store_entities, db, person, llm_data)

    # Emit updated graph with all entities
    current_graph = graph_service.get_full_graph()
    entity_count = len(current_graph["nodes"]) - 1  # minus the person node
    if entity_count > 0:
        await emit({
            "type": "graph_update",
            "step": "graph",
            "message": f"Added {entity_count} connected entities (schools, companies, locations...)",
            "graph": current_graph,
        })

    # Store relationships from LLM-extracted key_associates
    key_associates = llm_data.get("key_associates", [])
    if key_associates:
        await emit({
            "type": "status", "step": "graph",
            "message": f"Found {len(key_associates)} key associates.",
        })

    person_dict = person.to_dict()
    await emit({"type": "complete", "person": person_dict})
    return person_dict


# ─── Entity storage helpers ──────────────────────────────────────────

def _get_or_create_entity(
    db: Session, name: str, entity_type: str, description: str = "", metadata: dict | None = None
) -> Entity:
    """Find an existing entity by name+type or create a new one."""
    existing = (
        db.query(Entity)
        .filter(Entity.name.ilike(name), Entity.entity_type == entity_type)
        .first()
    )
    if existing:
        return existing
    entity = Entity(
        name=name,
        entity_type=entity_type,
        description=description,
        metadata_json=metadata or {},
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


def _link_person_entity(
    db: Session,
    person_id: int,
    entity_id: int,
    relationship_type: str = "associated",
    years: str = "",
    description: str = "",
) -> PersonEntity:
    """Create a PersonEntity link if it does not already exist."""
    existing = (
        db.query(PersonEntity)
        .filter(
            PersonEntity.person_id == person_id,
            PersonEntity.entity_id == entity_id,
            PersonEntity.relationship_type == relationship_type,
        )
        .first()
    )
    if existing:
        return existing
    pe = PersonEntity(
        person_id=person_id,
        entity_id=entity_id,
        relationship_type=relationship_type,
        years=years,
        description=description,
    )
    db.add(pe)
    db.commit()
    db.refresh(pe)
    return pe


def _store_entities(db: Session, person: Person, llm_data: dict) -> None:
    """Create Entity records from LLM-extracted education, organizations, locations."""
    # Education
    for edu in llm_data.get("education", []):
        inst_name = edu.get("institution", "").strip()
        if not inst_name:
            continue
        entity = _get_or_create_entity(
            db, inst_name, "school",
            metadata={"degree": edu.get("degree", "")},
        )
        pe = _link_person_entity(
            db, person.id, entity.id,
            relationship_type="attended",
            years=edu.get("years", ""),
            description=edu.get("degree", ""),
        )
        graph_service.add_entity(entity.to_dict())
        graph_service.add_person_entity_edge(person.id, entity.id, pe.to_dict())

    # Organizations
    for org in llm_data.get("organizations", []):
        org_name = org.get("name", "").strip()
        if not org_name:
            continue
        org_type = org.get("type", "organization").strip() or "organization"
        entity = _get_or_create_entity(db, org_name, org_type)
        rel_type = "works_at" if org_type == "company" else "member_of"
        pe = _link_person_entity(
            db, person.id, entity.id,
            relationship_type=rel_type,
            years=org.get("years", ""),
            description=org.get("role", ""),
        )
        graph_service.add_entity(entity.to_dict())
        graph_service.add_person_entity_edge(person.id, entity.id, pe.to_dict())

    # Locations
    for loc in llm_data.get("locations", []):
        loc_name = loc.get("name", "").strip()
        if not loc_name:
            continue
        loc_type = loc.get("type", "location").strip()
        entity = _get_or_create_entity(db, loc_name, "location")
        rel_type = "born_in" if "birth" in loc_type.lower() else "located_in"
        pe = _link_person_entity(
            db, person.id, entity.id,
            relationship_type=rel_type,
        )
        graph_service.add_entity(entity.to_dict())
        graph_service.add_person_entity_edge(person.id, entity.id, pe.to_dict())


# ─── URL picker for TinyFish scrape ─────────────────────────────────

def _pick_profile_url(tinyfish_results: list[dict], wiki_page: dict) -> str:
    """Choose the best URL for TinyFish to scrape a full profile from."""
    # Prefer Wikipedia URL if we have one
    wp_url = wiki_page.get("wikipedia_url", "")
    if wp_url:
        return wp_url

    # Look through TinyFish Google results for notable profile URLs
    priority_domains = [
        "en.wikipedia.org",
        "linkedin.com",
        "imdb.com",
        "britannica.com",
        "bbc.com",
        "forbes.com",
    ]
    for domain in priority_domains:
        for r in tinyfish_results:
            url = r.get("url", "")
            if domain in url:
                return url

    # Fall back to first result
    if tinyfish_results:
        return tinyfish_results[0].get("url", "")
    return ""


# ─── Cache helpers ───────────────────────────────────────────────────

def _get_cache(db: Session, query: str, source: str) -> dict | None:
    """Return cached response if not expired."""
    now = datetime.now(timezone.utc)
    entry = (
        db.query(SearchCache)
        .filter(SearchCache.query == query, SearchCache.source == source)
        .first()
    )
    if entry and entry.expires_at and entry.expires_at.replace(tzinfo=timezone.utc) > now:
        return entry.response_data
    return None


def _set_cache(db: Session, query: str, source: str, data: dict) -> None:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(seconds=CACHE_TTL_SECONDS)
    entry = (
        db.query(SearchCache)
        .filter(SearchCache.query == query, SearchCache.source == source)
        .first()
    )
    if entry:
        entry.response_data = data
        entry.expires_at = expires
    else:
        entry = SearchCache(
            query=query, source=source, response_data=data,
            created_at=now, expires_at=expires,
        )
        db.add(entry)
    db.commit()


# ─── Raw text builder ───────────────────────────────────────────────

def _build_raw_text(
    name: str,
    wiki_page: dict,
    wiki_data: dict,
    tinyfish_results: list[dict] | None = None,
    tinyfish_profile: dict | None = None,
    deep_results: dict | None = None,
) -> str:
    parts = [f"Person: {name}"]

    if wiki_page:
        parts.append(f"Wikipedia summary: {wiki_page.get('summary', '')}")
        infobox = wiki_page.get("infobox", {})
        if infobox:
            parts.append("Infobox: " + json.dumps(infobox))

    if wiki_data and wiki_data.get("found"):
        parts.append(f"Birth date: {wiki_data.get('birth_date', '')}")
        parts.append(f"Nationalities: {wiki_data.get('nationalities', [])}")
        parts.append(f"Occupations: {wiki_data.get('occupations', [])}")
        parts.append(f"Spouses: {wiki_data.get('spouses', [])}")
        parts.append(f"Education: {wiki_data.get('education', [])}")
        parts.append(f"Organizations: {wiki_data.get('organizations', [])}")

    if tinyfish_results:
        snippets = [f"- {r.get('title', '')}: {r.get('snippet', '')}" for r in tinyfish_results[:5]]
        parts.append("Google search results:\n" + "\n".join(snippets))

    if tinyfish_profile:
        parts.append("Profile scrape data: " + json.dumps(tinyfish_profile, default=str)[:3000])

    # Deep search extras
    if deep_results:
        social = deep_results.get("social_profiles", [])
        if social:
            social_lines = [f"- {s.get('title', '')}: {s.get('url', '')}" for s in social[:5]]
            parts.append("Social media profiles found:\n" + "\n".join(social_lines))

        news = deep_results.get("news_mentions", [])
        if news:
            news_lines = [f"- {n.get('title', '')}: {n.get('snippet', '')}" for n in news[:5]]
            parts.append("Recent news mentions:\n" + "\n".join(news_lines))

    return "\n".join(parts)


# ─── Merge and store ─────────────────────────────────────────────────

def _merge_and_store(
    db: Session,
    name: str,
    wiki_page: dict,
    wiki_data: dict,
    llm_data: dict,
    tinyfish_profile: dict | None = None,
) -> Person:
    """Merge data from all sources and upsert into DB."""
    # Prefer LLM-extracted name, fallback to wiki, fallback to query
    final_name = llm_data.get("name") or wiki_page.get("title") or name

    person = Person(
        name=final_name,
        aliases=llm_data.get("aliases", []),
        description=(
            llm_data.get("description")
            or wiki_page.get("summary", "")
        ),
        birth_date=(
            llm_data.get("birth_date")
            or wiki_data.get("birth_date", "")
        ),
        nationality=(
            llm_data.get("nationality")
            or (wiki_data.get("nationalities", [None]) or [None])[0]
            or ""
        ),
        occupations=(
            llm_data.get("occupations")
            or wiki_data.get("occupations", [])
        ),
        image_url=(
            wiki_page.get("image_url")
            or wiki_data.get("image_url", "")
        ),
        wikipedia_url=wiki_page.get("wikipedia_url", ""),
        wikidata_id=wiki_data.get("wikidata_id", ""),
        raw_data={
            "wikipedia": wiki_page,
            "wikidata": wiki_data,
            "llm": llm_data,
            "tinyfish_profile": tinyfish_profile or {},
        },
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    return person
