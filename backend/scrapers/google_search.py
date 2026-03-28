"""Google search scraper (lightweight, scrapes HTML results page).

Falls back gracefully — Google may block heavy usage.
For production, swap in SerpAPI or Google Custom Search API.
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import Any

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

_last_request: float = 0
_MIN_INTERVAL = 2.0  # be polite to Google


async def _rate_limit():
    global _last_request
    now = asyncio.get_event_loop().time()
    wait = _MIN_INTERVAL - (now - _last_request)
    if wait > 0:
        await asyncio.sleep(wait)
    _last_request = asyncio.get_event_loop().time()


async def search_google(query: str, num_results: int = 8) -> list[dict[str, Any]]:
    """
    Search Google and return list of {title, url, snippet}.
    May return empty list if Google blocks the request.
    """
    await _rate_limit()
    url = "https://www.google.com/search"
    params = {"q": query, "num": num_results, "hl": "en"}

    try:
        async with httpx.AsyncClient(
            headers=_HEADERS, timeout=15, follow_redirects=True
        ) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
    except Exception:
        # Google blocked us — return empty
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    results: list[dict[str, Any]] = []

    # Google result divs
    for g in soup.select("div.g, div[data-hveid]"):
        link_tag = g.find("a", href=True)
        title_tag = g.find("h3")
        snippet_tag = (
            g.find("div", class_="VwiC3b")
            or g.find("span", class_="aCOpRe")
            or g.find("div", {"data-sncf": True})
        )

        if not link_tag or not title_tag:
            continue

        href = link_tag["href"]
        if href.startswith("/url?q="):
            href = href.split("/url?q=")[1].split("&")[0]
        if not href.startswith("http"):
            continue

        results.append({
            "title": title_tag.get_text(strip=True),
            "url": href,
            "snippet": snippet_tag.get_text(strip=True) if snippet_tag else "",
        })

        if len(results) >= num_results:
            break

    return results
