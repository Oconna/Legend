// server.js - Korrigierte Multiplayer Server für Strategiespiel
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const ServerMapGenerator = require('./ServerMapGenerator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// ENHANCED GAME MANAGER
// ========================================

class EnhancedGameManager {
    constructor() {
        this.games = new Map();
        this.players = new Map();
        this.turnTimers = new Map();
        this.mapGenerator = new ServerMapGenerator();
        
        this.config = {
            TURN_TIME_LIMIT: 120,
            MIN_PLAYERS: 2,
            MAX_PLAYERS: 8,
            DEFAULT_STARTING_GOLD: 100,
            GOLD_INCOME_MULTIPLIER: 1.0
        };
        
        console.log('🎮 Enhanced Game Manager initialisiert');
    }

    // ========================================
    // SPIELERSTELLUNG UND -VERWALTUNG
    // ========================================

    createGame(gameData) {
        const gameId = this.generateGameId();
        const game = {
            id: gameId,
            name: gameData.name || `Spiel ${gameId}`,
            status: 'waiting',
            gamePhase: 'lobby',
            players: [],
            maxPlayers: Math.min(Math.max(gameData.maxPlayers || 4, this.config.MIN_PLAYERS), this.config.MAX_PLAYERS),
            settings: {
                mapSize: Math.min(Math.max(gameData.mapSize || 20, 10), 50),
                turnTimeLimit: gameData.turnTimeLimit || this.config.TURN_TIME_LIMIT,
                isPrivate: gameData.isPrivate || false
            },
            map: null,
            turnOrder: [],
            currentTurnIndex: 0,
            turnNumber: 1,
            createdAt: new Date(),
            startedAt: null,
            endedAt: null,
            winner: null
        };

        this.games.set(gameId, game);
        console.log(`🎮 Neues Spiel erstellt: ${game.name} (ID: ${gameId})`);
        
        return { success: true, game: game };
    }

    joinGame(gameId, playerData) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Spiel nicht gefunden' };
        }

        if (game.status !== 'waiting') {
            return { success: false, error: 'Spiel hat bereits begonnen' };
        }

        if (game.players.length >= game.maxPlayers) {
            return { success: false, error: 'Spiel ist voll' };
        }

        // Prüfe, ob Spieler bereits im Spiel ist
        const existingPlayer = game.players.find(p => p.socketId === playerData.socketId);
        if (existingPlayer) {
            return { success: false, error: 'Spieler ist bereits im Spiel' };
        }

        const player = {
            id: playerData.socketId,
            socketId: playerData.socketId,
            name: playerData.name,
            ready: false,
            selectedRace: null,
            raceConfirmed: false,
            gold: this.config.DEFAULT_STARTING_GOLD,
            units: [],
            buildings: [],
            isAlive: true,
            joinedAt: new Date()
        };

        game.players.push(player);
        this.players.set(playerData.socketId, { gameId: gameId, player: player });

        console.log(`👤 Spieler ${player.name} ist Spiel ${game.name} beigetreten`);
        
        return { success: true, game: game, player: player };
    }

    leaveGame(socketId) {
        const playerInfo = this.players.get(socketId);
        if (!playerInfo) {
            return { success: false, error: 'Spieler nicht in einem Spiel' };
        }

        const game = this.games.get(playerInfo.gameId);
        if (!game) {
            return { success: false, error: 'Spiel nicht gefunden' };
        }

        const playerIndex = game.players.findIndex(p => p.socketId === socketId);
        if (playerIndex === -1) {
            return { success: false, error: 'Spieler nicht im Spiel' };
        }

        const playerName = game.players[playerIndex].name;
        game.players.splice(playerIndex, 1);
        this.players.delete(socketId);

        // Wenn Spiel leer ist, lösche es
        if (game.players.length === 0) {
            this.deleteGame(playerInfo.gameId);
            return { success: true, gameDeleted: true, playerLeft: playerName };
        }

        console.log(`👤 Spieler ${playerName} hat Spiel ${game.name} verlassen`);
        
        return { success: true, game: game, playerLeft: playerName };
    }

    deleteGame(gameId) {
        const game = this.games.get(gameId);
        if (game) {
            // Entferne alle Spieler aus dem Spiel
            game.players.forEach(player => {
                this.players.delete(player.socketId);
            });
            
            // Entferne Map aus Cache
            this.mapGenerator.removeMap(gameId);
            
            // Entferne Turn Timer
            this.clearTurnTimer(gameId);
            
            // Lösche Spiel
            this.games.delete(gameId);
            
            console.log(`🗑️ Spiel ${game.name} (ID: ${gameId}) gelöscht`);
            return true;
        }
        return false;
    }

    // ========================================
    // RASSEN-AUSWAHL SYSTEM
    // ========================================

    selectRace(gameId, socketId, raceId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Spiel nicht gefunden' };
        }

        if (game.gamePhase !== 'race_selection') {
            return { success: false, error: 'Rassen-Auswahl ist nicht aktiv' };
        }

        const player = game.players.find(p => p.socketId === socketId);
        if (!player) {
            return { success: false, error: 'Spieler nicht im Spiel' };
        }

        // Prüfe, ob Rasse bereits gewählt wurde
        const raceAlreadyTaken = game.players.some(p => p.selectedRace === raceId && p.socketId !== socketId);
        if (raceAlreadyTaken) {
            return { success: false, error: 'Rasse bereits gewählt' };
        }

        // Setze Rasse für Spieler
        player.selectedRace = raceId;
        player.raceConfirmed = true;

        console.log(`🏛️ Spieler ${player.name} hat Rasse ${raceId} gewählt`);

        // Prüfe, ob alle Spieler eine Rasse gewählt haben
        const allRacesSelected = game.players.every(p => p.raceConfirmed);
        
        if (allRacesSelected) {
            console.log(`🎯 Alle Rassen für Spiel ${game.name} gewählt - starte Spiel`);
            this.startGameAfterRaceSelection(gameId);
        }

        return { 
            success: true, 
            player: player, 
            allRacesSelected: allRacesSelected,
            game: game 
        };
    }

    // ========================================
    // SPIEL-START UND MAP-GENERIERUNG
    // ========================================

    startRaceSelection(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Spiel nicht gefunden' };
        }

        if (game.players.length < this.config.MIN_PLAYERS) {
            return { success: false, error: 'Nicht genug Spieler' };
        }

        // Ändere Spielphase
        game.gamePhase = 'race_selection';
        game.status = 'race_selection';

        console.log(`🏛️ Rassen-Auswahl für Spiel ${game.name} gestartet`);
        
        return { success: true, game: game };
    }

    startGameAfterRaceSelection(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            console.error('❌ Spiel nicht gefunden:', gameId);
            return null;
        }

        console.log(`🎮 Starte Spiel nach Rassen-Auswahl: ${game.name}`);
        
        try {
            // Generiere synchronisierte Server-Karte
            const mapResult = this.mapGenerator.generateSynchronizedMap(
                gameId, 
                game.settings.mapSize, 
                null, 
                game.players
            );
            
            if (!mapResult.success) {
                console.error('❌ Kartengenerierung fehlgeschlagen:', mapResult.error);
                return { success: false, error: mapResult.error };
            }

            // Setze Karte im Spiel
            game.map = mapResult.map;

            // Setup für Spielbeginn
            this.setupTurnOrder(game);
            this.generateStartingPositions(game);
            
            // Ändere Spielstatus
            game.status = 'playing';
            game.gamePhase = 'playing';
            game.startedAt = new Date();
            game.turnStartTime = new Date();
            
            // Starte ersten Turn
            this.startTurn(gameId);
            
            console.log(`✅ Spiel ${game.name} erfolgreich gestartet`);
            
            return { success: true, game: game, map: game.map };
            
        } catch (error) {
            console.error('❌ Fehler beim Spielstart:', error);
            return { success: false, error: error.message };
        }
    }

    setupTurnOrder(game) {
        // Mische Spieler für zufällige Reihenfolge
        const playerIds = game.players.map(p => p.id);
        this.shuffleArray(playerIds);
        
        game.turnOrder = playerIds;
        game.currentTurnIndex = 0;
        game.turnNumber = 1;
        
        console.log(`🎯 Turn-Reihenfolge für ${game.name}: ${playerIds.join(' → ')}`);
    }

    generateStartingPositions(game) {
        console.log(`🏠 Generiere Startpositionen für ${game.players.length} Spieler...`);
        
        if (!game.map) {
            console.error('❌ Keine Karte verfügbar für Startpositionen');
            return false;
        }
        
        const buildings = this.findAllBuildings(game.map, 'city', 'castle');
        
        if (buildings.length < game.players.length) {
            console.warn(`⚠️ Nicht genug Gebäude für alle Spieler (${buildings.length} < ${game.players.length})`);
        }
        
        // Shuffle buildings für faire Verteilung
        this.shuffleArray(buildings);
        
        // Weise jedem Spieler ein Gebäude zu
        for (let i = 0; i < game.players.length && i < buildings.length; i++) {
            const player = game.players[i];
            const building = buildings[i];
            
            // Setze Spieler als Besitzer des Gebäudes
            game.map[building.y][building.x].owner = player.id;
            game.map[building.y][building.x].building.owner = player.id;
            
            // Erstelle Starteinheit neben dem Gebäude
            const unitPosition = this.findNearbyEmptyTile(game.map, building.x, building.y);
            if (unitPosition) {
                const startingUnit = this.createStartingUnit(player);
                game.map[unitPosition.y][unitPosition.x].unit = startingUnit;
                player.units = player.units || [];
                player.units.push(startingUnit);
                
                console.log(`👤 Spieler ${player.name}: Gebäude bei (${building.x}, ${building.y}), Einheit bei (${unitPosition.x}, ${unitPosition.y})`);
            }
        }
        
        return true;
    }

    findAllBuildings(map, ...buildingTypes) {
        const buildings = [];
        
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const tile = map[y][x];
                if (tile.building && buildingTypes.includes(tile.building.type)) {
                    buildings.push({ x, y, building: tile.building });
                }
            }
        }
        
        return buildings;
    }

    findNearbyEmptyTile(map, centerX, centerY, maxRadius = 3) {
        for (let radius = 1; radius <= maxRadius; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    if (x >= 0 && x < map[0].length && y >= 0 && y < map.length) {
                        const tile = map[y][x];
                        if (!tile.unit && !tile.building && tile.terrain.id !== 'water') {
                            return { x, y };
                        }
                    }
                }
            }
        }
        
        return null;
    }

    createStartingUnit(player) {
        return {
            id: `unit_${player.id}_${Date.now()}`,
            type: 'warrior',
            name: 'Krieger',
            owner: player.id,
            hp: 30,
            maxHp: 30,
            attack: 8,
            defense: 4,
            movement: 2,
            maxMovement: 2,
            range: 1,
            level: 1,
            experience: 0,
            icon: '⚔️'
        };
    }

    // ========================================
    // TURN-SYSTEM
    // ========================================

    startTurn(gameId) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') return;

        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        const currentPlayer = game.players.find(p => p.id === currentPlayerId);
        
        if (!currentPlayer) {
            console.error(`❌ Aktueller Spieler nicht gefunden: ${currentPlayerId}`);
            return;
        }

        // Gib Spieler Gold (basierend auf Gebäuden)
        this.processGoldIncome(game, currentPlayer);
        
        // Regeneriere Einheiten-Bewegungspunkte
        this.regenerateMovementPoints(game, currentPlayer);
        
        // Setze Turn Timer
        this.setTurnTimer(gameId);
        
        console.log(`⏰ Turn ${game.turnNumber} gestartet für Spieler ${currentPlayer.name}`);
        
        // Benachrichtige alle Clients
        io.to(gameId).emit('turn-started', {
            gameId: gameId,
            currentPlayer: {
                id: currentPlayer.id,
                name: currentPlayer.name
            },
            turnNumber: game.turnNumber,
            turnTimeLimit: game.settings.turnTimeLimit
        });
    }

    endTurn(gameId, playerId) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') {
            return { success: false, error: 'Spiel nicht aktiv' };
        }

        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        if (currentPlayerId !== playerId) {
            return { success: false, error: 'Nicht am Zug' };
        }

        // Clear turn timer
        this.clearTurnTimer(gameId);

        // Nächster Spieler
        game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
        
        // Wenn alle Spieler dran waren, neue Runde
        if (game.currentTurnIndex === 0) {
            game.turnNumber++;
        }

        console.log(`⏭️ Turn beendet für Spieler ${playerId}, nächster: ${game.turnOrder[game.currentTurnIndex]}`);

        // Starte nächsten Turn
        this.startTurn(gameId);

        return { success: true, game: game };
    }

    setTurnTimer(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Clear existing timer
        this.clearTurnTimer(gameId);

        // Set new timer
        const timer = setTimeout(() => {
            console.log(`⏰ Turn-Timer abgelaufen für Spiel ${gameId}`);
            this.forceTurnEnd(gameId);
        }, game.settings.turnTimeLimit * 1000);

        this.turnTimers.set(gameId, timer);
    }

    clearTurnTimer(gameId) {
        const timer = this.turnTimers.get(gameId);
        if (timer) {
            clearTimeout(timer);
            this.turnTimers.delete(gameId);
        }
    }

    forceTurnEnd(gameId) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') return;

        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        console.log(`⚠️ Forciere Turn-Ende für Spieler ${currentPlayerId} in Spiel ${gameId}`);

        this.endTurn(gameId, currentPlayerId);
    }

    // ========================================
    // GAME LOGIC METHODEN
    // ========================================

    processGoldIncome(game, player) {
        let income = 0;
        
        // Berechne Einkommen aus Gebäuden
        for (let y = 0; y < game.map.length; y++) {
            for (let x = 0; x < game.map[y].length; x++) {
                const tile = game.map[y][x];
                if (tile.building && tile.owner === player.id) {
                    income += tile.building.goldIncome || 0;
                }
            }
        }
        
        // Wende Rassen-Boni an
        income = Math.floor(income * this.config.GOLD_INCOME_MULTIPLIER);
        
        player.gold += income;
        
        console.log(`💰 Spieler ${player.name} erhält ${income} Gold (Total: ${player.gold})`);
    }

    regenerateMovementPoints(game, player) {
        // Regeneriere Bewegungspunkte für alle Einheiten des Spielers
        for (let y = 0; y < game.map.length; y++) {
            for (let x = 0; x < game.map[y].length; x++) {
                const tile = game.map[y][x];
                if (tile.unit && tile.unit.owner === player.id) {
                    tile.unit.movement = tile.unit.maxMovement;
                }
            }
        }
    }

    moveUnit(gameId, playerId, fromX, fromY, toX, toY) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') {
            return { success: false, error: 'Spiel nicht aktiv' };
        }

        // Prüfe, ob Spieler am Zug ist
        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        if (currentPlayerId !== playerId) {
            return { success: false, error: 'Nicht am Zug' };
        }

        // Validiere Koordinaten
        if (!this.isValidPosition(game.map, fromX, fromY) || !this.isValidPosition(game.map, toX, toY)) {
            return { success: false, error: 'Ungültige Position' };
        }

        const fromTile = game.map[fromY][fromX];
        const toTile = game.map[toY][toX];

        // Prüfe, ob Einheit existiert und dem Spieler gehört
        if (!fromTile.unit || fromTile.unit.owner !== playerId) {
            return { success: false, error: 'Keine eigene Einheit an dieser Position' };
        }

        // Prüfe, ob Zielfeld frei ist
        if (toTile.unit || toTile.building) {
            return { success: false, error: 'Zielfeld ist belegt' };
        }

        // Prüfe Bewegungsreichweite
        const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY);
        if (distance > fromTile.unit.movement) {
            return { success: false, error: 'Nicht genug Bewegungspunkte' };
        }

        // Führe Bewegung aus
        const unit = fromTile.unit;
        unit.movement -= distance;
        toTile.unit = unit;
        fromTile.unit = null;

        console.log(`🚶 Einheit von (${fromX}, ${fromY}) nach (${toX}, ${toY}) bewegt`);

        return { success: true, unit: unit, fromX, fromY, toX, toY };
    }

    attackUnit(gameId, playerId, attackerX, attackerY, defenderX, defenderY) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'playing') {
            return { success: false, error: 'Spiel nicht aktiv' };
        }

        // Prüfe, ob Spieler am Zug ist
        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        if (currentPlayerId !== playerId) {
            return { success: false, error: 'Nicht am Zug' };
        }

        // Validiere Koordinaten
        if (!this.isValidPosition(game.map, attackerX, attackerY) || !this.isValidPosition(game.map, defenderX, defenderY)) {
            return { success: false, error: 'Ungültige Position' };
        }

        const attackerTile = game.map[attackerY][attackerX];
        const defenderTile = game.map[defenderY][defenderX];

        // Prüfe Angreifer
        if (!attackerTile.unit || attackerTile.unit.owner !== playerId) {
            return { success: false, error: 'Keine eigene Einheit zum Angreifen' };
        }

        // Prüfe Verteidiger
        if (!defenderTile.unit || defenderTile.unit.owner === playerId) {
            return { success: false, error: 'Kein gültiges Angriffsziel' };
        }

        // Prüfe Angriffsreichweite
        const distance = Math.abs(defenderX - attackerX) + Math.abs(defenderY - attackerY);
        if (distance > attackerTile.unit.range) {
            return { success: false, error: 'Ziel außer Reichweite' };
        }

        // Berechne Schaden
        const attacker = attackerTile.unit;
        const defender = defenderTile.unit;
        const damage = Math.max(1, attacker.attack - defender.defense);

        defender.hp -= damage;

        console.log(`⚔️ ${attacker.name} greift ${defender.name} an (${damage} Schaden)`);

        let unitKilled = false;
        if (defender.hp <= 0) {
            defenderTile.unit = null;
            unitKilled = true;
            console.log(`💀 ${defender.name} wurde besiegt`);
        }

        return { 
            success: true, 
            damage: damage, 
            attacker: attacker, 
            defender: defender, 
            unitKilled: unitKilled 
        };
    }

    // ========================================
    // HILFSMETHODEN
    // ========================================

    generateGameId() {
        return 'game_' + Math.random().toString(36).substr(2, 9);
    }

    isValidPosition(map, x, y) {
        return x >= 0 && x < map[0].length && y >= 0 && y < map.length;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    getPublicGames() {
        const publicGames = [];
        
        for (const [gameId, game] of this.games.entries()) {
            if (!game.settings.isPrivate && game.status === 'waiting') {
                publicGames.push({
                    id: game.id,
                    name: game.name,
                    playerCount: game.players.length,
                    maxPlayers: game.maxPlayers,
                    status: game.status,
                    mapSize: game.settings.mapSize,
                    createdAt: game.createdAt
                });
            }
        }
        
        return publicGames;
    }

    getGameState(gameId) {
        const game = this.games.get(gameId);
        if (!game) return null;

        return {
            id: game.id,
            name: game.name,
            status: game.status,
            gamePhase: game.gamePhase,
            players: game.players,
            turnOrder: game.turnOrder,
            currentTurnIndex: game.currentTurnIndex,
            turnNumber: game.turnNumber,
            map: game.map,
            settings: game.settings
        };
    }

    // ========================================
    // CLEANUP METHODEN
    // ========================================

    cleanup() {
        // Entferne alte leere Spiele
        const now = Date.now();
        const maxAge = 2 * 60 * 60 * 1000; // 2 Stunden
        
        for (const [gameId, game] of this.games.entries()) {
            if (game.players.length === 0 && (now - game.createdAt.getTime()) > maxAge) {
                this.deleteGame(gameId);
            }
        }
        
        // Cleanup Map Generator Cache
        this.mapGenerator.clearOldMaps();
    }
}

// ========================================
// GLOBALE INSTANZ
// ========================================

const gameManager = new EnhancedGameManager();

// Cleanup Timer
setInterval(() => {
    gameManager.cleanup();
}, 10 * 60 * 1000); // Alle 10 Minuten

// ========================================
// SOCKET.IO EVENT HANDLERS
// ========================================

io.on('connection', (socket) => {
    console.log(`🔌 Neuer Client verbunden: ${socket.id}`);

    // ========================================
    // LOBBY EVENTS
    // ========================================

    socket.on('create-game', (data) => {
        console.log(`🎮 Erstelle Spiel:`, data);
        
        const result = gameManager.createGame({
            name: data.gameName,
            maxPlayers: data.maxPlayers,
            mapSize: data.mapSize,
            isPrivate: data.isPrivate || false
        });

        if (result.success) {
            socket.emit('game-created', result.game);
            io.emit('game-list-updated', gameManager.getPublicGames());
        } else {
            socket.emit('game-creation-failed', { error: result.error });
        }
    });

    socket.on('join-game', (data) => {
        console.log(`👤 Join Game:`, data);
        
        const result = gameManager.joinGame(data.gameId, {
            socketId: socket.id,
            name: data.playerName
        });

        if (result.success) {
            socket.join(data.gameId);
            socket.emit('game-joined', result.game);
            socket.to(data.gameId).emit('player-joined', {
                player: result.player,
                game: result.game
            });
            io.emit('game-list-updated', gameManager.getPublicGames());
        } else {
            socket.emit('join-game-failed', { error: result.error });
        }
    });

    socket.on('get-games', () => {
        socket.emit('game-list-updated', gameManager.getPublicGames());
    });

    // ========================================
    // RACE SELECTION EVENTS
    // ========================================

    socket.on('start-race-selection', (data) => {
        console.log(`🏛️ Starte Rassen-Auswahl für Spiel:`, data.gameId);
        
        const result = gameManager.startRaceSelection(data.gameId);
        
        if (result.success) {
            io.to(data.gameId).emit('race-selection-phase', result.game);
        } else {
            socket.emit('race-selection-failed', { error: result.error });
        }
    });

    socket.on('select-race', (data) => {
        console.log(`🏛️ Rassen-Auswahl:`, data);
        
        const result = gameManager.selectRace(data.gameId, socket.id, data.raceId);
        
        if (result.success) {
            // Benachrichtige alle Spieler über die Auswahl
            io.to(data.gameId).emit('race-selected', {
                playerId: socket.id,
                playerName: result.player.name,
                raceId: data.raceId,
                allRacesSelected: result.allRacesSelected
            });
            
            // Wenn alle Rassen gewählt wurden, starte das Spiel
            if (result.allRacesSelected) {
                io.to(data.gameId).emit('all-races-selected', {
                    game: result.game,
                    map: result.game.map
                });
            }
        } else {
            socket.emit('race-selection-failed', { error: result.error });
        }
    });

    // ========================================
    // GAME PLAY EVENTS
    // ========================================

    socket.on('get-game-state', (data) => {
        const gameState = gameManager.getGameState(data.gameId);
        if (gameState) {
            socket.emit('game-state', gameState);
        } else {
            socket.emit('game-state-failed', { error: 'Spiel nicht gefunden' });
        }
    });

    socket.on('end-turn', (data) => {
        console.log(`⏭️ Turn beenden:`, data);
        
        const result = gameManager.endTurn(data.gameId, socket.id);
        
        if (result.success) {
            io.to(data.gameId).emit('turn-ended', {
                game: result.game,
                previousPlayer: socket.id
            });
        } else {
            socket.emit('turn-end-failed', { error: result.error });
        }
    });

    socket.on('move-unit', (data) => {
        console.log(`🚶 Einheit bewegen:`, data);
        
        const result = gameManager.moveUnit(
            data.gameId, 
            socket.id, 
            data.fromX, 
            data.fromY, 
            data.toX, 
            data.toY
        );
        
        if (result.success) {
            io.to(data.gameId).emit('unit-moved', {
                unit: result.unit,
                fromX: result.fromX,
                fromY: result.fromY,
                toX: result.toX,
                toY: result.toY,
                playerId: socket.id
            });
        } else {
            socket.emit('move-failed', { error: result.error });
        }
    });

    socket.on('attack-unit', (data) => {
        console.log(`⚔️ Einheit angreifen:`, data);
        
        const result = gameManager.attackUnit(
            data.gameId,
            socket.id,
            data.attackerX,
            data.attackerY,
            data.defenderX,
            data.defenderY
        );
        
        if (result.success) {
            io.to(data.gameId).emit('unit-attacked', {
                attacker: result.attacker,
                defender: result.defender,
                damage: result.damage,
                unitKilled: result.unitKilled,
                playerId: socket.id
            });
        } else {
            socket.emit('attack-failed', { error: result.error });
        }
    });

    // ========================================
    // MAP SYNC EVENTS
    // ========================================

    socket.on('request-map', (data) => {
        console.log(`🗺️ Karten-Anfrage:`, data);
        
        const mapData = gameManager.mapGenerator.getMap(data.gameId);
        
        if (mapData) {
            socket.emit('map-data', {
                success: true,
                map: mapData.map,
                gameId: data.gameId
            });
        } else {
            socket.emit('map-request-failed', { 
                error: 'Karte nicht gefunden',
                gameId: data.gameId 
            });
        }
    });

    // ========================================
    // DISCONNECT HANDLING
    // ========================================

    socket.on('disconnect', () => {
        console.log(`🔌 Client getrennt: ${socket.id}`);
        
        const result = gameManager.leaveGame(socket.id);
        
        if (result.success) {
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

app.get('/api/game/:gameId', (req, res) => {
    const game = gameManager.games.get(req.params.gameId);
    if (!game) {
        return res.status(404).json({ error: 'Spiel nicht gefunden' });
    }
    
    res.json({
        id: game.id,
        name: game.name,
        status: game.status,
        playerCount: game.players.length,
        maxPlayers: game.maxPlayers,
        settings: game.settings,
        turnNumber: game.turnNumber,
        createdAt: game.createdAt
    });
});

// ========================================
// MAIN ROUTES
// ========================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// ========================================
// SERVER STARTUP
// ========================================

server.listen(PORT, () => {
    console.log('🚀 ========================================');
    console.log(`🎮 Strategiespiel Server läuft auf Port ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('🚀 ========================================');
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================

process.on('SIGTERM', () => {
    console.log('💤 Server wird heruntergefahren...');
    server.close(() => {
        console.log('✅ Server erfolgreich heruntergefahren');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('💤 Server wird heruntergefahren (SIGINT)...');
    server.close(() => {
        console.log('✅ Server erfolgreich heruntergefahren');
        process.exit(0);
    });
});