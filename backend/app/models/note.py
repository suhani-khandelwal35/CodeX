from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    problem_id = Column(Integer, ForeignKey("problems.id"), nullable=True)
    pattern_id = Column(Integer, ForeignKey("patterns.id"), nullable=True)

    content = Column(Text, nullable=False)
    source = Column(String(30), nullable=False, default="user")

    created_at = Column(DateTime, server_default=func.now())