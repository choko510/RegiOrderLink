from pydantic import BaseModel
from typing import List, Optional
from typing import List, Optional
from datetime import datetime

class TableBase(BaseModel):
    name: str
    status: Optional[str] = "available"

class TableCreate(TableBase):
    pass

class Table(TableBase):
    id: int

    class Config:
        from_attributes = True

class MenuBase(BaseModel):
    name: str
    price: float
    category: Optional[str] = "general"
    image_url: Optional[str] = None
    is_out_of_stock: bool = False

class MenuCreate(MenuBase):
    pass

class Menu(MenuBase):
    id: int

    class Config:
        from_attributes = True

class MenuUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    is_out_of_stock: Optional[bool] = None

class OrderItemBase(BaseModel):
    menu_id: int
    quantity: int = 1

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    order_id: int
    menu: Optional['Menu'] = None

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    table_id: Optional[int] = None
    order_items: List[OrderItemCreate]
    total_price: Optional[float] = 0.0

class OrderCreate(OrderBase):
    status: Optional[str] = "unpaid"

class Order(OrderBase):
    id: int
    payment_number: Optional[str] = None
    status: str = "pending"
    created_at: datetime
    order_items: List[OrderItem] = []

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: str

class SalesByTime(BaseModel):
    time_slot: str
    total: float

    class Config:
        from_attributes = True

class MenuSales(BaseModel):
    menu_id: int
    menu_name: str
    quantity_sold: int
    total_sales: float

    class Config:
        from_attributes = True

class RealtimeSales(BaseModel):
    daily_total: float = 0.0
    past_hour_total: float = 0.0
    past_30min_total: float = 0.0
    menu_sales: List['MenuSales'] = []

    class Config:
        from_attributes = True

OrderItem.model_rebuild()  # 循環参照のため