from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(String, default="available")  # available, occupied

class Menu(Base):
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Float)
    category = Column(String, default="general")
    image_url = Column(String, nullable=True)

    order_items = relationship("OrderItem", back_populates="menu")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String, unique=True, index=True, nullable=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    total_price = Column(Float)
    status = Column(String, default="pending")  # unpaid, pending, preparing, ready, completed, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)

    table = relationship("Table")
    order_items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    menu_id = Column(Integer, ForeignKey("menus.id"))
    quantity = Column(Integer, default=1)

    order = relationship("Order", back_populates="order_items")
    menu = relationship("Menu", back_populates="order_items")