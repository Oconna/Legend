// server.js – Express + Socket.io Server für Lobby, Rassenauswahl & Zugreihenfolge

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Static Files
// Stelle sicher, dass index.html, game.html, *.js, *.json erreichbar sind.
// Viele Deploys (Railway/Render) legen die Files im Projektroot ab.
// Wir serven daher **zuerst** das Projektroot. Optional zusätzlich /public.
app.use(express.static(__dirname, { extensions: ['html'] }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// races-data.json explizit (falls gebraucht)
app.get('/races-data.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'races-data.json'));
});

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Game Manager

class GameManager {
  constructor() {
    this.games = new Map();   // gameId -> game
    this.players = new Map(); // socketId -> { name, socketId }
  }

  createGame(gameData, hostSocketId) {
    const gameId = 'game_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const game = {
      id: gameId,
      name: gameData.name || 'Neues Spiel',
      host: hostSocketId,
      hostName: gameData.hostName,
      players: [
        this._newPlayer(gameData.hostName, hostSocketId)
      ],
      maxPlayers: Math.max(2, Math.min(8, parseInt(gameData.maxPlayers || 4, 10))),
      settings: {
        mapSize: Math.max(20, Math.min(100, parseInt(gameData.settings?.mapSize || 30, 10))),
        gameMode: gameData.settings?.gameMode || 'standard'
      },
      status: 'waiting',         // waiting | race_selection | playing | finished
      gamePhase: 'lobby',
      createdAt: new Date(),
      // Turn system
      turnOrder: [],
      currentTurnIndex: 0,
      turnNumber: 1,
      turnStartTime: null,
      turnTimeLimit: 120000,     // 2min
      gameStartTime: null
    };
    this.games.set(gameId, game);
    return game;
  }

  _newPlayer(name, socketId) {
    return {
      socketId,
      name,
      ready: false,
      id: Date.now() + Math.random(),
      selectedRace: null,
      raceConfirmed: false,
      gold: 100,
      units: [],
      cities: 0,
      castles: 0
    };
  }

  joinGame(gameId, playerData, socketId) {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Spiel nicht gefunden' };
    if (game.players.length >= game.maxPlayers) return { success: false, error: 'Spiel ist voll' };
    if (game.status !== 'waiting') return { success: false, error: 'Spiel läuft bereits' };

    if (game.players.find(p => p.name === playerData.name)) {
      return { success: false, error: 'Name bereits vergeben' };
    }

    const player = this._newPlayer(playerData.name, socketId);
    game.players.push(player);
    return { success: true, game };
  }

  leaveGame(socketId) {
    for (const [gameId, game] of this.games.entries()) {
      const idx = game.players.findIndex(p => p.socketId === socketId);
      if (idx === -1) continue;

      const player = game.players[idx];
      game.players.splice(idx, 1);

      // Host ersetzt?
      if (game.host === socketId && game.players.length > 0) {
        game.host = game.players[0].socketId;
        game.hostName = game.players[0].name;
      }

      // Turn-Order bereinigen, falls schon playing
      if (game.gamePhase === 'playing' && game.turnOrder.length > 0) {
        const tIdx = game.turnOrder.findIndex(p => p.socketId === socketId);
        if (tIdx !== -1) {
          game.turnOrder.splice(tIdx, 1);
          if (tIdx <= game.currentTurnIndex) {
            game.currentTurnIndex = Math.max(0, game.currentTurnIndex - 1);
          }
          if (game.currentTurnIndex >= game.turnOrder.length) {
            game.currentTurnIndex = 0;
            game.turnNumber += 1;
          }
        }
      }

      const deleted = game.players.length === 0;
      if (deleted) this.games.delete(gameId);

      return { gameId, game: deleted ? null : game, playerLeft: player.name, gameDeleted: deleted };
    }
    return null;
  }

  togglePlayerReady(gameId, socketId) {
    const game = this.games.get(gameId);
    if (!game) return null;
    const player = game.players.find(p => p.socketId === socketId);
    if (!player) return null;
    player.ready = !player.ready;
    return { game, player };
  }

  canStartGame(gameId, hostSocketId) {
    const game = this.games.get(gameId);
    if (!game) return false;
    const isHost = game.host === hostSocketId;
    const enough = game.players.length >= 2;
    const allReady = game.players.every(p => p.ready);
    return isHost && enough && allReady && game.status === 'waiting';
  }

  startGame(gameId) {
    const game = this.games.get(gameId);
    if (!game) return null;
    game.status = 'race_selection';
    game.gamePhase = 'race_selection';
    game.gameStartTime = new Date();
    return game;
  }

  // ---- Race Selection ----
  selectRace(gameId, socketId, raceId) {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Spiel nicht gefunden' };
    if (game.gamePhase !== 'race_selection') return { success: false, error: 'Rassen-Auswahl nicht aktiv' };

    const player = game.players.find(p => p.socketId === socketId);
    if (!player) return { success: false, error: 'Spieler nicht gefunden' };

    // Einzigartigkeit erzwingen
    if (game.players.some(p => p.selectedRace === raceId && p.socketId !== socketId)) {
      return { success: false, error: 'Rasse bereits gewählt' };
    }

    player.selectedRace = raceId;
    player.raceConfirmed = true;

    const allSelected = game.players.every(p => p.raceConfirmed && p.selectedRace);
    if (allSelected) this._initTurnOrder(game);

    return { success: true, game, allSelected };
  }

  _initTurnOrder(game) {
    game.turnOrder = [...game.players].sort(() => Math.random() - 0.5);
    game.currentTurnIndex = 0;
    game.turnNumber = 1;
    game.gamePhase = 'playing';
    game.status = 'playing';
    game.turnStartTime = new Date();
  }

  getCurrentPlayer(game) {
    if (!game.turnOrder.length) return null;
    return game.turnOrder[game.currentTurnIndex];
  }

  endTurn(gameId, socketId) {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Spiel nicht gefunden' };
    if (game.gamePhase !== 'playing') return { success: false, error: 'Spiel nicht aktiv' };

    const current = this.getCurrentPlayer(game);
    if (!current || current.socketId !== socketId) {
      return { success: false, error: 'Du bist nicht am Zug' };
    }

    // Nächster
    game.currentTurnIndex += 1;
    if (game.currentTurnIndex >= game.turnOrder.length) {
      game.currentTurnIndex = 0;
      game.turnNumber += 1;
      this._processNewRound(game);
    }

    game.turnStartTime = new Date();
    const next = this.getCurrentPlayer(game);

    return {
      success: true,
      game,
      previousPlayer: current.name,
      currentPlayer: next?.name,
      turnNumber: game.turnNumber
    };
  }

  _processNewRound(game) {
    // Einfaches Einkommen: Basis + Städte/Burgen
    game.players.forEach(p => {
      const base = 10;
      const city = (p.cities || 0) * 2;
      const castle = (p.castles || 0) * 5;
      p.gold += base + city + castle;
    });
  }

  forceNextTurn(gameId) {
    const game = this.games.get(gameId);
    if (!game || game.gamePhase !== 'playing') return null;
    const current = this.getCurrentPlayer(game);
    if (!current) return null;
    return this.endTurn(gameId, current.socketId);
  }

  getRemainingTurnTime(game) {
    if (!game.turnStartTime) return 0;
    const elapsed = Date.now() - game.turnStartTime.getTime();
    const remaining = Math.max(0, game.turnTimeLimit - elapsed);
    return Math.ceil(remaining / 1000);
  }

  updateGameSettings(gameId, newSettings, hostSocketId) {
    const game = this.games.get(gameId);
    if (!game) return null;
    if (game.host !== hostSocketId) return null;
    game.settings = { ...game.settings, ...newSettings };
    return game;
  }

  getPublicGames() {
    const list = [];
    this.games.forEach(g => {
      if (g.status === 'waiting') {
        list.push({
          id: g.id,
          name: g.name,
          hostName: g.hostName,
          playerCount: g.players.length,
          maxPlayers: g.maxPlayers,
          settings: g.settings,
          status: g.status
        });
      }
    });
    return list;
  }

  getGameBySocketId(socketId) {
    for (const g of this.games.values()) {
      if (g.players.find(p => p.socketId === socketId)) return g;
    }
    return null;
  }
}

const GM = new GameManager();

// ─────────────────────────────────────────────────────────────────────────────
// Turn-Timer Loop (alle 5s prüfen)
setInterval(() => {
  GM.games.forEach((game) => {
    if (game.gamePhase === 'playing' && game.turnStartTime) {
      const remaining = GM.getRemainingTurnTime(game);
      if (remaining <= 0) {
        const result = GM.forceNextTurn(game.id);
        if (result) {
          io.to(game.id).emit('turn-forced', {
            message: `⏰ Zeit abgelaufen für ${result.previousPlayer}`,
            currentPlayer: result.currentPlayer,
            turnNumber: result.turnNumber,
            game: result.game
          });
        }
      } else {
        io.to(game.id).emit('turn-info', {
          currentPlayer: GM.getCurrentPlayer(game)?.name,
          turnNumber: game.turnNumber,
          remainingTime: remaining
        });
      }
    }
  });
}, 5000);

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io

io.on('connection', (socket) => {
  console.log('🔗 Verbunden:', socket.id);

  // Lobby: öffentliche Liste
  socket.on('request-games-list', () => {
    socket.emit('games-list', GM.getPublicGames());
  });

  socket.on('create-game', (gameData) => {
    try {
      const game = GM.createGame(gameData, socket.id);
      socket.join(game.id);
      socket.emit('game-created', { success: true, game });
      socket.broadcast.emit('game-list-updated', GM.getPublicGames());
    } catch (e) {
      console.error(e);
      socket.emit('game-created', { success: false, error: 'Fehler beim Erstellen des Spiels' });
    }
  });

  socket.on('join-game', (data) => {
    try {
      const result = GM.joinGame(data.gameId, data.player, socket.id);
      if (result.success) {
        socket.join(data.gameId);
        socket.emit('game-joined', { success: true, game: result.game });
        socket.to(data.gameId).emit('player-joined', {
          player: result.game.players[result.game.players.length - 1],
          game: result.game
        });
        io.emit('game-list-updated', GM.getPublicGames());
      } else {
        socket.emit('game-joined', { success: false, error: result.error });
      }
    } catch (e) {
      console.error(e);
      socket.emit('game-joined', { success: false, error: 'Fehler beim Beitreten' });
    }
  });

  socket.on('leave-game', () => {
    const res = GM.leaveGame(socket.id);
    if (!res) return;
    socket.leave(res.gameId);
    if (res.gameDeleted) {
      io.emit('game-list-updated', GM.getPublicGames());
    } else {
      socket.to(res.gameId).emit('player-left', { playerName: res.playerLeft, game: res.game });
      io.emit('game-list-updated', GM.getPublicGames());
    }
    socket.emit('game-left', { success: true });
  });

  socket.on('toggle-ready', (data) => {
    const r = GM.togglePlayerReady(data.gameId, socket.id);
    if (r) {
      io.to(data.gameId).emit('player-ready-changed', { player: r.player, game: r.game });
    }
  });

  socket.on('start-game', (data) => {
    if (!GM.canStartGame(data.gameId, socket.id)) {
      socket.emit('start-game-failed', { error: 'Spiel kann nicht gestartet werden' });
      return;
    }
    const game = GM.startGame(data.gameId);
    io.to(data.gameId).emit('game-started', {
      game,
      message: 'Das Spiel wird gestartet! Wählt eure Rassen.'
    });
    io.emit('game-list-updated', GM.getPublicGames());
  });

  // ---- Race Selection ----
  socket.on('select-race', (data) => {
    const r = GM.selectRace(data.gameId, socket.id, data.raceId);
    if (!r.success) {
      socket.emit('race-selection-failed', { error: r.error });
      return;
    }
    const me = r.game.players.find(p => p.socketId === socket.id);
    io.to(data.gameId).emit('race-selected', {
      playerName: me?.name,
      raceId: data.raceId,
      game: r.game
    });

    if (r.allSelected) {
      setTimeout(() => {
        io.to(data.gameId).emit('all-races-selected', {
          game: r.game,
          turnOrder: r.game.turnOrder.map(p => p.name),
          currentPlayer: r.game.turnOrder[0]?.name,
          message: 'Alle Rassen gewählt! Das Spiel beginnt...'
        });
      }, 500);
    }
  });

  // ---- Turn System ----
  socket.on('end-turn', (data) => {
    const r = GM.endTurn(data.gameId, socket.id);
    if (!r.success) {
      socket.emit('end-turn-failed', { error: r.error });
      return;
    }
    io.to(data.gameId).emit('turn-ended', r);
  });

  // (Optional) Aktionen – hier nur als Durchreicher/Stub, deine Spiellogik kann später ergänzt werden
  socket.on('move-unit', (data) => {
    // TODO: Validate & update real game state
    io.to(data.gameId).emit('unit-moved', data);
  });

  socket.on('attack-unit', (data) => {
    // TODO: Kampfsystem integrieren
    io.to(data.gameId).emit('unit-attacked', { ...data, defenderDestroyed: false });
  });

  socket.on('buy-unit', (data) => {
    // TODO: Kaufen & platzieren
    io.to(data.gameId).emit('server-message', { type: 'info', message: 'Kauf-Logik noch nicht implementiert' });
  });

  socket.on('upgrade-unit', (data) => {
    // TODO: Upgrade durchführen
    io.to(data.gameId).emit('server-message', { type: 'info', message: 'Upgrade-Logik noch nicht implementiert' });
  });

  socket.on('get-turn-info', (data) => {
    const game = GM.games.get(data.gameId);
    if (!game) return;
    socket.emit('turn-info', {
      currentPlayer: GM.getCurrentPlayer(game)?.name,
      turnNumber: game.turnNumber,
      remainingTime: GM.getRemainingTurnTime(game)
    });
  });

  socket.on('get-game-state', (data) => {
    const game = GM.games.get(data.gameId);
    if (!game) return;
    socket.emit('game-settings-updated', { game });
  });

  socket.on('disconnect', () => {
    const res = GM.leaveGame(socket.id);
    if (!res) return;
    if (!res.gameDeleted) {
      io.to(res.gameId).emit('player-left', { playerName: res.playerLeft, game: res.game });
      io.emit('game-list-updated', GM.getPublicGames());
    } else {
      io.emit('game-list-updated', GM.getPublicGames());
    }
    console.log('🔌 Getrennt:', socket.id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});
