from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from ..database import get_db
from ..models import Order as ModelOrder, OrderItem as ModelOrderItem, Menu as ModelMenu, Table as ModelTable
from ..schemas import OrderCreate, Order, OrderItem, StatusUpdate, SalesByTime, RealtimeSales, MenuSales
from ..database import SessionLocal
from ..websockets import notify_new_order, notify_order_update
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, extract
from sqlalchemy import extract
from typing import List
import random
import time
import asyncio

router = APIRouter()

# 支払い番号で注文を取得する関数
def get_order_by_payment_number(payment_number: str, db: Session):
    order = db.query(ModelOrder).options(
        joinedload(ModelOrder.order_items).joinedload(ModelOrderItem.menu)
    ).filter(ModelOrder.payment_number == payment_number).first()
    return order

async def cancel_order_if_unpaid(order_id: int):
    """15分後に注文が未払いであればキャンセルする"""
    await asyncio.sleep(15 * 60)
    db = SessionLocal()
    try:
        db_order = db.query(ModelOrder).filter(ModelOrder.id == order_id).first()
        if db_order and db_order.status == 'unpaid':
            db_order.status = 'cancelled'
            db.commit()
            db.refresh(db_order)
            print(f"Order {order_id} has been cancelled due to non-payment.")
            await notify_order_update(order_id, 'cancelled')
    finally:
        db.close()


@router.get("/", response_model=list[Order])
def get_orders(db: Session = Depends(get_db)):
    orders = db.query(ModelOrder).options(
        joinedload(ModelOrder.order_items).joinedload(ModelOrderItem.menu)
    ).all()
    for order in orders:
        order.order_items = order.order_items or []
    return orders

@router.get("/by_payment_number/{payment_number}", response_model=Order)
def get_order_by_payment_number_api(payment_number: str, db: Session = Depends(get_db)):
    order = get_order_by_payment_number(payment_number, db)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 15分以上経過していて未払いの場合
    if order.status == 'unpaid':
        if datetime.utcnow() - order.created_at > timedelta(minutes=15):
            order.status = 'cancelled'
            db.commit()
            db.refresh(order)
            # WebSocketでの通知も検討

    order.order_items = order.order_items or []
    return order

@router.get("/{table_id}", response_model=list[Order])
def get_orders_by_table(table_id: int, db: Session = Depends(get_db)):
    orders = db.query(ModelOrder).options(
        joinedload(ModelOrder.order_items).joinedload(ModelOrderItem.menu)
    ).filter(ModelOrder.table_id == table_id).all()
    for order in orders:
        order.order_items = order.order_items or []
    return orders

@router.post("/", response_model=Order)
async def create_order(order: OrderCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # テーブル存在確認 (オプション)
    if order.table_id:
        table = db.query(ModelTable).filter(ModelTable.id == order.table_id).first()
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
    
    # 合計価格計算 (N+1問題対策)
    menu_ids = [item.menu_id for item in order.order_items]
    unique_menu_ids = set(menu_ids)
    menus = db.query(ModelMenu).filter(ModelMenu.id.in_(unique_menu_ids)).all()
    menu_map = {menu.id: menu for menu in menus}

    found_ids = set(menu_map.keys())
    missing_ids = list(unique_menu_ids - found_ids)
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Menu items not found: {missing_ids}")

    total_price = sum(menu_map[item.menu_id].price * item.quantity for item in order.order_items)

    # 支払い番号生成
    timestamp = int(time.time() * 100)
    random_num = random.randint(100, 999)
    payment_number = f"{timestamp}-{random_num}"


    # 注文作成
    db_order = ModelOrder(
        table_id=order.table_id,
        total_price=total_price,
        payment_number=payment_number,
        status="unpaid"  # 初期ステータスをunpaidに
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # 注文アイテム追加
    for item in order.order_items:
        db_item = ModelOrderItem(order_id=db_order.id, menu_id=item.menu_id, quantity=item.quantity)
        db.add(db_item)
    db.commit()
    db.refresh(db_order)
    
    # 15分後にキャンセルするバックグラウンドタスクを追加
    background_tasks.add_task(cancel_order_if_unpaid, db_order.id)

    # メニュー情報を含む注文を再クエリ
    full_order = db.query(ModelOrder).options(
        joinedload(ModelOrder.order_items).joinedload(ModelOrderItem.menu)
    ).filter(ModelOrder.id == db_order.id).first()
    
await notify_order_update(db_order.id, is_new=True)
    
    return full_order

@router.patch("/{order_id}", response_model=Order)
async def update_order_status(order_id: int, status_update: StatusUpdate, db: Session = Depends(get_db)):
    order = db.query(ModelOrder).options(
        joinedload(ModelOrder.order_items).joinedload(ModelOrderItem.menu)
    ).filter(ModelOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    original_status = order.status
    order.status = status_update.status
    db.commit()
    db.refresh(order)
    order.order_items = order.order_items or []
# Notify based on status change
# （支払い済みになった注文は厨房では「新規注文」として扱う）
if original_status == 'unpaid' and order.status == 'pending':
    # newly paid -> treat as "new order" for the kitchen/front
    await notify_new_order(order.id, order.status)
else:
    # otherwise it's a normal status update
    # prefer passing the status so receivers can know the new state
    await notify_order_update(order.id, order.status)

    return order

@router.get("/sales/by-time", response_model=List[SalesByTime])
async def get_sales_by_time(
    start: str,
    end: str,
    db: Session = Depends(get_db)
):
    start_date = datetime.fromisoformat(start).date()
    end_date = datetime.fromisoformat(end).date()
    
    # 日本時間で開始日時と終了日時を設定（UTC+9）
    jst = timezone(timedelta(hours=9))
    start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=jst)
    end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=jst)
    
    # 完了した注文のみ集計
    sales_data = db.query(
        extract('hour', ModelOrder.created_at).label('hour'),
        func.sum(ModelOrder.total_price).label('total')
    ).filter(
        ModelOrder.status == 'completed',
        ModelOrder.created_at >= start_datetime,
        ModelOrder.created_at <= end_datetime
    ).group_by(
        extract('hour', ModelOrder.created_at)
    ).order_by('hour').all()
    
    result = []
    for hour, total in sales_data:
        time_slot = f"{int(hour):02d}:00 - {int(hour+1):02d}:00"
        result.append(SalesByTime(time_slot=time_slot, total=float(total or 0)))
    return result

@router.get("/sales/realtime", response_model=RealtimeSales)
async def get_realtime_sales(db: Session = Depends(get_db)):
    # 日本時間で現在時刻を取得（UTC+9）
    jst = timezone(timedelta(hours=9))
    now = datetime.now(jst)
    today_start = datetime.combine(now.date(), datetime.min.time()).replace(tzinfo=jst)
    tomorrow_start = today_start + timedelta(days=1)
    
    # 過去1時間と過去30分の基準時刻
    one_hour_ago = now - timedelta(hours=1)
    thirty_minutes_ago = now - timedelta(minutes=30)
    
    # 今日の総売上 (完了注文)
    daily_total = db.query(func.sum(ModelOrder.total_price)).filter(
        ModelOrder.status == 'completed',
        ModelOrder.created_at >= today_start,
        ModelOrder.created_at < tomorrow_start
    ).scalar() or 0.0
    
    # 過去1時間の売上
    past_hour_total = db.query(func.sum(ModelOrder.total_price)).filter(
        ModelOrder.status == 'completed',
        ModelOrder.created_at >= one_hour_ago,
        ModelOrder.created_at <= now
    ).scalar() or 0.0
    
    # 過去30分の売上
    past_30min_total = db.query(func.sum(ModelOrder.total_price)).filter(
        ModelOrder.status == 'completed',
        ModelOrder.created_at >= thirty_minutes_ago,
        ModelOrder.created_at <= now
    ).scalar() or 0.0
    
    # 今日の商品ごとの売上
    menu_sales_data = db.query(
        ModelOrderItem.menu_id,
        ModelMenu.name.label('menu_name'),
        func.sum(ModelOrderItem.quantity).label('quantity_sold'),
        func.sum(ModelOrderItem.quantity * ModelMenu.price).label('total_sales')
    ).join(ModelMenu, ModelOrderItem.menu_id == ModelMenu.id
    ).join(ModelOrder, ModelOrderItem.order_id == ModelOrder.id
    ).filter(
        ModelOrder.status == 'completed',
        ModelOrder.created_at >= today_start,
        ModelOrder.created_at < tomorrow_start
    ).group_by(
        ModelOrderItem.menu_id, ModelMenu.name, ModelMenu.price
    ).order_by(func.sum(ModelOrderItem.quantity * ModelMenu.price).desc()).all()
    
    menu_sales = []
    for item in menu_sales_data:
        menu_sales.append(MenuSales(
            menu_id=item.menu_id,
            menu_name=item.menu_name,
            quantity_sold=int(item.quantity_sold or 0),
            total_sales=float(item.total_sales or 0.0)
        ))
    
    return RealtimeSales(
        daily_total=daily_total,
        past_hour_total=past_hour_total,
        past_30min_total=past_30min_total,
        menu_sales=menu_sales
    )