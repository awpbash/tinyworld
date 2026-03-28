"""Wikidata SPARQL scraper for structured person facts."""

import asyncio
import httpx
from typing import Any

_HEADERS = {
    "User-Agent": "TinyFish/1.0 (OSINT hackathon project; contact@tinyfish.dev)",
    "Accept": "application/json",
}
_SPARQL_URL = "https://query.wikidata.org/sparql"
_WIKIDATA_API = "https://www.wikidata.org/w/api.php"

_last_request: float = 0
_MIN_INTERVAL = 0.5


async def _rate_limit():
    global _last_request
    now = asyncio.get_event_loop().time()
    wait = _MIN_INTERVAL - (now - _last_request)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_request = asyncio.get_event_loop().time()


async def search_wikidata(name: str, limit: int = 5) -> list[dict[str, Any]]:
    """Search Wikidata for entity matches by label."""
    await _rate_limit()
    params = {
        "action": "wbsearchentities",
        "search": name,
        "language": "en",
        "limit": limit,
        "format": "json",
    }
    async with httpx.AsyncClient(headers=_HEADERS, timeout=15) as client:
        resp = await client.get(_WIKIDATA_API, params=params)
        resp.raise_for_status()
        data = resp.json()

    return [
        {
            "id": item["id"],
            "label": item.get("label", ""),
            "description": item.get("description", ""),
            "url": item.get("concepturi", ""),
        }
        for item in data.get("search", [])
    ]


async def get_wikidata_entity(wikidata_id: str) -> dict[str, Any]:
    """Fetch structured facts about a person via SPARQL."""
    await _rate_limit()

    query = f"""
    SELECT ?personLabel ?birthDate ?nationalityLabel ?occupationLabel
           ?spouseLabel ?educationLabel ?organizationLabel ?imageUrl
    WHERE {{
      OPTIONAL {{ wd:{wikidata_id} wdt:P569 ?birthDate . }}
      OPTIONAL {{ wd:{wikidata_id} wdt:P27 ?nationality . }}
      OPTIONAL {{ wd:{wikidata_id} wdt:P106 ?occupation . }}
      OPTIONAL {{ wd:{wikidata_id} wdt:P26 ?spouse . }}
      OPTIONAL {{ wd:{wikidata_id} wdt:P69 ?education . }}
      OPTIONAL {{ wd:{wikidata_id} wdt:P463 ?organization . }}
      OPTIONAL {{ wd:{wikidata_id} wdt:P18 ?imageUrl . }}
      BIND(wd:{wikidata_id} AS ?person)
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT 50
    """

    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        resp = await client.get(
            _SPARQL_URL, params={"query": query, "format": "json"}
        )
        resp.raise_for_status()
        data = resp.json()

    bindings = data.get("results", {}).get("bindings", [])
    if not bindings:
        return {"wikidata_id": wikidata_id, "found": False}

    # Aggregate multi-valued properties
    def _collect(key: str) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for b in bindings:
            val = b.get(key, {}).get("value", "")
            if val and val not in seen:
                seen.add(val)
                out.append(val)
        return out

    first = bindings[0]
    birth_raw = first.get("birthDate", {}).get("value", "")
    birth_date = birth_raw[:10] if birth_raw else ""

    image_urls = _collect("imageUrl")

    return {
        "wikidata_id": wikidata_id,
        "found": True,
        "name": first.get("personLabel", {}).get("value", ""),
        "birth_date": birth_date,
        "nationalities": _collect("nationalityLabel"),
        "occupations": _collect("occupationLabel"),
        "spouses": _collect("spouseLabel"),
        "education": _collect("educationLabel"),
        "organizations": _collect("organizationLabel"),
        "image_url": image_urls[0] if image_urls else "",
    }


async def get_related_people(wikidata_id: str) -> list[dict[str, Any]]:
    """Find people related to the given entity (spouses, associates, etc.)."""
    await _rate_limit()

    query = f"""
    SELECT DISTINCT ?related ?relatedLabel ?relationLabel WHERE {{
      {{
        wd:{wikidata_id} ?prop ?related .
        ?related wdt:P31 wd:Q5 .
        ?property wikibase:directClaim ?prop .
        ?property rdfs:label ?relationLabel .
        FILTER(LANG(?relationLabel) = "en")
      }}
      UNION
      {{
        ?related ?prop wd:{wikidata_id} .
        ?related wdt:P31 wd:Q5 .
        ?property wikibase:directClaim ?prop .
        ?property rdfs:label ?relationLabel .
        FILTER(LANG(?relationLabel) = "en")
      }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    LIMIT 30
    """

    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        resp = await client.get(
            _SPARQL_URL, params={"query": query, "format": "json"}
        )
        resp.raise_for_status()
        data = resp.json()

    results = []
    seen: set[str] = set()
    for b in data.get("results", {}).get("bindings", []):
        uri = b.get("related", {}).get("value", "")
        qid = uri.split("/")[-1] if uri else ""
        if not qid or qid in seen:
            continue
        seen.add(qid)
        results.append({
            "wikidata_id": qid,
            "name": b.get("relatedLabel", {}).get("value", ""),
            "relation": b.get("relationLabel", {}).get("value", ""),
        })
    return results
