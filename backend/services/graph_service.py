"""NetworkX graph engine for person + entity relationship networks."""

import logging
from typing import Any

import networkx as nx
from sqlalchemy.orm import Session

from models.person import Person, Relationship, Entity, PersonEntity

logger = logging.getLogger(__name__)

# Singleton graph instance
_graph = nx.Graph()


def get_graph() -> nx.Graph:
    return _graph


# ─── Person nodes ────────────────────────────────────────────────────

def add_person(person_data: dict[str, Any]) -> None:
    """Add or update a person node in the graph."""
    pid = person_data["id"]
    _graph.add_node(
        pid,
        name=person_data.get("name", ""),
        node_type="person",
        description=person_data.get("description", ""),
        occupations=person_data.get("occupations", []),
        nationality=person_data.get("nationality", ""),
        image_url=person_data.get("image_url", ""),
        wikidata_id=person_data.get("wikidata_id", ""),
    )


# ─── Entity nodes ───────────────────────────────────────────────────

def add_entity(entity_data: dict[str, Any]) -> None:
    """Add an entity node (school, company, team, etc.) with a string ID."""
    eid = f"entity_{entity_data['id']}"
    _graph.add_node(
        eid,
        name=entity_data["name"],
        node_type=entity_data["entity_type"],
        description=entity_data.get("description", ""),
        metadata=entity_data.get("metadata", {}),
    )


def add_person_entity_edge(
    person_id: int, entity_id: int, rel_data: dict[str, Any]
) -> None:
    """Add an edge between a person node and an entity node."""
    eid = f"entity_{entity_id}"
    _graph.add_edge(
        person_id,
        eid,
        relationship_type=rel_data.get("relationship_type", "associated"),
        strength=0.7,
        description=rel_data.get("description", ""),
        years=rel_data.get("years", ""),
    )


# ─── Person-to-person edges ─────────────────────────────────────────

def add_relationship(
    person_a_id: int, person_b_id: int, rel_data: dict[str, Any]
) -> None:
    """Add or update a relationship edge in the graph."""
    _graph.add_edge(
        person_a_id,
        person_b_id,
        relationship_type=rel_data.get("relationship_type", "associated"),
        strength=rel_data.get("strength", 0.5),
        description=rel_data.get("description", ""),
        evidence_sources=rel_data.get("evidence_sources", []),
    )


# ─── Path-finding ───────────────────────────────────────────────────

def find_connection(
    person_a_id: int, person_b_id: int
) -> list[dict[str, Any]] | None:
    """Find shortest path between two people. Returns list of node dicts or None."""
    if person_a_id not in _graph or person_b_id not in _graph:
        return None
    try:
        path_ids = nx.shortest_path(_graph, person_a_id, person_b_id)
    except nx.NetworkXNoPath:
        return None

    path = []
    for i, nid in enumerate(path_ids):
        node_data = dict(_graph.nodes[nid])
        node_data["id"] = nid
        if i < len(path_ids) - 1:
            edge_data = dict(_graph.edges[nid, path_ids[i + 1]])
            node_data["edge_to_next"] = edge_data
        path.append(node_data)
    return path


# ─── Ego / full graph export ────────────────────────────────────────

def get_person_network(person_id: int, depth: int = 2) -> dict[str, Any]:
    """Get ego network around a person."""
    if person_id not in _graph:
        return {"nodes": [], "links": []}

    ego = nx.ego_graph(_graph, person_id, radius=depth)
    return _graph_to_force_json(ego)


def get_full_graph() -> dict[str, Any]:
    """Export entire graph in react-force-graph format."""
    return _graph_to_force_json(_graph)


# ─── Force-graph JSON serialisation ─────────────────────────────────

# Occupation-based colours for person nodes
_PERSON_COLOR_MAP = {
    "politician": "#e74c3c",
    "athlete": "#2ecc71",
    "actor": "#9b59b6",
    "musician": "#f39c12",
    "scientist": "#3498db",
    "business": "#1abc9c",
    "writer": "#e67e22",
}

# Entity type colours
_ENTITY_COLOR_MAP = {
    "school": "#3b82f6",       # blue
    "company": "#f59e0b",      # amber
    "team": "#10b981",         # emerald
    "event": "#ec4899",        # pink
    "location": "#8b5cf6",     # violet
    "organization": "#6366f1", # indigo
}


def _person_node_color(attrs: dict) -> str:
    occupations = attrs.get("occupations", [])
    for occ in occupations:
        occ_lower = occ.lower()
        for key, color in _PERSON_COLOR_MAP.items():
            if key in occ_lower:
                return color
    return "#95a5a6"  # default grey


def _graph_to_force_json(g: nx.Graph) -> dict[str, Any]:
    """Convert a networkx graph to {nodes: [...], links: [...]} format."""
    nodes = []
    for nid, attrs in g.nodes(data=True):
        node_type = attrs.get("node_type", "person")

        if node_type == "person":
            nodes.append({
                "id": nid,
                "name": attrs.get("name", f"Person {nid}"),
                "node_type": "person",
                "val": max(1, g.degree(nid)),
                "color": _person_node_color(attrs),
                "description": attrs.get("description", ""),
                "occupations": attrs.get("occupations", []),
                "nationality": attrs.get("nationality", ""),
                "image_url": attrs.get("image_url", ""),
            })
        else:
            # Entity node
            color = _ENTITY_COLOR_MAP.get(node_type, "#94a3b8")
            nodes.append({
                "id": nid,
                "name": attrs.get("name", str(nid)),
                "node_type": node_type,
                "val": max(1, g.degree(nid)) * 0.7,  # slightly smaller than persons
                "color": color,
                "description": attrs.get("description", ""),
                "metadata": attrs.get("metadata", {}),
            })

    links = []
    for u, v, attrs in g.edges(data=True):
        links.append({
            "source": u,
            "target": v,
            "relationship_type": attrs.get("relationship_type", "associated"),
            "strength": attrs.get("strength", 0.5),
            "description": attrs.get("description", ""),
            "years": attrs.get("years", ""),
        })

    return {"nodes": nodes, "links": links}


# ─── Rebuild from DB ────────────────────────────────────────────────

def rebuild_from_db(db: Session) -> None:
    """Reconstruct the in-memory graph from the database."""
    _graph.clear()

    # Load persons
    persons = db.query(Person).all()
    for p in persons:
        add_person(p.to_dict())

    # Load person-to-person relationships
    relationships = db.query(Relationship).all()
    for r in relationships:
        add_relationship(r.person_a_id, r.person_b_id, r.to_dict())

    # Load entities
    entities = db.query(Entity).all()
    for e in entities:
        add_entity(e.to_dict())

    # Load person-entity edges
    person_entities = db.query(PersonEntity).all()
    for pe in person_entities:
        add_person_entity_edge(pe.person_id, pe.entity_id, pe.to_dict())

    logger.info(
        f"Graph rebuilt: {_graph.number_of_nodes()} nodes, "
        f"{_graph.number_of_edges()} edges"
    )
