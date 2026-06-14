"""
Security utilities for input validation and sanitization
"""
import re
from typing import Tuple, Optional
from html import escape


def sanitize_text(text: str) -> str:
    """
    Sanitize text input to prevent XSS attacks.
    Removes potentially dangerous characters and patterns.
    """
    if not text:
        return ""
    
    sanitized = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', text)
    
    sanitized = re.sub(r'[ \t]+', ' ', sanitized)
    sanitized = re.sub(r'\n{3,}', '\n\n', sanitized)
    
    return sanitized.strip()


def validate_pov(pov: str) -> Tuple[bool, Optional[str]]:
    """
    Validate POV (tag) input.
    Returns (is_valid, error_message)
    """
    if not pov or not pov.strip():
        return False, "POV cannot be empty"
    
    trimmed = pov.strip()
    
    if len(trimmed) > 300:
        return False, f"POV must be 300 characters or less, got {len(trimmed)} characters"
    
    dangerous_patterns = [
        r'<script',
        r'javascript:',
        r'onerror=',
        r'onload=',
        r'onclick=',
        r'data:text/html',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, trimmed, re.IGNORECASE):
            return False, "POV contains invalid characters or patterns"
    
    return True, None


def validate_post_text(text: str) -> Tuple[bool, Optional[str]]:
    """
    Validate post text input.
    Returns (is_valid, error_message)
    """
    if not text or not text.strip():
        return False, "Post text cannot be empty"
    
    if len(text) > 10000:
        return False, f"Post text must be 10,000 characters or less, got {len(text)} characters"
    
    dangerous_patterns = [
        r'<script',
        r'javascript:',
        r'data:text/html',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False, "Post text contains invalid characters or patterns"
    
    return True, None


def escape_html(text: str) -> str:
    """
    Escape HTML special characters.
    Python's html.escape is used for additional safety.
    """
    return escape(text)


# --- Account input normalization & validation -----------------------------

USERNAME_MAX = 30
EMAIL_MAX = 254
PASSWORD_MIN = 8
PASSWORD_MAX_BYTES = 72  # bcrypt silently truncates beyond 72 bytes

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CONTROL_RE = re.compile(r"[\x00-\x1F\x7F]")


def normalize_username(username: str) -> str:
    """Trim ends and collapse internal whitespace runs to a single space."""
    if not username:
        return ""
    return re.sub(r"\s+", " ", username).strip()


def validate_username(username: str) -> Tuple[bool, Optional[str]]:
    """Validate a (pre-normalization) username. Returns (ok, error)."""
    u = normalize_username(username or "")
    if not u:
        return False, "Username cannot be empty"
    if len(u) > USERNAME_MAX:
        return False, f"Username must be {USERNAME_MAX} characters or less"
    if _CONTROL_RE.search(u) or "<" in u or ">" in u:
        return False, "Username contains invalid characters"
    return True, None


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    e = normalize_email(email)
    if not e:
        return False, "Email cannot be empty"
    if len(e) > EMAIL_MAX:
        return False, "Email is too long"
    if not _EMAIL_RE.match(e):
        return False, "Invalid email format"
    return True, None


def validate_password(password: str) -> Tuple[bool, Optional[str]]:
    if not password:
        return False, "Password cannot be empty"
    if len(password) < PASSWORD_MIN:
        return False, f"Password must be at least {PASSWORD_MIN} characters"
    if len(password.encode("utf-8")) > PASSWORD_MAX_BYTES:
        return False, f"Password must be {PASSWORD_MAX_BYTES} bytes or less"
    return True, None


def sanitize_sql_input(value: str) -> str:
    if not isinstance(value, str):
        return str(value)
    
    dangerous_sql_patterns = [
        r"';?\s*--",
        r"';?\s*/\*",
        r"';?\s*\*/",
        r"';?\s*DROP",
        r"';?\s*DELETE",
        r"';?\s*UPDATE",
        r"';?\s*INSERT",
        r"';?\s*SELECT",
        r"';?\s*UNION",
    ]
    
    sanitized = value
    for pattern in dangerous_sql_patterns:
        sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
    
    return sanitized
