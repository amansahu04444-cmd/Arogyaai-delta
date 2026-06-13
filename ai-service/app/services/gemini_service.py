import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv

# ──────────────────────────────────────────────────────────────
# SDK: google-genai (current, recommended by Google)
# Do NOT mix with the deprecated google-generativeai package.
# ──────────────────────────────────────────────────────────────
try:
    from google import genai
except ImportError:
    import google.genai as genai

# Robust .env loading
def load_environment():
    search_paths = [
        os.getcwd(),
        os.path.dirname(os.path.abspath(__file__)),
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ]
    for path in search_paths:
        env_file = os.path.join(path, ".env")
        if os.path.exists(env_file):
            load_dotenv(env_file)
            return env_file
    return None

load_environment()
logger = logging.getLogger(__name__)

class GeminiService:
    # Requirement: Use gemini-2.5-flash for stable, verified responses
    DEFAULT_MODEL = "gemini-2.5-flash"

    def __init__(self, api_key: Optional[str] = None):
        # Requirement: Properly load .env key
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY") or "").strip()
        self.model_name = self.DEFAULT_MODEL
        self.client = None
        
        # Log masked key for debugging
        masked_key = f"{self.api_key[:6]}...{self.api_key[-4:]}" if len(self.api_key) > 10 else "(empty/short)"
        logger.info(f"GEMINI_API_KEY (masked): {masked_key}")
        
        # Requirement: mock_mode is False only when API key is valid
        if self.api_key and not self.api_key.startswith("your_"):
            try:
                self.client = genai.Client(api_key=self.api_key)
                self.mock_mode = False
                logger.info(f"✅ GeminiService initialized. Model: {self.model_name}, mock_mode: False")
            except Exception as e:
                logger.error(f"✗ Failed to initialize Gemini client: {e}")
                self.mock_mode = True
                logger.warning(f"Running in MOCK mode due to client init failure")
        else:
            self.mock_mode = True
            logger.warning("⚠️ No valid GEMINI_API_KEY found. Running in MOCK mode.")

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """Generate content from a prompt with strict debug logging."""
        # Requirement: Log input received
        logger.info(f"📡 INPUT RECEIVED: {prompt[:100]}...")
        
        try:
            full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

            if self.mock_mode or not self.client:
                logger.info("🤖 OUTPUT GENERATED FROM: MOCK SYSTEM")
                if "symptom timeline" in full_prompt.lower() or "clinical progression" in full_prompt.lower() or "arogyaai" in full_prompt.lower():
                    response_text = """==================================================
AI CLINICAL SUMMARY
==================================================
The patient initially reported mild fever and headache. Symptoms persisted for multiple days despite self-medication. Subsequently, chest pain was reported and classified as high risk. Clinical evaluation is recommended to rule out cardiovascular or infectious causes.

==================================================
DOCTOR CONSULTATION SUMMARY
==================================================
Chief Complaints:
- Fever
- Headache
- Chest Pain

Duration:
2-4 Days

Progression:
Symptoms progressed from mild fever to severe chest pain.

Risk Assessment:
High Risk

Recommended Action:
Urgent clinical evaluation."""
                    return {
                        "success": True,
                        "data": response_text,
                        "model": "gemini-mock"
                    }
                response_data = self._mock_response(full_prompt)
                return {
                    "success": True,
                    "data": json.dumps(response_data),
                    "model": "gemini-mock"
                }

            # Requirement: Clear log line for real API
            logger.info("🔥 GEMINI RESPONSE SOURCE: REAL GEMINI API")
            
            # Use asyncio.to_thread for synchronous SDK call
            response = await asyncio.to_thread(self._generate_content_sync, full_prompt)
            
            # Requirement: Print RAW Gemini response in terminal
            logger.info(f"📄 RAW GEMINI RESPONSE: {response}")
            
            # Requirement: Fix response parsing logic
            response_text = self._extract_response_text(response)
            
            # Requirement: Log output source
            logger.info("🤖 OUTPUT GENERATED FROM: GEMINI")
            
            return {
                "success": True,
                "data": response_text,
                "model": self.model_name
            }
        except Exception as e:
            error_type = type(e).__name__
            error_msg = str(e)
            logger.error(f"✗ Gemini generation error [{error_type}]: {error_msg}")
            
            # Detect specific error types for better diagnostics
            if "API_KEY" in error_msg.upper() or "401" in error_msg or "403" in error_msg or "PERMISSION" in error_msg.upper():
                logger.error("🔑 This appears to be an API KEY / AUTHENTICATION error. Check your GEMINI_API_KEY.")
            elif "QUOTA" in error_msg.upper() or "429" in error_msg or "RATE" in error_msg.upper():
                logger.error("📊 This appears to be a QUOTA / RATE LIMIT error.")
            elif "TIMEOUT" in error_msg.upper() or "DEADLINE" in error_msg.upper():
                logger.error("⏱️ This appears to be a TIMEOUT error. The model took too long.")
            
            return {
                "success": False,
                "error": f"[{error_type}] {error_msg}"
            }

    def _generate_content_sync(self, prompt: str) -> Any:
        # Requirement: contents must be a list: contents=[prompt]
        return self.client.models.generate_content(
            model=self.model_name,
            contents=[prompt],
        )

    def _extract_response_text(self, response: Any) -> str:
        """Requirement: Fix response parsing logic with specific fallbacks."""
        if not response:
            return ""
            
        # 1. Prefer response.text
        if hasattr(response, "text") and response.text:
            return response.text
            
        # 2. Fallback: response.candidates[0].content.parts[0].text
        try:
            if hasattr(response, "candidates") and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, "content") and hasattr(candidate.content, "parts") and candidate.content.parts:
                    part = candidate.content.parts[0]
                    if hasattr(part, "text") and part.text:
                        return part.text
        except Exception:
            pass
            
        # 3. Final fallback: str(response)
        return str(response)

    def _mock_response(self, prompt: str) -> Dict[str, Any]:
        return {
            "message": "Mock response (No API key)",
            "risk_level": "LOW",
            "triage_score": 1,
            "category": "General",
            "emergency": False,
            "symptoms_extracted": [],
            "confidence": 1.0
        }

    async def generate_text(self, prompt: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        return await self.generate(prompt, system_prompt)

    async def chat(self, messages: Any, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        if isinstance(messages, list):
            prompt = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in messages])
        else:
            prompt = str(messages)
        return await self.generate(prompt, system_prompt)

# Singleton instance
gemini_service = GeminiService()
