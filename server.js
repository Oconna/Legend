// server.js - Erweiterte Multiplayer Server für Strategiespiel
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
        this.mapGenerator = new ServerMapGenerator(); // Neue Map-Generator Instanz
        
        this.config = {
            TURN_TIME_LIMIT: 120,
            MIN_PLAYERS: 2,
            MAX_PLAYERS: 8,
            DEFAULT_STARTING_GOLD: 100,
            GOLD_INCOME_MULTIPLIER: 1.0
        };
    }

    // Aktualisierte Methode für Spielstart nach Rassenauswahl
    startGameAfterRaceSelection(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            console.error('❌ Spiel nicht gefunden:', gameId);
            return null;
        }

        console.log(`🎮 Starte Spiel nach Rassen-Auswahl: ${game.name}`);
        
        // WICHTIG: Generiere synchronisierte Server-Karte
        const mapResult = this.generateSynchronizedMap(game);
        if (!mapResult.success) {
            console.error('❌ Kartengenerierung fehlgeschlagen:', mapResult.error);
            return null;
        }

        // Setup für Spielbeginn
        this.setupTurnOrder(game);
        this.generateStartingPositions(game);
        
        // Ändere Spielstatus
        game.status = 'playing';
        game.gamePhase = 'playing';
        game.turnStartTime = new Date();
        
        this.startTurnTimer(game);
        
        console.log(`✅ Spiel ${game.name} erfolgreich gestartet mit synchronisierter Karte`);
        return game;
    }

    // Neue Methode: Generiere synchronisierte Karte
    generateSynchronizedMap(game) {
        try {
            console.log(`🗺️ Generiere synchronisierte Karte für ${game.name}...`);
            
            const mapSize = game.settings.mapSize || 30;
            const playerCount = game.players.length;
            
            // Verwende Server-Map-Generator
            const mapResult = this.mapGenerator.generateSynchronizedMap(
                game.id,
                mapSize,
                playerCount
            );
            
            if (!mapResult || !mapResult.mapData) {
                return {
                    success: false,
                    error: 'Kartengenerierung fehlgeschlagen'
                };
            }
            
            // Speichere Karte im Spiel
            game.map = mapResult.mapData;
            game.mapSeed = mapResult.seed;
            game.mapValidation = mapResult.validation;
            game.mapGeneratedAt = mapResult.generatedAt;
            
            console.log(`✅ Synchronisierte Karte generiert:`);
            console.log(`   Größe: ${mapSize}x${mapSize}`);
            console.log(`   Seed: ${mapResult.seed}`);
            console.log(`   Städte: ${mapResult.validation.stats.cities}`);
            console.log(`   Burgen: ${mapResult.validation.stats.castles}`);
            console.log(`   Land: ${(mapResult.validation.stats.landPercentage * 100).toFixed(1)}%`);
            
            return {
                success: true,
                mapData: mapResult.mapData,
                mapInfo: {
                    size: mapSize,
                    seed: mapResult.seed,
                    stats: mapResult.validation.stats
                }
            };
            
        } catch (error) {
            console.error('❌ Fehler bei Kartengenerierung:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Aktualisierte Methode: Generiere Startpositionen auf Server-Karte
    generateStartingPositions(game) {
        console.log(`🏠 Generiere Startpositionen für ${game.players.length} Spieler...`);
        
        if (!game.map) {
            console.error('❌ Keine Karte verfügbar für Startpositionen');
            return false;
        }
        
        const mapSize = game.map.length;
        const cities = this.findAllBuildings(game.map, 'city');
        const castles = this.findAllBuildings(game.map, 'castle');
        
        console.log(`🏘️ Gefunden: ${cities.length} Städte, ${castles.length} Burgen`);
        
        // Verteile Startgebäude an Spieler
        const availableBuildings = [...cities, ...castles];
        this.shuffleArray(availableBuildings);
        
        // Jeder Spieler bekommt mindestens ein Gebäude
        for (let i = 0; i < game.players.length; i++) {
            const player = game.players[i];
            
            if (i < availableBuildings.length) {
                const building = availableBuildings[i];
                
                // Setze Spieler als Besitzer des Gebäudes
                game.map[building.y][building.x].owner = player.id;
                
                // Erstelle Starteinheit neben dem Gebäude
                const startingUnit = this.createStartingUnit(player, building);
                if (startingUnit) {
                    const unitPosition = this.findNearbyEmptyTile(game.map, building.x, building.y);
                    if (unitPosition) {
                        game.map[unitPosition.y][unitPosition.x].unit = startingUnit;
                        player.units = player.units || [];
                        player.units.push(startingUnit);
                        
                        console.log(`👤 Spieler ${player.name}: Gebäude bei (${building.x}, ${building.y}), Einheit bei (${unitPosition.x}, ${unitPosition.y})`);
                    }
                }
                
                // Setze Startgebäude in Spielerdaten
                player.buildings = player.buildings || [];
                player.buildings.push({
                    x: building.x,
                    y: building.y,
                    type: building.type,
                    id: `building_${player.id}_${Date.now()}`
                });
            }
        }
        
        console.log(`✅ Startpositionen für ${game.players.length} Spieler generiert`);
        return true;
    }

    // Hilfsmethoden für Startpositionen
    findAllBuildings(map, buildingType) {
        const buildings = [];
        const mapSize = map.length;
        
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                if (map[y][x].terrain === buildingType) {
                    buildings.push({ x, y, type: buildingType });
                }
            }
        }
        
        return buildings;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    createStartingUnit(player, building) {
        // Erstelle Basis-Starteinheit basierend auf Rasse
        const raceId = player.raceId || 'humans';
        
        return {
            id: `unit_${player.id}_${Date.now()}`,
            type: 'warrior', // Standard-Starteinheit
            playerId: player.id,
            level: 1,
            hp: 50,
            maxHp: 50,
            attack: 15,
            defense: 10,
            movement: 3,
            remainingMovement: 3,
            raceId: raceId,
            createdAt: new Date()
        };
    }

    findNearbyEmptyTile(map, centerX, centerY, maxDistance = 3) {
        const mapSize = map.length;
        
        // Suche in steigenden Radien
        for (let radius = 1; radius <= maxDistance; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Nur Randpunkte des aktuellen Radius prüfen
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    // Prüfe Kartengrenzen
                    if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) continue;
                    
                    // Prüfe ob Feld leer und begehbar ist
                    const tile = map[y][x];
                    if (!tile.unit && this.isTerrainWalkable(tile.terrain)) {
                        return { x, y };
                    }
                }
            }
        }
        
        return null; // Kein freies Feld gefunden
    }

    isTerrainWalkable(terrain) {
        return terrain !== 'water' && terrain !== 'mountain';
    }

    // Aktualisierte Socket-Event-Handler
    handleGameStart(socket, io, data) {
        console.log(`🎮 Spielstart angefordert für Spiel ${data.gameId} von ${socket.id}`);
        
        const game = this.games.get(data.gameId);
        if (!game) {
            socket.emit('game-start-failed', { error: 'Spiel nicht gefunden' });
            return;
        }
        
        // Prüfe ob alle Spieler bereit sind
        if (!this.canStartGame(data.gameId, socket.id)) {
            socket.emit('game-start-failed', { error: 'Nicht alle Spieler sind bereit' });
            return;
        }
        
        // Starte Rassenauswahl-Phase
        game.status = 'race_selection';
        game.gamePhase = 'race_selection';
        
        console.log(`✅ Rassenauswahl gestartet für Spiel ${game.name}`);
        
        // Sende Game-Started Event mit leerer Karte (Karte wird nach Rassenauswahl generiert)
        io.to(data.gameId).emit('game-started', {
            success: true,
            game: game,
            map: null, // Keine Karte in dieser Phase
            message: 'Spiel gestartet! Wählen Sie Ihre Rasse.'
        });
        
        // Starte Rassenauswahl-Phase
        setTimeout(() => {
            io.to(data.gameId).emit('race-selection-phase', {
                game: game,
                availableRaces: this.getAvailableRaces(),
                message: 'Wählen Sie Ihre Rasse aus!'
            });
        }, 1000);
    }

    handleRaceSelection(socket, io, data) {
        console.log(`🏛️ Rassenauswahl: Spieler ${socket.id} wählt ${data.raceId} in Spiel ${data.gameId}`);
        
        const result = this.selectRace(data.gameId, socket.id, data.raceId);
        
        if (result.success) {
            // Benachrichtige alle Spieler über Rassenauswahl
            io.to(data.gameId).emit('race-selected', {
                playerId: socket.id,
                playerName: result.player?.name,
                raceId: data.raceId,
                game: result.game
            });
            
            // Prüfe ob alle Rassen gewählt wurden
            if (result.allSelected) {
                console.log(`🎯 Alle Rassen gewählt in Spiel ${data.gameId}, starte Spiel...`);
                
                // Starte das eigentliche Spiel mit Kartengenerierung
                const startedGame = this.startGameAfterRaceSelection(data.gameId);
                
                if (startedGame) {
                    // Sende die fertige Karte an alle Clients
                    io.to(data.gameId).emit('game-map-ready', {
                        success: true,
                        game: startedGame,
                        map: startedGame.map,
                        mapInfo: {
                            size: startedGame.map.length,
                            seed: startedGame.mapSeed,
                            generatedAt: startedGame.mapGeneratedAt
                        },
                        turnOrder: startedGame.turnOrder,
                        currentPlayer: this.getCurrentPlayer(startedGame),
                        message: 'Karte generiert! Das Spiel beginnt.'
                    });
                    
                    // Sende erste Zug-Information
                    setTimeout(() => {
                        const currentPlayer = this.getCurrentPlayer(startedGame);
                        io.to(data.gameId).emit('turn-started', {
                            game: startedGame,
                            currentPlayer: currentPlayer,
                            turnNumber: startedGame.turnNumber,
                            message: `${currentPlayer.name} ist am Zug!`
                        });
                    }, 2000);
                } else {
                    io.to(data.gameId).emit('game-start-failed', {
                        error: 'Fehler beim Starten des Spiels nach Rassenauswahl'
                    });
                }
            }
        } else {
            socket.emit('race-selection-failed', {
                error: result.error || 'Fehler bei Rassenauswahl'
            });
        }
    }

    getAvailableRaces() {
        // Hier könnten Sie die Rassen aus einer Datei laden
        // Für jetzt verwenden wir eine einfache Liste
        return [
            { id: 'humans', name: 'Menschen', icon: '👑' },
            { id: 'orcs', name: 'Orks', icon: '👹' },
            { id: 'elves', name: 'Elfen', icon: '🧝' },
            { id: 'dwarves', name: 'Zwerge', icon: '⚒️' },
            { id: 'undead', name: 'Untote', icon: '💀' }
        ];
    }

    // Weitere Utility-Methoden...
    
    setupTurnOrder(game) {
        // Mische Spieler-Reihenfolge
        const players = [...game.players];
        this.shuffleArray(players);
        
        game.turnOrder = players.map(p => p.id);
        game.currentTurnIndex = 0;
        game.turnNumber = 1;
        
        console.log(`🔄 Zugreihenfolge festgelegt:`, players.map(p => p.name));
    }

    getCurrentPlayer(game) {
        if (!game.turnOrder || game.turnOrder.length === 0) return null;
        
        const currentPlayerId = game.turnOrder[game.currentTurnIndex];
        return game.players.find(p => p.id === currentPlayerId);
    }

    startTurnTimer(game) {
        // Stoppe vorherigen Timer falls vorhanden
        if (this.turnTimers.has(game.id)) {
            clearTimeout(this.turnTimers.get(game.id));
        }
        
        // Starte neuen Timer
        const timer = setTimeout(() => {
            console.log(`⏰ Zug-Zeit abgelaufen für Spiel ${game.name}`);
            this.forceTurnEnd(game.id);
        }, this.config.TURN_TIME_LIMIT * 1000);
        
        this.turnTimers.set(game.id, timer);
    }

    forceTurnEnd(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;
        
        console.log(`⏰ Erzwinge Zug-Ende für ${game.name}`);
        this.nextTurn(game);
        
        // Benachrichtige alle Clients
        io.to(gameId).emit('turn-forced', {
            game: game,
            currentPlayer: this.getCurrentPlayer(game),
            message: 'Zeit abgelaufen! Nächster Spieler ist dran.'
        });
    }

    nextTurn(game) {
        game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
        
        // Neue Runde wenn alle Spieler dran waren
        if (game.currentTurnIndex === 0) {
            game.turnNumber++;
            console.log(`🔄 Neue Runde ${game.turnNumber} für Spiel ${game.name}`);
        }
        
        game.turnStartTime = new Date();
        this.startTurnTimer(game);
    }
}

// Event-Handler für Socket-Verbindungen (aktualisiert)
io.on('connection', (socket) => {
    console.log(`🔗 Neuer Client verbunden: ${socket.id}`);

    // Bestehende Event-Handler...
    
    // Aktualisierte Event-Handler für Kartensynchronisation
    socket.on('start-game', (data) => {
        gameManager.handleGameStart(socket, io, data);
    });

    socket.on('select-race', (data) => {
        gameManager.handleRaceSelection(socket, io, data);
    });

    // Neuer Event-Handler: Client fordert Karte an
    socket.on('request-map', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game || !game.map) {
            socket.emit('map-request-failed', { error: 'Karte nicht verfügbar' });
            return;
        }

        socket.emit('map-data', {
            success: true,
            map: game.map,
            mapInfo: {
                size: game.map.length,
                seed: game.mapSeed,
                generatedAt: game.mapGeneratedAt
            }
        });
    });

    // Rest der bestehenden Event-Handler...
});

console.log(`🚀 Server mit synchronisierter Kartengenerierung läuft auf Port ${PORT}`);


class EnhancedGameManager {
    constructor() {
        this.games = new Map();
        this.players = new Map(); // socketId -> playerInfo
        this.turnTimers = new Map(); // gameId -> timer
        
        // Game Configuration
        this.config = {
            TURN_TIME_LIMIT: 120, // seconds
            MIN_PLAYERS: 2,
            MAX_PLAYERS: 8,
            DEFAULT_STARTING_GOLD: 100,
            GOLD_INCOME_MULTIPLIER: 1.0
        };
    }

    // ========================================
    // GAME CREATION & MANAGEMENT
    // ========================================

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
                raceId: null,
                gold: this.config.DEFAULT_STARTING_GOLD,
                units: [],
                buildings: [],
                defeated: false
            }],
            maxPlayers: gameData.maxPlayers,
            settings: {
                mapSize: gameData.settings?.mapSize || 30,
                gameMode: 'standard',
                turnTimeLimit: this.config.TURN_TIME_LIMIT
            },
            status: 'waiting', // waiting, race_selection, playing, finished
            createdAt: new Date(),
            
            // Game State
            map: null,
            turnOrder: [],
            currentTurnIndex: 0,
            turnNumber: 1,
            turnStartTime: null,
            gamePhase: 'lobby',
            
            // Race Selection
            selectedRaces: new Map(), // playerId -> raceId
            
            // Combat & Actions
            actionHistory: [],
            lastActionId: 0
        };

        this.games.set(gameId, game);
        console.log(`✅ Spiel erstellt: ${game.name} (ID: ${gameId})`);
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

        // Check if player name already exists
        const existingPlayer = game.players.find(p => p.name === playerData.name);
        if (existingPlayer) {
            return { success: false, error: 'Name bereits vergeben' };
        }

        const player = {
            socketId: socketId,
            name: playerData.name,
            ready: false,
            id: Date.now() + Math.random(),
            raceId: null,
            gold: this.config.DEFAULT_STARTING_GOLD,
            units: [],
            buildings: [],
            defeated: false
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
                
                // Clean up turn timer if player was current player
                if (game.status === 'playing') {
                    this.handlePlayerLeaveInGame(game, playerName);
                }
                
                // If game is empty, delete it
                if (game.players.length === 0) {
                    this.deleteGame(gameId);
                    return { gameDeleted: true, gameId };
                }
                
                // If host left, assign new host
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

    handlePlayerLeaveInGame(game, playerName) {
        // Mark player as defeated
        const player = game.players.find(p => p.name === playerName);
        if (player) {
            player.defeated = true;
        }
        
        // Check if current player left
        const currentPlayer = this.getCurrentPlayer(game);
        if (currentPlayer && currentPlayer.name === playerName) {
            this.nextTurn(game);
        }
        
        // Check win condition
        this.checkWinCondition(game);
    }

    deleteGame(gameId) {
        const game = this.games.get(gameId);
        if (game) {
            // Clear turn timer
            this.clearTurnTimer(gameId);
            
            this.games.delete(gameId);
            console.log(`🗑️ Spiel gelöscht: ${game.name}`);
        }
    }

    // ========================================
    // RACE SELECTION
    // ========================================

    selectRace(gameId, playerId, raceId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: 'Spiel nicht gefunden' };
        }

        console.log(`🔍 Suche Spieler in Spiel ${gameId}:`, {
            playerId: playerId,
            availablePlayers: game.players.map(p => ({ id: p.id, socketId: p.socketId, name: p.name }))
        });

        // Try to find player by different identifiers
        let player = null;
        
        // First try by exact ID match
        player = game.players.find(p => p.id == playerId);
        
        // If not found, try by socketId
        if (!player) {
            player = game.players.find(p => p.socketId === playerId);
        }
        
        // If still not found, try by name (fallback)
        if (!player) {
            player = game.players.find(p => p.name === playerId);
        }

        if (!player) {
            console.error(`❌ Spieler nicht gefunden:`, {
                playerId: playerId,
                gamePlayers: game.players,
                gameId: gameId
            });
            return { success: false, error: 'Spieler nicht gefunden' };
        }

        console.log(`✅ Spieler gefunden: ${player.name} (ID: ${player.id}, Socket: ${player.socketId})`);

        // Check if race is already taken by another player
        const raceTakenBy = game.selectedRaces.get(raceId);
        if (raceTakenBy && raceTakenBy !== player.id) {
            return { success: false, error: 'Rasse bereits gewählt' };
        }

        // Set player race
        player.raceId = raceId;
        game.selectedRaces.set(raceId, player.id);

        console.log(`🏛️ ${player.name} hat Rasse ${raceId} gewählt`);

        // Check if all players selected races
        const allSelected = game.players.every(p => p.raceId !== null);
        
        console.log(`📊 Rassen-Auswahl Status: ${game.players.filter(p => p.raceId).length}/${game.players.length} Spieler haben gewählt`);
        
        return { 
            success: true, 
            game: game,
            allSelected: allSelected
        };
    }

    startGameAfterRaceSelection(game) {
        console.log(`🎮 Starte Spiel nach Rassen-Auswahl: ${game.name}`);
        
        // Generate map
        this.generateMap(game);
        
        // Setup turn order (randomized)
        this.setupTurnOrder(game);
        
        // Generate starting units and buildings
        this.generateStartingPositions(game);
        
        // Start first turn
        game.status = 'playing';
        game.gamePhase = 'playing';
        game.turnStartTime = new Date();
        
        this.startTurnTimer(game);
        
        return game;
    }

    // ========================================
    // MAP GENERATION
    // ========================================

// server.js - Erweiterte Kartengenerierung mit Synchronisation
// Fügen Sie diese Klasse zu Ihrem server.js hinzu:

class ServerMapGenerator {
    constructor() {
        this.terrainTypes = ['grass', 'forest', 'mountain', 'water', 'swamp'];
        this.buildingTypes = ['city', 'castle'];
    }

    // Hauptfunktion für Kartengenerierung
    generateSynchronizedMap(gameId, mapSize, playerCount) {
        console.log(`🗺️ Generiere synchronisierte Karte für Spiel ${gameId}: ${mapSize}x${mapSize}`);
        
        // Verwende Game-ID als Seed für konsistente Generierung
        const seed = this.createSeed(gameId);
        const random = this.seededRandom(seed);
        
        // Initialisiere leere Karte
        const map = this.initializeEmptyMap(mapSize);
        
        // Generiere Terrain-Features in mehreren Phasen
        this.generateBaseTerrain(map, mapSize, random);
        this.generateWaterBodies(map, mapSize, random);
        this.generateMountainRanges(map, mapSize, random);
        this.generateForestPatches(map, mapSize, random);
        this.generateSwampAreas(map, mapSize, random);
        this.generateBuildings(map, mapSize, playerCount, random);
        this.smoothTerrain(map, mapSize, random);
        this.ensureConnectivity(map, mapSize);
        
        // Validiere Karte
        const validation = this.validateMap(map, mapSize, playerCount);
        if (!validation.valid) {
            console.warn('⚠️ Karte invalid, regeneriere...', validation.issues);
            return this.generateSynchronizedMap(gameId, mapSize, playerCount);
        }
        
        console.log(`✅ Synchronisierte Karte generiert für ${gameId}`);
        return {
            mapData: map,
            mapSize: mapSize,
            seed: seed,
            generatedAt: new Date(),
            validation: validation
        };
    }

    // Seed-Generierung basierend auf Game-ID
    createSeed(gameId) {
        let hash = 0;
        for (let i = 0; i < gameId.length; i++) {
            const char = gameId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Konvertierung zu 32-Bit Integer
        }
        return Math.abs(hash);
    }

    // Seeded Random Number Generator für konsistente Ergebnisse
    seededRandom(seed) {
        let value = seed;
        return function() {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }

    // Initialisiere leere Karte
    initializeEmptyMap(size) {
        const map = [];
        for (let y = 0; y < size; y++) {
            map[y] = [];
            for (let x = 0; x < size; x++) {
                map[y][x] = {
                    terrain: 'grass',
                    unit: null,
                    owner: null,
                    resources: null,
                    elevation: 0,
                    moisture: 0.5
                };
            }
        }
        return map;
    }

    // Generiere Basis-Terrain mit Noise
    generateBaseTerrain(map, size, random) {
        // Erstelle Höhen- und Feuchtigkeitskarten
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Verwende Perlin-Noise-ähnlichen Algorithmus
                const elevation = this.generateNoise(x, y, size, random, 0.1);
                const moisture = this.generateNoise(x, y, size, random, 0.15, 1000);
                
                map[y][x].elevation = elevation;
                map[y][x].moisture = moisture;
                
                // Setze Basis-Terrain basierend auf Elevation/Moisture
                if (elevation > 0.7) {
                    map[y][x].terrain = 'mountain';
                } else if (elevation < 0.3 && moisture > 0.6) {
                    map[y][x].terrain = 'swamp';
                } else if (moisture > 0.7) {
                    map[y][x].terrain = 'forest';
                } else {
                    map[y][x].terrain = 'grass';
                }
            }
        }
    }

    // Einfacher Noise-Generator
    generateNoise(x, y, size, random, frequency, offset = 0) {
        const scale = size * frequency;
        const scaledX = (x + offset) / scale;
        const scaledY = (y + offset) / scale;
        
        // Einfache Interpolation zwischen zufälligen Werten
        const x1 = Math.floor(scaledX);
        const y1 = Math.floor(scaledY);
        const x2 = x1 + 1;
        const y2 = y1 + 1;
        
        const fx = scaledX - x1;
        const fy = scaledY - y1;
        
        // Generiere Eckwerte
        const corner1 = this.pseudoRandom(x1, y1, random);
        const corner2 = this.pseudoRandom(x2, y1, random);
        const corner3 = this.pseudoRandom(x1, y2, random);
        const corner4 = this.pseudoRandom(x2, y2, random);
        
        // Bilineare Interpolation
        const i1 = this.interpolate(corner1, corner2, fx);
        const i2 = this.interpolate(corner3, corner4, fx);
        return this.interpolate(i1, i2, fy);
    }

    pseudoRandom(x, y, random) {
        // Pseudo-zufälliger Wert basierend auf Koordinaten
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 0.5 + 0.25;
    }

    interpolate(a, b, t) {
        return a * (1 - t) + b * t;
    }

    // Generiere Wasserkörper
    generateWaterBodies(map, size, random) {
        const waterBodies = Math.max(2, Math.floor(size / 15));
        
        for (let i = 0; i < waterBodies; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const maxRadius = 3 + Math.floor(random() * (size / 10));
            
            this.generateCircularFeature(map, size, centerX, centerY, maxRadius, 'water', 0.8, random);
        }
    }

    // Generiere Gebirgsketten
    generateMountainRanges(map, size, random) {
        const ranges = Math.max(1, Math.floor(size / 20));
        
        for (let i = 0; i < ranges; i++) {
            const startX = Math.floor(random() * size);
            const startY = Math.floor(random() * size);
            const length = 8 + Math.floor(random() * (size / 5));
            
            this.generateLinearFeature(map, size, startX, startY, length, 'mountain', 0.7, random);
        }
    }

    // Generiere Waldgebiete
    generateForestPatches(map, size, random) {
        const patches = Math.max(3, Math.floor(size / 8));
        
        for (let i = 0; i < patches; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const radius = 4 + Math.floor(random() * 6);
            
            this.generateCircularFeature(map, size, centerX, centerY, radius, 'forest', 0.6, random);
        }
    }

    // Generiere Sumpfgebiete
    generateSwampAreas(map, size, random) {
        const swamps = Math.max(1, Math.floor(size / 25));
        
        for (let i = 0; i < swamps; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const radius = 2 + Math.floor(random() * 4);
            
            this.generateCircularFeature(map, size, centerX, centerY, radius, 'swamp', 0.5, random);
        }
    }

    // Generiere Gebäude (Städte und Burgen)
    generateBuildings(map, size, playerCount, random) {
        // Anzahl Gebäude basierend auf Kartengröße und Spieleranzahl
        const citiesPerPlayer = Math.max(1, Math.floor(size / 20));
        const totalCities = playerCount * citiesPerPlayer;
        const totalCastles = Math.max(playerCount, Math.floor(totalCities / 3));
        
        console.log(`🏰 Generiere ${totalCities} Städte und ${totalCastles} Burgen`);
        
        // Platziere Städte
        this.placeBuildingsWithSpacing(map, size, 'city', totalCities, random, 5);
        
        // Platziere Burgen
        this.placeBuildingsWithSpacing(map, size, 'castle', totalCastles, random, 8);
    }

    // Platziere Gebäude mit Mindestabstand
    placeBuildingsWithSpacing(map, size, buildingType, count, random, minSpacing) {
        const placed = [];
        let attempts = 0;
        const maxAttempts = size * size;
        
        while (placed.length < count && attempts < maxAttempts) {
            const x = Math.floor(random() * size);
            const y = Math.floor(random() * size);
            
            // Prüfe ob Position gültig ist
            if (this.isValidBuildingPosition(map, size, x, y, placed, minSpacing)) {
                map[y][x].terrain = buildingType;
                placed.push({ x, y, type: buildingType });
                console.log(`🏘️ ${buildingType} platziert bei (${x}, ${y})`);
            }
            
            attempts++;
        }
        
        if (placed.length < count) {
            console.warn(`⚠️ Nur ${placed.length}/${count} ${buildingType} platziert nach ${attempts} Versuchen`);
        }
    }

    // Prüfe ob Position für Gebäude geeignet ist
    isValidBuildingPosition(map, size, x, y, existingBuildings, minSpacing) {
        // Prüfe Kartengrenzen
        if (x < 1 || x >= size - 1 || y < 1 || y >= size - 1) return false;
        
        // Prüfe ob Terrain geeignet ist (nicht Wasser/Berg)
        const terrain = map[y][x].terrain;
        if (terrain === 'water' || terrain === 'mountain') return false;
        
        // Prüfe Mindestabstand zu anderen Gebäuden
        for (const building of existingBuildings) {
            const distance = Math.sqrt(
                Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2)
            );
            if (distance < minSpacing) return false;
        }
        
        return true;
    }

    // Generiere kreisförmige Features
    generateCircularFeature(map, size, centerX, centerY, maxRadius, terrainType, density, random) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const distance = Math.sqrt(
                    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
                );
                
                if (distance <= maxRadius) {
                    const probability = density * (1 - distance / maxRadius);
                    if (random() < probability) {
                        map[y][x].terrain = terrainType;
                    }
                }
            }
        }
    }

    // Generiere lineare Features (Gebirgsketten)
    generateLinearFeature(map, size, startX, startY, length, terrainType, density, random) {
        const angle = random() * Math.PI * 2;
        const deltaX = Math.cos(angle);
        const deltaY = Math.sin(angle);
        
        for (let i = 0; i < length; i++) {
            const x = Math.round(startX + deltaX * i);
            const y = Math.round(startY + deltaY * i);
            
            if (x >= 0 && x < size && y >= 0 && y < size) {
                if (random() < density) {
                    map[y][x].terrain = terrainType;
                    
                    // Füge Breiten-Variation hinzu
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const varX = x + dx;
                            const varY = y + dy;
                            
                            if (varX >= 0 && varX < size && varY >= 0 && varY < size) {
                                if (random() < density * 0.4) {
                                    map[varY][varX].terrain = terrainType;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Glätte Terrain für natürlicheres Aussehen
    smoothTerrain(map, size, random) {
        const tempMap = JSON.parse(JSON.stringify(map));
        
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                // Nur bei niedriger Wahrscheinlichkeit glätten
                if (random() > 0.1) continue;
                
                const terrainCounts = {};
                
                // Zähle umgebende Terrain-Typen
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const terrain = map[y + dy][x + dx].terrain;
                        terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
                    }
                }
                
                // Finde häufigsten Terrain-Typ
                const mostCommon = Object.keys(terrainCounts).reduce((a, b) =>
                    terrainCounts[a] > terrainCounts[b] ? a : b
                );
                
                // Glätte nur wenn deutliche Mehrheit vorhanden
                if (terrainCounts[mostCommon] >= 6) {
                    tempMap[y][x].terrain = mostCommon;
                }
            }
        }
        
        // Kopiere geglättete Werte zurück
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                map[y][x].terrain = tempMap[y][x].terrain;
            }
        }
    }

    // Stelle sicher, dass alle Landgebiete verbunden sind
    ensureConnectivity(map, size) {
        // Einfache Connectivity-Prüfung und -Korrektur
        // Finde alle Landgebiete und verbinde isolierte Inseln
        
        const visited = new Set();
        const landTiles = [];
        
        // Sammle alle Landfelder
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (map[y][x].terrain !== 'water') {
                    landTiles.push({ x, y });
                }
            }
        }
        
        if (landTiles.length === 0) return;
        
        // Finde größte zusammenhängende Landmasse
        const mainLand = this.findLargestLandmass(map, size, landTiles);
        
        // Verbinde isolierte Gebiete mit Hauptlandmasse
        this.connectIsolatedAreas(map, size, mainLand, landTiles);
    }

    findLargestLandmass(map, size, landTiles) {
        const visited = new Set();
        let largestGroup = [];
        
        for (const tile of landTiles) {
            const key = `${tile.x},${tile.y}`;
            if (visited.has(key)) continue;
            
            const group = this.floodFill(map, size, tile.x, tile.y, visited);
            if (group.length > largestGroup.length) {
                largestGroup = group;
            }
        }
        
        return largestGroup;
    }

    floodFill(map, size, startX, startY, visited) {
        const group = [];
        const stack = [{ x: startX, y: startY }];
        
        while (stack.length > 0) {
            const { x, y } = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            if (x < 0 || x >= size || y < 0 || y >= size) continue;
            if (map[y][x].terrain === 'water') continue;
            
            visited.add(key);
            group.push({ x, y });
            
            // Füge Nachbarn hinzu
            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }
        
        return group;
    }

    connectIsolatedAreas(map, size, mainLand, allLandTiles) {
        // Vereinfachte Verbindung: Wandle einige Wasserfelder in Grasland um
        const mainLandSet = new Set(mainLand.map(t => `${t.x},${t.y}`));
        
        for (const tile of allLandTiles) {
            const key = `${tile.x},${tile.y}`;
            if (mainLandSet.has(key)) continue;
            
            // Finde nächsten Punkt zur Hauptlandmasse
            const nearest = this.findNearestMainLandTile(tile, mainLand);
            if (nearest && this.getDistance(tile, nearest) <= 3) {
                // Erstelle einfache Verbindung
                this.createSimplePath(map, size, tile, nearest);
            }
        }
    }

    findNearestMainLandTile(tile, mainLand) {
        let nearest = null;
        let minDistance = Infinity;
        
        for (const landTile of mainLand) {
            const distance = this.getDistance(tile, landTile);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = landTile;
            }
        }
        
        return nearest;
    }

    getDistance(tile1, tile2) {
        return Math.sqrt(
            Math.pow(tile1.x - tile2.x, 2) + Math.pow(tile1.y - tile2.y, 2)
        );
    }

    createSimplePath(map, size, from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        for (let i = 0; i <= steps; i++) {
            const x = Math.round(from.x + (dx * i) / steps);
            const y = Math.round(from.y + (dy * i) / steps);
            
            if (x >= 0 && x < size && y >= 0 && y < size) {
                if (map[y][x].terrain === 'water') {
                    map[y][x].terrain = 'grass';
                }
            }
        }
    }

    // Validiere generierte Karte
    validateMap(map, size, playerCount) {
        const issues = [];
        const stats = this.calculateMapStats(map, size);
        
        // Prüfe Minimum-Anforderungen
        if (stats.cities < playerCount) {
            issues.push(`Zu wenige Städte: ${stats.cities} < ${playerCount}`);
        }
        
        if (stats.castles < Math.ceil(playerCount / 2)) {
            issues.push(`Zu wenige Burgen: ${stats.castles} < ${Math.ceil(playerCount / 2)}`);
        }
        
        if (stats.landPercentage < 0.6) {
            issues.push(`Zu wenig Land: ${(stats.landPercentage * 100).toFixed(1)}% < 60%`);
        }
        
        if (stats.waterPercentage > 0.4) {
            issues.push(`Zu viel Wasser: ${(stats.waterPercentage * 100).toFixed(1)}% > 40%`);
        }
        
        return {
            valid: issues.length === 0,
            issues: issues,
            stats: stats
        };
    }

    calculateMapStats(map, size) {
        const stats = {
            totalTiles: size * size,
            terrainCounts: {},
            cities: 0,
            castles: 0,
            landPercentage: 0,
            waterPercentage: 0
        };
        
        // Zähle Terrain-Typen
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const terrain = map[y][x].terrain;
                stats.terrainCounts[terrain] = (stats.terrainCounts[terrain] || 0) + 1;
                
                if (terrain === 'city') stats.cities++;
                if (terrain === 'castle') stats.castles++;
            }
        }
        
        // Berechne Prozentsätze
        const waterTiles = stats.terrainCounts.water || 0;
        const landTiles = stats.totalTiles - waterTiles;
        
        stats.waterPercentage = waterTiles / stats.totalTiles;
        stats.landPercentage = landTiles / stats.totalTiles;
        
        return stats;
    }
}

// Export the class
module.exports = ServerMapGenerator;


//AB HIER ALTER CODE    


    generateMap(game) {
        const size = game.settings.mapSize;
        const map = [];
        
        // Generate a seed for this game to ensure all players get the same map
        const gameSeed = game.id || Date.now();
        const random = this.seededRandom(gameSeed);
        
        console.log(`🗺️ Generiere Karte ${size}x${size} für Spiel ${game.name} mit Seed: ${gameSeed}`);
        
        // Initialize map with grass
        for (let y = 0; y < size; y++) {
            map[y] = [];
            for (let x = 0; x < size; x++) {
                map[y][x] = {
                    terrain: 'grass',
                    unit: null,
                    owner: null,
                    resources: null
                };
            }
        }
        
        // Generate terrain features using seeded random
        this.generateWater(map, size, random);
        this.generateMountains(map, size, random);
        this.generateForests(map, size, random);
        this.generateBuildings(map, size, game.players.length, random);
        
        game.map = map;
        game.mapSeed = gameSeed; // Store seed for debugging
        console.log(`✅ Karte generiert für ${game.name}`);
    }

    // Seeded random number generator for consistent map generation
    seededRandom(seed) {
        let value = seed;
        return function() {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }

    generateWater(map, size, random) {
        const waterBodies = Math.max(1, Math.floor(size / 15));
        
        for (let i = 0; i < waterBodies; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const radius = 2 + Math.floor(random() * 4);
            
            this.generateCircularFeature(map, centerX, centerY, radius, 'water', 0.7, size);
        }
    }

    generateMountains(map, size, random) {
        const mountainChains = Math.max(1, Math.floor(size / 20));
        
        for (let i = 0; i < mountainChains; i++) {
            const startX = Math.floor(random() * size);
            const startY = Math.floor(random() * size);
            const length = 5 + Math.floor(random() * 10);
            
            this.generateLinearFeature(map, startX, startY, length, 'mountain', 0.6, size);
        }
    }

    generateForests(map, size, random) {
        const forestPatches = Math.max(2, Math.floor(size / 8));
        
        for (let i = 0; i < forestPatches; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const radius = 3 + Math.floor(random() * 5);
            
            this.generateCircularFeature(map, centerX, centerY, radius, 'forest', 0.5, size);
        }
    }

    generateBuildings(map, size, playerCount, random) {
        // Generate cities (2-3 per player)
        const cityCount = Math.max(playerCount * 2, Math.floor(size / 12));
        
        for (let i = 0; i < cityCount; i++) {
            this.placeBuildingRandomly(map, size, 'city', random);
        }
        
        // Generate castles (1 per 2 players)
        const castleCount = Math.max(Math.floor(playerCount / 2), Math.floor(size / 20));
        
        for (let i = 0; i < castleCount; i++) {
            this.placeBuildingRandomly(map, size, 'castle', random);
        }
    }

    generateCircularFeature(map, centerX, centerY, radius, terrainType, density, size) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                if (x < 0 || x >= size || y < 0 || y >= size) continue;
                
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (distance <= radius && Math.random() < density) {
                    map[y][x].terrain = terrainType;
                }
            }
        }
    }

    generateLinearFeature(map, startX, startY, length, terrainType, density, size) {
        const angle = Math.random() * Math.PI * 2;
        const deltaX = Math.cos(angle);
        const deltaY = Math.sin(angle);
        
        for (let i = 0; i < length; i++) {
            const x = Math.round(startX + deltaX * i);
            const y = Math.round(startY + deltaY * i);
            
            if (x < 0 || x >= size || y < 0 || y >= size) continue;
            
            if (Math.random() < density) {
                map[y][x].terrain = terrainType;
                
                // Add some width variation
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const varX = x + dx;
                        const varY = y + dy;
                        
                        if (varX >= 0 && varX < size && varY >= 0 && varY < size && Math.random() < density * 0.5) {
                            map[varY][varX].terrain = terrainType;
                        }
                    }
                }
            }
        }
    }

    placeBuildingRandomly(map, size, buildingType, random) {
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            const x = Math.floor(random() * size);
            const y = Math.floor(random() * size);
            
            if (this.canPlaceBuilding(map, x, y, size)) {
                map[y][x].terrain = buildingType;
                return true;
            }
            attempts++;
        }
        
        return false;
    }

    canPlaceBuilding(map, x, y, size) {
        if (x < 0 || x >= size || y < 0 || y >= size) return false;
        
        const terrain = map[y][x].terrain;
        if (terrain !== 'grass') return false;
        
        // Check surrounding area for other buildings
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (checkX >= 0 && checkX < size && checkY >= 0 && checkY < size) {
                    const checkTerrain = map[checkY][checkX].terrain;
                    if (checkTerrain === 'city' || checkTerrain === 'castle') {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    // ========================================
    // STARTING POSITIONS
    // ========================================

    generateStartingPositions(game) {
        console.log(`🏠 Generiere Startpositionen für ${game.players.length} Spieler`);
        
        game.players.forEach((player, index) => {
            if (player.defeated) return;
            
            const startPos = this.findStartingPosition(game, index);
            
            // Create starting unit (basic unit from race)
            const startingUnit = this.createStartingUnit(player, startPos);
            if (startingUnit) {
                player.units.push(startingUnit);
                game.map[startPos.y][startPos.x].unit = startingUnit;
                
                console.log(`👤 Starteinheit für ${player.name} bei (${startPos.x}, ${startPos.y})`);
            }
            
            // Assign starting city if near one
            this.assignStartingBuildings(game, player, startPos);
        });
    }

    findStartingPosition(game, playerIndex) {
        const size = game.settings.mapSize;
        const map = game.map;
        
        // Try to place players in different corners/edges
        const positions = [
            { x: 2, y: 2 }, // Top-left
            { x: size - 3, y: size - 3 }, // Bottom-right
            { x: 2, y: size - 3 }, // Bottom-left
            { x: size - 3, y: 2 }, // Top-right
            { x: size / 2, y: 2 }, // Top-center
            { x: size / 2, y: size - 3 }, // Bottom-center
            { x: 2, y: size / 2 }, // Left-center
            { x: size - 3, y: size / 2 } // Right-center
        ];
        
        const preferredPos = positions[playerIndex % positions.length];
        
        // Find nearest suitable position
        for (let radius = 0; radius < 10; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const x = Math.floor(preferredPos.x + dx);
                    const y = Math.floor(preferredPos.y + dy);
                    
                    if (x >= 0 && x < size && y >= 0 && y < size) {
                        const tile = map[y][x];
                        if (tile.terrain === 'grass' && !tile.unit) {
                            return { x, y };
                        }
                    }
                }
            }
        }
        
        // Fallback: random position
        return {
            x: Math.floor(Math.random() * size),
            y: Math.floor(Math.random() * size)
        };
    }

    createStartingUnit(player, position) {
        // This would use race data to create appropriate starting unit
        // For now, create a basic unit
        return {
            id: 'unit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            ownerId: player.id,
            type: 'basic_warrior',
            x: position.x,
            y: position.y,
            level: 1,
            currentHp: 50,
            maxHp: 50,
            attack: 10,
            defense: 8,
            movement: 3,
            attackRange: 1,
            hasMoved: false,
            hasActed: false
        };
    }

    assignStartingBuildings(game, player, startPos) {
        const map = game.map;
        const size = game.settings.mapSize;
        
        // Look for nearby cities within 5 tiles
        for (let radius = 1; radius <= 5; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const x = startPos.x + dx;
                    const y = startPos.y + dy;
                    
                    if (x >= 0 && x < size && y >= 0 && y < size) {
                        const tile = map[y][x];
                        if (tile.terrain === 'city' && !tile.owner) {
                            tile.owner = player.id;
                            player.buildings.push({
                                x: x,
                                y: y,
                                type: 'city',
                                goldIncome: 2
                            });
                            console.log(`🏘️ ${player.name} erhält Startstadt bei (${x}, ${y})`);
                            return; // Only one starting city
                        }
                    }
                }
            }
        }
    }

    // ========================================
    // TURN SYSTEM
    // ========================================

    setupTurnOrder(game) {
        // Create a copy of players array and shuffle it
        const players = [...game.players];
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
        }
        
        game.turnOrder = players;
        game.currentTurnIndex = 0;
        
        console.log(`🎯 Zugreihenfolge für ${game.name}:`, players.map(p => p.name));
    }

    generateStartingPositions(game) {
        console.log(`🏗️ Generiere Startpositionen für ${game.name}`);
        
        const mapSize = game.settings.mapSize;
        const players = game.players;
        
        // Find starting positions (cities or castles)
        const startingPositions = [];
        
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                const tile = game.map[y][x];
                if (tile.terrain === 'city' || tile.terrain === 'castle') {
                    startingPositions.push({ x, y, terrain: tile.terrain });
                }
            }
        }
        
        // Assign starting positions to players
        players.forEach((player, index) => {
            if (startingPositions[index]) {
                const pos = startingPositions[index];
                player.startingPosition = pos;
                
                // Mark tile as owned
                game.map[pos.y][pos.x].owner = player.id;
                
                console.log(`📍 ${player.name} startet bei (${pos.x}, ${pos.y}) - ${pos.terrain}`);
            } else {
                // Fallback: random position
                const x = Math.floor(Math.random() * mapSize);
                const y = Math.floor(Math.random() * mapSize);
                player.startingPosition = { x, y, terrain: 'grass' };
                game.map[y][x].owner = player.id;
                
                console.log(`📍 ${player.name} startet bei (${x}, ${y}) - Fallback`);
            }
        });
    }

    startTurnTimer(game) {
        const timeLimit = game.settings.turnTimeLimit || this.config.TURN_TIME_LIMIT;
        
        console.log(`⏰ Starte Zug-Timer für ${game.name}: ${timeLimit} Sekunden`);
        
        const timer = setInterval(() => {
            const gameInstance = this.games.get(game.id);
            if (!gameInstance) {
                clearInterval(timer);
                return;
            }
            
            const elapsed = Math.floor((new Date() - gameInstance.turnStartTime) / 1000);
            const remaining = timeLimit - elapsed;
            
            if (remaining <= 0) {
                this.forceTurnEnd(gameInstance);
            } else {
                // Send time update to current player
                const currentPlayer = this.getCurrentPlayer(gameInstance);
                if (currentPlayer) {
                    io.to(currentPlayer.socketId).emit('turn-timer-update', {
                        remaining: remaining,
                        total: timeLimit
                    });
                }
            }
        }, 1000);
        
        this.turnTimers.set(game.id, timer);
    }

    getCurrentPlayer(game) {
        if (!game.turnOrder || game.turnOrder.length === 0) return null;
        return game.turnOrder[game.currentTurnIndex];
    }

    checkWinCondition(game) {
        const activePlayers = game.players.filter(p => !p.defeated);
        
        if (activePlayers.length === 1) {
            // Game won by remaining player
            const winner = activePlayers[0];
            game.status = 'finished';
            game.winner = winner.id;
            
            console.log(`🏆 Spiel ${game.name} beendet! Gewinner: ${winner.name}`);
            
            io.to(game.id).emit('game-ended', {
                winner: winner.name,
                winnerId: winner.id,
                message: `${winner.name} hat das Spiel gewonnen!`
            });
            
            return true;
        } else if (activePlayers.length === 0) {
            // All players defeated (draw)
            game.status = 'finished';
            game.winner = null;
            
            console.log(`🤝 Spiel ${game.name} beendet! Unentschieden - alle Spieler besiegt`);
            
            io.to(game.id).emit('game-ended', {
                winner: null,
                message: 'Unentschieden - alle Spieler besiegt!'
            });
            
            return true;
        }
        
        return false;
    }

    endGame(game, winner) {
        console.log(`🏁 Spiel ${game.name} beendet. Gewinner: ${winner?.name || 'Unentschieden'}`);
        
        game.status = 'finished';
        game.gamePhase = 'finished';
        
        this.clearTurnTimer(game.id);
        
        // Notify all players
        io.to(game.id).emit('game-ended', {
            winner: winner?.name,
            winnerId: winner?.id,
            finalTurn: game.turnNumber,
            duration: Date.now() - game.createdAt.getTime()
        });
        
        // Clean up game after delay
        setTimeout(() => {
            this.deleteGame(game.id);
        }, 30000); // 30 seconds
    }

    // ========================================
    // UNIT ACTIONS
    // ========================================

    moveUnit(game, playerId, unitId, fromX, fromY, toX, toY) {
        const player = game.players.find(p => p.id === playerId || p.socketId === playerId);
        if (!player) {
            return { success: false, error: 'Spieler nicht gefunden' };
        }

        const unit = player.units.find(u => u.id === unitId);
        if (!unit) {
            return { success: false, error: 'Einheit nicht gefunden' };
        }

        if (unit.hasMoved) {
            return { success: false, error: 'Einheit hat sich bereits bewegt' };
        }

        // Validate movement
        const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY);
        if (distance > unit.movement) {
            return { success: false, error: 'Bewegung zu weit' };
        }

        if (!this.isValidPosition(game, toX, toY)) {
            return { success: false, error: 'Ungültige Position' };
        }

        const targetTile = game.map[toY][toX];
        if (targetTile.unit) {
            return { success: false, error: 'Zielfeld besetzt' };
        }

        // Execute movement
        game.map[fromY][fromX].unit = null;
        game.map[toY][toX].unit = unit;
        
        unit.x = toX;
        unit.y = toY;
        unit.hasMoved = true;

        console.log(`🚶 ${player.name} bewegt Einheit von (${fromX},${fromY}) nach (${toX},${toY})`);

        // Record action
        this.recordAction(game, {
            type: 'move_unit',
            playerId: player.id,
            unitId: unitId,
            from: { x: fromX, y: fromY },
            to: { x: toX, y: toY },
            timestamp: new Date()
        });

        return { success: true, unit: unit };
    }

    attackUnit(game, playerId, attackerUnitId, defenderUnitId) {
        const player = game.players.find(p => p.id === playerId || p.socketId === playerId);
        if (!player) {
            return { success: false, error: 'Spieler nicht gefunden' };
        }

        const attackerUnit = player.units.find(u => u.id === attackerUnitId);
        if (!attackerUnit) {
            return { success: false, error: 'Angreifer nicht gefunden' };
        }

        if (attackerUnit.hasActed) {
            return { success: false, error: 'Einheit hat bereits gehandelt' };
        }

        // Find defender
        let defenderUnit = null;
        let defenderPlayer = null;

        for (const p of game.players) {
            const unit = p.units.find(u => u.id === defenderUnitId);
            if (unit) {
                defenderUnit = unit;
                defenderPlayer = p;
                break;
            }
        }

        if (!defenderUnit) {
            return { success: false, error: 'Verteidiger nicht gefunden' };
        }

        // Check range
        const distance = Math.abs(attackerUnit.x - defenderUnit.x) + Math.abs(attackerUnit.y - defenderUnit.y);
        if (distance > attackerUnit.attackRange) {
            return { success: false, error: 'Ziel außer Reichweite' };
        }

        // Calculate damage
        const damage = Math.max(1, attackerUnit.attack - defenderUnit.defense);
        defenderUnit.currentHp = Math.max(0, defenderUnit.currentHp - damage);

        attackerUnit.hasActed = true;

        console.log(`⚔️ ${player.name} greift ${defenderPlayer.name} an. Schaden: ${damage}`);

        const combatResult = {
            attackerId: attackerUnitId,
            defenderId: defenderUnitId,
            damage: damage,
            defenderHp: defenderUnit.currentHp,
            defenderDestroyed: defenderUnit.currentHp <= 0
        };

        // Handle unit destruction
        if (defenderUnit.currentHp <= 0) {
            this.destroyUnit(game, defenderPlayer, defenderUnit);
            combatResult.defenderDestroyed = true;
        }

        // Record action
        this.recordAction(game, {
            type: 'attack_unit',
            playerId: player.id,
            attackerUnitId: attackerUnitId,
            defenderUnitId: defenderUnitId,
            damage: damage,
            destroyed: combatResult.defenderDestroyed,
            timestamp: new Date()
        });

        return { success: true, combat: combatResult };
    }

    destroyUnit(game, player, unit) {
        // Remove from map
        if (game.map && game.map[unit.y] && game.map[unit.y][unit.x]) {
            game.map[unit.y][unit.x].unit = null;
        }
        
        // Remove from player's units
        const unitIndex = player.units.findIndex(u => u.id === unit.id);
        if (unitIndex !== -1) {
            player.units.splice(unitIndex, 1);
        }
        
        console.log(`💀 Einheit ${unit.id} von ${player.name} zerstört`);
        
        // Check if player has no units left (potential defeat)
        if (player.units.length === 0 && player.buildings.length === 0) {
            player.defeated = true;
            console.log(`💀 ${player.name} wurde besiegt!`);
            
            // Notify all players
            io.to(game.id).emit('player-defeated', {
                playerName: player.name,
                playerId: player.id
            });
        }
    }

    buyUnit(game, playerId, unitType, x, y) {
        const player = game.players.find(p => p.id === playerId || p.socketId === playerId);
        if (!player) {
            return { success: false, error: 'Spieler nicht gefunden' };
        }

        // Get unit definition (this would normally come from race data)
        const unitDef = this.getUnitDefinition(unitType, player.raceId);
        if (!unitDef) {
            return { success: false, error: 'Einheitentyp nicht gefunden' };
        }

        if (player.gold < unitDef.cost) {
            return { success: false, error: 'Nicht genug Gold' };
        }

        if (!this.isValidPosition(game, x, y)) {
            return { success: false, error: 'Ungültige Position' };
        }

        const targetTile = game.map[y][x];
        if (targetTile.unit) {
            return { success: false, error: 'Position besetzt' };
        }

        // Check if position is near owned building
        if (!this.canSpawnUnitAt(game, player, x, y)) {
            return { success: false, error: 'Muss neben eigener Stadt spawnen' };
        }

        // Create unit
        const newUnit = {
            id: 'unit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            ownerId: player.id,
            type: unitType,
            x: x,
            y: y,
            level: 1,
            currentHp: unitDef.hp,
            maxHp: unitDef.hp,
            attack: unitDef.attack,
            defense: unitDef.defense,
            movement: unitDef.movement,
            attackRange: unitDef.attackRange || 1,
            hasMoved: false,
            hasActed: false
        };

        // Deduct gold
        player.gold -= unitDef.cost;

        // Add unit
        player.units.push(newUnit);
        game.map[y][x].unit = newUnit;

        console.log(`🛒 ${player.name} kauft ${unitType} bei (${x},${y}) für ${unitDef.cost} Gold`);

        // Record action
        this.recordAction(game, {
            type: 'buy_unit',
            playerId: player.id,
            unitType: unitType,
            position: { x, y },
            cost: unitDef.cost,
            timestamp: new Date()
        });

        return { success: true, unit: newUnit, remainingGold: player.gold };
    }

    upgradeUnit(game, playerId, unitId) {
        const player = game.players.find(p => p.id === playerId || p.socketId === playerId);
        if (!player) {
            return { success: false, error: 'Spieler nicht gefunden' };
        }

        const unit = player.units.find(u => u.id === unitId);
        if (!unit) {
            return { success: false, error: 'Einheit nicht gefunden' };
        }

        if (unit.level >= 5) {
            return { success: false, error: 'Maximales Level erreicht' };
        }

        const upgradeCost = this.getUpgradeCost(unit);
        if (player.gold < upgradeCost) {
            return { success: false, error: 'Nicht genug Gold' };
        }

        // Deduct gold
        player.gold -= upgradeCost;

        // Upgrade unit
        const oldHpRatio = unit.currentHp / unit.maxHp;
        unit.level++;
        
        const multiplier = 1 + ((unit.level - 1) * 0.2);
        const baseStats = this.getUnitDefinition(unit.type, player.raceId);
        
        unit.maxHp = Math.floor(baseStats.hp * multiplier);
        unit.attack = Math.floor(baseStats.attack * multiplier);
        unit.defense = Math.floor(baseStats.defense * multiplier);
        unit.currentHp = Math.floor(unit.maxHp * oldHpRatio);

        console.log(`⬆️ ${player.name} wertet Einheit ${unit.id} auf Level ${unit.level} auf`);

        // Record action
        this.recordAction(game, {
            type: 'upgrade_unit',
            playerId: player.id,
            unitId: unitId,
            newLevel: unit.level,
            cost: upgradeCost,
            timestamp: new Date()
        });

        return { success: true, unit: unit, remainingGold: player.gold };
    }

    captureBuilding(game, playerId, x, y) {
        const player = game.players.find(p => p.id === playerId || p.socketId === playerId);
        if (!player) {
            return { success: false, error: 'Spieler nicht gefunden' };
        }

        if (!this.isValidPosition(game, x, y)) {
            return { success: false, error: 'Ungültige Position' };
        }

        const tile = game.map[y][x];
        if (tile.terrain !== 'city' && tile.terrain !== 'castle') {
            return { success: false, error: 'Kein eroberbares Gebäude' };
        }

        if (tile.owner === player.id) {
            return { success: false, error: 'Gebäude bereits besessen' };
        }

        // Check if player has unit on or adjacent to building
        const hasAdjacentUnit = this.hasPlayerUnitAdjacent(game, player, x, y);
        if (!hasAdjacentUnit) {
            return { success: false, error: 'Benötigt Einheit in der Nähe' };
        }

        // Remove from previous owner
        if (tile.owner) {
            const previousOwner = game.players.find(p => p.id === tile.owner);
            if (previousOwner) {
                const buildingIndex = previousOwner.buildings.findIndex(b => b.x === x && b.y === y);
                if (buildingIndex !== -1) {
                    previousOwner.buildings.splice(buildingIndex, 1);
                }
            }
        }

        // Assign to new owner
        tile.owner = player.id;
        
        const building = {
            x: x,
            y: y,
            type: tile.terrain,
            goldIncome: tile.terrain === 'city' ? 2 : 5
        };
        
        player.buildings.push(building);

        console.log(`🏰 ${player.name} erobert ${tile.terrain} bei (${x},${y})`);

        // Record action
        this.recordAction(game, {
            type: 'capture_building',
            playerId: player.id,
            buildingType: tile.terrain,
            position: { x, y },
            timestamp: new Date()
        });

        return { success: true, building: building };
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    isValidPosition(game, x, y) {
        const size = game.settings.mapSize;
        return x >= 0 && x < size && y >= 0 && y < size;
    }

    canSpawnUnitAt(game, player, x, y) {
        // Check if position is adjacent to owned city
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (this.isValidPosition(game, checkX, checkY)) {
                    const tile = game.map[checkY][checkX];
                    if (tile.terrain === 'city' && tile.owner === player.id) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    hasPlayerUnitAdjacent(game, player, x, y) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (this.isValidPosition(game, checkX, checkY)) {
                    const tile = game.map[checkY][checkX];
                    if (tile.unit && tile.unit.ownerId === player.id) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getUnitDefinition(unitType, raceId) {
        // This would normally load from race definitions
        // For now, return basic unit stats
        const basicUnits = {
            'basic_warrior': {
                cost: 25,
                hp: 50,
                attack: 15,
                defense: 10,
                movement: 3,
                attackRange: 1
            },
            'archer': {
                cost: 30,
                hp: 35,
                attack: 12,
                defense: 6,
                movement: 3,
                attackRange: 3
            },
            'knight': {
                cost: 50,
                hp: 70,
                attack: 20,
                defense: 18,
                movement: 4,
                attackRange: 1
            }
        };
        
        return basicUnits[unitType] || basicUnits['basic_warrior'];
    }

    getUpgradeCost(unit) {
        const baseCost = this.getUnitDefinition(unit.type).cost;
        return Math.floor(baseCost * Math.pow(1.5, unit.level - 1));
    }

    recordAction(game, action) {
        action.id = ++game.lastActionId;
        game.actionHistory.push(action);
        
        // Keep only last 100 actions
        if (game.actionHistory.length > 100) {
            game.actionHistory.shift();
        }
    }

    // ========================================
    // READY SYSTEM
    // ========================================

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
        const enoughPlayers = game.players.length >= this.config.MIN_PLAYERS;
        const allReady = game.players.every(p => p.ready);
        const isWaiting = game.status === 'waiting';

        return isHost && enoughPlayers && allReady && isWaiting;
    }

    startGame(gameId) {
        const game = this.games.get(gameId);
        if (!game) return null;

        game.status = 'race_selection';
        game.gamePhase = 'race_selection';
        console.log(`🎮 Spiel gestartet: ${game.name} - Rassen-Auswahl beginnt`);
        return game;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

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

    getPlayerBySocketId(socketId) {
        for (const game of this.games.values()) {
            const player = game.players.find(p => p.socketId === socketId);
            if (player) {
                return { player, game };
            }
        }
        return null;
    }

    // ========================================
    // GAME STATE SERIALIZATION
    // ========================================

    getGameStateForPlayer(game, playerId) {
        const player = game.players.find(p => p.id === playerId || p.socketId === playerId);
        if (!player) return null;

        return {
            gameId: game.id,
            gamePhase: game.gamePhase,
            status: game.status,
            turnNumber: game.turnNumber,
            currentTurnPlayer: this.getCurrentPlayer(game)?.name,
            isMyTurn: this.getCurrentPlayer(game)?.id === player.id,
            
            // Player data
            player: {
                id: player.id,
                name: player.name,
                raceId: player.raceId,
                gold: player.gold,
                units: player.units,
                buildings: player.buildings,
                defeated: player.defeated
            },
            
            // Other players (limited info)
            otherPlayers: game.players
                .filter(p => p.id !== player.id)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    raceId: p.raceId,
                    unitCount: p.units.length,
                    buildingCount: p.buildings.length,
                    defeated: p.defeated
                })),
            
            // Map (visible areas only - for now send full map)
            map: game.map,
            mapSize: game.settings.mapSize,
            
            // Game settings
            settings: game.settings
        };
    }

    clearTurnTimer(gameId) {
        const timer = this.turnTimers.get(gameId);
        if (timer) {
            clearInterval(timer);
            this.turnTimers.delete(gameId);
        }
    }

    nextTurn(game) {
        console.log(`⏭️ Nächster Zug in Spiel ${game.name}`);
        
        // Clear current turn timer
        this.clearTurnTimer(game.id);
        
        // Generate gold income for current player
        this.generateGoldIncome(game);
        
        // Reset unit states for current player
        this.resetUnitsForNewTurn(game);
        
        // Move to next player
        do {
            game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
            
            // New round started
            if (game.currentTurnIndex === 0) {
                game.turnNumber++;
                console.log(`🔄 Neue Runde ${game.turnNumber} in Spiel ${game.name}`);
            }
        } while (this.getCurrentPlayer(game)?.defeated);
        
        // Check win condition
        if (this.checkWinCondition(game)) {
            return; // Game ended
        }
        
        // Start new turn
        game.turnStartTime = new Date();
        this.startTurnTimer(game);
        
        const currentPlayer = this.getCurrentPlayer(game);
        console.log(`🎯 ${currentPlayer.name} ist jetzt dran`);
        
        // Notify all players
        io.to(game.id).emit('turn-started', {
            currentPlayer: currentPlayer.name,
            currentPlayerId: currentPlayer.id,
            turnNumber: game.turnNumber,
            timeLimit: game.settings.turnTimeLimit
        });
    }

    forceTurnEnd(game) {
        const currentPlayer = this.getCurrentPlayer(game);
        console.log(`⏰ Erzwinge Zugwende für ${currentPlayer?.name} in Spiel ${game.name}`);
        
        // Notify current player
        if (currentPlayer) {
            io.to(currentPlayer.socketId).emit('turn-forced', {
                message: 'Zeit abgelaufen! Zug wird automatisch beendet.'
            });
        }
        
        this.nextTurn(game);
    }

    generateGoldIncome(game) {
        const currentPlayer = this.getCurrentPlayer(game);
        if (!currentPlayer) return;
        
        let income = 0;
        
        // Calculate income from buildings
        currentPlayer.buildings.forEach(building => {
            if (building.type === 'city') income += 2;
            if (building.type === 'castle') income += 5;
        });
        
        // Apply multipliers (race bonuses, etc.)
        income = Math.floor(income * this.config.GOLD_INCOME_MULTIPLIER);
        
        if (income > 0) {
            currentPlayer.gold += income;
            
            console.log(`💰 ${currentPlayer.name} erhält ${income} Gold (Gesamt: ${currentPlayer.gold})`);
            
            // Notify player
            io.to(currentPlayer.socketId).emit('gold-updated', {
                amount: currentPlayer.gold,
                income: income,
                source: 'buildings'
            });
        }
    }

    resetUnitsForNewTurn(game) {
        const currentPlayer = this.getCurrentPlayer(game);
        if (!currentPlayer) return;
        
        currentPlayer.units.forEach(unit => {
            unit.hasMoved = false;
            unit.hasActed = false;
        });
        
        console.log(`🔄 Einheiten für ${currentPlayer.name} zurückgesetzt`);
    }
}

const gameManager = new EnhancedGameManager();

// ========================================
// SOCKET.IO EVENT HANDLING
// ========================================

io.on('connection', (socket) => {
    console.log(`🔗 Neuer Client verbunden: ${socket.id}`);

    // ========================================
    // LOBBY EVENTS
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
                    map: game.map, // Send the generated map to all clients
                    message: 'Spiel gestartet! Rassen-Auswahl beginnt.'
                });

                // Emit race-selection-phase event to trigger race selection UI
                io.to(data.gameId).emit('race-selection-phase', {
                    game: game,
                    message: 'Rassen-Auswahl beginnt'
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
    // RACE SELECTION EVENTS
    // ========================================

    socket.on('select-race', (data) => {
        console.log('🏛️ Rassen-Auswahl erhalten:', data);
        
        // Find the player by socket ID first
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('race-selection-failed', { error: 'Spiel nicht gefunden' });
            return;
        }
        
        // Find player by socket ID
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) {
            console.error('❌ Spieler nicht im Spiel gefunden:', socket.id);
            socket.emit('race-selection-failed', { error: 'Spieler nicht im Spiel gefunden' });
            return;
        }
        
        console.log(`✅ Spieler gefunden: ${player.name} (ID: ${player.id}, Socket: ${player.socketId})`);
        
        // Use the found player's ID for race selection
        const result = gameManager.selectRace(data.gameId, player.id, data.raceId);
        
        if (result.success) {
            // Notify all players about race selection
            io.to(data.gameId).emit('race-selected', {
                playerName: player.name,
                playerId: player.id,
                raceId: data.raceId
            });
            
            console.log(`🏛️ Rasse gewählt: ${player.name} hat ${data.raceId} gewählt`);
            
            // If all races selected, start the game
            if (result.allSelected) {
                console.log('🎯 Alle Rassen gewählt - starte Spiel...');
                
                const startedGame = gameManager.startGameAfterRaceSelection(result.game);
                
                io.to(data.gameId).emit('all-races-selected', {
                    game: startedGame,
                    map: startedGame.map, // Send the generated map to all clients
                    message: 'Alle Rassen gewählt! Spiel beginnt...'
                });
                
                // Start first turn
                setTimeout(() => {
                    gameManager.nextTurn(startedGame);
                }, 2000);
            }
        } else {
            console.error('❌ Rassen-Auswahl fehlgeschlagen:', result.error);
            socket.emit('race-selection-failed', {
                error: result.error
            });
        }
    });

    // ========================================
    // GAMEPLAY EVENTS
    // ========================================

    socket.on('end-turn', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('end-turn-failed', { error: 'Spiel nicht gefunden' });
            return;
        }

        const currentPlayer = gameManager.getCurrentPlayer(game);
        if (!currentPlayer || currentPlayer.socketId !== socket.id) {
            socket.emit('end-turn-failed', { error: 'Nicht am Zug' });
            return;
        }

        gameManager.nextTurn(game);
    });

    socket.on('move-unit', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('move-unit-failed', { error: 'Spiel nicht gefunden' });
            return;
        }

        const result = gameManager.moveUnit(
            game, 
            socket.id, 
            data.unitId, 
            data.fromX, 
            data.fromY, 
            data.toX, 
            data.toY
        );

        if (result.success) {
            io.to(data.gameId).emit('unit-moved', {
                unitId: data.unitId,
                fromX: data.fromX,
                fromY: data.fromY,
                toX: data.toX,
                toY: data.toY,
                unit: result.unit
            });
        } else {
            socket.emit('move-unit-failed', { error: result.error });
        }
    });

    socket.on('attack-unit', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('attack-unit-failed', { error: 'Spiel nicht gefunden' });
            return;
        }

        const result = gameManager.attackUnit(
            game,
            socket.id,
            data.attackerId,
            data.defenderId
        );

        if (result.success) {
            io.to(data.gameId).emit('unit-attacked', {
                attackerId: data.attackerId,
                defenderId: data.defenderId,
                damage: result.combat.damage,
                defenderHp: result.combat.defenderHp,
                defenderDestroyed: result.combat.defenderDestroyed
            });
        } else {
            socket.emit('attack-unit-failed', { error: result.error });
        }
    });

    socket.on('buy-unit', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('buy-unit-failed', { error: 'Spiel nicht gefunden' });
            return;
        }

        const result = gameManager.buyUnit(
            game,
            socket.id,
            data.unitType,
            data.x,
            data.y
        );

        if (result.success) {
            io.to(data.gameId).emit('unit-purchased', {
                playerId: socket.id,
                unit: result.unit,
                position: { x: data.x, y: data.y },
                cost: result.unit.cost
            });

            socket.emit('gold-updated', {
                amount: result.remainingGold
            });
        } else {
            socket.emit('buy-unit-failed', { error: result.error });
        }
    });

    socket.on('upgrade-unit', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('upgrade-unit-failed', { error: 'Spiel nicht gefunden' });
            return;
        }

        const result = gameManager.upgradeUnit(
            game,
            socket.id,
            data.unitId
        );

        if (result.success) {
            socket.emit('unit-upgraded', {
                unit: result.unit,
                remainingGold: result.remainingGold
            });

            socket.emit('gold-updated', {
                amount: result.remainingGold
            });
        } else {
            socket.emit('upgrade-unit-failed', { error: result.error });
        }
    });

    socket.on('capture-building', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('capture-building-failed', { error: 'Spiel nicht gefunden' });
            return;
        }

        const result = gameManager.captureBuilding(
            game,
            socket.id,
            data.x,
            data.y
        );

        if (result.success) {
            io.to(data.gameId).emit('building-captured', {
                playerId: socket.id,
                building: result.building,
                position: { x: data.x, y: data.y }
            });
        } else {
            socket.emit('capture-building-failed', { error: result.error });
        }
    });

    // ========================================
    // UTILITY EVENTS
    // ========================================

    socket.on('get-game-state', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) {
            socket.emit('game-state-failed', { error: 'Spiel nicht gefunden' });
            return;
        }

        const gameState = gameManager.getGameStateForPlayer(game, socket.id);
        socket.emit('game-state', gameState);
    });

    socket.on('get-turn-info', (data) => {
        const game = gameManager.games.get(data.gameId);
        if (!game) return;

        const currentPlayer = gameManager.getCurrentPlayer(game);
        socket.emit('turn-info', {
            currentPlayer: currentPlayer?.name,
            currentPlayerId: currentPlayer?.id,
            turnNumber: game.turnNumber,
            isMyTurn: currentPlayer?.socketId === socket.id,
            remainingTime: game.settings.turnTimeLimit
        });
    });

    socket.on('request-games-list', () => {
        socket.emit('games-list', gameManager.getPublicGames());
    });

    socket.on('ping', () => {
        socket.emit('pong');
    });

    // ========================================
    // DISCONNECT HANDLING
    // ========================================

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
    
    // Clear all turn timers
    for (const [gameId, timer] of gameManager.turnTimers) {
        clearInterval(timer);
    }
    
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

// ========================================
// PERIODIC MAINTENANCE
// ========================================

setInterval(() => {
    const stats = {
        players: gameManager.players.size,
        games: gameManager.games.size,
        activeGames: Array.from(gameManager.games.values()).filter(g => g.status === 'playing').length
    };
    
    console.log(`📊 Status: ${stats.players} Spieler, ${stats.games} Spiele (${stats.activeGames} aktiv)`);
    
    // Clean up old finished games
    const now = Date.now();
    const gameCleanupThreshold = 30 * 60 * 1000; // 30 minutes
    
    for (const [gameId, game] of gameManager.games.entries()) {
        if (game.status === 'finished') {
            const timeSinceFinish = now - game.finishedAt?.getTime();
            if (timeSinceFinish > gameCleanupThreshold) {
                gameManager.deleteGame(gameId);
                console.log(`🧹 Altes Spiel bereinigt: ${game.name}`);
            }
        }
    }
    
}, 5 * 60 * 1000); // Every 5 minutes

// ========================================
// DEBUG UTILITIES (Development)
// ========================================

if (process.env.NODE_ENV === 'development') {
    // Debug endpoint to view game state
    app.get('/debug/games', (req, res) => {
        const games = Array.from(gameManager.games.values()).map(game => ({
            id: game.id,
            name: game.name,
            status: game.status,
            gamePhase: game.gamePhase,
            players: game.players.map(p => ({
                name: p.name,
                ready: p.ready,
                raceId: p.raceId,
                gold: p.gold,
                unitCount: p.units?.length || 0,
                buildingCount: p.buildings?.length || 0,
                defeated: p.defeated
            })),
            turnNumber: game.turnNumber,
            currentTurnPlayer: gameManager.getCurrentPlayer(game)?.name,
            mapSize: game.settings?.mapSize,
            createdAt: game.createdAt,
            actionCount: game.actionHistory?.length || 0
        }));
        
        res.json({
            totalGames: games.length,
            totalPlayers: gameManager.players.size,
            games: games
        });
    });
    
    // Debug endpoint to simulate player actions
    app.post('/debug/simulate-action', (req, res) => {
        const { gameId, action, params } = req.body;
        const game = gameManager.games.get(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        try {
            let result;
            
            switch (action) {
                case 'next-turn':
                    gameManager.nextTurn(game);
                    result = { message: 'Turn advanced' };
                    break;
                    
                case 'add-gold':
                    const player = game.players.find(p => p.name === params.playerName);
                    if (player) {
                        player.gold += params.amount || 100;
                        result = { message: `Added ${params.amount || 100} gold to ${player.name}` };
                    } else {
                        result = { error: 'Player not found' };
                    }
                    break;
                    
                case 'end-game':
                    const winner = game.players[0];
                    gameManager.endGame(game, winner);
                    result = { message: `Game ended, winner: ${winner.name}` };
                    break;
                    
                default:
                    result = { error: 'Unknown action' };
            }
            
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    console.log('🔧 Debug-Endpunkte aktiviert (Development-Modus)');
}