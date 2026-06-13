import logging
from typing import Dict, Any, List
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class RecommendationAgent:
    def __init__(self):
        self.service = gemini_service
        self.action_lookup = {
            (1, 3, "LOW"): ("HOME", "Rest and monitor at home", "low", [
                "Get adequate rest",
                "Stay hydrated",
                "Monitor symptoms for 24-48 hours",
                "Consider OTC remedies if appropriate",
                "Return if symptoms worsen"
            ]),
            (1, 3, "MEDIUM"): ("HOME", "Home care with monitoring", "low", [
                "Rest at home",
                "Take prescribed medications",
                "Monitor temperature",
                "Consult doctor if no improvement in 48 hours"
            ]),
            (4, 6, "LOW"): ("DOCTOR", "Schedule doctor appointment", "medium", [
                "Book appointment within 48-72 hours",
                "Prepare questions for doctor",
                "Note all symptoms and duration",
                "Bring previous medical records if available"
            ]),
            (4, 6, "MEDIUM"): ("DOCTOR", "Consult doctor soon", "medium", [
                "Schedule appointment within 24-48 hours",
                "Avoid strenuous activities",
                "Document symptoms to discuss with doctor",
                "Seek earlier care if symptoms worsen"
            ]),
            (4, 6, "HIGH"): ("URGENT", "Seek medical attention within hours", "high", [
                "Visit urgent care or emergency department",
                "Do not delay seeking care",
                "Bring someone with you if possible",
                "Prepare for possible tests"
            ]),
            (7, 10, "HIGH"): ("EMERGENCY", "Immediate emergency response required", "critical", [
                "Call ambulance (102/108) immediately",
                "Do not drive yourself",
                "Notify family members",
                "Have emergency contacts ready",
                "Keep doors accessible for responders"
            ]),
            (7, 10, "MEDIUM"): ("URGENT", "Urgent medical attention needed", "high", [
                "Seek emergency care immediately",
                "Do not wait for appointment",
                "Call ahead to ER to prepare",
                "Bring all medications list"
            ]),
            (7, 10, "LOW"): ("URGENT", "Urgent evaluation required", "high", [
                "Visit emergency department today",
                "Do not ignore warning signs",
                "Seek professional evaluation"
            ])
        }

    async def process(self, triage_score: int, risk_level: str, category: str, language: str = "english") -> Dict[str, Any]:
        logger.info(f"RecommendationAgent processing: score={triage_score}, risk={risk_level}, language={language}")

        # Fallback values
        key = self._find_best_match(triage_score, risk_level)
        action_type, fallback_rec, urgency, next_steps = self.action_lookup.get(key, self._default_recommendation())

        # Build prompt using the new template
        from app.utils.prompt_templates import RECOMMENDATION_PROMPT
        prompt = RECOMMENDATION_PROMPT.format(
            triage_score=triage_score,
            risk_level=risk_level,
            category=category,
            language=language
        )

        response = await self.service.generate(prompt)
        if response.get("success"):
            import json
            try:
                # Attempt to parse structured JSON from gemini output
                data = response["data"]
                if isinstance(data, str):
                    data = json.loads(data)
                
                return {
                    "recommendation": data.get("recommendation", fallback_rec),
                    "action_type": data.get("action_type", action_type),
                    "urgency": data.get("urgency", urgency),
                    "next_steps": data.get("next_steps", next_steps)
                }
            except Exception as e:
                logger.error(f"Failed to parse gemini recommendation: {e}")

        return {
            "recommendation": fallback_rec,
            "action_type": action_type,
            "urgency": urgency,
            "next_steps": next_steps
        }

    def _find_best_match(self, score: int, risk_level: str) -> tuple:
        for (min_score, max_score, level), value in self.action_lookup.items():
            if min_score <= score <= max_score and level == risk_level:
                return (min_score, max_score, level)

        for (min_score, max_score, level), value in self.action_lookup.items():
            if min_score <= score <= max_score:
                return (min_score, max_score, level)

        return (5, 5, "MEDIUM")

    def _default_recommendation(self) -> tuple:
        return ("DOCTOR", "Consult with a healthcare provider", "medium", [
            "Schedule an appointment with your doctor",
            "Discuss symptoms and concerns",
            "Follow medical advice"
        ])

recommendation_agent = RecommendationAgent()
