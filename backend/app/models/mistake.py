from sqlalchemy import Column, Integer, String, Text, ForeignKey
from app.database import Base


class Mistake(Base):
    __tablename__ = "mistakes"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False)
    category = Column(String(100), nullable=False)
    explanation = Column(Text, nullable=True)
    correction = Column(Text, nullable=True)