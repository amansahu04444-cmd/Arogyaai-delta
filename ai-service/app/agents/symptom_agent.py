import logging
from typing import Dict, Any, List, Optional
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class SymptomAgent:
    def __init__(self):
        self.service = gemini_service
        self.symptom_patterns = {
            "pain": ["pain", "dard", "ache", "hurt", "burning", "tingling"],
            "fever": ["fever", "bukhar", "temperature", "febrile", "hot"],
            "respiratory": ["cough", "khansi", "breathing", "shortness", "breath", "wheeze"],
            "digestive": ["nausea", "vomit", "diarrhea", "stomach", "pet", "appetite"],
            "neurological": ["headache", "sir dard", "dizzy", "faint", "confusion"],
            "cardiac": ["chest", "heart", "palpitations", "sweating"],
            "skin": ["rash", "itching", "skin", "redness", "swelling"],
            "musculoskeletal": ["joint", "muscle", "back", "neck", "limb"]
        }

    async def process(self, normalized_text: str) -> Dict[str, Any]:
        logger.info("SymptomAgent processing normalized text")

        symptoms = self._extract_symptoms(normalized_text)
        duration = self._extract_duration(normalized_text)
        severity = self._extract_severity(normalized_text)
        analysis = self._analyze_text(normalized_text, symptoms)

        return {
            "symptoms": symptoms,
            "duration": duration,
            "severity": severity,
            "text_analysis": analysis
        }

    def _extract_symptoms(self, text: str) -> List[Dict]:
        text_lower = text.lower()
        found_symptoms = []

        for category, patterns in self.symptom_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    found_symptoms.append({
                        "name": pattern,
                        "category": category,
                        "mentioned": True
                    })

        if not found_symptoms:
            words = text_lower.split()
            for word in words:
                if len(word) > 4:
                    found_symptoms.append({
                        "name": word,
                        "category": "general",
                        "mentioned": True
                    })

        return found_symptoms

    def _extract_duration(self, text: str) -> Optional[str]:
        duration_patterns = [
            (r'(\d+)\s*days?', 'days'),
            (r'(\d+)\s*hours?', 'hours'),
            (r'(\d+)\s*weeks?', 'weeks'),
            (r'(\d+)\s*months?', 'months'),
            (r'for\s*a\s*day', '1 day'),
            (r'for\s*a\s*week', '1 week'),
            (r'just\s*now', 'immediate'),
            (r'since\s*yesterday', '1 day'),
            (r'last\s*\d+\s*days', 'several days')
        ]

        import re
        for pattern, duration in duration_patterns:
            if re.search(pattern, text.lower()):
                match = re.search(pattern, text.lower())
                if match:
                    return f"{match.group(1)} {duration}" if match.groups() else duration
                return duration

        return None

    def _extract_severity(self, text: str) -> str:
        high_severity = ["severe", "awful", "terrible", "extreme", "worst", "badi", "zyada"]
        medium_severity = ["moderate", "quite", "pretty", "thoda", "somewhat"]
        low_severity = ["mild", "slight", "light", "kam", "halka", "little"]

        text_lower = text.lower()

        if any(word in text_lower for word in high_severity):
            return "severe"
        if any(word in text_lower for word in medium_severity):
            return "moderate"
        if any(word in text_lower for word in low_severity):
            return "mild"

        return "moderate"

    def _analyze_text(self, text: str, symptoms: List[Dict]) -> Dict:
        return {
            "word_count": len(text.split()),
            "symptom_count": len(symptoms),
            "categories_mentioned": list(set(s["category"] for s in symptoms)),
            "has_duration": self._extract_duration(text) is not None,
            "has_severity": True
        }

symptom_agent = SymptomAgent()
