from pydantic import BaseModel, Field
from typing import Optional, List, Any

class RecommendationDetail(BaseModel):
    summary: str = Field(..., description="Short patient-friendly summary")
    possible_causes: List[str] = Field(..., description="List of possible causes")
    home_care: List[str] = Field(..., description="List of home care guidance points")
    doctor_visit: List[str] = Field(..., description="List of doctor visit guidance points")
    warning_signs: List[str] = Field(..., description="List of emergency warning signs")

class TriageResponse(BaseModel):
    risk_level: str = Field(..., description="Risk level: LOW, MEDIUM, HIGH")
    triage_score: int = Field(..., ge=1, le=10, description="Triage score 1-10")
    category: str = Field(..., description="Health category")
    recommendation: RecommendationDetail = Field(..., description="Recommended action details")
    emergency: bool = Field(..., description="Whether emergency action needed")
    follow_up_question: Optional[str] = Field(None, description="Follow-up question for more info")
    symptoms_extracted: Optional[List[str]] = Field(None, description="Extracted symptoms")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence score")

class InputAgentResponse(BaseModel):
    normalized_text: str
    language_detected: str
    text_cleaned: str

class SymptomAgentResponse(BaseModel):
    symptoms: List[dict]
    duration: Optional[str]
    severity: Optional[str]
    text_analysis: dict

class RedFlagResponse(BaseModel):
    emergency: bool
    risk_level: str
    redflags_detected: List[str]
    action: str
    urgency_score: int

class TriageAgentResponse(BaseModel):
    triage_score: int
    risk_level: str
    category: str
    reasoning: str

class RecommendationResponse(BaseModel):
    recommendation: str
    action_type: str
    urgency: str
    next_steps: List[str]

class MemoryResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error: Optional[str] = None
