const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = process.env.PORT || 3000;

const players = new Map();

function randomColor() {
  const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#5c7cfa', '#ff9f1c', '#9b5de5'];
  return colors[Math.floor(Math.random() * colors.length)];
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, players: players.size });
});

wss.on('connection', (ws) => {
  const id = `player-${Math.random().toString(16).slice(2, 10)}`;
  const entry = {
    id,
    x: 0,
    z: 0,
    rot: 0,
    speed: 0,
    color: randomColor(),
  };

  players.set(id, entry);
  ws.send(JSON.stringify({ type: 'welcome', id }));

  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type !== 'state') return;

      const current = players.get(id);
      if (!current) return;

      players.set(id, {
        ...current,
        ...message.player,
        id,
      });
    } catch (error) {
      console.error('Invalid websocket payload:', error.message);
    }
  });

  ws.on('close', () => {
    players.delete(id);
  });
});

setInterval(() => {
  const snapshot = Array.from(players.values());
  const payload = JSON.stringify({ type: 'snapshot', players: snapshot });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}, 50);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
