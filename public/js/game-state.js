// game-state.js - Zentrales Zustandsmanagement (Browser, non-module)

console.log('🎮 Initialisiere Game State Manager...');

/* -------------------------------------------------------------------------- */
/*  Phasen / Konstanten                                                        */
/* -------------------------------------------------------------------------- */

(function ensureGamePhasesGlobal() {
  if (!window.GAME_PHASES) {
    window.GAME_PHASES = {
      LOBBY: 'lobby',
      RACE_SELECTION: 'race_selection',
      PLAYING: 'playing',
      FINISHED: 'finished',
    };
  }
})();

/* -------------------------------------------------------------------------- */
/*  Hilfsfunktionen                                                            */
/* -------------------------------------------------------------------------- */

const GSUtils = {
  deepClone(value) {
    try {
      return structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  },
  isPlainObject(v) {
    return Object.prototype.toString.call(v) === '[object Object]';
  },
  clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  },
  now() {
    return Date.now();
  },
};

/* -------------------------------------------------------------------------- */
/*  GameState Klasse                                                           */
/* -------------------------------------------------------------------------- */

class GameState {
  constructor() {
    // Kernzustand – möglichst flach halten
    this.data = {
      /* Player (lokal) */
      currentPlayer: null,      // { id, name, ... }
      selectedRace: null,       // { id, name, ... } (aus FALLBACK_RACES / races-data)
      raceConfirmed: false,
      playerGold: 100,
      playerUnits: [],          // { id, type, pos, hp, ... }
      playerBuildings: [],

      /* Game / Meta */
      gameSettings: null,       // { gameId, mapSize, ... } optional
      gamePhase: window.GAME_PHASES.LOBBY,

      /* Turn System */
      turnOrder: [],            // Array von Spielernamen oder IDs (serverseitig bestimmt)
      currentTurnPlayer: null,  // string | object
      isMyTurn: false,
      turnNumber: 1,
      turnTimeRemaining: 0,     // Sek. Restzeit (Anzeige)
      turnEndsAt: null,         // Date | null (für Client-Timer)

      /* UI */
      selectedUnit: null,
      selectedTile: null,
      hoveredTile: null,

      /* Netzwerk */
      socket: null,
      isConnected: false,

      /* Andere Spieler */
      otherPlayersRaces: new Map(), // name -> raceId
      allPlayers: [],               // [{ name, id?, ready?, raceId? }, ...]

      /* Karte */
      mapData: null,               // 2D-Array Tiles
      mapSize: (window.GAME_CONFIG && window.GAME_CONFIG.DEFAULT_MAP_SIZE) || 30,
    };

    // Event-System
    this.listeners = new Map();

    // Optionale History (Debug / Undo)
    this.history = [];
    this.maxHistorySize = 100;

    console.log('✅ GameState initialisiert');
  }

  /* ----------------------------- Getter (bequem) ---------------------------- */

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

  /* --------------------------- Standard-Setter APIs ------------------------- */

  setSocket(socket) {
    this.updateState('socket', socket);
    return true;
  }

  setConnectionStatus(connected) {
    this.updateState('isConnected', !!connected);
    console.log(connected ? '🔗 Verbindung hergestellt' : '🔌 Verbindung getrennt');
    return true;
  }

  setGamePhase(phase) {
    const valid = Object.values(window.GAME_PHASES);
    if (!valid.includes(phase)) {
      console.warn('⚠️ Ungültige Spielphase:', phase);
      return false;
    }
    const old = this.data.gamePhase;
    this.updateState('gamePhase', phase);
    this.emit('gamePhaseChanged', { oldValue: old, newValue: phase });
    return true;
  }

  setCurrentPlayer(player) {
    if (!player || !player.name) {
      console.warn('⚠️ Ungültiger Spieler:', player);
      return false;
    }
    this.updateState('currentPlayer', player);
    return true;
  }

  /**
   * Für Kompatibilität mit Code, der `setLocalPlayerId` erwartet
   * (z. B. ältere game-main.js-Varianten)
   */
  setLocalPlayerId(id) {
    const cur = this.data.currentPlayer || {};
    const name = cur.name || `Spieler-${String(id).slice(0, 4)}`;
    this.updateState('currentPlayer', { ...cur, id, name });
    return true;
  }

  setSelectedRace(race) {
    if (!race || !race.id) {
      console.warn('⚠️ Ungültige Rasse:', race);
      return false;
    }
    this.updateState('selectedRace', race);
    if (typeof race.startingGold === 'number') {
      this.updateState('playerGold', Math.max(0, Math.floor(race.startingGold)));
    }
    return true;
  }

  setOtherPlayerRace(playerName, raceId) {
    if (!playerName) return false;
    const map = new Map(this.data.otherPlayersRaces);
    map.set(playerName, raceId);
    this.updateState('otherPlayersRaces', map);
    this.emit('otherPlayersRacesChanged', { playerName, raceId, map });
    return true;
  }

  setPlayerList(playersArray) {
    if (!Array.isArray(playersArray)) return false;
    this.updateState('allPlayers', playersArray);
    this.emit('playersChanged', { players: playersArray });
    return true;
  }

  /* ------------------------------ Map / Auswahl ----------------------------- */

  setMapData(map2dArray) {
    this.updateState('mapData', map2dArray || null);
    this.emit('mapDataChanged', { map: map2dArray });
    return true;
  }

  setMapSize(size) {
    const min = (window.GAME_CONFIG && window.GAME_CONFIG.MIN_MAP_SIZE) || 20;
    const max = (window.GAME_CONFIG && window.GAME_CONFIG.MAX_MAP_SIZE) || 100;
    const clamped = GSUtils.clamp(Number(size) || 30, min, max);
    this.updateState('mapSize', clamped);
    this.emit('mapSizeChanged', { size: clamped });
    return true;
  }

  updateFromServer(serverData) {
    console.log('📊 Aktualisiere GameState vom Server:', serverData);
    
    if (!serverData) return false;
    
    const updates = {};
    
    // Update game phase
    if (serverData.gamePhase) {
      updates.gamePhase = serverData.gamePhase;
    }
    
    // Update turn data
    if (serverData.turnNumber) {
      updates.turnNumber = serverData.turnNumber;
    }
    if (serverData.currentTurnPlayer) {
      updates.currentTurnPlayer = serverData.currentTurnPlayer;
    }
    if (serverData.isMyTurn !== undefined) {
      updates.isMyTurn = serverData.isMyTurn;
    }
    
    // Update map data
    if (serverData.map) {
      updates.mapData = serverData.map;
    }
    if (serverData.mapSize) {
      updates.mapSize = serverData.mapSize;
    }
    
    // Update player data
    if (serverData.player) {
      if (serverData.player.raceId) {
        // Find race in loaded races
        const race = window.LOADED_RACES?.find(r => r.id === serverData.player.raceId);
        if (race) {
          updates.selectedRace = race;
          updates.raceConfirmed = true;
        }
      }
      if (serverData.player.gold !== undefined) {
        updates.playerGold = serverData.player.gold;
      }
      if (serverData.player.units) {
        updates.playerUnits = serverData.player.units;
      }
      if (serverData.player.buildings) {
        updates.playerBuildings = serverData.player.buildings;
      }
    }
    
    // Update other players
    if (serverData.otherPlayers) {
      const otherPlayersRaces = new Map();
      serverData.otherPlayers.forEach(p => {
        if (p.raceId) {
          otherPlayersRaces.set(p.name, p.raceId);
        }
      });
      updates.otherPlayersRaces = otherPlayersRaces;
    }
    
    // Apply all updates at once
    if (Object.keys(updates).length > 0) {
      this.updateMultiple(updates);
      console.log('✅ GameState vom Server aktualisiert');
      return true;
    }
    
    return false;
  }

  selectTile(x, y) {
    this.updateState('selectedTile', (x != null && y != null) ? { x, y } : null);
    this.emit('selectedTileChanged', { tile: this.data.selectedTile });
    return true;
  }

  selectUnit(unit) {
    this.updateState('selectedUnit', unit || null);
    this.emit('selectedUnitChanged', { unit });
    return true;
  }

  clearSelection() {
    const changed = {};
    if (this.data.selectedUnit) changed.selectedUnit = null;
    if (this.data.selectedTile) changed.selectedTile = null;
    if (Object.keys(changed).length) {
      this.updateMultiple(changed);
      if ('selectedUnit' in changed) this.emit('selectedUnitChanged', { unit: null });
      if ('selectedTile' in changed) this.emit('selectedTileChanged', { tile: null });
    }
    return true;
  }

  /* ------------------------------- Zugsystem -------------------------------- */

  setTurnData({ turnOrder, currentPlayer, isMyTurn, turnNumber, endsAt } = {}) {
    const updates = {};
    if (Array.isArray(turnOrder)) updates.turnOrder = turnOrder;
    if (currentPlayer !== undefined) updates.currentTurnPlayer = currentPlayer;
    if (typeof isMyTurn === 'boolean') updates.isMyTurn = isMyTurn;
    if (typeof turnNumber === 'number') updates.turnNumber = Math.max(1, Math.floor(turnNumber));
    if (endsAt !== undefined) updates.turnEndsAt = endsAt ? new Date(endsAt) : null;

    if (Object.keys(updates).length) {
      this.updateMultiple(updates);
      if ('isMyTurn' in updates) this.emit('isMyTurnChanged', { value: updates.isMyTurn });
      this.emit('turnDataChanged', { ...updates });
    }
    return true;
  }

  setIsMyTurn(value) {
    this.updateState('isMyTurn', !!value);
    this.emit('isMyTurnChanged', { value: !!value });
    return true;
  }

  setTurnTimeRemaining(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    this.updateState('turnTimeRemaining', s);
    this.emit('turnTimeRemainingChanged', { value: s });
    return true;
  }

  /* ---------------------------- Gold / Ökonomie ----------------------------- */

  setPlayerGold(amount) {
    if (typeof amount !== 'number' || amount < 0) {
      console.warn('⚠️ Ungültiger Gold-Betrag:', amount);
      return false;
    }
    this.updateState('playerGold', Math.floor(amount));
    this.emit('goldChanged', { value: this.data.playerGold });
    return true;
  }

  addGold(delta) {
    const next = Math.max(0, Math.floor((this.data.playerGold || 0) + (Number(delta) || 0)));
    return this.setPlayerGold(next);
  }

  /* -------------------- Race Management (NEW METHODS) ---------------------- */

  isRaceTaken(raceId) {
    if (!raceId) return false;
    
    // Check if current player has selected this race
    if (this.data.selectedRace && this.data.selectedRace.id === raceId) {
      return false; // Current player can keep their selected race
    }
    
    // Check if any other player has selected this race
    for (const [playerName, selectedRaceId] of this.data.otherPlayersRaces) {
      if (selectedRaceId === raceId && playerName !== this.data.currentPlayer?.name) {
        return true;
      }
    }
    
    return false;
  }

  getAllSelectedRaces() {
    const selectedRaces = [];
    
    // Add current player's race if selected
    if (this.data.selectedRace) {
      selectedRaces.push({
        playerName: this.data.currentPlayer?.name || 'Du',
        raceId: this.data.selectedRace.id
      });
    }
    
    // Add other players' races
    for (const [playerName, raceId] of this.data.otherPlayersRaces) {
      if (playerName !== this.data.currentPlayer?.name) {
        selectedRaces.push({ playerName, raceId });
      }
    }
    
    return selectedRaces;
  }

  getRaceSelectionStatus() {
    const totalPlayers = this.data.gameSettings?.players?.length || this.data.allPlayers.length || 2;
    const selectedRaces = this.getAllSelectedRaces();
    
    return {
      totalPlayers,
      selectedCount: selectedRaces.length,
      isComplete: selectedRaces.length >= totalPlayers,
      selectedRaces
    };
  }

  /* ------------------------ Unit Management --------------------------------- */

  addUnit(unit) {
    if (!unit || !unit.id) {
      console.warn('⚠️ Ungültige Einheit:', unit);
      return false;
    }
    
    const units = [...this.data.playerUnits];
    const existingIndex = units.findIndex(u => u.id === unit.id);
    
    if (existingIndex >= 0) {
      units[existingIndex] = unit; // Update existing
    } else {
      units.push(unit); // Add new
    }
    
    this.updateState('playerUnits', units);
    this.emit('playerUnitsChanged', { units });
    return true;
  }

  removeUnit(unitId) {
    const units = this.data.playerUnits.filter(u => u.id !== unitId);
    this.updateState('playerUnits', units);
    this.emit('playerUnitsChanged', { units });
    return true;
  }

  updateUnit(unitId, updates) {
    const units = [...this.data.playerUnits];
    const unitIndex = units.findIndex(u => u.id === unitId);
    
    if (unitIndex >= 0) {
      units[unitIndex] = { ...units[unitIndex], ...updates };
      this.updateState('playerUnits', units);
      this.emit('playerUnitsChanged', { units });
      return true;
    }
    
    return false;
  }

  getUnit(unitId) {
    return this.data.playerUnits.find(u => u.id === unitId) || null;
  }

  /* ---------------------- Turn Management ------------------------------- */

  nextTurn() {
    // Reset all units for new turn
    const units = this.data.playerUnits.map(unit => ({
      ...unit,
      hasMoved: false,
      hasActed: false
    }));
    
    this.updateState('playerUnits', units);
    this.emit('playerUnitsChanged', { units });
    
    // Clear selections
    this.clearSelection();
    
    console.log('🔄 Zug zurückgesetzt - Einheiten können wieder agieren');
    return true;
  }

  /* --------------------- Generische State-Update-Methoden ------------------- */

  updateState(key, value) {
    if (!(key in this.data)) {
      console.warn(`⚠️ Unbekannter State-Key: ${key}`);
      return false;
    }

    const oldValue = this.data[key];
    this.data[key] = value;

    // History
    this._addToHistory(key, oldValue, value);

    // Events
    this.emit('stateChanged', { key, oldValue, newValue: value });
    // Convenience-Event pro Feld, z. B. "mapDataChanged"
    this.emit(`${key}Changed`, { oldValue, newValue: value });

    // Debug
    // console.log(`🔄 State Update: ${key} =`, value);
    return true;
  }

  updateMultiple(updates) {
    if (!GSUtils.isPlainObject(updates)) return false;

    const oldValues = {};
    Object.keys(updates).forEach((key) => {
      if (key in this.data) oldValues[key] = this.data[key];
    });

    Object.entries(updates).forEach(([key, value]) => {
      if (key in this.data) this.data[key] = value;
    });

    this._addToHistory('multipleUpdate', oldValues, updates);

    this.emit('multipleStateChanged', { oldValues, newValues: GSUtils.deepClone(updates) });
    // Zusätzlich Einzelevents triggern
    Object.keys(updates).forEach((key) => {
      if (key in this.data) this.emit(`${key}Changed`, { oldValue: oldValues[key], newValue: updates[key] });
    });

    // console.log('🔄 Multiple State Update:', Object.keys(updates));
    return true;
  }

  /* -------------------------------- History -------------------------------- */

  _addToHistory(key, oldValue, newValue) {
    try {
      const entry = {
        timestamp: GSUtils.now(),
        key,
        oldValue: GSUtils.deepClone(oldValue),
        newValue: GSUtils.deepClone(newValue),
      };
      this.history.push(entry);
      if (this.history.length > this.maxHistorySize) this.history.shift();
    } catch (_) {
      // Ignoriere History-Fehler still
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
    const last = this.history.pop();

    if (last.key === 'multipleUpdate') {
      Object.entries(last.oldValue).forEach(([key, value]) => {
        if (key in this.data) this.data[key] = value;
      });
      this.emit('multipleStateChanged', { oldValues: last.newValue, newValues: last.oldValue });
    } else {
      this.data[last.key] = last.oldValue;
      this.emit('stateChanged', { key: last.key, oldValue: last.newValue, newValue: last.oldValue });
      this.emit(`${last.key}Changed`, { oldValue: last.newValue, newValue: last.oldValue });
    }

    this.emit('stateUndone', last);
    // console.log('↩️ State Undo:', last.key);
    return true;
  }

  /* -------------------------------- Events --------------------------------- */

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const list = this.listeners.get(event);
    if (!list) return false;
    const idx = list.indexOf(callback);
    if (idx > -1) {
      list.splice(idx, 1);
      return true;
    }
    return false;
  }

  emit(event, data) {
    const list = this.listeners.get(event);
    if (!list) return;
    list.forEach((cb) => {
      try { cb(data); } catch (err) {
        console.error('GameState event handler error:', err);
      }
    });
  }

  /* ----------------------------- Nützliche APIs ----------------------------- */

  getSnapshot() {
    // Vorsicht bei Maps → in Plain Object verwandeln
    const otherRaces = {};
    this.data.otherPlayersRaces.forEach((race, name) => { otherRaces[name] = race; });

    return GSUtils.deepClone({
      ...this.data,
      otherPlayersRaces: otherRaces,
    });
  }

  /* --------------------------- Debug Methods ------------------------------- */

  getDebugInfo() {
    const raceStatus = this.getRaceSelectionStatus();
    
    return {
      gamePhase: this.data.gamePhase,
      isConnected: this.data.isConnected,
      currentPlayer: this.data.currentPlayer?.name,
      selectedRace: this.data.selectedRace?.name,
      isMyTurn: this.data.isMyTurn,
      turnNumber: this.data.turnNumber,
      playerGold: this.data.playerGold,
      unitCount: this.data.playerUnits.length,
      mapSize: this.data.mapSize,
      raceSelection: raceStatus,
      historySize: this.history.length
    };
  }

  logState() {
    console.table(this.getDebugInfo());
  }
}

/* -------------------------------------------------------------------------- */
/*  Globaler Singleton                                                         */
/* -------------------------------------------------------------------------- */

// Nur einen GameState erstellen und global bereitstellen
window.gameState = window.gameState || new GameState();

console.log('✅ GameState bereit (window.gameState)');