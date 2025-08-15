// server.js - Multiplayer Server für Strategiespiel
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Statische Dateien servieren (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Game State Management
class GameManager {
    constructor() {
        this.games = new Map();
        this.players = new Map(); // socketId -> playerInfo
    }

    createGame(gameData, hostSocketId) {
        const gameId = 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const game = {
            id: gameId,
            name: gameData.name,
            host: hostSocketId,
            hostName: gameData.hostName,
            players: [{
                socketId: hostSocketId,
                name: gameData.hostName,
                ready: false,
                id: Date.now()
            }],
            maxPlayers: gameData.maxPlayers,
            settings: gameData.settings || {
                mapSize: 30,
                gameMode: 'standard'
            },
            status: 'waiting', // waiting, playing, finished
            createdAt: new Date()
        };

        this.games.set(gameId, game);
        console.log(`✅ Spiel erstellt: ${game.name} (ID: ${gameId}) - Kartengröße: ${game.settings.mapSize}`);
        return game;
    }

    joinGame(gameId, playerData, socketId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Spiel nicht gefunden' };
        }

        if (game.players.length >= game.maxPlayers) {
            return { success: false, error: 'Spiel ist voll' };
        }

        if (game.status !== 'waiting') {
            return { success: false, error: 'Spiel läuft bereits' };
        }

        // Prüfe ob Spieler bereits im Spiel ist
        const existingPlayer = game.players.find(p => p.name === playerData.name);
        if (existingPlayer) {
            return { success: false, error: 'Name bereits vergeben' };
        }

        const player = {
            socketId: socketId,
            name: playerData.name,
            ready: false,
            id: Date.now() + Math.random()
        };

        game.players.push(player);
        console.log(`👤 ${playerData.name} ist Spiel ${game.name} beigetreten`);
        
        return { success: true, game: game };
    }

    leaveGame(socketId) {
        for (const [gameId, game] of this.games.entries()) {
            const playerIndex = game.players.findIndex(p => p.socketId === socketId);
            
            if (playerIndex !== -1) {
                const playerName = game.players[playerIndex].name;
                game.players.splice(playerIndex, 1);
                
                console.log(`👋 ${playerName} hat Spiel ${game.name} verlassen`);
                
                // Wenn Spiel leer ist, lösche es
                if (game.players.length === 0) {
                    this.games.delete(gameId);
                    console.log(`🗑️ Leeres Spiel gelöscht: ${game.name}`);
                    return { gameDeleted: true, gameId };
                }
                
                // Wenn Host verlassen hat, neuen Host bestimmen
                if (game.host === socketId && game.players.length > 0) {
                    game.host = game.players[0].socketId;
                    game.hostName = game.players[0].name;
                    console.log(`👑 Neuer Host: ${game.hostName}`);
                }
                
                return { gameId, game, playerLeft: playerName };
            }
        }
        return null;
    }

    togglePlayerReady(gameId, socketId) {
        const game = this.games.get(gameId);
        if (!game) return null;

        const player = game.players.find(p => p.socketId === socketId);
        if (!player) return null;

        player.ready = !player.ready;
        console.log(`${player.ready ? '✅' : '❌'} ${player.name} ist ${player.ready ? 'bereit' : 'nicht bereit'}`);
        
        return { game, player };
    }

    canStartGame(gameId, hostSocketId) {
        const game = this.games.get(gameId);
        if (!game) return false;

        const isHost = game.host === hostSocketId;
        const enoughPlayers = game.players.length >= 2;
        const allReady = game.players.every(p => p.ready);
        const isWaiting = game.status === 'waiting';

        return isHost && enoughPlayers && allReady && isWaiting;
    }

    startGame(gameId) {
        const game = this.games.get(gameId);
        if (!game) return null;

        game.status = 'playing';
        console.log(`🚀 Spiel gestartet: ${game.name}`);
        return game;
    }

    getPublicGames() {
        const publicGames = [];
        this.games.forEach(game => {
            if (game.status === 'waiting') {
                publicGames.push({
                    id: game.id,
                    name: game.name,
                    hostName: game.hostName,
                    playerCount: game.players.length,
                    maxPlayers: game.maxPlayers,
                    settings: game.settings,
                    status: game.status
                });
            }
        });
        return publicGames;
    }

    getGameBySocketId(socketId) {
        for (const game of this.games.values()) {
            if (game.players.find(p => p.socketId === socketId)) {
                return game;
            }
        }
        return null;
    }
}

const gameManager = new GameManager();

// Socket.io Event Handling
io.on('connection', (socket) => {
    console.log(`🔗 Neuer Client verbunden: ${socket.id}`);

    // Spieler registrieren (neu hinzugefügt)
    socket.on('register-player', (playerData) => {
        gameManager.players.set(socket.id, {
            name: playerData.name,
            socketId: socket.id,
            connectedAt: new Date()
        });
        
        console.log(`📝 Spieler registriert: ${playerData.name} (${socket.id})`);
        
        // Sende aktuelle Spiele-Liste
        socket.emit('games-list', gameManager.getPublicGames());
    });

    // Spiel erstellen
    socket.on('create-game', (gameData) => {
        try {
            const game = gameManager.createGame(gameData, socket.id);
            
            // Host tritt automatisch bei
            socket.join(game.id);
            
            // Bestätige Spielerstellung
            socket.emit('game-created', {
                success: true,
                game: game
            });

            // Informiere alle über neues Spiel
            socket.broadcast.emit('game-list-updated', gameManager.getPublicGames());
            
        } catch (error) {
            console.error('❌ Fehler beim Erstellen des Spiels:', error);
            socket.emit('game-created', {
                success: false,
                error: 'Fehler beim Erstellen des Spiels'
            });
        }
    });

    // Spiel beitreten
    socket.on('join-game', (data) => {
        try {
            const result = gameManager.joinGame(data.gameId, data.player, socket.id);
            
            if (result.success) {
                socket.join(data.gameId);
                
                // Bestätige Beitritt
                socket.emit('game-joined', {
                    success: true,
                    game: result.game
                });

                // Informiere alle Spieler im Spiel
                socket.to(data.gameId).emit('player-joined', {
                    player: result.game.players[result.game.players.length - 1],
                    game: result.game
                });

                // Update Spiele-Liste für alle
                io.emit('game-list-updated', gameManager.getPublicGames());
                
            } else {
                socket.emit('game-joined', {
                    success: false,
                    error: result.error
                });
            }
        } catch (error) {
            console.error('❌ Fehler beim Beitreten:', error);
            socket.emit('game-joined', {
                success: false,
                error: 'Fehler beim Beitreten'
            });
        }
    });

    // Spiel verlassen
    socket.on('leave-game', () => {
        const result = gameManager.leaveGame(socket.id);
        
        if (result) {
            socket.leave(result.gameId);
            
            if (result.gameDeleted) {
                // Spiel wurde gelöscht
                io.emit('game-list-updated', gameManager.getPublicGames());
            } else {
                // Informiere verbleibende Spieler
                socket.to(result.gameId).emit('player-left', {
                    playerName: result.playerLeft,
                    game: result.game
                });
                
                io.emit('game-list-updated', gameManager.getPublicGames());
            }
            
            socket.emit('game-left', { success: true });
        }
    });

    // Bereit-Status ändern
    socket.on('toggle-ready', (data) => {
        const result = gameManager.togglePlayerReady(data.gameId, socket.id);
        
        if (result) {
            // Informiere alle Spieler im Spiel
            io.to(data.gameId).emit('player-ready-changed', {
                player: result.player,
                game: result.game
            });
        }
    });

    // Spiel starten
    socket.on('start-game', (data) => {
        if (gameManager.canStartGame(data.gameId, socket.id)) {
            const game = gameManager.startGame(data.gameId);
            
            if (game) {
                // Informiere alle Spieler dass das Spiel startet
                io.to(data.gameId).emit('game-started', {
                    game: game,
                    message: 'Das Spiel wird gestartet!'
                });

                // Update Spiele-Liste (Spiel ist nicht mehr verfügbar)
                io.emit('game-list-updated', gameManager.getPublicGames());
                
                console.log(`🎮 Spiel gestartet: ${game.name} mit ${game.players.length} Spielern`);
            }
        } else {
            socket.emit('start-game-failed', {
                error: 'Spiel kann nicht gestartet werden'
            });
        }
    });

    // Spiel-Einstellungen aktualisieren
    socket.on('update-game-settings', (data) => {
        const game = gameManager.getGameBySocketId(socket.id);
        
        if (!game) {
            socket.emit('update-settings-failed', { error: 'Nicht in einem Spiel' });
            return;
        }
        
        // Prüfe ob Host
        if (game.host !== socket.id) {
            socket.emit('update-settings-failed', { error: 'Nur der Host kann Einstellungen ändern' });
            return;
        }
        
        // Update settings
        game.settings = { ...game.settings, ...data.settings };
        console.log(`⚙️ Spieleinstellungen geändert: ${game.name} - Neue Kartengröße: ${game.settings.mapSize}`);
        
        // Informiere alle Spieler im Spiel
        io.to(data.gameId).emit('game-settings-updated', {
            game: game
        });
        
        // Update Spiele-Liste
        io.emit('game-list-updated', gameManager.getPublicGames());
    });

    // Spiele-Liste anfordern
    socket.on('request-games-list', () => {
        socket.emit('games-list', gameManager.getPublicGames());
    });

    // Ping/Pong für Verbindungstest
    socket.on('ping', () => {
        socket.emit('pong');
    });

    // Verbindung getrennt
    socket.on('disconnect', () => {
        console.log(`🔌 Client getrennt: ${socket.id}`);
        
        // Spieler aus eventuellen Spielen entfernen
        const result = gameManager.leaveGame(socket.id);
        if (result) {
            if (result.gameDeleted) {
                io.emit('game-list-updated', gameManager.getPublicGames());
            } else if (result.game) {
                socket.to(result.gameId).emit('player-left', {
                    playerName: result.playerLeft,
                    game: result.game
                });
                io.emit('game-list-updated', gameManager.getPublicGames());
            }
        }
        
        // Spieler aus Liste entfernen
        gameManager.players.delete(socket.id);
    });
});

// API Endpoints für Statistiken (optional)
app.get('/api/stats', (req, res) => {
    res.json({
        connectedPlayers: gameManager.players.size,
        activeGames: gameManager.games.size,
        waitingGames: gameManager.getPublicGames().length,
        uptime: process.uptime()
    });
});

app.get('/api/games', (req, res) => {
    res.json(gameManager.getPublicGames());
});

// Haupt-Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server starten
server.listen(PORT, () => {
    console.log('🚀 ========================================');
    console.log(`🎮 Strategiespiel Server läuft auf Port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('🚀 ========================================');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('💤 Server wird heruntergefahren...');
    server.close(() => {
        console.log('✅ Server erfolgreich beendet');
        process.exit(0);
    });
});

// Error Handling
process.on('uncaughtException', (error) => {
    console.error('❌ Unbehandelter Fehler:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unbehandelte Promise Rejection:', reason);
});

// Regelmäßige Statistiken (alle 5 Minuten)
setInterval(() => {
    console.log(`📊 Status: ${gameManager.players.size} Spieler, ${gameManager.games.size} Spiele`);
}, 5 * 60 * 1000);