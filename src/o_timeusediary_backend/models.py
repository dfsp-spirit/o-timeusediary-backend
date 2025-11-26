from sqlmodel import SQLModel, Field, Relationship, JSON, Column
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
import uuid
from sqlalchemy import Text

class Participant(SQLModel, table=True):
    __tablename__ = "participants"

    id: str = Field(primary_key=True)  # External ID like "bernddasbrot", "annasmith"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    study_associations: List["StudyParticipant"] = Relationship(back_populates="participant")
    submissions: List["Submission"] = Relationship(back_populates="participant")

class Study(SQLModel, table=True):
    __tablename__ = "studies"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    name_short: str = Field(index=True, unique=True)
    description: str
    entry_names: List[str] = Field(sa_column=Column(JSON))  # e.g., ["monday", "tuesday", ...] or ["typical_weekend", "workday"]
    study_participant_ids: List[str] = Field(sa_column=Column(JSON))  # allowed participant IDs from config
    allow_unlisted_participants: bool = Field(default=True)
    activities_json_url: str
    data_collection_start: datetime
    data_collection_end: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    submissions: List["Submission"] = Relationship(back_populates="study")
    activity_configs: List["StudyActivityConfig"] = Relationship(back_populates="study")
    participant_associations: List["StudyParticipant"] = Relationship(back_populates="study")

class StudyParticipant(SQLModel, table=True):
    """Link table for study-participant associations"""
    __tablename__ = "study_participants"

    id: Optional[int] = Field(default=None, primary_key=True)
    study_id: int = Field(foreign_key="studies.id")
    participant_id: str = Field(foreign_key="participants.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    study: Study = Relationship(back_populates="participant_associations")
    participant: Participant = Relationship(back_populates="study_associations")

class Submission(SQLModel, table=True):
    __tablename__ = "submissions"

    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True, index=True)
    study_id: int = Field(foreign_key="studies.id")
    participant_id: str = Field(foreign_key="participants.id")
    entry_name: str  # Must be in study.entry_names

    # Metadata (for tracking, not research)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    total_duration_minutes: int = Field(default=0)  # Sum of all timeline entries
    is_complete: bool = Field(default=False)

    # Relationships
    study: Study = Relationship(back_populates="submissions")
    participant: Participant = Relationship(back_populates="submissions")
    timeline_entries: List["TimelineEntry"] = Relationship(back_populates="submission")

class TimelineEntry(SQLModel, table=True):
    __tablename__ = "timeline_entries"

    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: int = Field(foreign_key="submissions.id")
    timeline_type: str = Field(index=True)  # "primary", "digitalmediause", etc.

    # Core research data - time of day without date
    activity_code: int = Field(index=True)
    start_minutes: int  # Minutes since midnight (0-1439)
    end_minutes: int    # Minutes since midnight (0-1439)
    duration_minutes: int  # Calculated: end_minutes - start_minutes
    custom_input: Optional[str] = Field(default=None, sa_column=Column(Text))

    # Hierarchy information
    parent_activity_code: Optional[int] = Field(default=None, index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    submission: Submission = Relationship(back_populates="timeline_entries")

class StudyActivityConfig(SQLModel, table=True):
    """Stores the activity configuration for each study for reproducibility"""
    __tablename__ = "study_activity_configs"

    id: Optional[int] = Field(default=None, primary_key=True)
    study_id: int = Field(foreign_key="studies.id", unique=True)
    activities_config: Dict[str, Any] = Field(sa_column=Column(JSON))  # The entire activities JSON
    config_hash: str  # Hash of the config for change detection
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    study: Study = Relationship(back_populates="activity_configs")

# Pydantic models for API requests/responses
class TimelineEntryCreate(BaseModel):
    timeline_type: str
    activity_code: int
    start_minutes: int
    end_minutes: int
    custom_input: Optional[str] = None
    parent_activity_code: Optional[int] = None

class SubmissionCreate(BaseModel):
    entry_name: str
    timeline_entries: List[TimelineEntryCreate]

class SubmissionResponse(BaseModel):
    id: int
    uuid: str
    study_name: str
    participant_id: str
    entry_name: str
    created_at: datetime
    is_complete: bool
    total_duration_minutes: int
    timeline_entries: List[Dict[str, Any]]

class StudyResponse(BaseModel):
    id: int
    name: str
    name_short: str
    description: str
    entry_names: List[str]
    allow_unlisted_participants: bool
    data_collection_start: datetime
    data_collection_end: datetime