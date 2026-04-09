# validation dependencies for FastAPI routes related to activities
#
# Used to make sure that the activity codes provided in API requests from
# the frontend are valid according to the activities configuration for the given study
# in the backend database.

from fastapi import Depends, HTTPException, status
from typing import Set, Optional, Dict, Any
from sqlmodel import Session, select
from ..models import Study
from ..database import get_session
from .available_activities import (
    get_activity_info_for_study_code,
    get_valid_activity_codes_for_study,
)


def get_study_activity_codes(
    study_name_short: str,
    session: Session = Depends(get_session)
) -> Set[int]:
    """
    FastAPI dependency that returns valid activity codes for a study.
    Raises HTTPException if study not found or config cannot be loaded.
    """
    try:
        return get_valid_activity_codes_for_study(session, study_name_short)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Activities configuration not found for study '{study_name_short}'"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading activity configuration: {str(e)}"
        )


def validate_activity_code_dependency(
    study_name_short: str,
    activity_code: int,
    valid_codes: Set[int] = Depends(get_study_activity_codes)
) -> int:
    """
    Dependency that validates an activity code against the study's config.
    Raises HTTPException if code is invalid.
    """
    if activity_code not in valid_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid activity code: {activity_code}. Code not found in study configuration."
        )
    return activity_code


def get_activity_info_dependency(
    study_name_short: str,
    activity_code: int = Depends(validate_activity_code_dependency),
    session: Session = Depends(get_session)
) -> Optional[Dict[str, Any]]:
    """
    Dependency that returns activity info for a valid activity code.
    """
    return get_activity_info_for_study_code(session, study_name_short, activity_code)