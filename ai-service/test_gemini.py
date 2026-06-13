import asyncio
import sys
import os
import json

# Add the current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.gemini_service import GeminiService, gemini_service

async def test():
    print("Initializing GeminiService...")
    svc = GeminiService()
    print(f"API Key: {svc.api_key}")
    print(f"Mock Mode: {svc.mock_mode}")
    print("\nSetting default model to gemini-2.5-flash...")
    gemini_service.model_name = "gemini-2.5-flash"
    
    from app.engine.triage_engine import TriageEngine
    engine = TriageEngine()
    
    print("\nRunning triage for symptoms 'I have a high fever since 4 days and a severe headache'...")
    res = await engine.process("I have a high fever since 4 days and a severe headache")
    print("Result:", json.dumps(res, indent=2))



if __name__ == "__main__":
    asyncio.run(test())
