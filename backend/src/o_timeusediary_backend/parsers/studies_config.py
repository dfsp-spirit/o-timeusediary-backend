# config/study_config.py
from typing import List, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel, model_validator
import yaml
import json
from pathlib import Path
import re

class CfgFileDayLabel(BaseModel):
    name: str
    display_order: int
    display_name: str

class CfgFileStudy(BaseModel):
    name: str
    name_short: str
    description: Optional[str] = None
    day_labels: List[CfgFileDayLabel]
    study_participant_ids: List[str] = []
    allow_unlisted_participants: bool = True
    default_language: str = "en" # default to English if not given
    activities_json_file: str
    data_collection_start: datetime  # UTC-aware datetime, parsed from ISO 8601 string
    data_collection_end: datetime    # UTC-aware datetime, parsed from ISO 8601 string

    @model_validator(mode='after')
    def validate_name_short(self) -> 'CfgFileStudy':
        if not self.name_short:
            raise ValueError('name_short cannot be empty')

        # Check for URL-friendly characters only: lowercase a-z, numbers 0-9, underscore
        if not re.match(r'^[a-z0-9_]+$', self.name_short):
            raise ValueError(
                f'name_short "{self.name_short}" can only contain lowercase letters (a-z), numbers (0-9), and underscores (_). '
                f'No uppercase letters, spaces, hyphens, or special characters allowed.'
            )

        # Check length
        if len(self.name_short) < 2:
            raise ValueError(f'name_short "{self.name_short}" must be at least 2 characters long')
        if len(self.name_short) > 50:
            raise ValueError(f'name_short "{self.name_short}" cannot exceed 50 characters')

        return self

    @model_validator(mode='after')
    def validate_iso8601_dates(self) -> 'CfgFileStudy':
        # Ensure both datetimes are UTC-aware.
        # Pydantic v2 on Python 3.11+ parses ISO 8601 strings with 'Z' suffix
        # (e.g. "2024-01-01T00:00:00Z") into timezone-aware datetimes automatically.
        # If somehow a naive datetime slips through, treat it as UTC.
        if self.data_collection_start is not None and self.data_collection_start.tzinfo is None:
            self.data_collection_start = self.data_collection_start.replace(tzinfo=timezone.utc)
        if self.data_collection_end is not None and self.data_collection_end.tzinfo is None:
            self.data_collection_end = self.data_collection_end.replace(tzinfo=timezone.utc)
        return self

    @model_validator(mode='after')
    def validate_default_language(self) -> 'CfgFileStudy':
        """Validate that default_language is a 2-letter lowercase ASCII string."""
        import re

        if not isinstance(self.default_language, str):
            raise ValueError("default_language must be a string")

        if not re.match(r'^[a-z]{2}$', self.default_language):
            raise ValueError(
                f'default_language "{self.default_language}" is invalid. '
                f'Must be a 2-letter lowercase ASCII string (a-z).'
            )

        return self


    @model_validator(mode='after')
    def validate_activities_json_file(self) -> 'CfgFileStudy':
        if self.activities_json_file is not None and not isinstance(self.activities_json_file, str):
            raise ValueError('activities_json_file must be a string')
        if self.activities_json_file is not None and self.activities_json_file.strip() == "":
            raise ValueError('activities_json_file cannot be an empty string')

        return self


class CfgFileStudies(BaseModel):
    studies: List[CfgFileStudy]


def load_studies_config(config_path: str) -> CfgFileStudies:
    """Load studies configuration from YAML or JSON file.

    @param config_path Path to a YAML/YML/JSON studies config file.
    @return Parsed and validated studies configuration.
    """

    config_path = Path(config_path)

    if not config_path.exists():
        raise FileNotFoundError(f"Studies configuration file not found at '{config_path}'")

    if config_path.suffix in ['.yaml', '.yml']:
        with open(config_path, 'r') as f:
            data = yaml.safe_load(f)
    elif config_path.suffix == '.json':
        with open(config_path, 'r') as f:
            data = json.load(f)
    else:
        raise ValueError(f"Unsupported config file format: {config_path.suffix}")

    return CfgFileStudies(**data)

