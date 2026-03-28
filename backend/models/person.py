from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON
)
from models.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False, index=True)
    aliases = Column(JSON, default=list)           # ["Max E. Verstappen", ...]
    description = Column(Text, default="")
    birth_date = Column(String(32), default="")    # ISO or partial date string
    nationality = Column(String(128), default="")
    occupations = Column(JSON, default=list)       # ["racing driver", ...]
    image_url = Column(String(512), default="")
    wikipedia_url = Column(String(512), default="")
    wikidata_id = Column(String(32), default="")
    raw_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "aliases": self.aliases or [],
            "description": self.description or "",
            "birth_date": self.birth_date or "",
            "nationality": self.nationality or "",
            "occupations": self.occupations or [],
            "image_url": self.image_url or "",
            "wikipedia_url": self.wikipedia_url or "",
            "wikidata_id": self.wikidata_id or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(Integer, primary_key=True, index=True)
    person_a_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    person_b_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    relationship_type = Column(String(128), default="associated")
    strength = Column(Float, default=0.5)
    description = Column(Text, default="")
    evidence_sources = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "person_a_id": self.person_a_id,
            "person_b_id": self.person_b_id,
            "relationship_type": self.relationship_type or "associated",
            "strength": self.strength or 0.5,
            "description": self.description or "",
            "evidence_sources": self.evidence_sources or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False, index=True)
    entity_type = Column(String(64), nullable=False)  # "school", "company", "team", "event", "location", "organization"
    description = Column(Text, default="")
    metadata_json = Column(JSON, default=dict)  # extra info like founding_year, location, etc.
    created_at = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "entity_type": self.entity_type,
            "description": self.description or "",
            "metadata": self.metadata_json or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PersonEntity(Base):
    __tablename__ = "person_entities"

    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id"), nullable=False, index=True)
    relationship_type = Column(String(128), default="associated")  # "attended", "works_at", "member_of", "born_in"
    years = Column(String(64), default="")  # "2010-2014"
    description = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "person_id": self.person_id,
            "entity_id": self.entity_id,
            "relationship_type": self.relationship_type or "associated",
            "years": self.years or "",
            "description": self.description or "",
        }


class SearchCache(Base):
    __tablename__ = "search_cache"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String(512), nullable=False, index=True)
    source = Column(String(64), nullable=False)   # "wikipedia", "wikidata", "google"
    response_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    expires_at = Column(DateTime, nullable=False)
