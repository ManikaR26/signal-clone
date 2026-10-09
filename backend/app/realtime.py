"""Single-process connection hub. Multiple tabs/devices per user are supported."""

import asyncio
from fastapi import WebSocket


class Hub:
    def __init__(self):
        self.clients: dict[int, dict[WebSocket, asyncio.Lock]] = {}

    def add(self, user_id, ws):
        self.clients.setdefault(user_id, {})[ws] = asyncio.Lock()

    def remove(self, user_id, ws):
        connections = self.clients.get(user_id, {})
        connections.pop(ws, None)
        if not connections:
            self.clients.pop(user_id, None)

    async def send(self, user_id, event):
        for ws, lock in list(self.clients.get(user_id, {}).items()):
            try:
                async with lock:
                    await ws.send_json(event)
            except Exception:
                self.remove(user_id, ws)

    async def broadcast(self, users, event):
        await asyncio.gather(*(self.send(uid, event) for uid in set(users)))


hub = Hub()
