from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import json

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

async def notify_new_order(order_id: int, status: str):
    """Notify all connected clients about a new order for the kitchen."""
    message = json.dumps({"type": "new_order", "order_id": order_id, "status": status})
    await manager.broadcast(message)

async def notify_order_update(order_id: int, status: str):
    """Notify all connected clients about an order status update."""
    message = json.dumps({"type": "update_order", "order_id": order_id, "status": status})
    await manager.broadcast(message)