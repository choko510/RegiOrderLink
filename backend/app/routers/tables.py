from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Table as ModelTable
from ..schemas import Table, TableCreate

router = APIRouter()

@router.get("/", response_model=list[Table])
def get_tables(db: Session = Depends(get_db)):
    return db.query(ModelTable).all()

@router.post("/", response_model=Table)
def create_table(table: TableCreate, db: Session = Depends(get_db)):
    db_table = ModelTable(**table.dict())
    db.add(db_table)
    db.commit()
    db.refresh(db_table)
    return db_table