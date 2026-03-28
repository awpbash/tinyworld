"""OpenAI LLM integration for entity extraction and relationship analysis."""

import json
import logging
from typing import Any
from openai import AsyncOpenAI

from config import OPENAI_API_KEY, LLM_MODEL_FAST, LLM_MODEL_COMPLEX

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _client


# ---------- Person extraction ----------

_PERSON_EXTRACTION_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "store_person_info",
            "description": "Store extracted person information",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Full name"},
                    "aliases": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Alternative names or nicknames",
                    },
                    "description": {
                        "type": "string",
                        "description": "One-paragraph biography",
                    },
                    "birth_date": {
                        "type": "string",
                        "description": "Birth date (YYYY-MM-DD or partial)",
                    },
                    "nationality": {"type": "string"},
                    "occupations": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "key_associates": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "relationship": {"type": "string"},
                            },
                        },
                        "description": "Notable people associated with this person",
                    },
                    "education": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "institution": {"type": "string"},
                                "degree": {"type": "string"},
                                "years": {"type": "string"},
                            },
                        },
                        "description": "Schools, universities attended",
                    },
                    "organizations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "role": {"type": "string"},
                                "type": {
                                    "type": "string",
                                    "description": "company, team, organization",
                                },
                                "years": {"type": "string"},
                            },
                        },
                        "description": "Companies, teams, organizations affiliated with",
                    },
                    "locations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "type": {
                                    "type": "string",
                                    "description": "birth_place, residence, etc.",
                                },
                            },
                        },
                        "description": "Important locations associated with this person",
                    },
                },
                "required": ["name", "description"],
            },
        },
    }
]


async def extract_person_info(raw_text: str) -> dict[str, Any]:
    """Use LLM with function calling to extract structured person data."""
    if not OPENAI_API_KEY:
        logger.warning("No OpenAI API key -- returning empty extraction")
        return {}

    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model=LLM_MODEL_FAST,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert at extracting structured person "
                        "information from unstructured text. Extract all "
                        "available facts and call the store_person_info function. "
                        "Be sure to extract education (schools/universities), "
                        "organizations (companies/teams), and locations "
                        "(birth place, residence) when available."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Extract person information from this text:\n\n{raw_text[:6000]}",
                },
            ],
            tools=_PERSON_EXTRACTION_TOOLS,
            tool_choice={"type": "function", "function": {"name": "store_person_info"}},
        )

        tool_call = response.choices[0].message.tool_calls
        if tool_call:
            return json.loads(tool_call[0].function.arguments)
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")

    return {}


# ---------- Relationship finding ----------

async def find_relationships(
    person_a_info: dict, person_b_info: dict, search_results: list[dict]
) -> list[dict[str, Any]]:
    """Use LLM to identify connections between two people."""
    if not OPENAI_API_KEY:
        return []

    client = _get_client()
    context = json.dumps(search_results[:5], indent=2, default=str)[:4000]

    try:
        response = await client.chat.completions.create(
            model=LLM_MODEL_COMPLEX,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert at finding connections between people. "
                        "Analyze the provided information and return a JSON object "
                        'with a "connections" key containing an array. '
                        "Each connection should have: "
                        "relationship_type, strength (0-1), description, evidence, "
                        "and shared_entities (array of {name, type} for any shared "
                        "schools, companies, events, locations)."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Person A: {json.dumps(person_a_info, default=str)[:2000]}\n\n"
                        f"Person B: {json.dumps(person_b_info, default=str)[:2000]}\n\n"
                        f"Search results about them together:\n{context}\n\n"
                        "Return a JSON object with a 'connections' array."
                    ),
                },
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        # Handle both {"connections": [...]} and direct array
        if isinstance(data, list):
            return data
        return data.get("connections", data.get("relationships", []))
    except Exception as e:
        logger.error(f"LLM relationship finding failed: {e}")
        return []


# ---------- Summary ----------

async def summarize_connection(path: list[dict]) -> str:
    """Generate a natural-language summary of a connection path."""
    if not OPENAI_API_KEY:
        names = " -> ".join(node.get("name", "?") for node in path)
        return f"Connection path: {names}"

    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model=LLM_MODEL_FAST,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Summarize the connection path between people in "
                        "1-2 engaging sentences. Be specific about how they "
                        "are connected. The path may include entity nodes "
                        "(schools, companies, etc.) as intermediate steps."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Connection path:\n{json.dumps(path, indent=2, default=str)}",
                },
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"LLM summarize failed: {e}")
        names = " -> ".join(node.get("name", "?") for node in path)
        return f"Connection path: {names}"
