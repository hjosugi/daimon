import os
from typing import Dict, Optional, Tuple
import re

class ContentModerationService:
    def __init__(self):
        self.blocked_keywords = self._load_blocked_keywords()
        self.spam_patterns = [
            r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
            r"@\w+",
        ]
        
    def _load_blocked_keywords(self) -> set:
        return set()
    
    def check_content(self, text: str) -> Tuple[bool, Optional[str], Dict]:
        """
        Check if content is appropriate.
        
        Returns:
            (is_safe, reason, metadata)
            - is_safe: True if content is safe, False if should be blocked
            - reason: Reason for blocking (if not safe)
            - metadata: Additional info (toxicity_score, spam_score, etc.)
        """
        text_lower = text.lower()
        
        for keyword in self.blocked_keywords:
            if keyword.lower() in text_lower:
                return False, f"Blocked keyword detected: {keyword}", {
                    "blocked_keyword": keyword,
                    "method": "keyword_filter"
                }
        
        spam_score = 0
        for pattern in self.spam_patterns:
            matches = re.findall(pattern, text)
            if len(matches) > 3:
                spam_score += len(matches)
        
        if spam_score > 5:
            return False, "Spam pattern detected (too many links/mentions)", {
                "spam_score": spam_score,
                "method": "pattern_detection"
            }
        
        if len(text) > 5000:
            return False, "Post too long (possible spam)", {
                "length": len(text),
                "method": "length_check"
            }
        
        return True, None, {
            "spam_score": spam_score,
            "method": "basic_checks"
        }
    
    def check_with_perspective_api(self, text: str) -> Tuple[bool, Optional[str], Dict]:
        return self.check_content(text)

content_moderation_service = ContentModerationService()
