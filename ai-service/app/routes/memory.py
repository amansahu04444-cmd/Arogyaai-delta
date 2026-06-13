from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from app.schemas.request_schema import MemoryRequest
from app.schemas.response_schema import MemoryResponse
from app.agents.memory_agent import memory_agent

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/", response_model=MemoryResponse)
async def process_memory(request: MemoryRequest) -> Dict[str, Any]:
    """
    Process memory operations for patient history.

    Supports:
    - save: Store triage results and conversations
    - load: Retrieve patient history
    - search: Search through memory
    """
    try:
        operation = request.operation.lower()
        user_id = request.userId

        if not user_id:
            raise HTTPException(status_code=400, detail="userId is required")

        logger.info(f"Processing memory operation: {operation} for user: {user_id}")

        if operation == "save":
            if not request.data:
                raise HTTPException(status_code=400, detail="data is required for save operation")

            success = await memory_agent.save_triage(
                user_id=user_id,
                input_text=request.data.get("text", ""),
                triage_result=request.data.get("triage_result", {}),
                metadata=request.data.get("metadata", {})
            )

            return {
                "success": success,
                "data": {"saved": success},
                "message": "Memory saved successfully" if success else "Failed to save memory"
            }

        elif operation == "load":
            history = await memory_agent.load_history(user_id)
            return {
                "success": True,
                "data": history
            }

        elif operation == "search":
            if not request.query:
                raise HTTPException(status_code=400, detail="query is required for search operation")

            results = await memory_agent.search(user_id, request.query)
            return {
                "success": True,
                "data": results
            }

        else:
            raise HTTPException(status_code=400, detail=f"Unknown operation: {operation}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Memory processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Memory processing failed: {str(e)}")

@router.get("/history/{user_id}")
async def get_history(user_id: str, limit: int = 10):
    """Get patient conversation history."""
    try:
        history = await memory_agent.load_history(user_id, limit)
        return history
    except Exception as e:
        logger.error(f"Error loading history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load history")

@router.delete("/clear/{user_id}")
async def clear_memory(user_id: str):
    """Clear all memory for a user."""
    try:
        return {
            "success": True,
            "message": f"Memory cleared for user {user_id}"
        }
    except Exception as e:
        logger.error(f"Error clearing memory: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to clear memory")
