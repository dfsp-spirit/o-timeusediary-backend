import os
import uuid

import httpx
import pytest

from o_timeusediary_backend.settings import settings


BASE_SCHEME = os.getenv("TUD_BASE_SCHEME", "http://localhost:3000")
BASE_URL = f"{BASE_SCHEME}/" + settings.rootpath.strip("/")


async def _get_submission_template(client: httpx.AsyncClient, study_name_short: str):
    study_cfg_response = await client.get(f"{BASE_URL}/api/studies/{study_name_short}/study-config")
    assert study_cfg_response.status_code == 200
    study_cfg = study_cfg_response.json()
    assert "day_labels" in study_cfg and len(study_cfg["day_labels"]) >= 2

    activities_response = await client.get(f"{BASE_URL}/api/studies/{study_name_short}/activities-config")
    assert activities_response.status_code == 200
    activities_data = activities_response.json()
    assert "timeline" in activities_data

    timeline_key = next(iter(activities_data["timeline"].keys()))
    timeline_cfg = activities_data["timeline"][timeline_key]
    timeline_mode = timeline_cfg["mode"]
    first_category = timeline_cfg["categories"][0]
    first_activity = first_category["activities"][0]

    return {
        "day_labels": study_cfg["day_labels"],
        "timeline_key": timeline_key,
        "timeline_mode": timeline_mode,
        "category_name": first_category["name"],
        "activity_name": first_activity["name"],
        "activity_code": first_activity["code"],
    }


def _build_activity_item(template: dict, start_minutes: int, end_minutes: int) -> dict:
    item = {
        "timeline_key": template["timeline_key"],
        "activity": template["activity_name"],
        "category": template["category_name"],
        "start_minutes": start_minutes,
        "end_minutes": end_minutes,
        "mode": template["timeline_mode"],
    }

    if template["timeline_mode"] == "single-choice":
        item["code"] = template["activity_code"]
    else:
        item["codes"] = [template["activity_code"]]

    return item


async def _submit_day_activities(
    client: httpx.AsyncClient,
    study_name_short: str,
    participant_id: str,
    day_label_name: str,
    activity_items: list,
):
    response = await client.post(
        f"{BASE_URL}/api/studies/{study_name_short}/participants/{participant_id}/day_labels/{day_label_name}/activities",
        json={"activities": activity_items},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["participant"] == participant_id


async def _call_template_endpoint(client: httpx.AsyncClient, study_name_short: str, source_user: str, target_user: str):
    params = {
        "study": study_name_short,
        "source_user": source_user,
        "target_user": target_user,
    }

    post_response = await client.post(f"{BASE_URL}/api/template-activities", params=params)
    assert post_response.status_code == 200
    return post_response.json()


@pytest.mark.asyncio
async def test_template_activities_post_copies_missing_days_to_target_user():
    study_name_short = "default"
    source_participant_id = f"it_src_{uuid.uuid4().hex[:8]}"
    target_participant_id = f"it_tgt_{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient() as client:
        template = await _get_submission_template(client, study_name_short)
        monday_name = template["day_labels"][0]["name"]
        tuesday_name = template["day_labels"][1]["name"]

        # Source has Monday: 1 activity, Tuesday: 2 activities.
        await _submit_day_activities(
            client,
            study_name_short,
            source_participant_id,
            monday_name,
            [_build_activity_item(template, 240, 250)],
        )
        await _submit_day_activities(
            client,
            study_name_short,
            source_participant_id,
            tuesday_name,
            [
                _build_activity_item(template, 240, 250),
                _build_activity_item(template, 260, 270),
            ],
        )

        payload = await _call_template_endpoint(
            client,
            study_name_short,
            source_participant_id,
            target_participant_id,
        )

        assert payload["copied_days_count"] == 2
        assert payload["skipped_days_count"] == 0
        assert payload["total_activities_copied"] == 3
        assert payload["copied_day_indices"] == [0, 1]

        monday_target_response = await client.get(
            f"{BASE_URL}/api/studies/{study_name_short}/participants/{target_participant_id}/activities",
            params={"day_label_index": 0},
        )
        assert monday_target_response.status_code == 200
        monday_target_payload = monday_target_response.json()
        assert len(monday_target_payload["activities"]) == 1

        tuesday_target_response = await client.get(
            f"{BASE_URL}/api/studies/{study_name_short}/participants/{target_participant_id}/activities",
            params={"day_label_index": 1},
        )
        assert tuesday_target_response.status_code == 200
        tuesday_target_payload = tuesday_target_response.json()
        assert len(tuesday_target_payload["activities"]) == 2

        # Enforce API contract: GET is not supported for this endpoint.
        get_response = await client.get(
            f"{BASE_URL}/api/template-activities",
            params={
                "study": study_name_short,
                "source_user": source_participant_id,
                "target_user": target_participant_id,
            },
        )
        assert get_response.status_code == 405


@pytest.mark.asyncio
async def test_template_activities_post_skips_days_that_target_already_has_data_for():
    study_name_short = "default"
    source_participant_id = f"it_src_{uuid.uuid4().hex[:8]}"
    target_participant_id = f"it_tgt_{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient() as client:
        template = await _get_submission_template(client, study_name_short)
        monday_name = template["day_labels"][0]["name"]
        tuesday_name = template["day_labels"][1]["name"]

        # Source has Monday: 1 activity, Tuesday: 2 activities.
        await _submit_day_activities(
            client,
            study_name_short,
            source_participant_id,
            monday_name,
            [_build_activity_item(template, 240, 250)],
        )
        await _submit_day_activities(
            client,
            study_name_short,
            source_participant_id,
            tuesday_name,
            [
                _build_activity_item(template, 240, 250),
                _build_activity_item(template, 260, 270),
            ],
        )

        # Target already has Monday data -> Monday should be skipped, Tuesday should be copied.
        await _submit_day_activities(
            client,
            study_name_short,
            target_participant_id,
            monday_name,
            [_build_activity_item(template, 300, 310)],
        )

        payload = await _call_template_endpoint(
            client,
            study_name_short,
            source_participant_id,
            target_participant_id,
        )

        monday_target_response = await client.get(
            f"{BASE_URL}/api/studies/{study_name_short}/participants/{target_participant_id}/activities",
            params={"day_label_index": 0},
        )
        assert monday_target_response.status_code == 200
        monday_target_payload = monday_target_response.json()
        assert len(monday_target_payload["activities"]) == 1
        assert monday_target_payload["activities"][0]["start_minutes"] == 300

        assert payload["copied_days_count"] == 1
        assert payload["skipped_days_count"] == 1
        assert payload["total_activities_copied"] == 2
        assert payload["copied_day_indices"] == [1]
        assert payload["skipped_day_indices"] == [0]

        tuesday_target_response = await client.get(
            f"{BASE_URL}/api/studies/{study_name_short}/participants/{target_participant_id}/activities",
            params={"day_label_index": 1},
        )
        assert tuesday_target_response.status_code == 200
        tuesday_target_payload = tuesday_target_response.json()
        assert len(tuesday_target_payload["activities"]) == 2
