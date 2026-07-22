"""
Admin router — content management.
Endpoints:
  Media      : POST /upload/image  POST /upload/pdf
  PYQ struct : POST /exams  /years  /shifts
  Questions  : POST /questions  GET /questions/{id}  PUT /questions/{id}  DELETE /questions/{id}
               GET /questions?shift_id=&dpp_id=&module_id=&mock_test_id=
  Premium    : POST /premium/tracks|subjects|dpp-sets|dpps|test-sets|chapters|modules|mock-tests
               PATCH /premium/dpps/{id}   (edit title/duration/free)
               PATCH /premium/modules/{id}
               PATCH /premium/mock-tests/{id}
  Stats      : GET /stats
"""
import os, shutil, time
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.models.db import (
    get_db, User, Exam, Year, Shift, Question,
    PremiumExamTrack, PremiumSubject, DppSet, Dpp, TestSet, Chapter, Module, MockTest,
    NewsItem, ExamType, SubjectName, QuestionType, ContentFormat, Subscription, Attempt, SubscriptionStatus
)
from backend import schemas
from backend.auth import require_admin
from backend.storage import save_upload_sync

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Media upload ───────────────────────────────────────────────────────────────
@router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), admin: User = Depends(require_admin)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"):
        raise HTTPException(400, "Images only (jpg/png/webp/gif/svg).")
    data = await file.read()
    url, path = save_upload_sync(data, file.filename, file.content_type or "image/jpeg", "questions")
    return {"path": path, "url": url}

@router.post("/upload/pdf")
async def upload_pdf(file: UploadFile = File(...), admin: User = Depends(require_admin)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "PDF files only.")
    data = await file.read()
    url, path = save_upload_sync(data, file.filename, "application/pdf", "pdfs")
    return {"path": path, "url": url}


# ── PYQ structure ──────────────────────────────────────────────────────────────
@router.post("/exams")
def create_exam(type: str = Form(...), display_name: str = Form(...),
                admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(Exam).filter(Exam.type == type).first():
        raise HTTPException(400, "Exam type already exists.")
    e = Exam(type=ExamType(type), display_name=display_name)
    db.add(e); db.commit(); db.refresh(e)
    return {"id": e.id, "type": e.type, "display_name": e.display_name}

@router.post("/years")
def create_year(exam_id: int = Form(...), year: int = Form(...),
                admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    y = Year(exam_id=exam_id, year=year)
    db.add(y); db.commit(); db.refresh(y)
    return {"id": y.id, "year": y.year}

@router.post("/shifts")
def create_shift(year_id: int = Form(...), label: str = Form(...),
                 exam_date: Optional[str] = Form(None),
                 admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = Shift(year_id=year_id, label=label, exam_date=exam_date)
    db.add(s); db.commit(); db.refresh(s)
    return {"id": s.id, "label": s.label}


# ── Questions CRUD ─────────────────────────────────────────────────────────────
@router.post("/questions")
def create_question(payload: schemas.QuestionCreate,
                    admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    sources = [x for x in [payload.shift_id, payload.module_id, payload.dpp_id, payload.mock_test_id] if x]
    if len(sources) != 1:
        raise HTTPException(400, "Exactly one of shift_id / module_id / dpp_id / mock_test_id required.")
    q = Question(
        shift_id=payload.shift_id,
        dpp_id=payload.dpp_id,
        module_id=payload.module_id,
        mock_test_id=payload.mock_test_id,
        subject=payload.subject,
        question_type=payload.question_type,
        question_number=payload.question_number,
        question_format=payload.question_format,
        question_text=payload.question_text,
        question_image_path=payload.question_image_path,
        question_pdf_path=payload.question_pdf_path,
        option_a=payload.option_a,
        option_b=payload.option_b,
        option_c=payload.option_c,
        option_d=payload.option_d,
        option_a_image_path=payload.option_a_image_path,
        option_b_image_path=payload.option_b_image_path,
        option_c_image_path=payload.option_c_image_path,
        option_d_image_path=payload.option_d_image_path,
        options_image_path=payload.options_image_path,
        correct_answer=payload.correct_answer,
        marks_correct=payload.marks_correct,
        marks_incorrect=payload.marks_incorrect,
        solution_format=payload.solution_format,
        solution_text=payload.solution_text,
        solution_image_path=payload.solution_image_path,
        solution_pdf_path=payload.solution_pdf_path,
        topic=payload.topic,
    )
    
    db.add(q)
    db.commit()
    db.refresh(q)
    return {"id": q.id, "question_number": q.question_number}

@router.get("/questions", response_model=list[schemas.QuestionOut])
def list_questions(
    shift_id:     Optional[int] = Query(None),
    dpp_id:       Optional[int] = Query(None),
    module_id:    Optional[int] = Query(None),
    mock_test_id: Optional[int] = Query(None),
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    """Return all questions for a given container — used to populate the admin edit list."""
    q = db.query(Question)
    if shift_id:     q = q.filter(Question.shift_id     == shift_id)
    elif dpp_id:     q = q.filter(Question.dpp_id       == dpp_id)
    elif module_id:  q = q.filter(Question.module_id    == module_id)
    elif mock_test_id: q = q.filter(Question.mock_test_id == mock_test_id)
    else: raise HTTPException(400, "Provide one container id.")
    return q.order_by(Question.question_number).all()

@router.get("/questions/{question_id}", response_model=schemas.QuestionOut)
def get_question(question_id: int,
                 admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q: raise HTTPException(404, "Question not found.")
    return q

@router.put("/questions/{question_id}")
def update_question(question_id: int, payload: schemas.QuestionEdit,
                    admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q: raise HTTPException(404, "Question not found.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(q, k, v)
    db.commit()
    return {"id": q.id, "updated": True}

@router.delete("/questions/{question_id}")
def delete_question(question_id: int,
                    admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q: raise HTTPException(404, "Question not found.")
    db.delete(q); db.commit()
    return {"deleted": True}


# ── Premium structure creation ─────────────────────────────────────────────────
@router.post("/premium/tracks")
def create_track(name: str = Form(...), display_name: str = Form(...),
                 admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = PremiumExamTrack(name=name.upper(), display_name=display_name)
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id}

@router.post("/premium/subjects")
def create_subject(track_id: int = Form(...), name: str = Form(...), is_active: bool = Form(True),
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = PremiumSubject(track_id=track_id, name=SubjectName(name.upper()), is_active=is_active)
    db.add(s); db.commit(); db.refresh(s)
    return {"id": s.id}

@router.post("/premium/dpp-sets")
def create_dpp_set(subject_id: int = Form(...), name: str = Form(...),
                   questions_per_dpp: int = Form(15),
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ds = DppSet(subject_id=subject_id, name=name, questions_per_dpp=questions_per_dpp)
    db.add(ds); db.commit(); db.refresh(ds)
    return {"id": ds.id}

@router.post("/premium/dpps")
def create_dpp(dpp_set_id: int = Form(...), title: str = Form(...),
               chapter_name: Optional[str] = Form(None), order_index: int = Form(1),
               duration_minutes: int = Form(30), is_free_for_non_premium: bool = Form(False),
               admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    d = Dpp(dpp_set_id=dpp_set_id, title=title, chapter_name=chapter_name,
            order_index=order_index, duration_minutes=duration_minutes,
            is_free_for_non_premium=is_free_for_non_premium)
    db.add(d); db.commit(); db.refresh(d)
    return {"id": d.id}

@router.patch("/premium/dpps/{dpp_id}")
def edit_dpp(dpp_id: int, payload: schemas.DppEdit,
             admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Edit DPP title, duration, or free/premium toggle."""
    d = db.query(Dpp).filter(Dpp.id == dpp_id).first()
    if not d: raise HTTPException(404, "DPP not found.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit()
    return {"id": d.id, "updated": True}

@router.post("/premium/test-sets")
def create_test_set(subject_id: int = Form(...), name: str = Form(...),
                    admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ts = TestSet(subject_id=subject_id, name=name)
    db.add(ts); db.commit(); db.refresh(ts)
    return {"id": ts.id}

@router.post("/premium/chapters")
def create_chapter(test_set_id: int = Form(...), name: str = Form(...), order_index: int = Form(1),
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    ch = Chapter(test_set_id=test_set_id, name=name, order_index=order_index)
    db.add(ch); db.commit(); db.refresh(ch)
    return {"id": ch.id}

@router.post("/premium/modules")
def create_module(chapter_id: int = Form(...), name: str = Form(...),
                  order_index: int = Form(1), duration_minutes: int = Form(30),
                  is_free_for_non_premium: bool = Form(False),
                  admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    m = Module(chapter_id=chapter_id, name=name, order_index=order_index,
               duration_minutes=duration_minutes, is_free_for_non_premium=is_free_for_non_premium)
    db.add(m); db.commit(); db.refresh(m)
    return {"id": m.id}

@router.patch("/premium/modules/{module_id}")
def edit_module(module_id: int, payload: schemas.ModuleEdit,
                admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Edit module name, duration, or free/premium toggle."""
    m = db.query(Module).filter(Module.id == module_id).first()
    if not m: raise HTTPException(404, "Module not found.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    return {"id": m.id, "updated": True}

@router.post("/premium/mock-tests")
def create_mock_test(subject_id: int = Form(...), title: str = Form(...),
                     duration_minutes: int = Form(180), order_index: int = Form(1),
                     scheduled_date: Optional[str] = Form(None),
                     track_name: Optional[str] = Form(None),
                     is_free_for_non_premium: bool = Form(False),
                     admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    mt = MockTest(subject_id=subject_id, title=title, duration_minutes=duration_minutes,
                  order_index=order_index, scheduled_date=scheduled_date,
                  track_name=track_name, is_free_for_non_premium=is_free_for_non_premium)
    db.add(mt); db.commit(); db.refresh(mt)
    return {"id": mt.id}

@router.patch("/premium/mock-tests/{mock_id}")
def edit_mock_test(mock_id: int, payload: schemas.MockTestEdit,
                   admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Edit mock title, duration, scheduled date, or free/premium toggle."""
    m = db.query(MockTest).filter(MockTest.id == mock_id).first()
    if not m: raise HTTPException(404, "Mock test not found.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    return {"id": m.id, "updated": True}


# ── Stats ──────────────────────────────────────────────────────────────────────
@router.get("/stats")
def admin_stats(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from sqlalchemy import func
    from datetime import datetime as dt
    return {
        "total_users":    db.query(func.count(User.id)).scalar(),
        "active_premium": db.query(func.count(Subscription.id)).filter(
                              Subscription.status == SubscriptionStatus.ACTIVE,
                              Subscription.current_period_end >= dt.utcnow()).scalar(),
        "total_attempts": db.query(func.count(Attempt.id)).scalar(),
        "total_questions":db.query(func.count(Question.id)).scalar(),
    }