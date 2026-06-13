import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class MockDBService:
    def __init__(self):
        self.memory_store = {}
        self.conversations = []
        logger.info("MockDBService initialized")

    async def save_conversation(self, user_id: str, message: str, response: Dict, metadata: Optional[Dict] = None) -> bool:
        try:
            conversation_entry = {
                "id": f"conv_{len(self.conversations) + 1}",
                "user_id": user_id,
                "message": message,
                "response": response,
                "metadata": metadata or {},
                "timestamp": datetime.utcnow().isoformat()
            }
            self.conversations.append(conversation_entry)
            logger.info(f"Saved conversation for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving conversation: {str(e)}")
            return False

    async def get_conversations(self, user_id: str, limit: int = 10) -> List[Dict]:
        user_conversations = [c for c in self.conversations if c["user_id"] == user_id]
        return user_conversations[-limit:]

    async def save_memory(self, user_id: str, memory_type: str, data: Dict) -> bool:
        try:
            if user_id not in self.memory_store:
                self.memory_store[user_id] = {}
            if memory_type not in self.memory_store[user_id]:
                self.memory_store[user_id][memory_type] = []
            self.memory_store[user_id][memory_type].append({
                "data": data,
                "timestamp": datetime.utcnow().isoformat()
            })
            logger.info(f"Saved {memory_type} memory for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving memory: {str(e)}")
            return False

    async def get_memory(self, user_id: str, memory_type: Optional[str] = None) -> Any:
        if user_id not in self.memory_store:
            return None
        if memory_type:
            return self.memory_store[user_id].get(memory_type, [])
        return self.memory_store[user_id]

    async def search_memory(self, user_id: str, query: str) -> List[Dict]:
        results = []
        if user_id in self.memory_store:
            for memory_type, entries in self.memory_store[user_id].items():
                for entry in entries:
                    if query.lower() in str(entry["data"]).lower():
                        results.append(entry)
        return results

    async def save_symptom_log(self, user_id: str, symptoms: List[Dict], triage_result: Dict) -> bool:
        try:
            symptom_log = {
                "user_id": user_id,
                "symptoms": symptoms,
                "triage_result": triage_result,
                "logged_at": datetime.utcnow().isoformat()
            }
            await self.save_memory(user_id, "symptom_logs", symptom_log)
            return True
        except Exception as e:
            logger.error(f"Error saving symptom log: {str(e)}")
            return False

    async def get_patient_history(self, user_id: str) -> Dict:
        memories = await self.get_memory(user_id)
        symptom_logs = memories.get("symptom_logs", []) if memories else []
        return {
            "user_id": user_id,
            "total_consultations": len(self.conversations),
            "symptom_history": symptom_logs,
            "retrieved_at": datetime.utcnow().isoformat()
        }

db_service = MockDBService()
