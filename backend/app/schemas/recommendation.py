from pydantic import BaseModel


class RecommendationResponse(BaseModel):
    problem_id: int
    title: str
    difficulty: str
    pattern: str
    reason: str
    priority: float