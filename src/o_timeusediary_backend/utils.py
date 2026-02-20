from datetime import datetime, timezone
from datetime import time


def utc_now() -> datetime:
    """Get the current UTC time.

    Returns:
        datetime: Current UTC time
    """
    return datetime.now(timezone.utc)



def get_time_for_minutes_from_midnight(minutes_from_midnight : int) -> time:
    """
    Convert minutes from midnight to a time object.

    Args:
        minutes_from_midnight (int): Number of minutes since midnight

    Returns:
        datetime.time: Time object representing the given minutes
    """
    # Handle minutes that might exceed 24 hours (1440 minutes)
    minutes_from_midnight = minutes_from_midnight % (24 * 60)

    # Calculate hours and minutes
    hours = minutes_from_midnight // 60
    minutes = minutes_from_midnight % 60

    return time(hours, minutes)