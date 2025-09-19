from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Menu as ModelMenu
from ..schemas import Menu, MenuCreate, MenuUpdate
from ..websockets import notify_menu_update

router = APIRouter()

@router.get("/", response_model=list[Menu])
def get_menus(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ModelMenu)
    if category:
        query = query.filter(ModelMenu.category == category)
    return query.all()

@router.get("/categories/", response_model=list[str])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(ModelMenu.category).distinct().all()
    return [cat[0] for cat in categories]

@router.post("/", response_model=Menu)
def create_menu(menu: MenuCreate, db: Session = Depends(get_db)):
    db_menu = ModelMenu(**menu.dict())
    db.add(db_menu)
    db.commit()
    db.refresh(db_menu)
    return db_menu

@router.patch("/{menu_id}", response_model=Menu)
async def update_menu(menu_id: int, menu_update: MenuUpdate, db: Session = Depends(get_db)):
    db_menu = db.query(ModelMenu).filter(ModelMenu.id == menu_id).first()
    if not db_menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    update_data = menu_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_menu, key, value)

    db.add(db_menu)
    db.commit()
    db.refresh(db_menu)

    # Notify clients about the update
    await notify_menu_update()

    return db_menu