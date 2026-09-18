from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.mistake import Mistake
from app.schemas.mistake import MistakeResponse

router = APIRouter(
    prefix="/mistakes",
    tags=["Mistakes"]
)


@router.post("/", response_model=MistakeResponse)
def create_mistake(
    submission_id: int,
    category: str,
    explanation: str | None = None,
    correction: str | None = None,
    db: Session = Depends(get_db)
):
    mistake = Mistake(
        submission_id=submission_id,
        category=category,
        explanation=explanation,
        correction=correction
    )

    db.add(mistake)
    db.commit()
    db.refresh(mistake)

    return mistake


@router.get("/", response_model=list[MistakeResponse])
def get_mistakes(db: Session = Depends(get_db)):
    return db.query(Mistake).all()


@router.get("/{mistake_id}", response_model=MistakeResponse)
def get_mistake(
    mistake_id: int,
    db: Session = Depends(get_db)
):
    mistake = (
        db.query(Mistake)
        .filter(Mistake.id == mistake_id)
        .first()
    )

    if not mistake:
        raise HTTPException(
            status_code=404,
            detail="Mistake not found"
        )

    return mistake