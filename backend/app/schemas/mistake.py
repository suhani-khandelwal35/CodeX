from pydantic import BaseModel


class MistakeResponse(BaseModel):
    id: int
    submission_id: int
    category: str
    explanation: str | None = None
    correction: str | None = None

    class Config:
        from_attributes = True