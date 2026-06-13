from pydantic import BaseModel, Field
from typing import Optional, List

class TriageRequest(BaseModel):
    text: str = Field(..., min_length=2, max_length=2000, description="Patient symptom text (Hinglish supported)")
    userId: Optional[str] = Field(None, description="User identifier")
    language: Optional[str] = Field("hinglish", description="Input language (hinglish, english, hindi)")

class MemoryRequest(BaseModel):
    operation: str = Field(..., description="Operation: save, load, search")
    userId: str = Field(..., description="User identifier")
    data: Optional[dict] = Field(None, description="Data to save")
    query: Optional[str] = Field(None, description="Search query")

class InputAgentRequest(BaseModel):
    text: str

class SymptomAgentRequest(BaseModel):
    normalized_text: str

class TriageAgentRequest(BaseModel):
    symptoms: List[dict]
    duration: Optional[str]
    severity: Optional[str]

class RecommendationAgentRequest(BaseModel):
    triage_score: int
    risk_level: str
    category: str
