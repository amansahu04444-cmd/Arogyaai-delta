import logging
from typing import Dict, Any, Optional
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

class MemoryAgent:
    def __init__(self):
        self.db = db_service

    async def save_triage(self, user_id: str, input_text: str, triage_result: Dict, metadata: Optional[Dict] = None) -> bool:
        try:
            logger.info(f"MemoryAgent saving triage for user {user_id}")

            await self.db.save_conversation(
                user_id=user_id,
                message=input_text,
                response=triage_result,
                metadata=metadata or {}
            )

            symptoms = triage_result.get("symptoms_extracted", [])
            if symptoms:
                await self.db.save_symptom_log(user_id, symptoms, triage_result)

            return True
        except Exception as e:
            logger.error(f"Error saving triage memory: {str(e)}")
            return False

    async def load_history(self, user_id: str, limit: int = 10) -> Dict[str, Any]:
        try:
            logger.info(f"MemoryAgent loading history for user {user_id}")

            conversations = await self.db.get_conversations(user_id, limit)
            patient_history = await self.db.get_patient_history(user_id)

            return {
                "conversations": conversations,
                "patient_history": patient_history,
                "retrieved_at": conversations[0]["timestamp"] if conversations else None
            }
        except Exception as e:
            logger.error(f"Error loading history: {str(e)}")
            return {"conversations": [], "patient_history": {}, "error": str(e)}

    async def search(self, user_id: str, query: str) -> Dict[str, Any]:
        try:
            logger.info(f"MemoryAgent searching for user {user_id} with query: {query}")

            results = await self.db.search_memory(user_id, query)

            return {
                "results": results,
                "query": query,
                "count": len(results)
            }
        except Exception as e:
            logger.error(f"Error searching memory: {str(e)}")
            return {"results": [], "query": query, "error": str(e)}

    async def save_preference(self, user_id: str, preference_type: str, data: Dict) -> bool:
        try:
            return await self.db.save_memory(user_id, f"preference_{preference_type}", data)
        except Exception as e:
            logger.error(f"Error saving preference: {str(e)}")
            return False

memory_agent = MemoryAgent()
