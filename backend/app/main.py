from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models import Table, Menu, Order, OrderItem
from .routers import tables, menus, orders
from fastapi.middleware.cors import CORSMiddleware
from .websockets import manager
from fastapi import WebSocket, WebSocketDisconnect
import os
from fastapi.staticfiles import StaticFiles

# テーブル作成
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Order System API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番では制限
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 依存性
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.send_personal_message(f"You wrote: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ルーターのインクルード
app.include_router(tables.router, prefix="/tables", tags=["tables"])
app.include_router(menus.router, prefix="/menus", tags=["menus"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# テストデータ挿入 (開発用)
@app.post("/init-data")
def init_data(db: Session = Depends(get_db)):
    # テーブル追加
    tables_data = [
        {"name": "テーブル1"}, {"name": "テーブル2"}, {"name": "テーブル3"}
    ]
    for t in tables_data:
        db.add(Table(**t))
    db.commit()

    # メニュー追加
    menus_data = [
        {"name": "ハンバーガー", "price": 500, "category": "メイン"},
        {"name": "ピザ", "price": 800, "category": "メイン"}
    ]
    for m in menus_data:
        db.add(Menu(**m))
    db.commit()

    return {"message": "テストデータ挿入完了"}

@app.on_event("startup")
async def startup_event():
    db = SessionLocal()
    try:
        # テーブルデータが存在しない場合のみ追加
        if db.query(Table).first() is None:
            tables_data = [{"name": f"テーブル{i+1}"} for i in range(3)]
            for t in tables_data:
                db.add(Table(**t))
            db.commit()
            print("テーブルのテストデータ挿入完了")

        # メニューデータが存在しない場合のみ追加
        if db.query(Menu).first() is None:
            menus_data = [
                {"name": "ミートコロッケ", "price": 200, "category": "フード"},
                {"name": "カレーコロッケ", "price": 200, "category": "フード"},
                {"name": "お茶", "price": 150, "category": "ドリンク"},
            ]
            for m in menus_data:
                db.add(Menu(**m))
            db.commit()
            print("メニューのテストデータ挿入完了")
    finally:
        db.close()

# 静的ファイルのマウント (他のすべてのルートの後に配置)
backend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(backend_dir, "..", ".."))
frontend_path = os.path.join(project_root, "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")