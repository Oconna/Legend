// server.js - Multiplayer Server für Strategiespiel mit Turn-System
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
                id: Date.now(),
                selectedRace: null,
                raceConfirmed: false,
                gold: 100,
                units: [],
                cities: 0,
                castles: 0
            }],
            maxPlayers: gameData.maxPlayers,
            settings: gameData.settings || {
                mapSize: 30,
                gameMode: 'standard'
            },
            status: 'waiting', // waiting, race_selection, playing, finished
            createdAt: new Date(),
            
            // Turn-System Properties
            gamePhase: 'lobby', // lobby, race_selection, playing, finished
            turnOrder: [],
            currentTurnIndex: 0,
            turnNumber: 1,
            turnStartTime: null,
            turnTimeLimit: 120000, // 2 Minuten pro Zug
            gameStartTime: null
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
            id: Date.now() + Math.random(),
            selectedRace: null,
            raceConfirmed: false,
            gold: 100,
            units: [],
            cities: 0,
            castles: 0
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
                
                // Wenn Spiel läuft und Spieler am Zug war, nächsten Spieler aktivieren
                if (game.gamePhase === 'playing' && game.turnOrder.length > 0) {
                    this.handlePlayerLeaveInGame(game, playerName);
                }
                
                return { gameId, game, playerLeft: playerName };
            }
        }
        return null;
    }

    handlePlayerLeaveInGame(game, leftPlayerName) {
        // Entferne Spieler aus Turn-Order
        const leftPlayerIndex = game.turnOrder.findIndex(p => p.name === leftPlayerName);
        if (leftPlayerIndex !== -1) {
            game.turnOrder.splice(leftPlayerIndex, 1);
            
            // Adjustiere currentTurnIndex wenn nötig
            if (leftPlayerIndex <= game.currentTurnIndex) {
                game.currentTurnIndex = Math.max(0, game.currentTurnIndex - 1);
            }
            
            // Stelle sicher, dass currentTurnIndex gültig ist
            if (game.currentTurnIndex >= game.turnOrder.length) {
                game.currentTurnIndex = 0;
                game.turnNumber++;
            }
            
            console.log(`🔄 Turn-Order angepasst nach Spieler-Verlassen: ${game.turnOrder.map(p => p.name).join(', ')}`);
        }
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
        game.gamePhase = 'race_selection';
        game.gameStartTime = new Date();
        
        console.log(`🚀 Spiel gestartet: ${game.name} - Phase: Rassen-Auswahl`);
        return game;
    }

    // ========================================
    // RACE SELECTION SYSTEM
    // ========================================

    selectRace(gameId, socketId, raceId) {
        const game = this.games.get(gameId);
        if (!game) return { success: false, error: 'Spiel nicht gefunden' };

        if (game.gamePhase !== 'race_selection') {
            return { success: false, error: 'Rassen-Auswahl nicht aktiv' };
        }

        const player = game.players.find(p => p.socketId === socketId);
        if (!player) return { success: false, error: 'Spieler nicht gefunden' };

        // Prüfe ob Rasse bereits gewählt wurde
        const raceAlreadyTaken = game.players.find(p => p.selectedRace === raceId && p.socketId !== socketId);
        if (raceAlreadyTaken) {
            return { success: false, error: 'Rasse bereits gewählt' };
        }

        player.selectedRace = raceId;
        player.raceConfirmed = true;
        
        console.log(`🏛️ ${player.name} hat Rasse ${raceId} gewählt`);

        // Prüfe ob alle Spieler ihre Rasse gewählt haben
        const allRacesSelected = game.players.every(p => p.raceConfirmed);
        if (allRacesSelected) {
            this.initializeTurnOrder(game);
        }

        return { success: true, game, allRacesSelected };
    }

    // ========================================
    // TURN SYSTEM
    // ========================================

    initializeTurnOrder(game) {
        console.log(`🎲 Initialisiere Zug-Reihenfolge für Spiel: ${game.name}`);
        
        // Kopiere Spieler-Array und mische es zufällig
        game.turnOrder = [...game.players].sort(() => Math.random() - 0.5);
        game.currentTurnIndex = 0;
        game.turnNumber = 1;
        game.gamePhase = 'playing';
        game.turnStartTime = new Date();

        const turnOrderNames = game.turnOrder.map((p, index) => `${index + 1}. ${p.name}`).join(', ');
        console.log(`🔄 Zug-Reihenfolge festgelegt: ${turnOrderNames}`);
        console.log(`▶️ ${game.turnOrder[0].name} beginnt!`);

        return game;
    }

    getCurrentPlayer(game) {
        if (!game.turnOrder || game.turnOrder.length === 0) return null;
        return game.turnOrder[game.currentTurnIndex];
    }

    endTurn(gameId, socketId) {
        const game = this.games.get(gameId);
        if (!game) return { success: false, error: 'Spiel nicht gefunden' };

        if (game.gamePhase !== 'playing') {
            return { success: false, error: 'Spiel nicht aktiv' };
        }

        const currentPlayer = this.getCurrentPlayer(game);
        if (!currentPlayer || currentPlayer.socketId !== socketId) {
            return { success: false, error: 'Du bist nicht am Zug' };
        }

        // Nächster Spieler
        game.currentTurnIndex++;
        
        // Wenn alle Spieler dran waren, neue Runde
        if (game.currentTurnIndex >= game.turnOrder.length) {
            game.currentTurnIndex = 0;
            game.turnNumber++;
            console.log(`🔄 Neue Runde: ${game.turnNumber}`);
            
            // Hier können Runden-basierte Aktionen ausgeführt werden
            this.processNewRound(game);
        }

        game.turnStartTime = new Date();
        const newCurrentPlayer = this.getCurrentPlayer(game);
        
        console.log(`⏭️ ${currentPlayer.name} hat Zug beendet. ${newCurrentPlayer.name} ist jetzt dran.`);

        return { 
            success: true, 
            game, 
            previousPlayer: currentPlayer.name,
            currentPlayer: newCurrentPlayer.name,
            turnNumber: game.turnNumber 
        };
    }

    processNewRound(game) {
        console.log(`💰 Verarbeite neue Runde ${game.turnNumber} für Spiel ${game.name}`);
        
        // Gold-Einkommen für alle Spieler
        game.players.forEach(player => {
            const baseIncome = 10; // Basis-Einkommen
            const cityIncome = player.cities * 2; // 2 Gold pro Stadt
            const castleIncome = player.castles * 5; // 5 Gold pro Burg
            const totalIncome = baseIncome + cityIncome + castleIncome;
            
            player.gold += totalIncome;
            console.log(`💰 ${player.name} erhält ${totalIncome} Gold (Gesamt: ${player.gold})`);
        });
        
        // Hier können weitere Runden-Aktionen hinzugefügt werden:
        // - Einheiten heilen
        // - Status-Effekte verarbeiten
        // - Siegbedingungen prüfen
    }

    forceNextTurn(gameId) {
        const game = this.games.get(gameId);
        if (!game || game.gamePhase !== 'playing') return null;

        const currentPlayer = this.getCurrentPlayer(game);
        if (!currentPlayer) return null;

        console.log(`⏰ Zeit abgelaufen für ${currentPlayer.name}, erzwinge nächsten Zug`);
        
        return this.endTurn(gameId, currentPlayer.socketId);
    }

    getRemainingTurnTime(game) {
        if (!game.turnStartTime) return 0;
        
        const elapsed = Date.now() - game.turnStartTime.getTime();
        const remaining = Math.max(0, game.turnTimeLimit - elapsed);
        
        return Math.ceil(remaining / 1000); // Sekunden
    }

    // ========================================
    // EXISTING METHODS (unchanged)
    // ========================================

    updateGameSettings(gameId, newSettings, hostSocketId) {
        const game = this.games.get(gameId);
        if (!game) return null;
        
        if (game.host !== hostSocketId) return null;
        
        game.settings = { ...game.settings, ...newSettings };
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

// ========================================
// TURN TIMER SYSTEM
// ========================================

// Prüfe alle 5 Sekunden auf abgelaufene Züge
setInterval(() => {
    gameManager.games.forEach((game, gameId) => {
        if (game.gamePhase === 'playing' && game.turnStartTime) {
            const remainingTime = gameManager.getRemainingTurnTime(game);
            
            if (remainingTime <= 0) {
                const result = gameManager.forceNextTurn(gameId);
                if (result) {
                    // Benachrichtige alle Spieler über erzwungenen Zugwechsel
                    io.to(gameId).emit('turn-forced', {
                        message: `⏰ Zeit abgelaufen für ${result.previousPlayer}`,
                        currentPlayer: result.currentPlayer,
                        turnNumber: result.turnNumber,
                        game: result.game
                    });
                }
            }
        }
    });
}, 5000);

// Socket.io Event Handling
io.on('connection', (socket) => {
    console.log(`🔗 Neuer Client verbunden: ${socket.id}`);

    // ========================================
    // EXISTING LOBBY EVENTS
    // ========================================

    socket.on('register-player', (playerData) => {
        gameManager.players.set(socket.id, {
            name: playerData.name,
            socketId: socket.id,
            connectedAt: new Date()
        });
        
        console.log(`📝 Spieler registriert: ${playerData.name} (${socket.id})`);
        socket.emit('games-list', gameManager.getPublicGames());
    });

    socket.on('create-game', (gameData) => {
        try {
            const game = gameManager.createGame(gameData, socket.id);
            
            socket.join(game.id);
            
            socket.emit('game-created', {
                success: true,
                game: game
            });

            socket.broadcast.emit('game-list-updated', gameManager.getPublicGames());
            
        } catch (error) {
            console.error('❌ Fehler beim Erstellen des Spiels:', error);
            socket.emit('game-created', {
                success: false,
                error: 'Fehler beim Erstellen des Spiels'
            });
        }
    });

    socket.on('join-game', (data) => {
        try {
            const result = gameManager.joinGame(data.gameId, data.player, socket.id);
            
            if (result.success) {
                socket.join(data.gameId);
                
                socket.emit('game-joined', {
                    success: true,
                    game: result.game
                });

                socket.to(data.gameId).emit('player-joined', {
                    player: result.game.players[result.game.players.length - 1],
                    game: result.game
                });

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

    socket.on('leave-game', () => {
        const result = gameManager.leaveGame(socket.id);
        
        if (result) {
            socket.leave(result.gameId);
            
            if (result.gameDeleted) {
                io.emit('game-list-updated', gameManager.getPublicGames());
            } else {
                socket.to(result.gameId).emit('player-left', {
                    playerName: result.playerLeft,
                    game: result.game
                });
                
                io.emit('game-list-updated', gameManager.getPublicGames());
            }
            
            socket.emit('game-left', { success: true });
        }
    });

    socket.on('toggle-ready', (data) => {
        const result = gameManager.togglePlayerReady(data.gameId, socket.id);
        
        if (result) {
            io.to(data.gameId).emit('player-ready-changed', {
                player: result.player,
                game: result.game
            });
        }
    });

    socket.on('start-game', (data) => {
        if (gameManager.canStartGame(data.gameId, socket.id)) {
            const game = gameManager.startGame(data.gameId);
            
            if (game) {
                io.to(data.gameId).emit('game-started', {
                    game: game,
                    message: 'Das Spiel wird gestartet! Wählt eure Rassen.'
                });

                io.emit('game-list-updated', gameManager.getPublicGames());
                
                console.log(`🎮 Spiel gestartet: ${game.name} mit ${game.players.length} Spielern`);
            }
        } else {
            socket.emit('start-game-failed', {
                error: 'Spiel kann nicht gestartet werden'
            });
        }
    });

    // ========================================
    // NEW RACE SELECTION EVENTS
    // ========================================

    socket.on('select-race', (data) => {
        const result = gameManager.selectRace(data.gameId, socket.id, data.raceId);
        
        if (result.success) {
            // Benachrichtige alle Spieler über Rassen-Auswahl
            io.to(data.gameId).emit('race-selected', {
                playerName: result.game.players.find(p => p.socketId === socket.id).name,
                raceId: data.raceId,
                game: result.game
            });

            // Wenn alle Rassen gewählt wurden, starte das eigentliche Spiel
            if (result.allRacesSelected) {
                setTimeout(() => {
                    io.to(data.gameId).emit('all-races-selected', {
                        game: result.game,
                        turnOrder: result.game.turnOrder.map(p => p.name),
                        currentPlayer: result.game.turnOrder[0].name,
                        message: 'Alle Rassen gewählt! Das Spiel beginnt...'
                    });
                }, 1000);
            }
        } else {
            socket.emit('race-selection-failed', {
                error: result.error
            });
        }
    });

    // ========================================
    // NEW TURN SYSTEM EVENTS
    // ========================================

    socket.on('end-turn', (data) => {
        const result = gameManager.endTurn(data.gameId, socket.id);
        
        if (result.success) {
            io.to(data.gameId).emit('turn-ended', {
                previousPlayer: result.previousPlayer,
                currentPlayer: result.currentPlayer,
                turnNumber: result.turnNumber,
                game: result.game,
                message: `${result.previousPlayer} hat den Zug beendet. ${result.currentPlayer} ist dran.`
            });
        } else {
            socket.emit('end-turn-failed', {
                error: result.error
            });
        }
    });

    socket.on('get-turn-info', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (game && game.gamePhase === 'playing') {
            const currentPlayer = gameManager.getCurrentPlayer(game);
            const remainingTime = gameManager.getRemainingTurnTime(game);
            
            socket.emit('turn-info', {
                currentPlayer: currentPlayer ? currentPlayer.name : null,
                turnNumber: game.turnNumber,
                remainingTime: remainingTime,
                isMyTurn: currentPlayer && currentPlayer.socketId === socket.id
            });
        }
    });

    // ========================================
    // EXISTING EVENTS (unchanged)
    // ========================================

    socket.on('update-game-settings', (data) => {
        const game = gameManager.updateGameSettings(data.gameId, data.settings, socket.id);
        
        if (game) {
            io.to(data.gameId).emit('game-settings-updated', { game: game });
            io.emit('game-list-updated', gameManager.getPublicGames());
        } else {
            socket.emit('update-settings-failed', { error: 'Fehler beim Aktualisieren' });
        }
    });

    socket.on('request-games-list', () => {
        socket.emit('games-list', gameManager.getPublicGames());
    });

    socket.on('ping', () => {
        socket.emit('pong');
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client getrennt: ${socket.id}`);
        
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
        
        gameManager.players.delete(socket.id);
    });
});

// ========================================
// API ENDPOINTS
// ========================================

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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========================================
// SERVER START & ERROR HANDLING
// ========================================

server.listen(PORT, () => {
    console.log('🚀 ========================================');
    console.log(`🎮 Strategiespiel Server läuft auf Port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('🔄 Turn-System aktiviert');
    console.log('🚀 ========================================');
});

process.on('SIGTERM', () => {
    console.log('💤 Server wird heruntergefahren...');
    server.close(() => {
        console.log('✅ Server erfolgreich beendet');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Unbehandelter Fehler:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unbehandelte Promise Rejection:', reason);
});

setInterval(() => {
    console.log(`📊 Status: ${gameManager.players.size} Spieler, ${gameManager.games.size} Spiele`);
}, 5 * 60 * 1000);