"""
Enums and constants for better code organization
"""
from enum import Enum


class MatchType(str, Enum):
    """Match type for post recommendations"""
    TAG = "tag"
    BOTH = "both"  # Matched by both POVs and content similarity


class HTTPStatus(int, Enum):
    """HTTP status codes"""
    OK = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    INTERNAL_SERVER_ERROR = 500


class POVConstraints:
    """POV (tag) constraints"""
    MAX_LENGTH = 300
    MAX_COUNT = 100


class PostConstraints:
    """Post constraints"""
    MAX_TEXT_LENGTH = 10000
    MIN_TEXT_LENGTH = 1


class DebounceDelays:
    """Debounce delays in milliseconds"""
    POV_GENERATION = 800
    POV_SUGGESTION = 300
