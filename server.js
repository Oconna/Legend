// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*'},
});

// --- Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien (liefert index.html, game.html, /js, /css, /socket.io usw.)
const STATIC_DIR = path.join(__dirname);
app.use(express.static(STATIC_DIR, {
  index: false, // wir routen "/" explizit auf index.html
  extensions: ['html'],
}));

// Root -> Lobby
app.get('/', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

// Spielfeld
app.get('/game.html', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'game.html'));
});

// races-data.json (falls vorhanden)
app.get('/races-data.json', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'races-data.json'));
});

// Healthcheck
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ---------------------------------------------------------------------------
// 💾 Minimale In‑Memory Lobby (kompatibel zu deinem index.html)
const games = new Map(); // gameId -> gameObj
const clients = new Map(); // socket.id -> { gameId?, name? }

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function publicGameInfo(game) {
  return {
    id: game.id,
    name: game.name,
    hostName: game.hostName,
    maxPlayers: game.maxPlayers,
    playerCount: game.players.length,
    settings: game.settings,
    status: game.status,
    players: game.players.map(p => ({ name: p.name, ready: p.ready })),
  };
}

io.on('connection', (socket) => {
  clients.set(socket.id, {});

  // Liste anfordern
  socket.on('request-games-list', () => {
    const list = Array.from(games.values()).map(publicGameInfo);
    socket.emit('games-list', list);
  });

  // Spiel erstellen
  socket.on('create-game', ({ name, hostName, maxPlayers, settings }) => {
    if (!name || !hostName) {
      return socket.emit('game-created', { success: false, error: 'Name/Host fehlen' });
    }
    const id = uid('game');
    const game = {
      id,
      name,
      hostName,
      maxPlayers: Math.max(2, Math.min(8, maxPlayers || 4)),
      settings: { mapSize: 30, gameMode: 'standard', ...(settings || {}) },
      status: 'waiting',
      players: [{ id: socket.id, name: hostName, ready: false }],
    };
    games.set(id, game);
    clients.get(socket.id).gameId = id;

    io.emit('game-list-updated', Array.from(games.values()).map(publicGameInfo));
    socket.emit('game-created', { success: true, game: publicGameInfo(game) });
  });

  // Spiel beitreten
  socket.on('join-game', ({ gameId, player }) => {
    const game = games.get(gameId);
    if (!game) return socket.emit('game-joined', { success: false, error: 'Spiel nicht gefunden' });
    if (game.players.length >= game.maxPlayers) return socket.emit('game-joined', { success: false, error: 'Spiel voll' });

    const name = player?.name?.trim();
    if (!name) return socket.emit('game-joined', { success: false, error: 'Spielername fehlt' });

    // Falls schon drin: update Name
    const already = game.players.find(p => p.id === socket.id);
    if (!already) {
      game.players.push({ id: socket.id, name, ready: false });
    } else {
      already.name = name;
    }
    clients.get(socket.id).gameId = gameId;

    const pub = publicGameInfo(game);
    socket.emit('game-joined', { success: true, game: pub });
    io.to(gameId).emit('player-joined', { player: { name }, game: pub });

    socket.join(gameId);
    io.emit('game-list-updated', Array.from(games.values()).map(publicGameInfo));
  });

  // Lobby: ready toggeln
  socket.on('toggle-ready', () => {
    const { gameId } = clients.get(socket.id) || {};
    const game = games.get(gameId);
    if (!game) return;

    const p = game.players.find(pl => pl.id === socket.id);
    if (!p) return;

    p.ready = !p.ready;
    const pub = publicGameInfo(game);
    io.to(gameId).emit('player-ready-changed', { player: { name: p.name, ready: p.ready }, game: pub });
  });

  // Host ändert Settings
  socket.on('update-game-settings', ({ gameId, settings }) => {
    const game = games.get(gameId);
    if (!game) return;
    if (game.hostName !== game.players.find(pl => pl.id === socket.id)?.name) return;

    game.settings = { ...game.settings, ...(settings || {}) };
    const pub = publicGameInfo(game);
    io.to(gameId).emit('game-settings-updated', { game: pub });
    io.emit('game-list-updated', Array.from(games.values()).map(publicGameInfo));
  });

  // Spiel starten
  socket.on('start-game', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) return socket.emit('start-game-failed', { error: 'Spiel nicht gefunden' });

    const host = game.players.find(p => p.id === socket.id);
    const allReady = game.players.length >= 2 && game.players.every(p => p.ready);
    if (!host || host.name !== game.hostName || !allReady) {
      return socket.emit('start-game-failed', { error: 'Bedingungen nicht erfüllt' });
    }

    game.status = 'running';
    const payload = {
      game: publicGameInfo(game),
    };
    io.to(gameId).emit('game-started', payload);
  });

  // Spiel verlassen
  socket.on('leave-game', () => {
    const client = clients.get(socket.id) || {};
    const game = games.get(client.gameId);
    if (!game) return socket.emit('game-left', { success: true });

    game.players = game.players.filter(p => p.id !== socket.id);
    const pub = publicGameInfo(game);
    io.to(game.id).emit('player-left', { playerName: socket.id, game: pub });

    if (game.players.length === 0) {
      games.delete(game.id);
    } else if (!game.players.some(p => p.name === game.hostName)) {
      // Host weg -> neuen Host setzen
      game.hostName = game.players[0].name;
    }

    socket.leave(game.id);
    clients.get(socket.id).gameId = null;

    io.emit('game-list-updated', Array.from(games.values()).map(publicGameInfo));
    socket.emit('game-left', { success: true });
  });

  socket.on('disconnect', () => {
    const client = clients.get(socket.id);
    if (client?.gameId) {
      const game = games.get(client.gameId);
      if (game) {
        game.players = game.players.filter(p => p.id !== socket.id);
        if (game.players.length === 0) {
          games.delete(game.id);
        } else if (!game.players.some(p => p.name === game.hostName)) {
          game.hostName = game.players[0].name;
        }
        io.emit('game-list-updated', Array.from(games.values()).map(publicGameInfo));
      }
    }
    clients.delete(socket.id);
  });
});

// Start
server.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});
