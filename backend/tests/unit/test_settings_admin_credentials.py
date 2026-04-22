import pytest

from o_timeusediary_backend.settings import TUDBackendSettings


def test_admin_single_value_fallback(monkeypatch):
    monkeypatch.setenv("TUD_API_ADMIN_USERNAME", "single_admin")
    monkeypatch.setenv("TUD_API_ADMIN_PASSWORD", "single_password")

    settings = TUDBackendSettings()

    assert settings.admin_usernames == ["single_admin"]
    assert settings.admin_passwords == ["single_password"]
    assert settings.admin_credentials == [("single_admin", "single_password")]
    assert settings.admin_username == "single_admin"
    assert settings.admin_password == "single_password"


def test_admin_credentials_from_json_lists(monkeypatch):
    monkeypatch.setenv("TUD_API_ADMIN_USERNAME", '["admin1", "admin2"]')
    monkeypatch.setenv("TUD_API_ADMIN_PASSWORD", '["pass1", "pass2"]')

    settings = TUDBackendSettings()

    assert settings.admin_usernames == ["admin1", "admin2"]
    assert settings.admin_passwords == ["pass1", "pass2"]
    assert settings.admin_credentials == [("admin1", "pass1"), ("admin2", "pass2")]


def test_admin_credentials_reject_mismatched_lengths(monkeypatch):
    monkeypatch.setenv("TUD_API_ADMIN_USERNAME", '["admin1", "admin2"]')
    monkeypatch.setenv("TUD_API_ADMIN_PASSWORD", '["pass1"]')

    settings = TUDBackendSettings()

    with pytest.raises(ValueError, match="same number of entries"):
        _ = settings.admin_credentials


def test_admin_json_list_rejects_empty_entries(monkeypatch):
    monkeypatch.setenv("TUD_API_ADMIN_USERNAME", '["admin1", ""]')
    monkeypatch.setenv("TUD_API_ADMIN_PASSWORD", '["pass1", "pass2"]')

    settings = TUDBackendSettings()

    with pytest.raises(ValueError, match="non-empty strings"):
        _ = settings.admin_usernames
