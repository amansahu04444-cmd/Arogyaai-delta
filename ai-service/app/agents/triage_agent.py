import logging
from typing import Dict, Any, List
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class TriageAgent:
    def __init__(self):
        self.service = gemini_service
        self.risk_thresholds = {
            "HIGH": 7,
            "MEDIUM": 4,
            "LOW": 1
        }

    async def process(self, symptoms: List[Dict], duration: str = None, severity: str = None) -> Dict[str, Any]:
        logger.info("TriageAgent calculating score")

        base_score = self._calculate_base_score(symptoms)
        duration_factor = self._apply_duration_factor(duration)
        severity_factor = self._apply_severity_factor(severity)

        final_score = min(10, max(1, base_score + duration_factor + severity_factor))
        risk_level = self._determine_risk_level(final_score)
        category = self._categorize(symptoms)

        reasoning = self._generate_reasoning(symptoms, final_score, risk_level, category)

        return {
            "triage_score": int(final_score),
            "risk_level": risk_level,
            "category": category,
            "reasoning": reasoning
        }

    def _calculate_base_score(self, symptoms: List[Dict]) -> int:
        if not symptoms:
            return 5

        category_scores = {
            "cardiac": 8,
            "neurological": 8,
            "respiratory": 7,
            "pain": 5,
            "fever": 4,
            "digestive": 4,
            "skin": 2,
            "musculoskeletal": 3,
            "general": 3
        }

        max_score = 0
        for symptom in symptoms:
            category = symptom.get("category", "general")
            score = category_scores.get(category, 3)
            max_score = max(max_score, score)

        return max_score

    def _apply_duration_factor(self, duration: str) -> int:
        if not duration:
            return 0

        duration_lower = duration.lower()

        if any(word in duration_lower for word in ["week", "month", "weeks", "months"]):
            return 2
        if "day" in duration_lower or "days" in duration_lower:
            days = int(''.join(filter(str.isdigit, duration)) or 1)
            if days > 3:
                return 1
        if "hour" in duration_lower or "hours" in duration_lower:
            return -1

        return 0

    def _apply_severity_factor(self, severity: str) -> int:
        severity_factors = {
            "severe": 2,
            "moderate": 0,
            "mild": -1
        }
        return severity_factors.get(severity, 0)

    def _determine_risk_level(self, score: int) -> str:
        if score >= self.risk_thresholds["HIGH"]:
            return "HIGH"
        elif score >= self.risk_thresholds["MEDIUM"]:
            return "MEDIUM"
        return "LOW"

    def _categorize(self, symptoms: List[Dict]) -> str:
        category_map = {
            "cardiac": "Cardiac Risk",
            "neurological": "Neurological Concerns",
            "respiratory": "Respiratory Issues",
            "fever": "Infectious Disease",
            "digestive": "Digestive Problems",
            "skin": "Skin Conditions",
            "musculoskeletal": "Musculoskeletal",
            "pain": "General Symptoms",
            "general": "General Symptoms"
        }

        if not symptoms:
            return "General Symptoms"

        primary_category = symptoms[0].get("category", "general")
        return category_map.get(primary_category, "General Symptoms")

    def _generate_reasoning(self, symptoms: List[Dict], score: int, risk_level: str, category: str) -> str:
        symptom_names = [s.get("name", "unknown") for s in symptoms[:3]]
        symptom_text = ", ".join(symptom_names)

        reasoning_templates = {
            "HIGH": f"Symptoms ({symptom_text}) indicate HIGH risk requiring immediate attention. Score: {score}",
            "MEDIUM": f"Symptoms ({symptom_text}) suggest MEDIUM risk. Professional consultation recommended. Score: {score}",
            "LOW": f"Symptoms ({symptom_text}) appear LOW risk with manageable symptoms. Score: {score}"
        }

        return reasoning_templates.get(risk_level, f"Assessment complete. Score: {score}")

triage_agent = TriageAgent()
