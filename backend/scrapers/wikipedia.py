"""Wikipedia scraper using the REST API and MediaWiki API."""

import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import Any

_HEADERS = {
    "User-Agent": "TinyFish/1.0 (OSINT hackathon project; contact@tinyfish.dev)"
}
_REST = "https://en.wikipedia.org/api/rest_v1"
_MW = "https://en.wikipedia.org/w/api.php"

# Simple per-domain rate limiter
_last_request: float = 0
_MIN_INTERVAL = 0.2  # seconds


async def _rate_limit():
    global _last_request
    now = asyncio.get_event_loop().time()
    wait = _MIN_INTERVAL - (now - _last_request)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_request = asyncio.get_event_loop().time()


async def search_wikipedia(name: str, limit: int = 5) -> list[dict[str, Any]]:
    """Search Wikipedia and return a list of {title, description, url}."""
    await _rate_limit()
    params = {
        "action": "query",
        "list": "search",
        "srsearch": name,
        "srlimit": limit,
        "format": "json",
    }
    async with httpx.AsyncClient(headers=_HEADERS, timeout=15) as client:
        resp = await client.get(_MW, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("query", {}).get("search", []):
        snippet_text = BeautifulSoup(item.get("snippet", ""), "html.parser").get_text()
        results.append({
            "title": item["title"],
            "snippet": snippet_text,
            "url": f"https://en.wikipedia.org/wiki/{item['title'].replace(' ', '_')}",
        })
    return results


async def get_wikipedia_page(title: str) -> dict[str, Any]:
    """Fetch full page data: summary, links, categories, infobox fields."""
    await _rate_limit()
    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        # --- Summary via REST API ---
        summary_resp = await client.get(f"{_REST}/page/summary/{title.replace(' ', '_')}")
        summary_resp.raise_for_status()
        summary_data = summary_resp.json()

        await _rate_limit()

        # --- Categories + Links via MediaWiki API ---
        params = {
            "action": "query",
            "titles": title,
            "prop": "categories|links|pageprops",
            "cllimit": "50",
            "pllimit": "50",
            "format": "json",
        }
        mw_resp = await client.get(_MW, params=params)
        mw_resp.raise_for_status()
        mw_data = mw_resp.json()

        await _rate_limit()

        # --- Infobox via raw HTML parse ---
        html_resp = await client.get(
            f"{_REST}/page/html/{title.replace(' ', '_')}"
        )
        html_resp.raise_for_status()

    # Parse MW response
    pages = mw_data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})

    categories = [
        c["title"].replace("Category:", "")
        for c in page.get("categories", [])
    ]
    links = [l["title"] for l in page.get("links", [])]
    wikidata_id = page.get("pageprops", {}).get("wikibase_item", "")

    # Parse infobox from HTML
    infobox = _parse_infobox(html_resp.text)

    image_url = summary_data.get("thumbnail", {}).get("source", "")
    if not image_url:
        image_url = summary_data.get("originalimage", {}).get("source", "")

    return {
        "title": summary_data.get("title", title),
        "summary": summary_data.get("extract", ""),
        "description": summary_data.get("description", ""),
        "image_url": image_url,
        "wikipedia_url": summary_data.get("content_urls", {})
            .get("desktop", {}).get("page", ""),
        "wikidata_id": wikidata_id,
        "categories": categories,
        "links": links[:50],
        "infobox": infobox,
    }


def _parse_infobox(html: str) -> dict[str, str]:
    """Extract key-value pairs from a Wikipedia infobox."""
    soup = BeautifulSoup(html, "html.parser")
    infobox = soup.find("table", class_="infobox") or soup.find(
        "table", class_=lambda c: c and "infobox" in c
    )
    if not infobox:
        return {}

    data: dict[str, str] = {}
    for row in infobox.find_all("tr"):
        header = row.find("th")
        value = row.find("td")
        if header and value:
            key = header.get_text(strip=True)
            val = value.get_text(separator=" ", strip=True)
            if key and val:
                data[key] = val
    return data
