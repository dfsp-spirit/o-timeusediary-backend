import json

from o_timeusediary_backend.parsers.activities_config import (
    ActivitiesConfig,
    get_activity_codes_set,
    get_all_activity_codes,
    validate_multiple_activity_codes,
)


def _example_activities_payload() -> dict:
    return {
        "general": {"app_name": "TRAC"},
        "timeline": {
            "primary": {
                "name": "Primary",
                "mode": "single-choice",
                "categories": [
                    {
                        "name": "Main",
                        "activities": [
                            {
                                "name": "Sleep",
                                "code": 100,
                                "childItems": [
                                    {"name": "Nap", "code": 101}
                                ],
                            },
                            {"name": "Work", "code": 200},
                        ],
                    }
                ],
            }
        },
    }


def test_get_all_activity_codes_includes_child_context():
    config = ActivitiesConfig(**_example_activities_payload())

    all_codes = get_all_activity_codes(config)

    assert set(all_codes.keys()) == {100, 101, 200}
    assert all_codes[100]["timeline"] == "primary"
    assert all_codes[100]["category"] == "Main"
    assert all_codes[101]["is_child"] is True
    assert all_codes[101]["parent_name"] == "Sleep"


def test_get_activity_codes_set_collects_all_codes():
    config = ActivitiesConfig(**_example_activities_payload())

    assert get_activity_codes_set(config) == {100, 101, 200}


def test_validate_multiple_activity_codes_reports_valid_and_invalid(tmp_path):
    config_file = tmp_path / "activities_test.json"
    config_file.write_text(json.dumps(_example_activities_payload()), encoding="utf-8")

    result = validate_multiple_activity_codes(str(config_file), [100, 999, 200])

    assert result == {
        "valid": [100, 200],
        "invalid": [999],
        "all_valid": False,
    }
