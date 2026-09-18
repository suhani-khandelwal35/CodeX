from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Pattern, Problem
from app.schemas.pattern import PatternResponse
from app.schemas.problem import ProblemResponse

router = APIRouter(prefix="/patterns", tags=["Patterns"])


@router.get("/", response_model=list[PatternResponse])
def get_patterns(db: Session = Depends(get_db)):
    return db.query(Pattern).order_by(Pattern.id).all()


@router.get("/{pattern_id}", response_model=PatternResponse)
def get_pattern(pattern_id: int, db: Session = Depends(get_db)):
    pattern = db.query(Pattern).filter(Pattern.id == pattern_id).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    return pattern


@router.get("/{pattern_id}/problems", response_model=list[ProblemResponse])
def get_pattern_problems(pattern_id: int, db: Session = Depends(get_db)):
    pattern = db.query(Pattern).filter(Pattern.id == pattern_id).first()

    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")

    return (
        db.query(Problem)
        .filter(Problem.pattern_id == pattern_id)
        .order_by(Problem.id)
        .all()
    )