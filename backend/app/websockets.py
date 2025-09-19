import json
from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Optional
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

async def notify_order_update(order_id: int, status: Optional[str] = None, is_new: bool = False):
    """
    Notifies clients about a new order or an order status update.
    - if is_new == True -> message["type"] == "new_order"
    - otherwise -> message["type"] == "update_order"
    - status が与えられれば message に含める（後方互換）
    """
    message = {
        "type": "new_order" if is_new else "update_order",
        "order_id": order_id,
    }
    if status is not None:
        message["status"] = status
    await manager.broadcast(json.dumps(message))


async def notify_new_order(order_id: int, status: Optional[str] = None):
    """後方互換ラッパー：既存の notify_new_order(order_id, status) 呼び出しをサポート"""
    await notify_order_update(order_id, status=status, is_new=True)


async def notify_menu_update():
    """Notifies clients that a menu item has been updated."""
    message = {"type": "menu_update"}
    await manager.broadcast(json.dumps(message))