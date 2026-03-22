import json

import pytest

from o_timeusediary_backend.parsers.studies_config import load_studies_config


def _valid_studies_payload() -> dict:
    return {
        "studies": [
            {
                "name": "Demo Study",
                "name_short": "demo_study",
                "description": "Short description",
                "day_labels": [
                    {"name": "day1", "display_order": 1, "display_names": {"en": "Day 1", "sv": "Day 1"}}
                ],
                "study_participant_ids": ["p1"],
                "allow_unlisted_participants": False,
                "default_language": "en",
                "activities_json_files": {
                    "en": "activities_default.json",
                    "sv": "activities_default.sv.json"
                },
                "data_collection_start": "2024-01-01T00:00:00Z",
                "data_collection_end": "2024-01-07T00:00:00Z",
            }
        ]
    }


def test_load_studies_config_from_json(tmp_path):
    config_file = tmp_path / "studies_config.json"
    config_file.write_text(json.dumps(_valid_studies_payload()), encoding="utf-8")

    config = load_studies_config(str(config_file))

    assert len(config.studies) == 1
    assert config.studies[0].name_short == "demo_study"
    assert config.studies[0].default_language == "en"
    assert sorted(config.studies[0].get_supported_languages()) == ["en", "sv"]


def test_load_studies_config_rejects_invalid_name_short(tmp_path):
    payload = _valid_studies_payload()
    payload["studies"][0]["name_short"] = "Demo-Study"

    config_file = tmp_path / "studies_config.json"
    config_file.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="name_short"):
        load_studies_config(str(config_file))


def test_load_studies_config_rejects_missing_daylabel_translation_for_existing_activity_language(tmp_path):
    payload = _valid_studies_payload()
    payload["studies"][0]["day_labels"][0]["display_names"] = {"en": "Day 1"}

    config_file = tmp_path / "studies_config.json"
    config_file.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ValueError, match="missing translated display names"):
        load_studies_config(str(config_file))
