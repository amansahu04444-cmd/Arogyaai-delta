import logging
from typing import Dict, Any, Optional
from app.utils.prompt_templates import (
    SYSTEM_PROMPT,
    INPUT_NORMALIZATION_PROMPT,
    SYMPTOM_EXTRACTION_PROMPT,
    RED_FLAG_PROMPT,
    TRIAGE_SCORING_PROMPT,
    RECOMMENDATION_PROMPT,
    FOLLOWUP_QUESTION_PROMPT
)
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class InputAgent:
    def __init__(self):
        self.service = gemini_service

    async def process(self, text: str) -> Dict[str, Any]:
        logger.info("InputAgent processing text")

        normalized_text = self._normalize_text(text)
        language_detected = self._detect_language(text)
        text_cleaned = self._clean_text(normalized_text)

        return {
            "normalized_text": normalized_text,
            "language_detected": language_detected,
            "text_cleaned": text_cleaned
        }

    def _normalize_text(self, text: str) -> str:
        text = text.strip()
        text = ' '.join(text.split())
        replacements = {
            'nahi': 'not',
            'nhi': 'not',
            'nahi': 'not',
            'thik': 'okay',
            'theek': 'okay',
            'bahut': 'very',
            'zyada': 'too much',
            'dard': 'pain',
            'bukhar': 'fever',
            'sardi': 'cold',
            'khansi': 'cough',
            'sir dard': 'headache',
            'chest pain': 'chest pain',
            'pet dard': 'stomach pain'
        }
        for hindi, english in replacements.items():
            text = text.lower().replace(hindi, english)
        return text

    def _detect_language(self, text: str) -> str:
        hindi_chars = set('अ आ इ ई उ ऊ ए ऐ ओ औ क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह')
        if any(char in hindi_chars for char in text):
            return "hindi"
        hinglish_indicators = ['nahi', 'nhi', 'thik', 'bahut', 'zyada', 'dard', 'bukhar']
        if any(word in text.lower() for word in hinglish_indicators):
            return "hinglish"
        return "english"

    def _clean_text(self, text: str) -> str:
        import re
        text = re.sub(r'[^\w\s.,!?-]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

input_agent = InputAgent()
