from pydantic import BaseModel


class PatternResponse(BaseModel):
    id: int
    name: str
    description: str | None = None

    class Config:
        from_attributes = True