import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class RedFlagEngine:
    def __init__(self):
        self.redflag_patterns = {
            "cardiac": {
                "keywords": ["chest pain", "sweating", "arm pain", "jaw pain", "shortness of breath", "palpitations"],
                "weight": 10,
                "action": "CALL_AMBULANCE"
            },
            "neurological": {
                "keywords": ["unconscious", "fainted", "confused", "slurred speech", "face drooping", "arm weakness", "FAST"],
                "weight": 10,
                "action": "CALL_AMBULANCE"
            },
            "trauma": {
                "keywords": ["severe bleeding", "gushing blood", " amputation", "penetrating wound", "open fracture"],
                "weight": 9,
                "action": "CALL_AMBULANCE"
            },
            "respiratory": {
                "keywords": ["choking", "cannot breathe", "blue lips", "severe asthma", "anaphylaxis"],
                "weight": 9,
                "action": "CALL_AMBULANCE"
            },
            "stroke": {
                "keywords": ["sudden numbness", "sudden confusion", "sudden trouble seeing", "sudden trouble walking", "sudden severe headache"],
                "weight": 10,
                "action": "CALL_AMBULANCE"
            },
            "gi_emergency": {
                "keywords": ["vomiting blood", "black stool", "severe abdominal pain", "rigid abdomen"],
                "weight": 8,
                "action": "SEEK_EMERGENCY_CARE"
            }
        }

    async def analyze(self, symptoms: List[Dict], duration: str = None, severity: str = None) -> Dict[str, Any]:
        logger.info("RedFlagEngine analyzing symptoms")

        detected_redflags = []
        highest_weight = 0
        top_action = "CONSULT_DOCTOR"
        top_category = None

        for category, pattern_data in self.redflag_patterns.items():
            for keyword in pattern_data["keywords"]:
                for symptom in symptoms:
                    symptom_name = symptom.get("name", "").lower()
                    if keyword.lower() in symptom_name or symptom_name in keyword.lower():
                        detected_redflags.append({
                            "keyword": keyword,
                            "category": category,
                            "symptom": symptom.get("name")
                        })
                        if pattern_data["weight"] > highest_weight:
                            highest_weight = pattern_data["weight"]
                            top_action = pattern_data["action"]
                            top_category = category

        if severity == "severe" and highest_weight < 8:
            highest_weight = min(10, highest_weight + 2)

        emergency = highest_weight >= 8
        risk_level = "HIGH" if emergency else ("MEDIUM" if highest_weight >= 5 else "LOW")
        urgency_score = highest_weight if highest_weight > 0 else 3

        result = {
            "emergency": emergency,
            "risk_level": risk_level,
            "redflags_detected": [rf["keyword"] for rf in detected_redflags],
            "action": top_action,
            "urgency_score": urgency_score
        }

        logger.info(f"RedFlag result: emergency={emergency}, risk={risk_level}, action={top_action}")
        return result

    def is_immediate_emergency(self, symptoms: List[Dict]) -> bool:
        for symptom in symptoms:
            symptom_name = symptom.get("name", "").lower()
            for category, pattern_data in self.redflag_patterns.items():
                if pattern_data["weight"] >= 9:
                    for keyword in pattern_data["keywords"]:
                        if keyword.lower() in symptom_name:
                            return True
        return False

redflag_engine = RedFlagEngine()
