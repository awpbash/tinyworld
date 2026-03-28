"""TinyFish stealth browser agent scraper.

Uses the TinyFish automation API to perform Google searches and profile
scraping with a stealth browser profile, forwarding SSE events to the
frontend in real time.
"""

import asyncio
import json
import logging
from typing import Any, Callable, Awaitable

import httpx

from config import TINYFISH_API_KEY, TINYFISH_TIMEOUT

logger = logging.getLogger(__name__)

TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse"

EventCallback = Callable[[dict[str, Any]], Awaitable[None]]

# Global semaphore: max 2 concurrent TinyFish browser sessions at a time.
# TinyFish queues requests beyond your plan's concurrency limit, so we
# limit to 2 to ensure both agents (A and B) each get a live browser slot
# simultaneously instead of one hogging all slots.
_tinyfish_semaphore = asyncio.Semaphore(2)


async def _run_tinyfish(
    url: str,
    goal: str,
    emit: EventCallback,
    api_key: str | None = None,
) -> Any:
    """
    Core helper: POST to TinyFish SSE endpoint, stream events, return the
    COMPLETE result payload.
    """
    key = api_key or TINYFISH_API_KEY
    if not key:
        await emit({
            "type": "status",
            "step": "tinyfish",
            "message": "TinyFish API key not configured -- skipping.",
        })
        return None

    headers = {"X-API-Key": key, "Content-Type": "application/json"}
    body = {"url": url, "goal": goal, "browser_profile": "stealth"}

    result = None
    try:
        async with _tinyfish_semaphore:
            async with httpx.AsyncClient(timeout=float(TINYFISH_TIMEOUT)) as client:
                async with client.stream(
                    "POST", TINYFISH_URL, headers=headers, json=body
                ) as response:
                    response.raise_for_status()
                    buffer = ""
                    async for chunk in response.aiter_text():
                        buffer += chunk
                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            line = line.strip()
                            if not line.startswith("data: "):
                                continue
                            try:
                                event = json.loads(line[6:])
                            except json.JSONDecodeError:
                                continue

                            event_type = event.get("type", "")

                            if event_type == "STARTED":
                                run_id = event.get("run_id", "")
                                short_id = run_id[:8] if run_id else "?"
                                await emit({
                                    "type": "status",
                                    "step": "tinyfish",
                                    "message": f"TinyFish agent started (run: {short_id}...)",
                                })

                            elif event_type == "STREAMING_URL":
                                await emit({
                                    "type": "browser_url",
                                    "step": "tinyfish",
                                    "message": "Browser session live",
                                    "streaming_url": event.get("streaming_url", ""),
                                })

                            elif event_type == "PROGRESS":
                                purpose = event.get("purpose", "Working...")
                                await emit({
                                    "type": "status",
                                    "step": "tinyfish",
                                    "message": f"TinyFish: {purpose}",
                                })

                            elif event_type == "COMPLETE":
                                if event.get("status") == "COMPLETED":
                                    result = event.get("result")
                                    await emit({
                                        "type": "status",
                                        "step": "tinyfish",
                                        "message": "TinyFish agent completed!",
                                    })
                                else:
                                    error = event.get("error", "unknown")
                                    await emit({
                                        "type": "status",
                                        "step": "tinyfish",
                                        "message": f"TinyFish agent failed: {error}",
                                    })
    except httpx.HTTPStatusError as exc:
        logger.error("TinyFish HTTP error: %s", exc)
        await emit({
            "type": "status",
            "step": "tinyfish",
            "message": f"TinyFish HTTP error: {exc.response.status_code}",
        })
    except Exception as exc:
        logger.error("TinyFish request failed: %s", exc)
        await emit({
            "type": "status",
            "step": "tinyfish",
            "message": f"TinyFish request error: {exc}",
        })

    return result


def _try_parse_json(raw: Any) -> Any:
    """Attempt to parse a JSON string; return as-is if already a dict/list."""
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code block
            stripped = raw.strip()
            if stripped.startswith("```"):
                lines = stripped.split("\n")
                # Remove first and last lines (code fences)
                inner = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                try:
                    return json.loads(inner)
                except json.JSONDecodeError:
                    pass
    return raw


# ─── Public API ──────────────────────────────────────────────────────

async def tinyfish_web_search(
    query: str,
    api_key: str | None = None,
    emit: EventCallback | None = None,
) -> list[dict]:
    """Use TinyFish stealth browser to search via DuckDuckGo (no bot blocking).

    Returns a list of ``{title, url, snippet}`` dicts (up to 10).
    """
    if emit is None:
        async def emit(e: dict) -> None:  # noqa: F811
            pass

    goal = (
        f"Search for '{query}' and extract the top 10 search results. "
        "For each result return: title, url, snippet. "
        "Return as JSON array."
    )
    raw = await _run_tinyfish("https://duckduckgo.com", goal, emit, api_key)
    parsed = _try_parse_json(raw)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        # Handle {"results": [...]} or {"search_results": [...]}
        for key in ("results", "search_results", "data"):
            if isinstance(parsed.get(key), list):
                return parsed[key]
    return []


async def tinyfish_scrape_profile(
    url: str,
    person_name: str,
    api_key: str | None = None,
    emit: EventCallback | None = None,
) -> dict:
    """Use TinyFish stealth browser to scrape a person's profile from any URL.

    Returns a dict with name, description, birth_date, nationality,
    occupations, education, organizations, key_associates, achievements,
    social_media_links.
    """
    if emit is None:
        async def emit(e: dict) -> None:  # noqa: F811
            pass

    goal = (
        f"Extract all information about {person_name} from this page. "
        "Return JSON with: name, description, birth_date, nationality, "
        "occupations, education (schools/universities with years), "
        "organizations (companies/teams with roles and years), "
        "key_associates (names and relationships), achievements, "
        "social_media_links."
    )
    raw = await _run_tinyfish(url, goal, emit, api_key)
    parsed = _try_parse_json(raw)
    if isinstance(parsed, dict):
        return parsed
    return {}


async def tinyfish_search_connections(
    person_a: str,
    person_b: str,
    api_key: str | None = None,
    emit: EventCallback | None = None,
) -> list[dict]:
    """Use TinyFish to search Google for connections between two people.

    Returns a list of result dicts with title, url, snippet, and any
    mentioned connections or shared entities.
    """
    if emit is None:
        async def emit(e: dict) -> None:  # noqa: F811
            pass

    goal = (
        f'Search for "{person_a}" AND "{person_b}" and find how these '
        "two people are connected. Extract the top 15 results with title, "
        "url, snippet, and any mentioned connections or shared entities "
        "(schools, companies, events, locations)."
    )
    raw = await _run_tinyfish("https://duckduckgo.com", goal, emit, api_key)
    parsed = _try_parse_json(raw)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        for key in ("results", "search_results", "data", "connections"):
            if isinstance(parsed.get(key), list):
                return parsed[key]
    return []


# ─── Deep Search API ─────────────────────────────────────────────────


async def tinyfish_deep_search(
    person_name: str,
    api_key: str | None = None,
    emit: EventCallback | None = None,
) -> dict:
    """Multi-hop deep search: Google + social + news in PARALLEL, then profile scrape.

    Fires 3 TinyFish browser agents concurrently for maximum speed,
    then scrapes the best profile URL found.
    Returns a dict with keys: google_results, social_profiles, news_mentions, profile_data
    """
    import asyncio

    if emit is None:
        async def emit(e: dict) -> None: pass

    results: dict[str, Any] = {
        "google_results": [],
        "social_profiles": [],
        "news_mentions": [],
        "profile_data": {},
    }

    # Run searches sequentially so the semaphore (2 slots) lets BOTH agents
    # have a live browser at the same time. If we fired 3 parallel per agent,
    # one agent hogs all slots and the other gets queued by TinyFish.

    # ── Step 1: Google search (this gets the browser iframe) ──
    await emit({"type": "status", "step": "tinyfish", "message": f"\U0001f41f Searching '{person_name}'..."})
    try:
        google_results = await tinyfish_web_search(person_name, api_key=api_key, emit=emit)
        results["google_results"] = google_results
    except Exception as e:
        logger.error(f"TinyFish Google search failed: {e}")
        results["google_results"] = []

    # ── Step 2: Social media search ──
    await emit({"type": "status", "step": "tinyfish", "message": "\U0001f41f Hunting social media profiles..."})
    try:
        social_goal = (
            f"Search for '{person_name} social media profiles site:linkedin.com OR site:twitter.com OR site:instagram.com OR site:facebook.com'. "
            "Extract the top 10 results with title, url, snippet, and which social media platform. Return as JSON array."
        )
        social_raw = await _run_tinyfish("https://duckduckgo.com", social_goal, emit, api_key)
        social_parsed = _try_parse_json(social_raw)
        if isinstance(social_parsed, list):
            results["social_profiles"] = social_parsed
        elif isinstance(social_parsed, dict):
            for k in ("results", "search_results", "data"):
                if isinstance(social_parsed.get(k), list):
                    results["social_profiles"] = social_parsed[k]
                    break
    except Exception as e:
        logger.error(f"TinyFish social search failed: {e}")

    # ── Step 3: News search ──
    await emit({"type": "status", "step": "tinyfish", "message": "\U0001f41f Scanning news articles..."})
    try:
        news_goal = (
            f"Search for '{person_name} news' and extract the top 10 most relevant news articles. "
            "For each result return: title, url, snippet, date_published (if available), source_name. Return as JSON array."
        )
        news_raw = await _run_tinyfish("https://duckduckgo.com", news_goal, emit, api_key)
        news_parsed = _try_parse_json(news_raw)
        if isinstance(news_parsed, list):
            results["news_mentions"] = news_parsed
        elif isinstance(news_parsed, dict):
            for k in ("results", "search_results", "data", "articles"):
                if isinstance(news_parsed.get(k), list):
                    results["news_mentions"] = news_parsed[k]
                    break
    except Exception as e:
        logger.error(f"TinyFish news search failed: {e}")

    await emit({
        "type": "status", "step": "tinyfish",
        "message": f"\U0001f41f Search done: {len(results['google_results'])} results, {len(results['social_profiles'])} social, {len(results['news_mentions'])} news",
    })

    # ── Step 4: Profile scrape (depends on step 1+2 results) ──
    profile_url = _find_best_profile_url(
        results["google_results"], results["social_profiles"]
    )
    if profile_url:
        await emit({"type": "status", "step": "tinyfish", "message": f"\U0001f41f Scraping profile: {profile_url[:60]}..."})
        profile_data = await tinyfish_scrape_profile(
            profile_url, person_name, api_key=api_key, emit=emit
        )
        if profile_data:
            results["profile_data"] = profile_data

    return results


def _find_best_profile_url(google_results: list, social_profiles: list) -> str:
    """Pick the best profile URL to scrape deeply."""
    priority_domains = [
        "linkedin.com/in/",
        "en.wikipedia.org/wiki/",
        "imdb.com/name/",
        "britannica.com",
        "forbes.com",
        "crunchbase.com",
    ]
    all_results = social_profiles + google_results
    for domain in priority_domains:
        for r in all_results:
            url = r.get("url", "")
            if domain in url:
                return url
    return ""


async def tinyfish_deep_connection_search(
    person_a: str,
    person_b: str,
    api_key: str | None = None,
    emit: EventCallback | None = None,
) -> dict:
    """Multi-hop connection search: 3 parallel browsers for co-mentions, shared orgs, events.

    Fires all 3 TinyFish agents concurrently for speed.
    Returns dict with: co_mentions, shared_entities, event_connections, mutual_connections
    """
    import asyncio

    if emit is None:
        async def emit(e: dict) -> None: pass

    results: dict[str, Any] = {
        "co_mentions": [],
        "shared_entities": [],
        "event_connections": [],
        "mutual_connections": [],
    }

    # Sequential searches — semaphore ensures both agents get fair browser time

    # ── Step 1: Co-mention search ──
    await emit({"type": "status", "step": "tinyfish", "message": "\U0001f41f Finding co-mentions..."})
    try:
        co_mentions = await tinyfish_search_connections(person_a, person_b, api_key=api_key, emit=emit)
        results["co_mentions"] = co_mentions
    except Exception as e:
        logger.error(f"TinyFish co-mention search failed: {e}")

    # ── Step 2: Shared organizations ──
    await emit({"type": "status", "step": "tinyfish", "message": "\U0001f41f Looking for shared organizations..."})
    try:
        shared_goal = (
            f'Search for shared connections between "{person_a}" and "{person_b}". '
            "Look for: shared schools, universities, companies, teams, organizations, events, locations, mutual friends/colleagues. "
            "Return JSON with: shared_entities (array of {{name, type, how_person_a_connected, how_person_b_connected}}), "
            "mutual_connections (array of {{name, relationship_to_a, relationship_to_b}})"
        )
        shared_raw = await _run_tinyfish("https://duckduckgo.com", shared_goal, emit, api_key)
        shared_parsed = _try_parse_json(shared_raw)
        if isinstance(shared_parsed, dict):
            results["shared_entities"] = shared_parsed.get("shared_entities", [])
            results["mutual_connections"] = shared_parsed.get("mutual_connections", [])
    except Exception as e:
        logger.error(f"TinyFish shared orgs search failed: {e}")

    # ── Step 3: Shared events ──
    await emit({"type": "status", "step": "tinyfish", "message": "\U0001f41f Scanning for shared events..."})
    try:
        events_goal = (
            f'Search for events, conferences, award shows, or gatherings where both "{person_a}" '
            f'and "{person_b}" were present or mentioned. Return JSON array of: '
            "{{event_name, date, location, source_url, how_both_connected}}"
        )
        events_raw = await _run_tinyfish("https://duckduckgo.com", events_goal, emit, api_key)
        events_parsed = _try_parse_json(events_raw)
        if isinstance(events_parsed, list):
            results["event_connections"] = events_parsed
        elif isinstance(events_parsed, dict):
            for k in ("events", "results", "data"):
                if isinstance(events_parsed.get(k), list):
                    results["event_connections"] = events_parsed[k]
                    break
    except Exception as e:
        logger.error(f"TinyFish events search failed: {e}")

    await emit({
        "type": "status", "step": "tinyfish",
        "message": f"\U0001f41f Connection search done: {len(results['co_mentions'])} co-mentions, {len(results['shared_entities'])} shared entities, {len(results['event_connections'])} events",
    })

    return results
