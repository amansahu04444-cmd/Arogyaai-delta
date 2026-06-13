import logging
import json
import re
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class UnifiedTriageAgent:
    """
    Rule-based triage agent that processes symptoms without requiring LLM.
    LLM enhancement can be enabled when API key is available.
    """

    # Symptom patterns with category, severity, and emergency flags
    SYMPTOM_PATTERNS = {
        # HIGH RISK / EMERGENCY symptoms
        "chest pain": {
            "category": "Cardiac Risk",
            "base_score": 8,
            "emergency": True,
            "keywords": ["chest pain", "chest dard", "seene me dard", "heart pain", "chest discomfort"]
        },
        "difficulty breathing": {
            "category": "Respiratory Issues",
            "base_score": 8,
            "emergency": True,
            "keywords": ["cannot breathe", "breathing difficulty", "saans nahi aa rahi", "shortness of breath", "wheezing", "chest tightness"]
        },
        "unconscious": {
            "category": "Neurological Concerns",
            "base_score": 10,
            "emergency": True,
            "keywords": ["unconscious", "fainted", "becool", "consciousness lost", "bewjoon"]
        },
        "severe bleeding": {
            "category": "Trauma/Injury",
            "base_score": 9,
            "emergency": True,
            "keywords": ["severe bleeding", "zyada blood", "heavy bleeding"]
        },
        "stroke symptoms": {
            "category": "Neurological Concerns",
            "base_score": 9,
            "emergency": True,
            "keywords": ["face drooping", "arm weakness", "sudden headache", "slurred speech", "face fall"]
        },
        "severe allergic": {
            "category": "General Symptoms",
            "base_score": 9,
            "emergency": True,
            "keywords": ["allergic reaction", "anaphylaxis", "throat swelling"]
        },

        # MEDIUM-HIGH symptoms
        "fever": {
            "category": "Infectious Disease",
            "base_score": 5,
            "emergency": False,
            "keywords": ["fever", "bukhar", "temperature", "febrile", "hot body", "bukhar hai", "taap"]
        },
        "cough": {
            "category": "Respiratory Issues",
            "base_score": 4,
            "emergency": False,
            "keywords": ["cough", "khansi", "khanki", "productive cough"]
        },
        "headache": {
            "category": "Neurological Concerns",
            "base_score": 4,
            "emergency": False,
            "keywords": ["headache", "sir dard", "sir dard hai", "migraine"]
        },
        "vomiting": {
            "category": "Digestive Problems",
            "base_score": 5,
            "emergency": False,
            "keywords": ["vomiting", "vomit", "ulta aana", "nausea", "chhaya"]
        },
        "diarrhea": {
            "category": "Digestive Problems",
            "base_score": 4,
            "emergency": False,
            "keywords": ["diarrhea", "loose motion", "dast", " watery stool"]
        },
        "body pain": {
            "category": "Musculoskeletal",
            "base_score": 3,
            "emergency": False,
            "keywords": ["body pain", "badan me dard", "body ache", "maaz dard", "weakness"]
        },
        "sore throat": {
            "category": "Respiratory Issues",
            "base_score": 3,
            "emergency": False,
            "keywords": ["sore throat", "gale me kharash", "throat pain", "gale ki soojh"]
        },
        "fatigue": {
            "category": "General Symptoms",
            "base_score": 2,
            "emergency": False,
            "keywords": ["fatigue", "tired", "thaka", "weakness", "kamzoori", "exhausted"]
        },
        "stomach pain": {
            "category": "Digestive Problems",
            "base_score": 5,
            "emergency": False,
            "keywords": ["stomach pain", "pet dard", "pet me dard", "abdominal pain"]
        },
        "skin rash": {
            "category": "Skin Conditions",
            "base_score": 3,
            "emergency": False,
            "keywords": ["rash", "skin rash", "chakkar", "allergy", "khujli"]
        },
        "joint pain": {
            "category": "Musculoskeletal",
            "base_score": 3,
            "emergency": False,
            "keywords": ["joint pain", "godi dard", "leg pain", "arm pain", "muscle pain"]
        },
        "dizziness": {
            "category": "Neurological Concerns",
            "base_score": 5,
            "emergency": False,
            "keywords": ["dizziness", "chakkar", "sick", "lightheaded", "郎晕"]
        }
    }

    SEVERITY_MODIFIERS = {
        "severe": 2,
        "awful": 2,
        "terrible": 2,
        "extreme": 2,
        "worst": 2,
        "badi": 2,
        "zyada": 1,
        "moderate": 0,
        "quite": 0,
        "pretty": 0,
        "thoda": 0,
        "mild": -1,
        "slight": -1,
        "light": -1,
        "kam": -1,
        "halka": -1,
        "little": -1
    }

    DURATION_MODIFIERS = {
        "hours": -1,
        "hour": -1,
        "day": 0,
        "days": 0,
        "week": 1,
        "weeks": 1,
        "month": 2,
        "months": 2
    }

    def __init__(self):
        logger.info("UnifiedTriageAgent initialized with rule-based triage")

    def process(self, text: str) -> Dict[str, Any]:
        """Process user input and return structured triage result."""
        logger.info(f"Processing triage for: {text[:100]}")

        text_lower = text.lower()

        # Extract symptoms
        symptoms_found = self._extract_symptoms(text_lower)

        # Determine severity
        severity = self._extract_severity(text_lower)

        # Extract duration
        duration = self._extract_duration(text_lower)

        # Calculate score
        triage_result = self._calculate_triage(symptoms_found, severity, duration)

        # Generate recommendation
        recommendation = self._generate_recommendation(triage_result, text_lower)

        # Generate follow-up question
        follow_up = self._generate_followup(triage_result, symptoms_found)

        result = {
            "risk_level": triage_result["risk_level"],
            "triage_score": triage_result["triage_score"],
            "category": triage_result["category"],
            "recommendation": recommendation,
            "emergency": triage_result["emergency"],
            "follow_up_question": follow_up,
            "symptoms_extracted": symptoms_found,
            "confidence": triage_result["confidence"]
        }

        logger.info(f"Triage result: {result['risk_level']} / Score: {result['triage_score']}")
        return result

    def _extract_symptoms(self, text: str) -> List[str]:
        """Extract all matching symptoms from input text."""
        found = []
        for symptom_name, config in self.SYMPTOM_PATTERNS.items():
            for keyword in config["keywords"]:
                if keyword in text:
                    if symptom_name not in found:
                        found.append(symptom_name)
                    break
        return found if found else ["general discomfort"]

    def _extract_severity(self, text: str) -> str:
        """Determine severity level from text."""
        if any(word in text for word in ["severe", "awful", "terrible", "extreme", "worst", "badi", "zyada"]):
            return "severe"
        if any(word in text for word in ["mild", "slight", "light", "kam", "halka", "little"]):
            return "mild"
        return "moderate"

    def _extract_duration(self, text: str) -> Optional[str]:
        """Extract duration from text."""
        patterns = [
            (r'(\d+)\s*hours?', 'hours'),
            (r'(\d+)\s*days?', 'days'),
            (r'(\d+)\s*weeks?', 'weeks'),
            (r'(\d+)\s*months?', 'months'),
            (r'just\s*now', 'immediate'),
            (r'since\s*yesterday', '1 day'),
        ]
        for pattern, duration in patterns:
            match = re.search(pattern, text)
            if match:
                num = match.group(1) if match.groups() else ""
                return f"{num} {duration}".strip() if num else duration
        return None

    def _calculate_triage(self, symptoms: List[str], severity: str, duration: Optional[str]) -> Dict[str, Any]:
        """Calculate triage score and risk level."""
        if not symptoms:
            return self._default_result()

        max_score = 0
        categories = []
        has_emergency = False
        confidence = 0.7

        for symptom in symptoms:
            if symptom in self.SYMPTOM_PATTERNS:
                config = self.SYMPTOM_PATTERNS[symptom]
                score = config["base_score"]
                categories.append(config["category"])
                if config["emergency"]:
                    has_emergency = True
                if score > max_score:
                    max_score = score

        # Apply severity modifier
        severity_mod = self.SEVERITY_MODIFIERS.get(severity, 0)
        max_score = min(10, max(1, max_score + severity_mod))

        # Apply duration modifier
        if duration:
            duration_lower = duration.lower()
            for dur_key, mod in self.DURATION_MODIFIERS.items():
                if dur_key in duration_lower:
                    max_score = min(10, max(1, max_score + mod))
                    break

        # Determine risk level
        if max_score >= 7 or has_emergency:
            risk_level = "HIGH"
            confidence = 0.9
        elif max_score >= 4:
            risk_level = "MEDIUM"
            confidence = 0.8
        else:
            risk_level = "LOW"
            confidence = 0.85

        # Category is the highest priority one found
        category = categories[0] if categories else "General Symptoms"

        return {
            "risk_level": risk_level,
            "triage_score": max_score,
            "category": category,
            "emergency": has_emergency,
            "confidence": confidence
        }

    def _default_result(self) -> Dict[str, Any]:
        return {
            "risk_level": "MEDIUM",
            "triage_score": 5,
            "category": "General Symptoms",
            "emergency": False,
            "confidence": 0.6
        }

    def _generate_recommendation(self, triage: Dict, text: str) -> Dict[str, Any]:
        """Generate detailed recommendation based on triage result."""
        score = triage["triage_score"]
        risk = triage["risk_level"]
        category = triage["category"]
        emergency = triage["emergency"]
        is_hinglish = any(word in text for word in ["mujhe", "hai", "ho raha", "mein", "aap", "kya"])

        if emergency or risk == "HIGH":
            if is_hinglish:
                return {
                    "summary": f"EMERGENCY: Aapki symptoms bahut serious hain! (Score: {score}/10 - {category})",
                    "possible_causes": ["Severe infection or acute health condition related to " + category],
                    "home_care": ["Self-care remedies are NOT advised. Rest quietly while waiting for medical help."],
                    "doctor_visit": [
                        "Turant doctor se contact karein ya ambulance (102/108) ko call karein.",
                        "Der se doctor ke paas jaana risk bada sakta hai."
                    ],
                    "warning_signs": [
                        "Saans lene mein takleef",
                        "Behoshi ya confusion",
                        "Bahut tez sir dard ya chest pain"
                    ]
                }
            return {
                "summary": f"EMERGENCY: Your symptoms are serious! (Score: {score}/10 - {category})",
                "possible_causes": ["Severe acute concern related to " + category],
                "home_care": ["Self-care is not appropriate. Please rest and wait for medical attention."],
                "doctor_visit": [
                    "Contact a doctor immediately or call emergency services (102/108).",
                    "This requires urgent medical evaluation."
                ],
                "warning_signs": [
                    "Difficulty breathing",
                    "Fainting or severe confusion",
                    "Sudden severe pain or chest pressure"
                ]
            }

        if risk == "MEDIUM":
            if is_hinglish:
                return {
                    "summary": f"Aapki symptoms {category} category me hain. Score: {score}/10 - Doctor consultation recommended.",
                    "possible_causes": ["Mild infection", "Seasonal issue", "Inflammatory response"],
                    "home_care": [
                        "Rest lein, hydrated rahein, aur light food khayein.",
                        "Body temperature monitor karein."
                    ],
                    "doctor_visit": [
                        "2-3 din me theek na hone par doctor se milna chahiye.",
                        "Agar symptoms badhein to doctor consult karein."
                    ],
                    "warning_signs": [
                        "Saans lene mein takleef",
                        "Bukhar ka lagatar badhna",
                        "Tez dard jo kam na ho"
                    ]
                }
            return {
                "summary": f"Your symptoms suggest potential {category}. Score: {score}/10 - Doctor visit recommended.",
                "possible_causes": ["Infection or viral syndrome", "Inflammation", "Sub-acute health issue"],
                "home_care": [
                    "Rest, stay hydrated, and eat light, nutritious food.",
                    "Monitor your temperature and key symptoms."
                ],
                "doctor_visit": [
                    "If symptoms persist beyond 2-3 days, see a doctor.",
                    "If symptoms worsen, consult a healthcare provider."
                ],
                "warning_signs": [
                    "Difficulty breathing",
                    "Persistent high temperature",
                    "Severe localized pain"
                ]
            }

        # LOW risk
        if is_hinglish:
            return {
                "summary": f"Aapki symptoms mild hain. Score: {score}/10 - Self-care at home.",
                "possible_causes": ["Seasonal fatigue", "Mild viral flu", "Minor stress or fatigue"],
                "home_care": [
                    "Proper rest lein, 7-8 ghante ki neend lein.",
                    "Paryapt paani piyen aur hydrated rahein.",
                    "Halka aur poshtik bhojan lein."
                ],
                "doctor_visit": [
                    "Agar 48 ghante me farak na pade to doctor consult karein.",
                    "Symptoms badhne par doctor se milein."
                ],
                "warning_signs": [
                    "Bukhar ka 102°F se upar jaana",
                    "Gardan me akdan ya tez dard",
                    "Saans lene me pareshani"
                ]
            }
        return {
            "summary": f"Your symptoms appear mild. Score: {score}/10 - Self-care at home.",
            "possible_causes": ["Seasonal changes", "Mild fatigue", "Minor viral syndrome"],
            "home_care": [
                "Get proper rest and aim for 7-8 hours of sleep.",
                "Drink plenty of water and stay hydrated.",
                "Eat a balanced diet."
            ],
            "doctor_visit": [
                "If no improvement in 48 hours, consult a doctor.",
                "If symptoms begin to worsen, seek medical attention."
            ],
            "warning_signs": [
                "Fever rising above 102°F",
                "Neck stiffness or severe headache",
                "Shortness of breath"
            ]
        }

    def _generate_followup(self, triage: Dict, symptoms: List[str]) -> str:
        """Generate a relevant follow-up question."""
        category = triage["category"]
        is_hinglish = True  # Default for Indian healthcare context

        questions = {
            "Cardiac Risk": "Kya aapko saans lene me bhi takleef hoti hai ya haath/kaan me dard failta hai?",
            "Respiratory Issues": "Kya aapko wheezing ya saans lete waqt cheent honi hai?",
            "Neurological Concerns": "Ye symptoms kab shuru hue? Kya aapke dono haath/paon normal hain?",
            "Infectious Disease": "Aapka temperature kitna hai? Kya aapko sardard ya Badan me dard bhi hai?",
            "Digestive Problems": "Kya aapne stool me khoon ya黑色的 ya dast me change dekha hai?",
            "Musculoskeletal": "Kya dard ek jagah hai ya poora shareer dard hai? Koi swelling hai?",
            "Skin Conditions": "Kya rash kheenchi hoti hai ya koi fluid nikal raha hai?",
            "General Symptoms": "Ye symptoms kitne din se hain? Koi aur naya symptom bhi hai?",
            "Trauma/Injury": "Kya koi injury ya accident hua tha? Blood flow kaisa hai?"
        }

        question = questions.get(category, "Aapki symptoms aur feel kaisi hai? Koi specific discomfort hai?")
        return question


# Export singleton
unified_triage_agent = UnifiedTriageAgent()
