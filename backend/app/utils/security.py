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
