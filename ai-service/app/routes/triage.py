from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from app.schemas.request_schema import TriageRequest
from app.schemas.response_schema import TriageResponse, ErrorResponse
from app.agents.input_agent import input_agent
from app.engine.triage_engine import triage_engine
from app.agents.memory_agent import memory_agent

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/", response_model=TriageResponse)
async def process_triage(request: TriageRequest) -> Dict[str, Any]:
    """
    Process health triage request.

    Takes symptom text input and returns structured triage assessment.
    Handles Hinglish input and detects emergencies via RedFlag Engine.
    """
    try:
        logger.info(f"Processing triage request for user: {request.userId}")

        input_result = await input_agent.process(request.text)

        triage_result = await triage_engine.process(
            normalized_text=input_result["normalized_text"],
            duration=None,
            severity=None,
            language=input_result["language_detected"]
        )

        await memory_agent.save_triage(
            user_id=request.userId or "anonymous",
            input_text=request.text,
            triage_result=triage_result,
            metadata={
                "language_detected": input_result["language_detected"],
                "processing_type": "triage"
            }
        )

        logger.info(f"Triage complete: risk={triage_result['risk_level']}, score={triage_result['triage_score']}")

        return {
            "risk_level": triage_result["risk_level"],
            "triage_score": triage_result["triage_score"],
            "category": triage_result["category"],
            "recommendation": triage_result["recommendation"],
            "emergency": triage_result["emergency"],
            "follow_up_question": triage_result.get("follow_up_question"),
            "symptoms_extracted": triage_result.get("symptoms_extracted"),
            "confidence": triage_result.get("confidence", 0.85)
        }

    except Exception as e:
        logger.exception("Triage processing critical failure")
        raise HTTPException(
            status_code=500, 
            detail={
                "message": "Triage processing failed",
                "error": str(e),
                "type": type(e).__name__
            }
        )

@router.get("/categories")
async def get_categories():
    """Get available triage categories."""
    return {
        "categories": [
            "Cardiac Risk",
            "Respiratory Issues",
            "Digestive Problems",
            "Neurological Concerns",
            "Musculoskeletal",
            "Skin Conditions",
            "Mental Health",
            "Infectious Disease",
            "General Symptoms",
            "Trauma/Injury"
        ]
    }

@router.get("/risk-levels")
async def get_risk_levels():
    """Get risk level definitions."""
    return {
        "risk_levels": {
            "LOW": {
                "score_range": "1-3",
                "description": "Manageable at home with self-care",
                "action": "HOME"
            },
            "MEDIUM": {
                "score_range": "4-6",
                "description": "Requires medical consultation",
                "action": "DOCTOR"
            },
            "HIGH": {
                "score_range": "7-10",
                "description": "Urgent or emergency care needed",
                "action": "EMERGENCY"
            }
        }
    }

@router.post("/analyze_timeline")
async def analyze_timeline(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze symptom timeline.
    Takes a list of daily symptom entries and returns a structured AI progression summary.
    """
    try:
        entries = request.get("entries", [])
        if not entries:
            return {
                "success": False,
                "summary": "No timeline entries provided to analyze."
            }
        
        # Sort entries by date chronologically
        try:
            sorted_entries = sorted(entries, key=lambda x: x.get("date", ""))
        except Exception:
            sorted_entries = entries

        # Group entries by calendar date
        from collections import OrderedDict
        date_groups = OrderedDict()
        for entry in sorted_entries:
            date_key = entry.get("date", "Unknown")
            if date_key not in date_groups:
                date_groups[date_key] = []
            date_groups[date_key].append(entry)

        formatted_timeline = ""
        for day_num, (date_key, day_entries) in enumerate(date_groups.items(), 1):
            # Format date for display
            try:
                from datetime import datetime
                d = datetime.strptime(date_key, "%Y-%m-%d")
                display_date = d.strftime("%d %b %Y")
            except Exception:
                display_date = date_key

            formatted_timeline += f"Day {day_num} ({display_date}):\n"
            for entry in day_entries:
                formatted_timeline += f"  - Symptoms: {entry.get('symptoms')}\n"
                formatted_timeline += f"  - Severity: {entry.get('severity')}\n"
                if entry.get('temperature'):
                    formatted_timeline += f"  - Temperature: {entry.get('temperature')}°F\n"
                if entry.get('risk_level'):
                    formatted_timeline += f"  - Risk Level: {entry.get('risk_level')}\n"
                if entry.get('notes'):
                    formatted_timeline += f"  - Notes: {entry.get('notes')}\n"
                formatted_timeline += "\n"

        system_prompt = """You are ArogyaAI, an advanced clinical AI assistant.
Your task is to analyze the patient's daily symptom timeline and generate a professional, doctor-ready progression summary.

You must output exactly two sections:

==================================================
AI CLINICAL SUMMARY
==================================================
[Provide a cohesive, professional medical summary paragraph. Use proper medical language. E.g. "The patient initially reported mild fever and headache. Symptoms persisted for multiple days despite self-medication. Subsequently, chest pain was reported and classified as high risk. Clinical evaluation is recommended to rule out cardiovascular or infectious causes."]

==================================================
DOCTOR CONSULTATION SUMMARY
==================================================
Chief Complaints:
- [List chief complaints]

Duration:
[Specify duration, e.g. "2-4 Days"]

Progression:
[Describe progression, e.g. "Symptoms progressed from mild fever to severe chest pain."]

Risk Assessment:
[Specify risk level, e.g. "High Risk"]

Recommended Action:
[Specify action, e.g. "Urgent clinical evaluation."]

Ensure the tone is professional, medical-grade, and concise. Do NOT use markdown bold/italics (like ** or *), emojis, or JSON formatting in the response.
"""

        prompt = f"Patient's Symptom Timeline:\n{formatted_timeline}"
        
        from app.services.gemini_service import gemini_service
        response = await gemini_service.generate(prompt, system_prompt)
        
        if response.get("success"):
            from app.utils.text_cleaner import clean_ai_text
            cleaned_summary = clean_ai_text(response.get("data", ""))
            return {
                "success": True,
                "summary": cleaned_summary
            }
        else:
            return {
                "success": False,
                "summary": "AI Service failed to generate summary.",
                "error": response.get("error")
            }
            
    except Exception as e:
        logger.exception("Timeline analysis failed")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Timeline analysis failed",
                "error": str(e)
            }
        )


def detect_tool_intent(message: str) -> str:
    msg_lower = message.lower()
    tool_patterns = {
        "generate_medical_pdf": ["generate pdf", "download report", "export report", "pdf"],
        "generate_doctor_summary": ["doctor summary", "clinical summary", "handover"],
        "get_timeline_data": ["timeline", "symptom history", "symptoms log"],
        "analyze_symptom_progression": ["risk progression", "health trend", "analyze my health", "what changed in my condition"],
        "get_medical_reports": ["reports", "lab reports", "test results"],
        "search_nearby_hospitals": ["hospitals", "nearby hospitals", "nearest hospital", "find hospital", "nearest hospitals"],
        "get_emergency_contacts": ["emergency", "contacts", "sos", "who to call"],
        "get_user_profile": ["profile", "patient details", "my info"],
        "get_qr_code_data": ["qr", "medical qr", "qr code"]
    }
    
    for tool_name, patterns in tool_patterns.items():
        if any(p in msg_lower for p in patterns):
            return tool_name
            
    return ""

def execute_tool_simulated(tool_name: str, context: dict) -> dict:
    if tool_name == "generate_medical_pdf":
        return {
            "status": "ready",
            "pdfUrl": "/api/timeline/pdf",
            "message": "Report has been successfully generated."
        }
    elif tool_name == "get_timeline_data":
        return {"timeline": context.get("timeline", [])}
    elif tool_name == "generate_doctor_summary":
        return {"doctorSummary": context.get("doctorSummary", {})}
    elif tool_name == "analyze_symptom_progression":
        return {"progression": "Symptom progression analysis based on timeline.", "timeline": context.get("timeline", [])}
    elif tool_name == "get_medical_reports":
        return {"reports": context.get("reports", [])}
    elif tool_name == "search_nearby_hospitals":
        return {"hospitals": context.get("hospitals", [])}
    elif tool_name == "get_emergency_contacts":
        return {"careCircle": context.get("careCircle", []), "emergencyAlerts": context.get("emergencyAlerts", [])}
    elif tool_name == "get_user_profile":
        return {"profile": context.get("medicalQr", {}).get("patient_info", {})}
    elif tool_name == "get_qr_code_data":
        return {"medicalQr": context.get("medicalQr", {})}
    
    return {}

@router.post("/copilot")
async def process_copilot(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Reason over the patient's context data to answer natural language questions.
    Uses intent detection and tool simulated pipeline.
    """
    import time
    import json
    req_id = f"cop-{int(time.time()*1000)}"
    
    try:
        message = request.get("message", "")
        context = request.get("context", {})
        
        timeline_count = len(context.get('timeline', []))
        reports_count = len(context.get('reports', []))
        hospitals_count = len(context.get('hospitals', []))
        care_circle_count = len(context.get('careCircle', []))
        
        logger.info(f"[{req_id}] ═══ COPILOT REQUEST ═══")
        logger.info(f"[{req_id}] Message: '{message[:100]}...'")
        logger.info(f"[{req_id}] Context keys: {list(context.keys())}")
        logger.info(f"[{req_id}] Timeline Count: {timeline_count}")
        logger.info(f"[{req_id}] Reports Count: {reports_count}")
        logger.info(f"[{req_id}] Hospitals Count: {hospitals_count}")
        logger.info(f"[{req_id}] Care Circle Count: {care_circle_count}")
        logger.info(f"[{req_id}] Has medical QR: {bool(context.get('medicalQr'))}")
        
        if not message:
            raise HTTPException(status_code=400, detail="message is required")
            
        # 1. Intent Router
        tool_intent = detect_tool_intent(message)
        logger.info(f"[{req_id}] Detected tool intent: {tool_intent}")
        
        # 2. Tool Execution
        tool_result = None
        if tool_intent:
            tool_result = execute_tool_simulated(tool_intent, context)
            
        # 3. Hospital Direct Mode
        if tool_intent == "search_nearby_hospitals" and hospitals_count > 0:
            hospitals = context.get("hospitals", [])
            h_str = "\\n".join([f"{i+1}. **{h.get('name')}**\\n   Address: {h.get('address', 'Nearby')}\\n   Rating: {h.get('rating', 'N/A')}\\n   Distance: {h.get('distance', 'N/A')} km" for i, h in enumerate(hospitals)])
            direct_response = f"Nearby Hospitals:\\n\\n{h_str}"
            logger.info(f"[{req_id}] ✅ Returning direct hospital lookup")
            return {
                "success": True,
                "answer": direct_response,
                "source": "tool_direct"
            }
            
        # 3b. PDF Direct Mode
        if tool_intent == "generate_medical_pdf":
            logger.info(f"[{req_id}] ✅ Returning direct PDF download link")
            return {
                "success": True,
                "type": "pdf_ready",
                "downloadUrl": "/api/timeline/pdf",
                "answer": "✅ Your medical report is ready for download.",
                "source": "tool_direct"
            }
            
        # Prepare context data
        medical_qr = context.get("medicalQr") or "No medical QR profile found."
        timeline = context.get("timeline") or "No daily symptom timeline recorded."
        doctor_summary = context.get("doctorSummary") or "No doctor clinical summary generated yet."
        reports = context.get("reports") or "No medical laboratory or diagnostic reports uploaded."
        hospitals = context.get("hospitals") or "No nearby hospitals data available."
        care_circle = context.get("careCircle") or "No care circle / family contacts connected."
        emergency_alerts = context.get("emergencyAlerts") or "No emergency alerts logs."

        system_prompt = f"""You are the ArogyaAI AI Health Copilot, an advanced clinical reasoning agent.
You have secure access to the patient's complete health dashboard data.
Your goal is to reason over this data and act as a professional clinical agent, not a generic chatbot.

Instructions:
1. Never claim data is unavailable if counts are > 0.
2. If tool results are provided, format them professionally for the patient. Do NOT expose raw JSON to the patient.
3. If user requests a medical report/PDF, the tool will provide a pdfUrl. You MUST return a message like: "Your medical report is ready. Download: [URL]".
4. Answer complex requests like "Analyze my health" or "Show risk progression" using the timeline and risk data.
5. Keep tone clinical, concise, and empathetic. Prioritize real patient records.

When timeline data is available, it may contain duplicate or natural language entries. Before analysis, you MUST:
- Normalize symptoms (e.g., "bukhar" -> Fever, "mujhe fever hai" -> Fever, "headche" -> Headache).
- Deduplicate symptoms.
- Group symptoms by date.

Then, you MUST:
1. Identify recurring symptoms.
2. Generate progression analysis.
3. Detect worsening or improving trends.
4. Generate a clinical summary.
5. Provide risk assessment.
6. Provide recommendations.

Return structured markdown:

# Clinical Summary
[Summary here]
# Timeline Analysis
[Progression analysis here]
# Symptom Trends
[Recurring and trending symptoms here]
# Risk Assessment
[Risk here]
# Recommendations
[Recommendations here]

Never answer with only a bullet list of timeline entries.

Current Database Status:
- Timeline Records: {timeline_count}
- Reports: {reports_count}
- Hospitals: {hospitals_count}
- Care Circle: {care_circle_count}
"""

        full_prompt = f"""USER QUESTION:
{message}

MEDICAL QR DATA:
{json.dumps(medical_qr, default=str)}

PATIENT PROFILE:
{json.dumps(context.get("medicalQr", {}).get("patient_info", {}), default=str)}

TIMELINE ENTRIES:
{json.dumps(timeline, default=str)}

MEDICAL REPORTS:
{json.dumps(reports, default=str)}

DOCTOR SUMMARY:
{json.dumps(doctor_summary, default=str)}

HOSPITALS:
{json.dumps(hospitals, default=str)}

CARE CIRCLE:
{json.dumps(care_circle, default=str)}

EMERGENCY DATA:
{json.dumps(emergency_alerts, default=str)}
"""

        if tool_result:
            full_prompt += f"\\n\\nTOOL EXECUTION RESULT ({tool_intent}):\\n{json.dumps(tool_result, default=str)}\\n\\nPlease format this tool output into a professional natural language response. Never show raw JSON."

        from app.services.gemini_service import gemini_service
        logger.info(f"[{req_id}] Calling Gemini API with full injected context...")
        
        start_time = time.time()
        response = await gemini_service.generate(full_prompt, system_prompt)
        elapsed = round((time.time() - start_time) * 1000)
        
        logger.info(f"[{req_id}] Gemini responded in {elapsed}ms")
        
        if response.get("success"):
            logger.info(f"[{req_id}] ✅ Returning Gemini answer")
            return {
                "success": True,
                "answer": response.get("data", ""),
                "source": "gemini"
            }
        else:
            # Phase 5: Fallback Engine
            logger.error(f"[{req_id}] ✗ Gemini failed or timed out: {response.get('error')}. Activating Fallback Engine.")
            
            # Use basic matching to return professional local fallback
            msg_lower = message.lower()
            fallback_answer = "The ArogyaAI Copilot is temporarily experiencing high load. "
            if "hospital" in msg_lower and hospitals_count > 0:
                h_str = "\\n".join([f"- **{h.get('name')}**" for h in context["hospitals"][:3]])
                fallback_answer += f"However, based on local cache, here are your nearest hospitals:\\n{h_str}"
            elif ("symptom" in msg_lower or "timeline" in msg_lower) and timeline_count > 0:
                fallback_answer += f"I can confirm you have {timeline_count} timeline entries safely logged in your history."
            elif "pdf" in msg_lower or "report" in msg_lower:
                if tool_result and "pdfUrl" in tool_result:
                    fallback_answer = f"Your medical report is ready for download: {tool_result['pdfUrl']}"
                else:
                    fallback_answer += f"I can confirm you have {reports_count} reports on file."
            elif "emergency" in msg_lower or "sos" in msg_lower:
                c_str = "\\n".join([f"- **{c.get('name')}**: {c.get('phone')}" for c in context.get("careCircle", [])])
                fallback_answer = f"Emergency Contacts:\\n{c_str}\\nIn an emergency, please dial 108."
            else:
                fallback_answer += "Please check back in a few minutes, your data is securely stored."

            return {
                "success": True,
                "answer": fallback_answer,
                "source": "fallback"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[{req_id}] AI Health Copilot processing failed")
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"AI Health Copilot processing failed: {str(e)}",
                "error": str(e)
            }
        )

