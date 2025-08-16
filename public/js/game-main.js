// game-main.js - Hauptsteuerung ohne Demo-Modus
console.log('🎮 Initialisiere Game Main...');

class GameController {
    constructor() {
        // Warten bis gameState verfügbar ist
        if (!window.gameState) {
            console.error('❌ GameState nicht verfügbar');
            return;
        }
        this.mapSyncEnabled = true;
        this.awaitingMapSync = false;
        this.gameState = window.gameState;
        this.socketManager = null;
        this.mapSystem = null;
        this.raceSelection = null;
        this.isInitialized = false;
        
        // Game state
        this.gameSettings = null;
        this.gamePhase = 'lobby';
        this.currentTurnPlayer = null;
        this.turnTimer = null;
        
        this.init();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    initialize() {
        console.log('🚀 Initialisiere Game Controller...');
        
        // Load game settings
        this.loadGameSettings();
        
        // Load races data
        this.loadRacesData();
        
        // Initialize socket manager
        this.initializeSocketManager();
        
        // Initialize map system
        this.initializeMapSystem();
        
        // Initialize race selection
        this.initializeRaceSelection();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Setup UI integration
        this.setupUIIntegration();
        
        // Setup map integration
        this.setupMapIntegration();
        
        // Start game flow
        this.startGameFlow();
        
        console.log('✅ Game Controller initialisiert');
    }

    loadGameSettings() {
        const urlParams = new URLSearchParams(window.location.search);
        const settingsParam = urlParams.get('settings');
        
        if (settingsParam) {
            try {
                this.gameSettings = JSON.parse(decodeURIComponent(settingsParam));
                console.log('📋 Spiel-Einstellungen geladen:', this.gameSettings);
            } catch (error) {
                console.error('❌ Fehler beim Parsen der Spiel-Einstellungen:', error);
                this.showError('Ungültige Spiel-Einstellungen. Bitte über die Lobby beitreten.');
                return;
            }
        } else {
            console.error('❌ Keine Spiel-Einstellungen gefunden');
            this.showError('Keine Spiel-Einstellungen gefunden. Bitte über die Lobby beitreten.');
            return;
        }
        
        // Update game state
        this.gameState.updateState('gameSettings', this.gameSettings);
        this.gameState.setCurrentPlayer(this.gameSettings.currentPlayer);
        this.gameState.setMapSize(this.gameSettings.mapSize);
    }

    loadRacesData() {
        try {
            console.log('🔍 Lade Rassen-Daten...');
            
            // Check if races are already loaded
            if (window.LOADED_RACES && window.LOADED_RACES.length > 0) {
                console.log('🏛️ Rassen bereits geladen:', window.LOADED_RACES.length);
                return;
            }
            
            // Try to load races from races-data.json
            fetch('/races-data.json')
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error('Rassen-Daten konnten nicht geladen werden');
                })
                .then(races => {
                    console.log('🏛️ Rassen-Daten geladen:', races.length);
                    window.LOADED_RACES = races;
                })
                .catch(error => {
                    console.warn('⚠️ Verwende Fallback-Rassen:', error.message);
                    if (window.FALLBACK_RACES && window.FALLBACK_RACES.length > 0) {
                        window.LOADED_RACES = window.FALLBACK_RACES;
                    }
                });
                
        } catch (error) {
            console.error('❌ Fehler beim Laden der Rassen-Daten:', error);
            // Use fallback races if available
            if (window.FALLBACK_RACES && window.FALLBACK_RACES.length > 0) {
                window.LOADED_RACES = window.FALLBACK_RACES;
            }
        }
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    setupEventHandlers() {
        // Game phase change events
        window.addEventListener('gamePhaseChanged', (event) => {
            this.onGamePhaseChanged(event.detail);
        });

        // Race selection events
        window.addEventListener('raceConfirmed', (event) => {
            console.log('🏛️ Rasse bestätigt:', event.detail.race);
            this.handleRaceConfirmed(event.detail);
        });

        window.addEventListener('allRacesSelected', (event) => {
            console.log('🎯 Alle Rassen gewählt Event empfangen:', event.detail);
            this.handleAllRacesSelected(event.detail);
        });

        // Socket events
        if (this.socketManager) {
            this.socketManager.on('race-selected', (data) => this.handleRaceSelected(data));
            this.socketManager.on('all-races-selected', (data) => this.handleAllRacesSelected(data));
            this.socketManager.on('game-started', (data) => this.handleGameStarted(data));
            this.socketManager.on('turn-started', (data) => this.handleTurnStarted(data));
            this.socketManager.on('map-updated', (data) => this.handleMapUpdated(data));
            this.socketManager.on('disconnect', () => this.handleDisconnect());
            this.socketManager.on('reconnect', () => this.handleReconnect());
        }

        console.log('📡 Event Handler eingerichtet');
    }

    setupSocketEvents() {
        if (!this.socketManager || !this.socketManager.socket) return;
        
        const socket = this.socketManager.socket;
        
        // Game flow events
        socket.on('game-started', (data) => this.onGameStarted(data));
        socket.on('race-selection-phase', (data) => this.onRaceSelectionPhase(data));
        socket.on('all-races-selected', (data) => this.onAllRacesSelected(data));
        socket.on('game-phase-changed', (data) => this.onServerPhaseChanged(data));
        
        // Game state events
        socket.on('game-state', (data) => this.onGameState(data));
        socket.on('game-state-failed', (data) => this.onGameStateFailed(data));
        
        // Turn system events
        socket.on('turn-started', (data) => this.onTurnStarted(data));
        socket.on('turn-ended', (data) => this.onTurnEnded(data));
        socket.on('turn-timer-update', (data) => this.onTurnTimerUpdate(data));
        
        // Game action events
        socket.on('unit-moved', (data) => this.onUnitMoved(data));
        socket.on('unit-attacked', (data) => this.onUnitAttacked(data));
        socket.on('unit-purchased', (data) => this.onUnitPurchasedFromServer(data));
        socket.on('gold-updated', (data) => this.onGoldUpdated(data));
        
        // Player events
        socket.on('player-left', (data) => this.onPlayerLeft(data));
        socket.on('player-defeated', (data) => this.onPlayerDefeated(data));
        socket.on('game-ended', (data) => this.onGameEnded(data));
        
        console.log('📡 Socket Events eingerichtet');
    }

    // ========================================
    // SOCKET EVENT HANDLERS
    // ========================================

    setupSocketEventHandlers() {
        if (!this.socketManager) {
            console.error('❌ Socket Manager nicht verfügbar');
            return;
        }

        // Race selection events
        this.socketManager.socket.on('race-selected', (data) => {
            console.log('🏛️ Rasse gewählt von Server:', data);
            this.handleRaceSelected(data);
        });

        this.socketManager.socket.on('all-races-selected', (data) => {
            console.log('🎯 Alle Rassen gewählt - Server bestätigt:', data);
            this.handleAllRacesSelected(data);
        });

        this.socketManager.socket.on('race-selection-failed', (data) => {
            console.error('❌ Rassen-Auswahl fehlgeschlagen:', data.error);
            this.showError(`Rassen-Auswahl fehlgeschlagen: ${data.error}`);
        });

        // Game start events
        this.socketManager.socket.on('game-started', (data) => {
            console.log('🎮 Spiel gestartet vom Server:', data);
            this.handleGameStarted(data);
        });

        // Turn events
        this.socketManager.socket.on('turn-started', (data) => {
            console.log('🎯 Zug gestartet:', data);
            this.handleTurnStarted(data);
        });

        // Map events
        this.socketManager.socket.on('map-updated', (data) => this.onMapUpdated(data));

        // Connection events
        this.socketManager.socket.on('disconnect', () => {
            console.warn('⚠️ Verbindung zum Server getrennt');
            this.handleDisconnect();
        });

        this.socketManager.socket.on('reconnect', () => {
            console.log('✅ Verbindung zum Server wiederhergestellt');
            this.handleReconnect();
        });

        console.log('📡 Socket Event Handler eingerichtet');
    }

    // Aktualisierte onRaceSelected Methode
    onRaceSelected(data) {
        console.log('🏛️ Rasse gewählt:', data);
        
        // Update Game State falls es die eigene Auswahl war
        if (window.socketManager && data.playerId === socketManager.socket.id) {
            if (window.gameState) {
                // Finde Rassen-Details
                const selectedRace = this.findRaceById(data.raceId);
                if (selectedRace) {
                    gameState.setSelectedRace(selectedRace);
                    gameState.updateState('raceConfirmed', true);
                }
            }
        }
        
        // Update UI
        this.updateRaceSelectionStatus(data);
        
        // Zeige Benachrichtigung
        const message = data.playerId === socketManager?.socket?.id 
            ? `Sie haben ${this.getRaceName(data.raceId)} gewählt!`
            : `${data.playerName} hat ${this.getRaceName(data.raceId)} gewählt!`;
        
        this.showNotification(message);
    }

    // Hilfsmethoden
    findRaceById(raceId) {
        if (window.FALLBACK_RACES) {
            return FALLBACK_RACES.find(race => race.id === raceId);
        }
        return null;
    }

    getRaceName(raceId) {
        const race = this.findRaceById(raceId);
        return race ? race.name : raceId;
    }

    updateTurnDisplay(currentPlayer, turnOrder) {
        // Update Turn-Anzeige in der UI
        const turnInfo = document.getElementById('turn-info');
        if (turnInfo) {
            turnInfo.innerHTML = `
                <div class="current-turn">
                    <strong>${currentPlayer.name}</strong> ist am Zug
                </div>
                <div class="turn-order">
                    Reihenfolge: ${turnOrder.map(id => {
                        const player = this.findPlayerById(id);
                        return player ? player.name : id;
                    }).join(' → ')}
                </div>
            `;
        }
    }

    showGameInterface() {
        // Zeige Haupt-Spielinterface
        document.getElementById('game-interface')?.classList.remove('hidden');
        document.getElementById('map-container')?.classList.remove('hidden');
        document.getElementById('game-ui')?.classList.remove('hidden');
    }

    hideRaceSelection() {
        // Verstecke Rassenauswahl
        if (this.raceSelection) {
            this.raceSelection.hide();
        }
    }

    // Debug-Methoden
    debugMapSync() {
        console.log('🔍 Map Sync Debug Info:');
        console.log('  Server Map Loaded:', window.mapSystem?.serverMapLoaded);
        console.log('  Map Sync ID:', window.mapSystem?.mapSyncId);
        console.log('  Map Size:', window.mapSystem?.mapSize);
        console.log('  Awaiting Sync:', this.awaitingMapSync);
        console.log('  Socket Connected:', window.socketManager?.isConnected);
    }
}

// ========================================
// 4. Event-Listener für Map-Synchronisation
// ========================================

// Globale Event-Listener für Map-Events
window.addEventListener('mapLoaded', (event) => {
    console.log('🗺️ Map Loaded Event:', event.detail);
    
    // Benachrichtige UI-Komponenten
    if (window.gameController) {
        gameController.onMapLoaded(event.detail);
    }
});

// Debug-Funktionen für Browser-Konsole
window.debugMapSync = () => {
    if (window.gameController) {
        gameController.debugMapSync();
    }
};

window.requestMapSync = () => {
    if (window.mapSystem) {
        mapSystem.requestMapSync();
    }
};

console.log('🔄 Client Map Synchronisation System geladen');

    handleRaceSelected(data) {
        // Update other players' race selections
        if (data.playerName && data.raceId) {
            this.gameState.data.otherPlayersRaces.set(data.playerName, data.raceId);
            this.updateRaceStatusPanel();
            
            // Check if all races are selected
            this.checkIfAllRacesSelected();
        }
    }

    handleRaceConfirmed(data) {
        console.log('🏛️ Rasse bestätigt:', data.race);
        
        // Update current player's race in game state
        if (data.race) {
            this.gameState.setSelectedRace(data.race);
        }
        
        // Update race status panel
        this.updateRaceStatusPanel();
        
        // Check if all races are selected
        this.checkIfAllRacesSelected();
    }

    handleAllRacesSelected(data) {
        console.log('🎯 Alle Rassen gewählt - starte Spiel...');
        
        // Hide race selection modal
        if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
            this.raceSelection.hide();
        }

        // Update game state with server data
        if (data.game) {
            this.gameSettings = data.game;
        }

        // Start playing phase
        this.startPlayingPhase();
    }

    handleGameStarted(data) {
        console.log('🎮 Spiel vom Server gestartet:', data);
        
        // Update game state
        if (data.game) {
            this.gameSettings = data.game;
        }

        // Update map if provided
        if (data.map && this.mapSystem) {
            this.mapSystem.mapData = data.map;
            this.mapSystem.renderMap();
        }

        // Switch to playing phase
        this.setGamePhase('playing');
        
        // Start first turn
        this.startFirstTurn();
    }

    handleTurnStarted(data) {
        console.log('🎯 Zug gestartet:', data);
        
        // Update turn information
        if (data.currentPlayer) {
            this.gameState.setTurnData({
                currentPlayer: data.currentPlayer,
                turnNumber: data.turnNumber || 1,
                isMyTurn: data.currentPlayer === this.gameState.currentPlayer?.name
            });
        }

        // Update UI
        this.updatePlayerDisplay();
        this.updateTurnInfo();
    }

    handleMapUpdated(data) {
        console.log('🗺️ Karte aktualisiert:', data);
        
        // Update map data
        if (data.map && this.mapSystem) {
            this.mapSystem.mapData = data.map;
            this.mapSystem.renderMap();
        }

        // Update units if provided
        if (data.units) {
            this.gameState.data.playerUnits = data.units.filter(u => u.owner === this.gameState.currentPlayer?.name);
            this.updateUnitsOverview();
        }
    }

    handleDisconnect() {
        console.warn('⚠️ Verbindung getrennt - versuche Reconnection...');
        
        // Show disconnect message
        this.showError('Verbindung zum Server getrennt. Versuche Reconnection...');
        
        // Try to reconnect after delay
        setTimeout(() => {
            if (this.socketManager && !this.socketManager.isConnected) {
                this.socketManager.connect();
            }
        }, 3000);
    }

    handleReconnect() {
        console.log('🔄 Verbindung wiederhergestellt');
        
        // Show success message
        this.showNotification('Verbindung wiederhergestellt!', 'success');
        
        // Try to rejoin the game
        if (this.gameSettings?.gameId) {
            if (this.socketManager && this.socketManager.socket) {
                this.socketManager.emit('join-game', {
                    gameId: this.gameSettings.gameId,
                    player: this.gameSettings.currentPlayer
                });
            }
        }
    }

    // ========================================
    // GAME FLOW CONTROL
    // ========================================

    startGameFlow() {
        console.log('🎮 Starte Spielablauf...');
        
        // Check if we're in demo mode (no server connection)
        if (!this.socketManager || !this.socketManager.isConnected) {
            console.log('🤖 Demo-Modus: Keine Server-Verbindung, starte automatisch...');
            setTimeout(() => this.startDemoMode(), 1000);
            return;
        }
        
        // Wait for game to be joined
        console.log('⏳ Warte auf Spielbeitritt...');
        
        // Check if we need to join a game
        if (this.gameSettings?.gameId) {
            // Try to join the game
            if (this.socketManager && this.socketManager.socket) {
                this.socketManager.emit('join-game', {
                    gameId: this.gameSettings.gameId,
                    player: this.gameSettings.currentPlayer
                });
            }
        }
    }

    startDemoMode() {
        console.log('🤖 Starte Demo-Modus...');
        
        // Set game phase to race selection
        this.setGamePhase('race_selection');
        
        // Start race selection
        this.startRaceSelection();
        
        console.log('🤖 Demo-Modus: Rassenauswahl gestartet');
    }

    setGamePhase(phase) {
        const oldPhase = this.gameState.gamePhase;
        console.log(`🔄 Spielphase: ${oldPhase} → ${phase}`);
        
        // Update game state
        this.gameState.setGamePhase(phase);
        
        // Update UI for new phase
        this.updateUIForPhase(phase);
        
        // Handle phase-specific logic
        switch (phase) {
            case 'race_selection':
                console.log('🏛️ setGamePhase: Zeige Race Selection Modal...');
                if (this.raceSelection && typeof this.raceSelection.show === 'function') {
                    this.raceSelection.show();
                }
                break;
            case 'playing':
                console.log('🎮 setGamePhase: Starte Spielphase...');
                // Game phase logic is handled in startPlayingPhase
                break;
            case 'lobby':
                console.log('🚪 setGamePhase: Verstecke Race Selection Modal (Lobby)...');
                if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
                    this.raceSelection.hide();
                }
                break;
        }
    }

    updateUIForPhase(phase) {
        console.log(`🔄 Spielphase geändert: {oldValue: '${this.gameState.gamePhase}', newValue: '${phase}'}`);
        
        switch (phase) {
            case 'race_selection':
                console.log('🏛️ updateUIForPhase: Zeige Race Selection Modal...');
                if (this.raceSelection && typeof this.raceSelection.show === 'function') {
                    this.raceSelection.show();
                }
                break;
            case 'playing':
                console.log('🎮 updateUIForPhase: Verstecke Race Selection Modal...');
                if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
                    this.raceSelection.hide();
                }
                break;
            case 'lobby':
                console.log('🚪 updateUIForPhase: Verstecke Race Selection Modal...');
                if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
                    this.raceSelection.hide();
                }
                break;
        }
    }

    // ========================================
    // RACE SELECTION
    // ========================================

    startRaceSelection() {
        console.log('🏛️ Starte Rassen-Auswahl...');
        
        // Ensure race selection is properly initialized
        if (!this.raceSelection || !this.raceSelection.isInitialized) {
            console.warn('⚠️ Race Selection noch nicht vollständig initialisiert, warte...');
            setTimeout(() => this.startRaceSelection(), 1000);
            return;
        }

        // Check if races are available
        const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
        if (availableRaces.length === 0) {
            console.error('❌ Keine Rassen verfügbar');
            this.showError('Keine Rassen verfügbar');
            return;
        }

        console.log('🔍 Verfügbare Rassen:', availableRaces.length);

        // Show race selection modal
        if (this.raceSelection && typeof this.raceSelection.show === 'function') {
            console.log('🔍 Zeige Race Selection Modal');
            this.raceSelection.show();
        } else {
            console.error('❌ Race Selection show() Methode nicht verfügbar');
            this.showError('Rassen-Auswahl kann nicht angezeigt werden');
        }
    }

    updateRaceStatusPanel() {
        const raceStatusList = document.getElementById('raceStatusList');
        if (!raceStatusList) return;
        
        const players = this.gameSettings?.players || [];
        let html = '';
        
        players.forEach(player => {
            let hasSelected = this.gameState.data.otherPlayersRaces.has(player.name);
            const raceId = this.gameState.data.otherPlayersRaces.get(player.name);
            let raceName = 'Wählt...';
            
            if (hasSelected && raceId) {
                const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
                const race = availableRaces.find(r => r.id === raceId);
                raceName = race ? race.name : 'Unbekannt';
            }
            
            // Check if this is the current player
            if (player.name === this.gameState.currentPlayer?.name && this.gameState.selectedRace) {
                raceName = this.gameState.selectedRace.name;
                hasSelected = true;
            }
            
            html += `
                <div class="race-status-item">
                    <span>${player.name}:</span>
                    <span style="color: ${hasSelected ? '#27ae60' : '#f39c12'};">
                        ${hasSelected ? '✅' : '⏳'} ${raceName}
                    </span>
                </div>
            `;
        });
        
        raceStatusList.innerHTML = html;
    }

    checkIfAllRacesSelected() {
        const players = this.gameSettings?.players || [];
        const totalPlayers = players.length;
        let selectedCount = 0;
        
        // Count players who have selected races
        players.forEach(player => {
            if (player.name === this.gameState.currentPlayer?.name) {
                // Current player
                if (this.gameState.selectedRace) {
                    selectedCount++;
                }
            } else {
                // Other players
                if (this.gameState.data.otherPlayersRaces.has(player.name)) {
                    selectedCount++;
                }
            }
        });
        
        console.log(`🏛️ Rassen-Auswahl Status: ${selectedCount}/${totalPlayers} Spieler haben gewählt`);
        
        // If all players have selected races, start the game
        if (selectedCount === totalPlayers) {
            console.log('🎯 Alle Rassen gewählt! Starte Spiel...');
            
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('allRacesSelected', {
                detail: { 
                    message: 'Alle Rassen gewählt',
                    totalPlayers: totalPlayers,
                    selectedCount: selectedCount
                }
            }));
            
            // Start the game after a short delay
            setTimeout(() => {
                this.startPlayingPhase();
            }, 1000);
        }
    }

    // ========================================
    // PLAYING PHASE
    // ========================================

    startPlayingPhase() {
        console.log('🎮 Starte Spielphase...');
        
        // Hide race selection modal first
        if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
            this.raceSelection.hide();
        }
        
        // Switch to playing phase
        this.setGamePhase('playing');
        
        // Generate map if not already generated
        if (this.mapSystem && (!this.mapSystem.mapData || this.mapSystem.mapData.length === 0)) {
            console.log('🗺️ Generiere Karte...');
            this.mapSystem.generateMap();
        }
        
        // Initialize turn system
        this.initializeTurnSystem();
        
        // Generate starting units
        this.generateStartingUnits();
        
        // Start first turn
        this.startFirstTurn();
        
        // Update UI
        this.updatePlayerDisplay();
        this.updateMapInfo();
        this.updateUnitsOverview();
        
        console.log('✅ Spielphase gestartet');
    }

    initializeTurnSystem() {
        const players = this.gameSettings.players || [];
        const turnOrder = [...players].sort(() => Math.random() - 0.5); // Shuffle
        
        this.gameState.setTurnData({
            turnOrder: turnOrder.map(p => p.name),
            currentPlayer: turnOrder[0]?.name,
            turnNumber: 1,
            isMyTurn: turnOrder[0]?.id === this.gameSettings.currentPlayer.id
        });
        
        console.log('🎯 Zugreihenfolge:', turnOrder.map(p => p.name));
    }

    generateStartingUnits() {
        if (!this.gameState.selectedRace) {
            console.warn('⚠️ Keine Rasse ausgewählt, überspringe Einheiten-Generierung');
            return;
        }
        
        const race = this.gameState.selectedRace;
        const startingUnits = race.startingUnits || [];
        
        startingUnits.forEach(unitDef => {
            // Find a valid starting position
            const position = this.findStartingPosition();
            if (position) {
                const unit = this.createUnit(unitDef, position.x, position.y);
                this.gameState.data.playerUnits.push(unit);
                this.mapSystem.placeUnit(unit, position.x, position.y);
            }
        });
        
        console.log(`🎯 ${startingUnits.length} Starteinheiten generiert`);
    }

    findStartingPosition() {
        // Simple starting position logic - find empty grass tile
        for (let x = 0; x < this.mapSystem.mapSize; x++) {
            for (let y = 0; y < this.mapSystem.mapSize; y++) {
                const tile = this.mapSystem.getTile(x, y);
                if (tile && tile.type === 'grass' && !tile.unit) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    createUnit(unitDef, x, y) {
        const unit = {
            id: Date.now() + Math.random(),
            type: unitDef.id,
            name: unitDef.name,
            owner: this.gameState.currentPlayer?.name || 'Unknown',
            x: x,
            y: y,
            health: unitDef.health || 100,
            maxHealth: unitDef.health || 100,
            attack: unitDef.attack || 10,
            defense: unitDef.defense || 5,
            movement: unitDef.movement || 2,
            range: unitDef.range || 1,
            level: 1,
            experience: 0,
            cost: unitDef.cost || 50
        };
        
        return unit;
    }

    startFirstTurn() {
        console.log('🎯 Starte ersten Zug...');
        
        // Reset unit movement and actions
        this.gameState.data.playerUnits.forEach(unit => {
            unit.movement = unit.maxMovement || 2;
            unit.hasMoved = false;
            unit.hasAttacked = false;
        });
        
        // Update UI
        this.updateTurnInfo();
        this.updateUnitsOverview();
        
        console.log('✅ Erster Zug gestartet');
    }

    startMyTurn() {
        console.log('🎯 Dein Zug beginnt!');
        
        // Generate gold income
        this.generateGoldIncome();
        
        // Reset unit states
        this.resetUnitsForNewTurn();
        
        // Start turn timer
        this.startTurnTimer();
        
        // Update UI
        this.updateTurnUI();
        
        // Show notification
        this.showNotification('🎯 Du bist dran!', 'success');
    }

    generateGoldIncome() {
        if (!this.mapSystem) return;
        
        let income = 0;
        const mapSize = this.gameState.mapSize;
        
        // Count owned cities and castles
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                const tile = this.mapSystem.getTile(x, y);
                if (tile && tile.owner === this.gameState.currentPlayer.id) {
                    if (tile.terrain === 'city') income += 2;
                    if (tile.terrain === 'castle') income += 5;
                }
            }
        }
        
        // Race bonus
        const race = this.gameState.selectedRace;
        if (race && race.goldMultiplier) {
            income = Math.floor(income * race.goldMultiplier);
        }
        
        if (income > 0) {
            this.gameState.addGold(income);
            this.showNotification(`💰 +${income} Gold erhalten!`, 'info');
            console.log(`💰 Gold-Einkommen: +${income}`);
        }
    }

    resetUnitsForNewTurn() {
        this.gameState.data.playerUnits.forEach(unit => {
            unit.hasMoved = false;
            unit.hasActed = false;
        });
        
        // Clear selection
        this.gameState.clearSelection();
        
        console.log('🔄 Einheiten für neuen Zug zurückgesetzt');
    }

    startTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
        }
        
        const timeLimit = window.GAME_CONFIG?.TURN_TIME_LIMIT || 120;
        let timeRemaining = timeLimit;
        
        this.gameState.setTurnTimeRemaining(timeRemaining);
        
        this.turnTimer = setInterval(() => {
            timeRemaining--;
            this.gameState.setTurnTimeRemaining(timeRemaining);
            
            if (timeRemaining <= 0) {
                this.endTurn();
            }
        }, 1000);
    }

    endTurn() {
        console.log('⏭️ Zug beenden...');
        
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        // Send to server
        if (this.socketManager) {
            this.socketManager.endTurn();
        }
        
        // Update UI
        this.gameState.setIsMyTurn(false);
        this.updateTurnUI();
        
        this.showNotification('⏭️ Zug beendet', 'info');
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    onGamePhaseChanged(data) {
        console.log('🔄 Game Phase geändert:', data);
        
        if (data.newValue === 'race_selection') {
            console.log('🏛️ onGamePhaseChanged: Zeige Race Selection Modal...');
            if (this.raceSelection && typeof this.raceSelection.show === 'function') {
                this.raceSelection.show();
            }
        }
    }

    onTurnChanged(data) {
        console.log('🎯 Zug geändert:', data);
        
        // Update turn info
        this.updateTurnInfo();
        
        // Update end turn button
        const endTurnBtn = document.getElementById('endTurnBtn');
        if (endTurnBtn) {
            endTurnBtn.disabled = !data.isMyTurn;
        }
        
        // Show turn notification
        if (data.isMyTurn) {
            this.showNotification('Du bist am Zug!', 'success');
        } else {
            this.showNotification(`${data.currentPlayer} ist am Zug`, 'info');
        }
    }

    onUnitSelectionChanged(data) {
        console.log('🎯 Einheit ausgewählt:', data.unit);
        
        // Update selected unit display
        const selectedUnitDisplay = document.getElementById('selectedUnitDisplay');
        if (selectedUnitDisplay && data.unit) {
            selectedUnitDisplay.innerHTML = `
                <h3>🎯 Ausgewählte Einheit</h3>
                <p><strong>Name:</strong> ${data.unit.name}</p>
                <p><strong>HP:</strong> ${data.unit.health}/${data.unit.maxHealth}</p>
                <p><strong>Position:</strong> (${data.unit.x}, ${data.unit.y})</p>
                <p><strong>Bewegung:</strong> ${data.unit.movement}</p>
            `;
        }
    }

    onGoldChanged(data) {
        console.log('💰 Gold geändert:', data);
        
        // Update player display
        this.updatePlayerDisplay();
        
        // Show gold change notification
        if (data.oldValue !== undefined && data.newValue !== undefined) {
            const change = data.newValue - data.oldValue;
            if (change > 0) {
                this.showNotification(`+${change} Gold erhalten!`, 'success');
            } else if (change < 0) {
                this.showNotification(`${Math.abs(change)} Gold ausgegeben`, 'info');
            }
        }
    }

    onRaceConfirmed(data) {
        console.log('🏛️ Rasse bestätigt:', data.race);
        
        // Update current player's race in game state
        if (data.race) {
            this.gameState.setSelectedRace(data.race);
        }
        
        // Update race status panel
        this.updateRaceStatusPanel();
        
        // Check if all races are selected
        this.checkIfAllRacesSelected();
    }

    onAllRacesSelected(data) {
        console.log('🎯 Alle Rassen gewählt, Spiel beginnt:', data);
        
        // Load server-generated map if available and not already loaded
        if (data.map && this.mapSystem) {
            console.log('🗺️ Lade Server-Karte (alle Rassen gewählt)...');
            this.mapSystem.loadServerMap(data.map);
        }
        
        // Only start playing phase if we're not already in it
        if (this.gamePhase !== 'playing') {
            console.log('🎮 Starte Spielphase von onAllRacesSelected...');
            setTimeout(() => this.startPlayingPhase(), 1000);
        } else {
            console.log('🎮 Spielphase läuft bereits, überspringe Start...');
        }
    }

    onGameJoined(data) {
        console.log('🎉 Spieler hat das Spiel beigetreten:', data);
        
        if (!data.success) {
            console.error('❌ Fehler beim Beitreten zum Spiel:', data.error);
            this.showError(`Fehler beim Beitreten zum Spiel: ${data.error}`);
            return;
        }
        
        // Now that we've joined the game, we can request the current game state
        if (this.socketManager) {
            setTimeout(() => {
                console.log('📡 Fordere Spielstand vom Server an...');
                this.socketManager.requestGameState();
            }, 1000); // Small delay to ensure server is ready
        }
        
        // Update UI
        this.updatePlayerDisplay();
        this.updateRaceStatusPanel();
        this.updateMapInfo();
        this.updateUnitsOverview();
        
        // Start race selection
        console.log('🏛️ Starte Rassenauswahl nach Spielbeitritt...');
        this.startRaceSelection();
    }

    // ========================================
    // SERVER EVENT HANDLERS
    // ========================================

    onGameStarted(data) {
        console.log('🎮 Spiel gestartet:', data);
        
        // Update Game State
        if (window.gameState) {
            gameState.setGamePhase('race_selection'); // Beginne mit Rassenauswahl
            
            if (data.game) {
                gameState.updateState('gameSettings', {
                    gameId: data.game.id,
                    mapSize: data.game.settings?.mapSize || 30,
                    playerCount: data.game.players?.length || 2
                });
            }
        }
        
        // WICHTIG: Keine Karte in dieser Phase generieren
        // Warten auf race-selection-phase Event
        console.log('⏳ Warte auf Rassenauswahl-Phase...');
        
        this.showNotification('Spiel gestartet! Rassenauswahl beginnt...');
    }

    onMapReady(data) {
        console.log('🗺️ Karte bereit:', data);
        
        this.awaitingMapSync = false;
        
        // Update UI für Spielphase
        this.hideRaceSelection();
        this.showGameInterface();
        
        // Update Turn Information
        if (data.turnOrder && data.currentPlayer) {
            this.updateTurnDisplay(data.currentPlayer, data.turnOrder);
        }
        
        // Update andere UI-Elemente
        this.updatePlayerDisplay();
        this.updateUnitsOverview();
        this.updateMapInfo();
        
        console.log('✅ Spiel-Interface bereit');
    }

    onGameJoined(data) {
        console.log('🎉 Spieler hat das Spiel beigetreten:', data);
        
        // Now that we've joined the game, we can request the current game state
        if (this.socketManager) {
            setTimeout(() => {
                console.log('📡 Fordere Spielstand vom Server an...');
                this.socketManager.requestGameState();
            }, 1000); // Small delay to ensure server is ready
        }
        
        // Update UI
        this.updatePlayerDisplay();
        this.updateRaceStatusPanel();
        this.updateMapInfo();
        this.updateUnitsOverview();
    }

    onRaceSelectionPhase(data) {
        console.log('🏛️ Rassen-Auswahl Phase vom Server gestartet:', data);
        
        // Ensure race selection is properly initialized
        if (!this.raceSelection || !this.raceSelection.isInitialized) {
            console.warn('⚠️ Race Selection nicht bereit in onRaceSelectionPhase, warte...');
            setTimeout(() => this.onRaceSelectionPhase(data), 500);
            return;
        }
        
        this.startRaceSelection();
    }

    onServerPhaseChanged(data) {
        console.log('📡 Server Phasen-Änderung:', data);
        this.setGamePhase(data.phase);
        
        // Handle race selection phase specifically
        if (data.phase === 'race_selection' && this.raceSelection && typeof this.raceSelection.show === 'function') {
            // Add a small delay to ensure everything is ready
            setTimeout(() => {
                if (this.raceSelection && this.raceSelection.isInitialized) {
                    console.log('🏛️ onServerPhaseChanged: Zeige Race Selection Modal...');
                    this.raceSelection.show();
                } else {
                    console.warn('⚠️ Race Selection nicht bereit in onServerPhaseChanged');
                }
            }, 300);
        } else if (data.phase === 'playing' && this.raceSelection && typeof this.raceSelection.hide === 'function') {
            console.log('🎮 onServerPhaseChanged: Verstecke Race Selection Modal...');
            this.raceSelection.hide();
        } else if (data.phase === 'lobby' && this.raceSelection && typeof this.raceSelection.hide === 'function') {
            console.log('🚪 onServerPhaseChanged: Verstecke Race Selection Modal (Lobby)...');
            this.raceSelection.hide();
        } else if (data.phase === 'finished' && this.raceSelection && typeof this.raceSelection.hide === 'function') {
            console.log('🏁 onServerPhaseChanged: Verstecke Race Selection Modal (Finished)...');
            this.raceSelection.hide();
        }
    }

    onTurnStarted(data) {
        console.log('🎯 Zug vom Server gestartet:', data);
        
        this.gameState.setTurnData({
            currentPlayer: data.currentPlayer,
            turnNumber: data.turnNumber,
            isMyTurn: data.currentPlayer === this.gameState.currentPlayer.name
        });
        
        if (this.gameState.isMyTurn) {
            this.startMyTurn();
        } else {
            this.updateTurnUI();
        }
    }

    onTurnEnded(data) {
        console.log('⏭️ Zug vom Server beendet:', data);
        
        this.gameState.setTurnData({
            currentPlayer: data.nextPlayer,
            turnNumber: data.turnNumber,
            isMyTurn: data.nextPlayer === this.gameState.currentPlayer.name
        });
        
        if (this.gameState.isMyTurn) {
            this.startMyTurn();
        } else {
            this.updateTurnUI();
        }
    }

    onTurnTimerUpdate(data) {
        this.gameState.setTurnTimeRemaining(data.timeRemaining);
    }

    onUnitMoved(data) {
        console.log('📡 Einheit vom Server bewegt:', data);
        
        // Update other player's unit if visible
        if (this.mapSystem) {
            this.mapSystem.markForRedraw();
        }
    }

    onUnitAttacked(data) {
        console.log('📡 Angriff vom Server:', data);
        
        // Handle combat result
        if (data.defenderDestroyed) {
            this.showNotification(`⚔️ ${data.defenderName} wurde zerstört!`, 'warning');
        }
        
        if (this.mapSystem) {
            this.mapSystem.markForRedraw();
        }
    }

    onUnitPurchased(data) {
        console.log('🛒 Einheit gekauft:', data);
        
        // Update units overview
        this.updateUnitsOverview();
        
        // Show success message
        this.showNotification('Einheit erfolgreich gekauft!', 'success');
    }

    onUnitPurchasedFromServer(data) {
        console.log('📡 Einheit vom Server gekauft:', data);
        
        // Update map
        if (this.mapSystem) {
            this.mapSystem.markForRedraw();
        }
    }

    onGoldUpdated(data) {
        console.log('📡 Gold vom Server aktualisiert:', data);
        this.gameState.setPlayerGold(data.amount);
    }

    onPlayerLeft(data) {
        console.log('👋 Spieler hat verlassen:', data);
        this.showNotification(`👋 ${data.playerName} hat das Spiel verlassen`, 'warning');
    }

    onPlayerDefeated(data) {
        console.log('💀 Spieler besiegt:', data);
        this.showNotification(`💀 ${data.playerName} wurde besiegt!`, 'warning');
    }

    onGameEnded(data) {
        console.log('🏁 Spiel beendet:', data);
        
        this.setGamePhase('finished');
        
        if (data.winner === this.gameState.currentPlayer.name) {
            this.showNotification('🏆 Du hast gewonnen!', 'success');
        } else {
            this.showNotification(`🏁 ${data.winner} hat gewonnen!`, 'info');
        }
    }

    onGameState(data) {
        console.log('📊 Spielstand vom Server erhalten:', data);
        
        // Update game state
        if (this.gameState) {
            this.gameState.updateFromServer(data);
        }
        
        // Load map if available
        if (data.map && this.mapSystem) {
            console.log('🗺️ Lade Karte vom Spielstand...');
            this.mapSystem.loadServerMap(data.map);
        }
    }

    onGameStateFailed(data) {
        console.error('❌ Spielstand konnte nicht geladen werden:', data);
        
        // Show error message
        this.showError('Spielstand konnte nicht geladen werden');
        
        // Start demo mode as fallback
        setTimeout(() => this.startDemoMode(), 2000);
    }

    // ========================================
    // UI UPDATES
    // ========================================

    updateTurnUI() {
        const turnIndicator = document.getElementById('turnIndicator');
        const endTurnBtn = document.getElementById('endTurnBtn');
        const turnInfo = document.getElementById('turnInfo');
        const timerDisplay = document.getElementById('timerDisplay');
        const timeRemaining = document.getElementById('timeRemaining');
        
        if (this.gamePhase !== 'playing') return;
        
        const currentPlayer = this.gameState.data.currentTurnPlayer;
        const isMyTurn = this.gameState.isMyTurn;
        const turnNumber = this.gameState.turnNumber;
        
        if (turnIndicator) {
            if (isMyTurn) {
                turnIndicator.className = 'turn-indicator my-turn';
                turnIndicator.textContent = `🎯 Du bist dran! (Runde ${turnNumber})`;
            } else {
                turnIndicator.className = 'turn-indicator others-turn';
                turnIndicator.textContent = `⏳ ${currentPlayer} ist dran (Runde ${turnNumber})`;
            }
        }
        
        if (endTurnBtn) {
            endTurnBtn.disabled = !isMyTurn;
        }
        
        if (turnInfo) {
            turnInfo.innerHTML = `
                <strong>Aktueller Spieler:</strong> ${currentPlayer}<br>
                <strong>Runde:</strong> ${turnNumber}<br>
                <strong>Zugreihenfolge:</strong> ${this.gameState.data.turnOrder.join(', ')}
            `;
        }
        
        if (timeRemaining) {
            timeRemaining.textContent = this.gameState.data.turnTimeRemaining;
            
            if (this.gameState.data.turnTimeRemaining <= 10) {
                timerDisplay.classList.add('warning');
            } else {
                timerDisplay.classList.remove('warning');
            }
        }
    }

    updateTurnInfo() {
        const turnInfo = document.getElementById('turnInfo');
        if (!turnInfo) return;
        
        const turnData = this.gameState.data.turnData;
        if (!turnData) return;
        
        let html = `
            <h3>🎯 Zug</h3>
            <p><strong>Aktueller Spieler:</strong> ${turnData.currentPlayer || 'Unbekannt'}</p>
            <p><strong>Zug-Nummer:</strong> ${turnData.turnNumber || 1}</p>
            <p><strong>Mein Zug:</strong> ${turnData.isMyTurn ? '✅ Ja' : '❌ Nein'}</p>
        `;
        
        turnInfo.innerHTML = html;
    }

    updatePlayerDisplay() {
        const playerDisplay = document.getElementById('playerDisplay');
        if (!playerDisplay) return;
        
        const player = this.gameState.currentPlayer;
        if (!player) return;
        
        const race = this.gameState.selectedRace;
        const raceName = race ? race.name : 'Keine Rasse';
        
        let html = `
            <h3>👤 Spieler</h3>
            <p><strong>Name:</strong> ${player.name}</p>
            <p><strong>Rasse:</strong> ${raceName}</p>
            <p><strong>Gold:</strong> ${this.gameState.playerGold || 0}</p>
        `;
        
        playerDisplay.innerHTML = html;
    }

    updateGoldDisplay() {
        const goldAmount = document.getElementById('goldAmount');
        if (goldAmount) {
            goldAmount.textContent = this.gameState.playerGold;
        }
    }

    updateSelectedUnitUI(unit) {
        const selectedUnitSection = document.getElementById('selectedUnitSection');
        const selectedUnitInfo = document.getElementById('selectedUnitInfo');
        
        if (!selectedUnitSection) return;
        
        if (unit) {
            selectedUnitSection.style.display = 'block';
            
            if (selectedUnitInfo) {
                const def = unit.definition;
                const healthPercentage = Math.round((unit.currentHp / unit.currentStats.hp) * 100);
                
                selectedUnitInfo.innerHTML = `
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 1.5em; margin-right: 8px;">${def.icon || '❓'}</span>
                        <div>
                            <strong>${def.name || 'Unbekannt'}</strong> (Level ${unit.level})<br>
                            <small>${def.description || 'Keine Beschreibung'}</small>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                        <div><strong>❤️ Leben:</strong> ${unit.currentHp}/${unit.currentStats.hp} (${healthPercentage}%)</div>
                        <div><strong>⚔️ Angriff:</strong> ${unit.currentStats.attack}</div>
                        <div><strong>🛡️ Verteidigung:</strong> ${unit.currentStats.defense}</div>
                        <div><strong>🏃 Bewegung:</strong> ${unit.currentStats.movement}</div>
                        <div><strong>📍 Position:</strong> (${unit.x}, ${unit.y})</div>
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
                        ${unit.hasMoved ? '🚶 Bewegt' : '⚡ Kann sich bewegen'} | 
                        ${unit.hasActed ? '⚔️ Hat gehandelt' : '🎯 Kann angreifen'}
                    </div>
                `;
            }
        } else {
            selectedUnitSection.style.display = 'none';
        }
    }

    updateMapInfo() {
        const mapInfo = document.getElementById('mapInfo');
        if (!mapInfo) return;
        
        if (!this.mapSystem) return;
        
        const mapSize = this.mapSystem.mapSize || 30;
        const tileCount = mapSize * mapSize;
        
        let html = `
            <h3>🗺️ Karte</h3>
            <p><strong>Größe:</strong> ${mapSize}x${mapSize}</p>
            <p><strong>Felder:</strong> ${tileCount}</p>
        `;
        
        mapInfo.innerHTML = html;
    }

    updateUnitsOverview() {
        const unitsOverview = document.getElementById('unitsOverview');
        if (!unitsOverview) return;
        
        const units = this.gameState.data.playerUnits || [];
        
        let html = '<h3>🎯 Meine Einheiten</h3>';
        if (units.length === 0) {
            html += '<p>Keine Einheiten vorhanden</p>';
        } else {
            units.forEach(unit => {
                html += `
                    <div class="unit-item">
                        <span>${unit.name}</span>
                        <span>HP: ${unit.health}/${unit.maxHealth}</span>
                        <span>Level: ${unit.level}</span>
                        <button class="upgrade-unit-btn" data-unit-id="${unit.id}">⬆️</button>
                    </div>
                `;
            });
        }
        
        unitsOverview.innerHTML = html;
        
        // Re-attach event listeners
        this.setupUIIntegration();
    }

    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after delay
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    getNotificationColor(type) {
        const colors = {
            info: 'rgba(52, 152, 219, 0.9)',
            success: 'rgba(46, 204, 113, 0.9)',
            warning: 'rgba(243, 156, 18, 0.9)',
            error: 'rgba(231, 76, 60, 0.9)'
        };
        return colors[type] || colors.info;
    }

    // ========================================
    // GAME ACTIONS
    // ========================================

    upgradeUnit(unit) {
        const upgradeCost = this.getUpgradeCost(unit);
        if (!upgradeCost || this.gameState.playerGold < upgradeCost || unit.level >= 5) {
            this.showNotification('❌ Aufwertung nicht möglich', 'error');
            return;
        }
        
        // Deduct gold
        this.gameState.addGold(-upgradeCost);
        
        // Upgrade unit
        unit.level++;
        const multiplier = 1 + ((unit.level - 1) * 0.2);
        const oldHpRatio = unit.currentHp / unit.currentStats.hp;
        
        unit.currentStats = {
            hp: Math.floor(unit.definition.baseStats.hp * multiplier),
            attack: Math.floor(unit.definition.baseStats.attack * multiplier),
            defense: Math.floor(unit.definition.baseStats.defense * multiplier),
            movement: unit.definition.baseStats.movement
        };
        
        unit.currentHp = Math.floor(unit.currentStats.hp * oldHpRatio);
        
        // Send to server
        if (this.socketManager) {
            this.socketManager.emit('upgrade-unit', {
                gameId: this.gameSettings.gameId,
                unitId: unit.id,
                newLevel: unit.level
            });
        }
        
        // Update UI
        this.updateSelectedUnitUI(unit);
        this.updateUnitsOverview();
        
        this.showNotification(`⬆️ ${unit.definition.name} auf Level ${unit.level} aufgewertet!`, 'success');
        console.log(`⬆️ Einheit aufgewertet: ${unit.definition.name} Level ${unit.level}`);
    }

    startUnitMovement(unit) {
        if (unit.hasMoved || !this.gameState.isMyTurn) {
            this.showNotification('❌ Einheit kann sich nicht bewegen', 'error');
            return;
        }
        
        // Enter movement mode
        this.gameState.updateState('movementMode', {
            active: true,
            unit: unit
        });
        
        this.showNotification(`🚶 Klicke auf ein Feld um ${unit.definition.name} zu bewegen`, 'info');
        console.log('🚶 Bewegungs-Modus aktiviert für:', unit.definition.name);
    }

    moveUnitTo(unit, toX, toY) {
        if (!unit || !this.mapSystem) {
            return false;
        }
        
        const fromX = unit.x;
        const fromY = unit.y;
        
        // Check if move is valid
        if (!this.mapSystem.isValidPosition(toX, toY)) {
            this.showNotification('❌ Ungültige Position', 'error');
            return false;
        }
        
        const targetTile = this.mapSystem.getTile(toX, toY);
        if (targetTile.unit) {
            this.showNotification('❌ Feld besetzt', 'error');
            return false;
        }
        
        // Calculate movement cost
        const movementCost = this.calculateMovementCost(unit, fromX, fromY, toX, toY);
        if (unit.movement < movementCost) {
            this.showNotification('❌ Nicht genug Bewegungspunkte', 'error');
            return false;
        }
        
        // Move unit
        unit.x = toX;
        unit.y = toY;
        unit.movement -= movementCost;
        
        // Update map
        this.mapSystem.moveUnit(unit, fromX, fromY, toX, toY);
        
        // Send to server
        if (this.socketManager && this.socketManager.socket) {
            this.socketManager.moveUnit(unit.id, fromX, fromY, toX, toY);
        }
        
        // Clear movement mode
        this.gameState.data.movementMode = null;
        
        this.showNotification(`🚶 ${unit.name} bewegt nach (${toX}, ${toY})`, 'success');
        return true;
    }

    calculateMovementCost(unit, fromX, fromY, toX, toY) {
        // Simple movement cost calculation
        const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY);
        return distance;
    }

    buyUnit(unitType, x, y) {
        console.log('💰 Buy Unit:', unitType, x, y);
        
        // Find unit definition
        const race = this.gameState.selectedRace;
        if (!race) {
            this.showNotification('❌ Keine Rasse ausgewählt', 'error');
            return false;
        }
        
        const unitDef = race.units.find(u => u.id === unitType);
        if (!unitDef) {
            this.showNotification('❌ Einheitentyp nicht gefunden', 'error');
            return false;
        }
        
        if (this.gameState.playerGold < unitDef.cost) {
            this.showNotification('❌ Nicht genug Gold', 'error');
            return false;
        }
        
        if (!this.mapSystem || !this.mapSystem.isValidPosition(x, y)) {
            this.showNotification('❌ Ungültige Position', 'error');
            return false;
        }
        
        const tile = this.mapSystem.getTile(x, y);
        if (!tile || tile.unit) {
            this.showNotification('❌ Feld besetzt', 'error');
            return false;
        }
        
        // Create unit
        const newUnit = this.createUnit(unitDef, x, y);
        
        // Deduct gold
        this.gameState.addGold(-unitDef.cost);
        
        // Add to player units
        this.gameState.data.playerUnits.push(newUnit);
        
        // Place on map
        this.mapSystem.placeUnit(newUnit, x, y);
        
        // Send to server
        if (this.socketManager && this.socketManager.socket) {
            this.socketManager.buyUnit(unitType, x, y);
        }
        
        // Update UI
        this.updateUnitsOverview();
        
        this.showNotification(`🛒 ${unitDef.name} gekauft!`, 'success');
        console.log(`🛒 Einheit gekauft: ${unitDef.name} bei (${x}, ${y})`);
        
        return true;
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    getUpgradeCost(unit) {
        if (!unit || unit.level >= 5) return null;
        const baseCost = unit.definition.upgradeCost || unit.definition.cost;
        return Math.floor(baseCost * Math.pow(1.5, unit.level - 1));
    }

    countOwnedBuildings(buildingType) {
        if (!this.mapSystem) return 0;
        
        let count = 0;
        const mapSize = this.gameState.mapSize;
        const playerId = this.gameState.currentPlayer.id;
        
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                const tile = this.mapSystem.getTile(x, y);
                if (tile && tile.terrain === buildingType && tile.owner === playerId) {
                    count++;
                }
            }
        }
        
        return count;
    }

    calculateGoldIncome() {
        const cityIncome = this.countOwnedBuildings('city') * 2;
        const castleIncome = this.countOwnedBuildings('castle') * 5;
        let total = cityIncome + castleIncome;
        
        // Apply race bonus
        const race = this.gameState.selectedRace;
        if (race && race.goldMultiplier) {
            total = Math.floor(total * race.goldMultiplier);
        }
        
        return total;
    }

    // ========================================
    // SETUP UI INTEGRATION
    // ========================================

    setupUIIntegration() {
        // End Turn Button
        const endTurnBtn = document.getElementById('endTurnBtn');
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => this.endTurn());
        }

        // Unit Purchase Buttons
        const buyUnitBtns = document.querySelectorAll('.buy-unit-btn');
        buyUnitBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const unitType = e.target.dataset.unitType;
                const x = parseInt(e.target.dataset.x);
                const y = parseInt(e.target.dataset.y);
                this.buyUnit(unitType, x, y);
            });
        });

        // Unit Upgrade Buttons
        const upgradeUnitBtns = document.querySelectorAll('.upgrade-unit-btn');
        upgradeUnitBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const unitId = e.target.dataset.unitId;
                this.upgradeUnit(unitId);
            });
        });

        console.log('🎨 UI Integration eingerichtet');
    }

    setupMapIntegration() {
        if (!this.mapSystem) {
            console.warn('⚠️ Map System nicht verfügbar für Integration');
            return;
        }

        // Setup map click events
        this.mapSystem.onMapClick = (x, y) => {
            this.handleMapClick(x, y);
        };

        // Setup unit selection events
        this.mapSystem.onUnitSelect = (unit) => {
            this.handleUnitSelect(unit);
        };

        // Setup unit movement events
        this.mapSystem.onUnitMove = (unit, fromX, fromY, toX, toY) => {
            this.handleUnitMove(unit, fromX, fromY, toX, toY);
        };

        // Setup unit attack events
        this.mapSystem.onUnitAttack = (attacker, defender) => {
            this.handleUnitAttack(attacker, defender);
        };

        console.log('🗺️ Map Integration eingerichtet');
    }

    showUnitShop() {
        if (!this.gameState.selectedRace) {
            this.showNotification('❌ Keine Rasse ausgewählt', 'error');
            return;
        }
        
        // Simple unit shop implementation
        const race = this.gameState.selectedRace;
        const units = race.units || [];
        
        let shopHtml = '<h3>   Einheiten kaufen</h3><div style="max-height: 300px; overflow-y: auto;">';
        
        units.forEach(unit => {
            const canAfford = this.gameState.playerGold >= unit.cost;
            const buttonStyle = canAfford ? '' : 'opacity: 0.5; cursor: not-allowed;';
            
            shopHtml += `
                <div style="display: flex; align-items: center; padding: 8px; border: 1px solid #444; margin: 4px 0; border-radius: 4px; ${buttonStyle}">
                    <span style="font-size: 1.5em; margin-right: 10px;">${unit.icon}</span>
                    <div style="flex: 1;">
                        <strong>${unit.name}</strong> - ${unit.cost}💰<br>
                        <small>❤️${unit.baseStats.hp} ⚔️${unit.baseStats.attack} 🛡️${unit.baseStats.defense} 🏃${unit.baseStats.movement}</small>
                    </div>
                    <button class="btn btn-success" ${canAfford ? '' : 'disabled'} 
                            onclick="gameController.buyUnitFromShop('${unit.id}')" 
                            style="margin-left: 10px;">Kaufen</button>
                </div>
            `;
        });
        
        shopHtml += '</div>';
        
        // Show in a simple modal
        this.showModal('Einheiten Shop', shopHtml);
    }

    buyUnitFromShop(unitId) {
        const race = this.gameState.selectedRace;
        const unit = race.units.find(u => u.id === unitId);
        
        if (!unit) {
            this.showNotification('❌ Einheit nicht gefunden', 'error');
            return;
        }
        
        // Find a suitable position (near owned cities)
        const position = this.findUnitSpawnPosition();
        if (!position) {
            this.showNotification('❌ Kein freier Platz gefunden', 'error');
            return;
        }
        
        this.buyUnit(unit, position.x, position.y);
        this.closeModal();
    }

    findUnitSpawnPosition() {
        if (!this.mapSystem) return null;
        
        const mapSize = this.gameState.mapSize;
        const playerId = this.gameState.currentPlayer.id;
        
        // Try to spawn near owned cities first
        for (let y = 0; y < mapSize; y++) {
            for (let x = 0; x < mapSize; x++) {
                const tile = this.mapSystem.getTile(x, y);
                if (tile && tile.terrain === 'city' && tile.owner === playerId) {
                    // Look for empty adjacent tiles
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const adjX = x + dx;
                            const adjY = y + dy;
                            const adjTile = this.mapSystem.getTile(adjX, adjY);
                            
                            if (adjTile && !adjTile.unit && adjTile.terrain === 'grass') {
                                return { x: adjX, y: adjY };
                            }
                        }
                    }
                }
            }
        }
        
        // Fallback: any empty grass tile
        for (let attempts = 0; attempts < 100; attempts++) {
            const x = Math.floor(Math.random() * mapSize);
            const y = Math.floor(Math.random() * mapSize);
            const tile = this.mapSystem.getTile(x, y);
            
            if (tile && !tile.unit && tile.terrain === 'grass') {
                return { x, y };
            }
        }
        
        return null;
    }

    showModal(title, content) {
        // Simple modal implementation
        const modal = document.createElement('div');
        modal.id = 'gameModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: #2c3e50; padding: 20px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: white;">${title}</h3>
                    <button onclick="gameController.closeModal()" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">✕</button>
                </div>
                <div style="color: white;">
                    ${content}
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
        
        document.body.appendChild(modal);
    }

    closeModal() {
        const modal = document.getElementById('gameModal');
        if (modal) {
            modal.remove();
        }
    }

    // ========================================
    // CLEANUP
    // ========================================

    cleanup() {
        console.log('🧹 Cleanup Game Controller...');
        
        // Disconnect socket
        if (this.socketManager) {
            this.socketManager.disconnect();
        }
        
        // Remove event listeners
        window.removeEventListener('gamePhaseChanged', this.onGamePhaseChanged);
        window.removeEventListener('raceConfirmed', this.onRaceConfirmed);
        window.removeEventListener('allRacesSelected', this.onAllRacesSelected);
        window.removeEventListener('unitPurchased', this.onUnitPurchased);
        window.removeEventListener('endTurnRequested', this.endTurn);
        window.removeEventListener('gameStateFailed', this.onGameStateFailed);
        
        console.log('✅ Game Controller Cleanup abgeschlossen');
    }

    initializeSocketManager() {
        if (this.socketManager) {
            console.log('🔌 Socket Manager bereits initialisiert');
            return;
        }

        // Wait for SocketManager class to be available
        if (!window.SocketManager) {
            console.warn('⚠️ SocketManager Klasse nicht verfügbar, warte...');
            setTimeout(() => this.initializeSocketManager(), 100);
            return;
        }

        // Create new socket manager instance
        this.socketManager = new window.SocketManager();
        
        // Wait for socket manager to be ready
        if (this.socketManager.isReady) {
            this.setupSocketConnection();
        } else {
            // Wait for socket manager to be ready
            const checkReady = () => {
                if (this.socketManager.isReady) {
                    this.setupSocketConnection();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        }
    }

    setupSocketConnection() {
        if (!this.socketManager || !this.socketManager.isReady) {
            console.warn('⚠️ Socket Manager nicht bereit');
            return;
        }

        // Connect to server
        this.socketManager.connect();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        console.log('🔌 Socket Manager initialisiert');
    }

    initializeRaceSelection() {
        // Check if race selection is already initialized
        if (window.raceSelection && window.raceSelection.isInitialized) {
            console.log('🏛️ Race Selection bereits initialisiert, verwende bestehende Instanz');
            this.raceSelection = window.raceSelection;
            return;
        }

        // Wait for race selection to be available
        if (!window.RaceSelection) {
            console.warn('⚠️ RaceSelection Klasse nicht verfügbar, warte...');
            setTimeout(() => this.initializeRaceSelection(), 100);
            return;
        }

        // Create new race selection instance
        console.log('🏛️ Erstelle neue Race Selection Instanz...');
        window.raceSelection = new window.RaceSelection();
        this.raceSelection = window.raceSelection;
        
        console.log('🏛️ Race Selection initialisiert:', this.raceSelection);
    }

    initializeMapSystem() {
        // Wait for MapSystem class to be available
        if (!window.MapSystem) {
            console.warn('⚠️ MapSystem Klasse nicht verfügbar, warte...');
            setTimeout(() => this.initializeMapSystem(), 100);
            return;
        }

        // Create new map system instance
        this.mapSystem = new window.MapSystem(this.gameSettings);
        console.log('🗺️ Map System initialisiert');
    }

    // ========================================
    // MAP EVENT HANDLERS
    // ========================================

    handleMapClick(x, y) {
        console.log('🗺️ Map Click:', x, y);
        
        // Handle map click based on current game state
        if (this.gameState.data.movementMode?.active) {
            this.moveUnitTo(this.gameState.data.movementMode.unit, x, y);
        }
    }

    handleUnitSelect(unit) {
        console.log('🎯 Unit Selected:', unit);
        this.gameState.setSelectedUnit(unit);
    }

    handleUnitMove(unit, fromX, fromY, toX, toY) {
        console.log('🚶 Unit Move:', unit, fromX, fromY, toX, toY);
        
        // Send move command to server
        if (this.socketManager && this.socketManager.socket) {
            this.socketManager.moveUnit(unit.id, fromX, fromY, toX, toY);
        }
    }

    handleUnitAttack(attacker, defender) {
        console.log('⚔️ Unit Attack:', attacker, defender);
        
        // Send attack command to server
        if (this.socketManager && this.socketManager.socket) {
            this.socketManager.attackUnit(attacker.id, defender.id);
        }
    }

    // ========================================
    // GAME ACTION METHODS
    // ========================================

    upgradeUnit(unitId) {
        console.log('⬆️ Upgrade Unit:', unitId);
        
        // Send upgrade command to server
        if (this.socketManager && this.socketManager.socket) {
            this.socketManager.upgradeUnit(unitId);
        }
    }

    endTurn() {
        console.log('⏭️ End Turn');
        
        // Send end turn command to server
        if (this.socketManager && this.socketManager.socket) {
            this.socketManager.endTurn();
        }
    }
}

// ========================================
// GLOBAL INITIALIZATION
// ========================================

let gameController = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisiere Game Controller...');
    
    // Wait a bit for all modules to load
    setTimeout(() => {
        gameController = new GameController();
        window.gameController = gameController; // Make available globally for debugging
    }, 200);
});

// Setup button events after map system loads
window.addEventListener('load', () => {
    if (window.setupButtonEvents) {
        window.setupButtonEvents();
    }
});

console.log('✅ Game Main (ohne Demo-Modus) Module geladen');