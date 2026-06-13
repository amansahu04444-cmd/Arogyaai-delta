import logging
import json
import re
from typing import Dict, Any, List, Optional
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class TriageEngine:
    def __init__(self):
        pass

    async def process(self, normalized_text: str, duration: str = None, severity: str = None, language: str = "english") -> Dict[str, Any]:
        logger.info("TriageEngine processing via Dynamic Medical AI")

        system_prompt = """You are ArogyaAI, an AI-powered healthcare triage assistant.

IMPORTANT:
- Your job is NOT to diagnose diseases.
- Your job is to provide:
  1. Risk Assessment
  2. Home Care Guidance
  3. Doctor Visit Guidance
  4. Emergency Warning Signs
  5. Follow-up Question

RESPONSE RULES:
- Match user's language automatically:
  - Hinglish input -> Professional Hinglish output
  - English input -> Professional English output
- Never return a single paragraph.
- Never return short answers or generic answers.
- Recommendation must be detailed, structured, and use a professional healthcare tone.

OUTPUT FORMAT (STRICT JSON ONLY, NO MARKDOWN OR WRAPPER):
{{
  "risk_level": "LOW | MEDIUM | HIGH",
  "triage_score": number (1-10),
  "category": "contextual medical category based on symptoms",
  "recommendation": {{
    "summary": "Short patient-friendly summary matching the input language",
    "possible_causes": [
      "Possible cause 1 in matching language",
      "Possible cause 2 in matching language",
      "Possible cause 3 in matching language"
    ],
    "home_care": [
      "Detailed home care step 1 in matching language",
      "Detailed home care step 2 in matching language",
      "Detailed home care step 3 in matching language"
    ],
    "doctor_visit": [
      "When to see a doctor rule 1 in matching language",
      "When to see a doctor rule 2 in matching language",
      "When to see a doctor rule 3 in matching language"
    ],
    "warning_signs": [
      "Emergency warning sign 1 in matching language",
      "Emergency warning sign 2 in matching language",
      "Emergency warning sign 3 in matching language"
    ]
  }},
  "emergency": true/false,
  "follow_up_question": "Ask only one useful follow-up question in matching language",
  "symptoms_extracted": ["list of extracted symptoms"],
  "confidence": number (0-1)
}}

USER INPUT:
{text}"""

        prompt = normalized_text
        system_prompt = system_prompt.format(text=prompt)

        # Call Gemini
        try:
            response = await gemini_service.generate(prompt, system_prompt)
        except Exception as e:
            logger.error(f"Critical error calling GeminiService: {e}")
            return await self._fallback_triage(normalized_text)

        if response.get("success"):
            raw_data = response.get("data")
            parsed = self._parse_gemini_json(raw_data)
            
            # Ensure parsed is a dictionary and not None or other type
            if not isinstance(parsed, dict):
                logger.error(f"Failed to parse Gemini JSON response into dict. Type: {type(parsed)}")
                logger.error(f"Raw data: {raw_data}")
                return await self._fallback_triage(normalized_text)

            logger.info(f"Gemini triage complete: risk={parsed.get('risk_level')}, score={parsed.get('triage_score')}")
            
            rec = parsed.get("recommendation")
            if isinstance(rec, str):
                rec = {
                    "summary": rec,
                    "possible_causes": ["Unknown / pending further details"],
                    "home_care": ["Monitor symptoms closely"],
                    "doctor_visit": ["Consult doctor if symptoms persist or worsen"],
                    "warning_signs": ["Severe pain, high fever, or breathing difficulty"]
                }
            elif not isinstance(rec, dict):
                rec = {
                    "summary": "Assessment complete.",
                    "possible_causes": [],
                    "home_care": [],
                    "doctor_visit": [],
                    "warning_signs": []
                }
            else:
                rec = {
                    "summary": rec.get("summary", "Assessment complete."),
                    "possible_causes": rec.get("possible_causes", []),
                    "home_care": rec.get("home_care", []),
                    "doctor_visit": rec.get("doctor_visit", []),
                    "warning_signs": rec.get("warning_signs", [])
                }

            return {
                "risk_level": str(parsed.get("risk_level", parsed.get("risk", "MEDIUM"))).upper(),
                "triage_score": int(parsed.get("triage_score", parsed.get("score", 5))),
                "category": parsed.get("category", "General"),
                "recommendation": rec,
                "emergency": bool(parsed.get("emergency", False)),
                "follow_up_question": parsed.get("follow_up_question"),
                "symptoms_extracted": parsed.get("symptoms_extracted", []),
                "confidence": float(parsed.get("confidence", 0.85))
            }
        else:
            logger.error(f"Gemini API returned failure: {response.get('error')}")
            return await self._fallback_triage(normalized_text)

    def _parse_gemini_json(self, raw: str) -> Optional[Dict[str, Any]]:
        if not isinstance(raw, str):
            return None

        # Strip whitespace
        cleaned = raw.strip()

        # Strip markdown code fences: ```json ... ``` or ``` ... ```
        if cleaned.startswith("```"):
            # Remove opening fence (with optional language tag)
            first_newline = cleaned.find("\n")
            if first_newline != -1:
                cleaned = cleaned[first_newline + 1:]
            # Remove closing fence
            if cleaned.rstrip().endswith("```"):
                cleaned = cleaned.rstrip()[:-3].rstrip()

        # Direct parse
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Extract the first JSON object from the text body
        start = cleaned.find('{')
        end = cleaned.rfind('}')
        if start != -1 and end != -1 and end > start:
            candidate = cleaned[start:end+1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        # Replace simple single quotes if the response is nearly JSON-like
        safe_text = cleaned.replace("'", '"')
        try:
            return json.loads(safe_text)
        except json.JSONDecodeError:
            pass

        # Remove markdown or explanatory text surrounding JSON
        json_match = re.search(r'\{[^{}]*"message"[^{}]*\}', cleaned, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass

        return None

    async def _fallback_triage(self, text: str) -> Dict[str, Any]:
        """Fallback to rule-based triage when Gemini fails"""
        from app.agents.unified_triage_agent import unified_triage_agent
        result = unified_triage_agent.process(text)
        return {
            "risk_level": result.get("risk_level", "MEDIUM"),
            "triage_score": result.get("triage_score", 5),
            "category": result.get("category", "General"),
            "recommendation": result.get("recommendation", "Assessment complete."),
            "emergency": result.get("emergency", False),
            "follow_up_question": result.get("follow_up_question"),
            "symptoms_extracted": result.get("symptoms_extracted", []),
            "confidence": result.get("confidence", 0.85)
        }

    def _map_category(self, redflag_result: Dict) -> str:
        detected = redflag_result.get("redflags_detected", [])
        for category in ["cardiac", "neurological", "trauma", "respiratory", "stroke", "gi_emergency"]:
            for keyword in detected:
                if keyword in self._get_category_keywords(category):
                    return self._category_names().get(category, "Emergency")
        return "Medical Emergency"

    def _get_category_keywords(self, category: str) -> List[str]:
        return {
            "cardiac": ["chest pain", "sweating", "arm pain", "shortness of breath"],
            "neurological": ["unconscious", "fainted", "confused"],
            "trauma": ["severe bleeding"],
            "respiratory": ["choking", "cannot breathe"],
            "stroke": ["face drooping", "arm weakness", "sudden severe headache"]
        }.get(category, [])

    def _category_names(self) -> Dict[str, str]:
        return {
            "cardiac": "Cardiac Emergency",
            "neurological": "Neurological Emergency",
            "trauma": "Trauma Emergency",
            "respiratory": "Respiratory Emergency",
            "stroke": "Stroke Emergency",
            "gi_emergency": "GI Emergency"
        }

    def _get_emergency_recommendation(self, redflag_result: Dict) -> str:
        action = redflag_result.get("action", "CALL_AMBULANCE")
        recommendations = {
            "CALL_AMBULANCE": "EMERGENCY: Call ambulance (102/108) immediately. Do not delay.",
            "SEEK_EMERGENCY_CARE": "URGENT: Seek emergency medical care immediately.",
            "SEEK_HELP": "URGENT: Get help now. Call emergency services."
        }
        return recommendations.get(action, "EMERGENCY: Seek immediate medical attention.")

    def _generate_followup(self, symptoms: List[Dict], category: str) -> str:
        followup_questions = {
            "Cardiac Risk": "Are you experiencing any shortness of breath or pain radiating to your arm or jaw?",
            "Neurological Concerns": "Can you describe when these symptoms started? Are both arms and legs normal?",
            "Respiratory Issues": "Are you wheezing or making whistling sounds when breathing?",
            "Infectious Disease": "What is your current temperature? Have you had chills or body aches?",
            "Digestive Problems": "Have you noticed any changes in your stool or blood in vomit/stool?",
            "General Symptoms": "How long have you had these symptoms? Any other associated complaints?"
        }
        return followup_questions.get(category, "Can you describe your symptoms in more detail?")


triage_engine = TriageEngine()
