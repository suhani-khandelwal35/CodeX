from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.submission import Submission
from app.schemas.submission import SubmissionCreate, SubmissionResponse


router = APIRouter(
    prefix="/submissions",
    tags=["Submissions"]
)


@router.post("/", response_model=SubmissionResponse)
def create_submission(
    submission: SubmissionCreate,
    db: Session = Depends(get_db)
):
    new_submission = Submission(
        user_id=submission.user_id,
        problem_id=submission.problem_id,
        code=submission.code,
        language=submission.language,
        status=submission.status,
        is_correct=submission.is_correct,
    )

    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    return new_submission


@router.get("/", response_model=list[SubmissionResponse])
def get_submissions(db: Session = Depends(get_db)):
    return db.query(Submission).all()


@router.get("/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db)
):
    submission = (
        db.query(Submission)
        .filter(Submission.id == submission_id)
        .first()
    )

    if not submission:
        raise HTTPException(
            status_code=404,
            detail="Submission not found"
        )

    return submission