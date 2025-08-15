// game-state.js - Zentrales Zustandsmanagement (Komplett)

console.log('🎮 Initialisiere Game State Manager...');

// ========================================
// GLOBAL GAME STATE
// ========================================

class GameState {
    constructor() {
        this.data = {
            // Player Data
            currentPlayer: null,
            selectedRace: null,
            raceConfirmed: false,
            playerGold: 100,
            playerUnits: [],
            playerBuildings: [],
            
            // Game Data
            gameSettings: null,
            gamePhase: GAME_PHASES.LOBBY,
            
            // Turn System
            turnOrder: [],
            currentTurnPlayer: null,
            isMyTurn: false,
            turnNumber: 1,
            turnTimeRemaining: 0,
            
            // UI State
            selectedUnit: null,
            selectedTile: null,
            hoveredTile: null,
            
            // Network State
            socket: null,
            isConnected: false,
            
            // Other Players
            otherPlayersRaces: new Map(),
            allPlayers: [],
            
            // Map Data
            mapData: null,
            mapSize: GAME_CONFIG.DEFAULT_MAP_SIZE
        };
        
        this.listeners = new Map();
        this.history = [];
        this.maxHistorySize = 50;
        
        console.log('✅ GameState initialisiert');
    }

    // ========================================
    // GETTER METHODS
    // ========================================

    get currentPlayer() { return this.data.currentPlayer; }
    get selectedRace() { return this.data.selectedRace; }
    get playerGold() { return this.data.playerGold; }
    get gamePhase() { return this.data.gamePhase; }
    get isMyTurn() { return this.data.isMyTurn; }
    get selectedUnit() { return this.data.selectedUnit; }
    get turnNumber() { return this.data.turnNumber; }
    get socket() { return this.data.socket; }
    get isConnected() { return this.data.isConnected; }
    get mapSize() { return this.data.mapSize; }

    // ========================================
    // SETTER METHODS WITH VALIDATION
    // ========================================

    setCurrentPlayer(player) {
        if (!player || !player.name) {
            console.warn('⚠️ Ungültiger Spieler:', player);
            return false;
        }
        
        this.updateState('currentPlayer', player);
        return true;
    }

    setSelectedRace(race) {
        if (!race || !FALLBACK_RACES.find(r => r.id === race.id)) {
            console.warn('⚠️ Ungültige Rasse:', race);
            return false;
        }
        
        this.updateState('selectedRace', race);
        this.updateState('playerGold', race.startingGold);
        return true;
    }

    setGamePhase(phase) {
        if (!Object.values(GAME_PHASES).includes(phase)) {
            console.warn('⚠️ Ungültige Spielphase:', phase);
            return false;
        }
        
        this.updateState('gamePhase', phase);
        return true;
    }

    setPlayerGold(amount) {
        if (typeof amount !== 'number' || amount < 0) {
            console.warn('⚠️ Ungültiger Gold-Betrag:', amount);
            return false;
        }
        
        this.updateState('playerGold', Math.floor(amount));
        return true;
    }

    // ========================================
    // NETWORK STATE
    // ========================================

    setConnectionStatus(connected) {
        this.updateState('isConnected', !!connected);
        
        if (connected) {
            console.log('🔗 Verbindung hergestellt');
        } else {
            console.log('🔌 Verbindung getrennt');
        }
    }

    // ========================================
    // CORE STATE MANAGEMENT
    // ========================================

    updateState(key, value) {
        if (!(key in this.data)) {
            console.warn(`⚠️ Unbekannter State-Key: ${key}`);
            return false;
        }

        const oldValue = this.data[key];
        this.data[key] = value;

        // History hinzufügen
        this.addToHistory(key, oldValue, value);

        // Event emittieren
        this.emit('stateChanged', { key, oldValue, newValue: value });
        this.emit(`${key}Changed`, { oldValue, newValue: value });

        console.log(`🔄 State Update: ${key} =`, value);
        return true;
    }

    updateMultiple(updates) {
        const oldValues = {};
        
        // Sammle alte Werte
        Object.keys(updates).forEach(key => {
            if (key in this.data) {
                oldValues[key] = this.data[key];
            }
        });

        // Aktualisiere alle Werte
        Object.entries(updates).forEach(([key, value]) => {
            if (key in this.data) {
                this.data[key] = value;
            }
        });

        // History hinzufügen
        this.addToHistory('multipleUpdate', oldValues, updates);

        // Events emittieren
        this.emit('multipleStateChanged', { oldValues, newValues: updates });
        
        console.log('🔄 Multiple State Update:', Object.keys(updates));
        return true;
    }

    // ========================================
    // HISTORY MANAGEMENT
    // ========================================

    addToHistory(key, oldValue, newValue) {
        const historyEntry = {
            timestamp: Date.now(),
            key,
            oldValue: this.deepClone(oldValue),
            newValue: this.deepClone(newValue)
        };

        this.history.push(historyEntry);

        // Begrenze History-Größe
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    getHistory() {
        return [...this.history];
    }

    canUndo() {
        return this.history.length > 0;
    }

    undo() {
        if (!this.canUndo()) return false;

        const lastEntry = this.history.pop();
        
        if (lastEntry.key === 'multipleUpdate') {
            // Multiple Undo
            Object.entries(lastEntry.oldValue).forEach(([key, value]) => {
                if (key in this.data) {
                    this.data[key] = value;
                }
            });
        } else {
            // Single Undo
            this.data[lastEntry.key] = lastEntry.oldValue;
        }

        this.emit('stateUndone', lastEntry);
        console.log('↩️ State Undo:', lastEntry.key);
        return true;
    }

    // ========================================
    // EVENT SYSTEM
    // ========================================

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        return () => this.off(event, callback); // Return unsubscribe function
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return false;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        
        if (index > -1) {
            callbacks.splice(index, 1);
            return true;
        }
        return false;
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`❌ Error in event listener for ${event}:`, error);
            }
        });
    }

    // ========================================
    // UNIT MANAGEMENT
    // ========================================

    addUnit(unit) {
        if (!unit || !unit.id) {
            console.warn('⚠️ Ungültige Einheit:', unit);
            return false;
        }
        
        const units = [...this.data.playerUnits];
        units.push(unit);
        this.updateState('playerUnits', units);
        
        console.log(`➕ Einheit hinzugefügt: ${unit.definition?.name} (${unit.id})`);
        return true;
    }

    removeUnit(unitId) {
        const units = this.data.playerUnits.filter(u => u.id !== unitId);
        this.updateState('playerUnits', units);
        
        if (this.data.selectedUnit?.id === unitId) {
            this.updateState('selectedUnit', null);
        }
        
        console.log(`➖ Einheit entfernt: ${unitId}`);
        return true;
    }

    updateUnit(unitId, updates) {
        const units = this.data.playerUnits.map(unit => {
            if (unit.id === unitId) {
                return { ...unit, ...updates };
            }
            return unit;
        });
        
        this.updateState('playerUnits', units);
        
        // Update selected unit if it was the updated one
        if (this.data.selectedUnit?.id === unitId) {
            const updatedUnit = units.find(u => u.id === unitId);
            this.updateState('selectedUnit', updatedUnit);
        }
        
        return true;
    }

    selectUnit(unit) {
        if (!unit) {
            this.updateState('selectedUnit', null);
            return true;
        }
        
        // Prüfe ob Einheit dem Spieler gehört
        const playerUnit = this.data.playerUnits.find(u => u.id === unit.id);
        if (!playerUnit && unit.ownerId !== this.data.currentPlayer?.name) {
            console.warn('⚠️ Einheit gehört nicht dem Spieler:', unit);
            return false;
        }
        
        this.updateState('selectedUnit', unit);
        console.log(`🎯 Einheit ausgewählt: ${unit.definition?.name}`);
        return true;
    }

    getUnit(unitId) {
        return this.data.playerUnits.find(u => u.id === unitId) || null;
    }

    getUnitsAt(x, y) {
        return this.data.playerUnits.filter(u => u.x === x && u.y === y);
    }

    // ========================================
    // TURN MANAGEMENT
    // ========================================

    setTurnData(turnData) {
        const updates = {};
        
        if (turnData.turnOrder) updates.turnOrder = turnData.turnOrder;
        if (turnData.currentPlayer) updates.currentTurnPlayer = turnData.currentPlayer;
        if (turnData.turnNumber) updates.turnNumber = turnData.turnNumber;
        if (turnData.timeRemaining !== undefined) updates.turnTimeRemaining = turnData.timeRemaining;
        
        // Bestimme ob der aktuelle Spieler dran ist
        if (turnData.currentPlayer && this.data.currentPlayer) {
            updates.isMyTurn = turnData.currentPlayer === this.data.currentPlayer.name;
        }
        
        this.updateMultiple(updates);
        
        console.log(`🔄 Turn Update: ${turnData.currentPlayer} ist dran (Runde ${turnData.turnNumber})`);
        return true;
    }

    nextTurn() {
        // Reset unit states for new turn
        const units = this.data.playerUnits.map(unit => ({
            ...unit,
            hasMoved: false,
            hasActed: false
        }));
        
        this.updateState('playerUnits', units);
        
        // Clear selection
        this.updateState('selectedUnit', null);
        
        console.log('⏭️ Neuer Zug vorbereitet');
    }

    // ========================================
    // RACE MANAGEMENT
    // ========================================

    setOtherPlayerRace(playerName, raceId) {
        const newMap = new Map(this.data.otherPlayersRaces);
        newMap.set(playerName, raceId);
        this.updateState('otherPlayersRaces', newMap);
        
        console.log(`🏛️ ${playerName} hat Rasse ${raceId} gewählt`);
    }

    getPlayerRace(playerName) {
        return this.data.otherPlayersRaces.get(playerName);
    }

    getAllSelectedRaces() {
        return Array.from(this.data.otherPlayersRaces.values());
    }

    isRaceTaken(raceId) {
        return this.getAllSelectedRaces().includes(raceId);
    }

    // ========================================
    // MAP MANAGEMENT
    // ========================================

    setMapData(mapData) {
        if (!Array.isArray(mapData)) {
            console.warn('⚠️ Ungültige Kartendaten:', mapData);
            return false;
        }
        
        this.updateState('mapData', mapData);
        this.updateState('mapSize', mapData.length);
        return true;
    }

    getTile(x, y) {
        if (!this.isValidPosition(x, y)) return null;
        return this.data.mapData?.[y]?.[x] || null;
    }

    updateTile(x, y, updates) {
        if (!this.isValidPosition(x, y) || !this.data.mapData) return false;
        
        const newMapData = this.data.mapData.map((row, rowIndex) => {
            if (rowIndex === y) {
                return row.map((tile, colIndex) => {
                    if (colIndex === x) {
                        return { ...tile, ...updates };
                    }
                    return tile;
                });
            }
            return row;
        });
        
        this.updateState('mapData', newMapData);
        return true;
    }

    selectTile(x, y) {
        if (!this.isValidPosition(x, y)) {
            this.updateState('selectedTile', null);
            return false;
        }
        
        this.updateState('selectedTile', { x, y });
        return true;
    }

    isValidPosition(x, y) {
        return GameUtils.isValidPosition(x, y, this.data.mapSize);
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Map) return new Map(Array.from(obj.entries()).map(([k, v]) => [k, this.deepClone(v)]));
        if (obj instanceof Set) return new Set(Array.from(obj).map(item => this.deepClone(item)));
        
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = this.deepClone(obj[key]);
        });
        return cloned;
    }

    reset() {
        const initialState = {
            currentPlayer: null,
            selectedRace: null,
            raceConfirmed: false,
            playerGold: 100,
            playerUnits: [],
            playerBuildings: [],
            gameSettings: null,
            gamePhase: GAME_PHASES.LOBBY,
            turnOrder: [],
            currentTurnPlayer: null,
            isMyTurn: false,
            turnNumber: 1,
            turnTimeRemaining: 0,
            selectedUnit: null,
            selectedTile: null,
            hoveredTile: null,
            socket: null,
            isConnected: false,
            otherPlayersRaces: new Map(),
            allPlayers: [],
            mapData: null,
            mapSize: GAME_CONFIG.DEFAULT_MAP_SIZE
        };

        this.updateMultiple(initialState);
        this.history = [];
        
        console.log('🔄 GameState zurückgesetzt');
    }

    // ========================================
    // SERIALIZATION
    // ========================================

    serialize() {
        const serializable = { ...this.data };
        
        // Convert Map to object for serialization
        serializable.otherPlayersRaces = Object.fromEntries(this.data.otherPlayersRaces);
        
        return JSON.stringify(serializable);
    }

    deserialize(json) {
        try {
            const data = JSON.parse(json);
            
            // Convert object back to Map
            if (data.otherPlayersRaces) {
                data.otherPlayersRaces = new Map(Object.entries(data.otherPlayersRaces));
            }
            
            this.updateMultiple(data);
            console.log('📥 GameState deserialisiert');
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Deserialisieren:', error);
            return false;
        }
    }

    // ========================================
    // DEBUG METHODS
    // ========================================

    getDebugInfo() {
        return {
            currentState: this.deepClone(this.data),
            historySize: this.history.length,
            listenersCount: this.listeners.size,
            memoryUsage: this.calculateMemoryUsage()
        };
    }

    calculateMemoryUsage() {
        const jsonString = this.serialize();
        return {
            stateSize: jsonString.length,
            historySize: JSON.stringify(this.history).length,
            totalSize: jsonString.length + JSON.stringify(this.history).length
        };
    }

    printState() {
        console.table({
            'Spieler': this.data.currentPlayer?.name || 'Nicht gesetzt',
            'Rasse': this.data.selectedRace?.name || 'Nicht gewählt',
            'Gold': this.data.playerGold,
            'Phase': this.data.gamePhase,
            'Ist mein Zug': this.data.isMyTurn,
            'Rundennummer': this.data.turnNumber,
            'Einheiten': this.data.playerUnits.length,
            'Verbunden': this.data.isConnected
        });
    }
}

// ========================================
// GLOBAL INSTANCE
// ========================================

const gameState = new GameState();

// Global verfügbar machen
if (typeof window !== 'undefined') {
    window.gameState = gameState;
    window.GameState = GameState;
}

console.log('✅ Game State Manager bereit');

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState, gameState };
}