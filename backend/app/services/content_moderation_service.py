"""
Content Moderation Service
Detects inappropriate content, spam, and toxic language in posts.
"""
import os
from typing import Dict, Optional, Tuple
import re

# For MVP: Simple keyword-based filtering
# In production: Use ML models or APIs like Perspective API, AWS Comprehend, etc.

class ContentModerationService:
    def __init__(self):
        # Simple keyword-based approach for MVP
        # In production, replace with ML model or API calls
        self.blocked_keywords = self._load_blocked_keywords()
        self.spam_patterns = [
            r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",  # URLs
            r"@\w+",  # Mentions (can be spam)
        ]
        
    def _load_blocked_keywords(self) -> set:
        """Load blocked keywords (hate speech, profanity, etc.)"""
        # For MVP: Simple list
        # In production: Load from database or config file
        return {
            # Add blocked keywords here
            # Example: "spam", "scam", etc.
        }
    
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
        
        # Check blocked keywords
        for keyword in self.blocked_keywords:
            if keyword.lower() in text_lower:
                return False, f"Blocked keyword detected: {keyword}", {
                    "blocked_keyword": keyword,
                    "method": "keyword_filter"
                }
        
        # Check spam patterns
        spam_score = 0
        for pattern in self.spam_patterns:
            matches = re.findall(pattern, text)
            if len(matches) > 3:  # Too many URLs/mentions
                spam_score += len(matches)
        
        if spam_score > 5:
            return False, "Spam pattern detected (too many links/mentions)", {
                "spam_score": spam_score,
                "method": "pattern_detection"
            }
        
        # Check length (extremely long posts might be spam)
        if len(text) > 5000:
            return False, "Post too long (possible spam)", {
                "length": len(text),
                "method": "length_check"
            }
        
        # All checks passed
        return True, None, {
            "spam_score": spam_score,
            "method": "basic_checks"
        }
    
    def check_with_perspective_api(self, text: str) -> Tuple[bool, Optional[str], Dict]:
        """
        Check content using Google's Perspective API (requires API key).
        
        This is an example integration - uncomment and configure if you want to use it.
        """
        # Uncomment to use Perspective API:
        # import requests
        # 
        # PERSPECTIVE_API_KEY = os.getenv("PERSPECTIVE_API_KEY")
        # if not PERSPECTIVE_API_KEY:
        #     return self.check_content(text)  # Fallback to basic checks
        # 
        # try:
        #     response = requests.post(
        #         f"https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key={PERSPECTIVE_API_KEY}",
        #         json={
        #             "comment": {"text": text},
        #             "requestedAttributes": {
        #                 "TOXICITY": {},
        #                 "SPAM": {},
        #                 "SEVERE_TOXICITY": {}
        #             }
        #         }
        #     )
        #     data = response.json()
        #     
        #     toxicity = data.get("attributeScores", {}).get("TOXICITY", {}).get("summaryScore", {}).get("value", 0)
        #     spam = data.get("attributeScores", {}).get("SPAM", {}).get("summaryScore", {}).get("value", 0)
        #     
        #     if toxicity > 0.7 or spam > 0.7:
        #         return False, f"Toxicity: {toxicity:.2f}, Spam: {spam:.2f}", {
        #             "toxicity_score": toxicity,
        #             "spam_score": spam,
        #             "method": "perspective_api"
        #         }
        #     
        #     return True, None, {
        #         "toxicity_score": toxicity,
        #         "spam_score": spam,
        #         "method": "perspective_api"
        #     }
        # except Exception as e:
        #     print(f"Perspective API error: {e}")
        #     return self.check_content(text)  # Fallback
        
        # For now, use basic checks
        return self.check_content(text)

# Singleton
content_moderation_service = ContentModerationService()
