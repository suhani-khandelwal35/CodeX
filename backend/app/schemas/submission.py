from datetime import datetime

from pydantic import BaseModel


class SubmissionCreate(BaseModel):
    user_id: int
    problem_id: int
    code: str | None = None
    language: str
    status: str
    is_correct: bool


class SubmissionResponse(BaseModel):
    id: int
    user_id: int
    problem_id: int
    code: str | None = None
    language: str
    status: str
    is_correct: bool
    submitted_at: datetime

    class Config:
        from_attributes = True