// game-main.js - Hauptsteuerung ohne Demo-Modus
console.log('🎮 Initialisiere Game Main...');

class GameController {
    constructor() {
        // Warten bis gameState verfügbar ist
        if (!window.gameState) {
            console.error('❌ GameState nicht verfügbar');
            return;
        }
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

    async init() {
        console.log('🔧 Initialisiere Game Controller...');
        
        try {
            // Parse game settings from URL
            this.parseGameSettings();
            
            // Initialize core systems
            await this.initializeSystems();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Setup UI
            this.setupUI();
            
            // Start game flow
            this.startGameFlow();
            
            this.isInitialized = true;
            console.log('✅ Game Controller initialisiert');
            
        } catch (error) {
            console.error('❌ Fehler bei Game Controller Initialisierung:', error);
            this.showError('Fehler beim Laden des Spiels');
        }
    }

    parseGameSettings() {
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

    async initializeSystems() {
        // Load race data first
        await this.loadRaceData();
        
        // Initialize Socket Manager
        if (window.SocketManager) {
            this.socketManager = new window.SocketManager();
            if (this.socketManager.socket) {
                this.gameState.setSocket(this.socketManager.socket);
                console.log('🔌 Socket Manager initialisiert');
            }
        } else {
            console.error('❌ Socket Manager nicht verfügbar');
            this.showError('Multiplayer-System nicht verfügbar');
            return;
        }
        
        // Initialize Map System
        if (window.MapSystem) {
            this.mapSystem = new window.MapSystem(this.gameSettings);
            console.log('🗺️ Map System initialisiert');
        }
        
        // Initialize Race Selection AFTER races are loaded
        if (window.RaceSelection) {
            try {
                // Ensure races are available before initializing race selection
                if (!window.LOADED_RACES || window.LOADED_RACES.length === 0) {
                    console.warn('⚠️ Keine Rassen verfügbar, verwende FALLBACK_RACES');
                    if (window.FALLBACK_RACES && window.FALLBACK_RACES.length > 0) {
                        window.LOADED_RACES = window.FALLBACK_RACES;
                    }
                }
                
                // Check if race selection is already initialized
                if (window.raceSelection) {
                    console.log('🏛️ Race Selection bereits initialisiert, verwende bestehende Instanz');
                    this.raceSelection = window.raceSelection;
                } else {
                    console.log('🏛️ Erstelle neue Race Selection Instanz...');
                    window.raceSelection = new window.RaceSelection();
                    this.raceSelection = window.raceSelection;
                }
                
                console.log('🏛️ Race Selection initialisiert:', this.raceSelection);
                

            } catch (error) {
                console.error('❌ Fehler beim Initialisieren der Race Selection:', error);
            }
        } else {
            console.error('❌ RaceSelection Klasse nicht verfügbar');
        }
        
        console.log('🏛️ Race Selection wartet auf Initialisierung...');
    }

    async loadRaceData() {
        try {
            console.log('🔍 Lade Rassen-Daten...');
            const response = await fetch('/races-data.json');
            if (response.ok) {
                const data = await response.json();
                if (data.races && Array.isArray(data.races)) {
                    window.LOADED_RACES = data.races;
                    console.log('🏛️ Rassen-Daten geladen:', data.races.length, 'Rassen');
                    console.log('🔍 LOADED_RACES nach dem Laden:', window.LOADED_RACES);
                    return;
                } else {
                    console.warn('⚠️ Ungültiges Rassen-Daten-Format:', data);
                }
            } else {
                console.warn('⚠️ Konnte races-data.json nicht laden:', response.status, response.statusText);
            }
        } catch (error) {
            console.warn('⚠️ Konnte Rassen-Daten nicht laden:', error);
        }
        
        // Fallback zu FALLBACK_RACES
        if (window.FALLBACK_RACES && window.FALLBACK_RACES.length > 0) {
            window.LOADED_RACES = window.FALLBACK_RACES;
            console.log('🏛️ Fallback-Rassen verwendet:', window.FALLBACK_RACES.length, 'Rassen');
            console.log('🔍 LOADED_RACES nach Fallback:', window.LOADED_RACES);
        } else {
            console.error('❌ Weder races-data.json noch FALLBACK_RACES verfügbar!');
            window.LOADED_RACES = [];
        }
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    setupEventHandlers() {
        // Socket events
        if (this.socketManager) {
            this.setupSocketEvents();
        }
        
        // Game state events
        this.gameState.on('gamePhaseChanged', (data) => this.onGamePhaseChanged(data));
        this.gameState.on('isMyTurnChanged', (data) => this.onTurnChanged(data));
        this.gameState.on('selectedUnitChanged', (data) => this.onUnitSelectionChanged(data));
        this.gameState.on('goldChanged', (data) => this.onGoldChanged(data));
        
        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
        window.addEventListener('gameJoined', (e) => this.onGameJoined(e.detail));
        
        // Custom game events
        window.addEventListener('raceConfirmed', (e) => this.onRaceConfirmed(e.detail));
        window.addEventListener('allRacesSelected', (e) => this.onAllRacesSelected(e.detail));
        window.addEventListener('unitPurchased', (e) => this.onUnitPurchased(e.detail));
        window.addEventListener('endTurnRequested', () => this.endTurn());
        
        console.log('🎯 Event Handler eingerichtet');
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
    // GAME FLOW CONTROL
    // ========================================

    startGameFlow() {
        console.log('🎮 Starte Spielablauf...');
        
        // Update UI for initial state
        this.updateUIForPhase('lobby');
        
        // Wait for server to start the game
        this.setGamePhase('lobby');
        
        // Don't request game state immediately - wait for gameJoined event
        // The socket manager will automatically join the game when connected
        console.log('⏳ Warte auf Spielbeitritt...');
        
        // Demo-Modus: Wenn nach 5 Sekunden keine Server-Verbindung, starte automatisch
        setTimeout(() => {
            if (!this.socketManager || !this.socketManager.socket || !this.socketManager.socket.connected) {
                console.log('🤖 Demo-Modus: Keine Server-Verbindung, starte automatisch...');
                this.startDemoMode();
            }
        }, 5000); // Increased delay from 3000ms to 5000ms
    }

    startDemoMode() {
        console.log('🤖 Starte Demo-Modus...');
        
        // Simuliere Spielstart
        this.setGamePhase('race_selection');
        
        // Starte Rassenauswahl sofort
        console.log('🤖 Demo-Modus: Starte Rassenauswahl...');
        console.log('🤖 Demo-Modus: Race Selection verfügbar?', !!this.raceSelection);
        console.log('🤖 Demo-Modus: LOADED_RACES verfügbar?', !!window.LOADED_RACES);
        console.log('🤖 Demo-Modus: LOADED_RACES Anzahl:', window.LOADED_RACES ? window.LOADED_RACES.length : 'undefined');
        
        this.startRaceSelection();
        
        // Ensure modal is shown with proper timing
        if (this.raceSelection && typeof this.raceSelection.show === 'function') {
            console.log('🤖 Demo-Modus: Zeige Race Selection Modal...');
            // Add a delay to ensure race selection is fully initialized
            setTimeout(() => {
                if (this.raceSelection && this.raceSelection.isInitialized) {
                    this.raceSelection.show();
                } else {
                    console.error('🤖 Demo-Modus: Race Selection nicht bereit');
                }
            }, 500);
        } else {
            console.error('🤖 Demo-Modus: Race Selection Modal kann nicht angezeigt werden');
        }
    }

    setGamePhase(phase) {
        const oldPhase = this.gamePhase;
        this.gamePhase = phase;
        this.gameState.setGamePhase(phase);
        
        console.log(`🔄 Spielphase: ${oldPhase} → ${phase}`);
        
        // Update UI based on phase
        this.updateUIForPhase(phase);
        
        // Handle race selection phase specifically
        if (phase === 'race_selection' && this.raceSelection && typeof this.raceSelection.show === 'function') {
            console.log('🏛️ setGamePhase: Zeige Race Selection Modal...');
            // Add a small delay to ensure everything is ready
            setTimeout(() => {
                if (this.raceSelection && this.raceSelection.isInitialized) {
                    this.raceSelection.show();
                } else {
                    console.warn('⚠️ Race Selection nicht bereit in setGamePhase');
                }
            }, 100);
        } else if (phase === 'playing' && this.raceSelection && typeof this.raceSelection.hide === 'function') {
            console.log('🎮 setGamePhase: Verstecke Race Selection Modal...');
            this.raceSelection.hide();
        } else if (phase === 'lobby' && this.raceSelection && typeof this.raceSelection.hide === 'function') {
            console.log('🚪 setGamePhase: Verstecke Race Selection Modal (Lobby)...');
            this.raceSelection.hide();
        } else if (phase === 'finished' && this.raceSelection && typeof this.raceSelection.hide === 'function') {
            console.log('🏁 setGamePhase: Verstecke Race Selection Modal (Finished)...');
            this.raceSelection.hide();
        }
    }

    updateUIForPhase(phase) {
        const turnIndicator = document.getElementById('turnIndicator');
        const endTurnBtn = document.getElementById('endTurnBtn');
        const timerDisplay = document.getElementById('timerDisplay');
        
        switch (phase) {
            case 'lobby':
                if (turnIndicator) {
                    turnIndicator.className = 'turn-indicator waiting';
                    turnIndicator.innerHTML = '<span class="loading-spinner"></span> Warten auf Spielstart...';
                }
                if (endTurnBtn) endTurnBtn.disabled = true;
                if (timerDisplay) timerDisplay.style.display = 'none';
                
                // Ensure race selection modal is hidden
                if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
                    this.raceSelection.hide();
                }
                break;
                
            case 'race_selection':
                if (turnIndicator) {
                    turnIndicator.className = 'turn-indicator waiting';
                    turnIndicator.textContent = '🏛️ Rassen-Auswahl läuft...';
                }
                if (endTurnBtn) endTurnBtn.disabled = true;
                if (timerDisplay) timerDisplay.style.display = 'none';
                
                // Show race status panel
                const raceStatusPanel = document.getElementById('raceStatusPanel');
                if (raceStatusPanel) {
                    raceStatusPanel.style.display = 'block';
                    this.updateRaceStatusPanel();
                }
                
                // Ensure race selection modal is shown
                if (this.raceSelection && typeof this.raceSelection.show === 'function') {
                    console.log('🏛️ updateUIForPhase: Zeige Race Selection Modal...');
                    // Add a small delay to ensure everything is ready
                    setTimeout(() => {
                        if (this.raceSelection && this.raceSelection.isInitialized) {
                            this.raceSelection.show();
                        } else {
                            console.warn('⚠️ Race Selection nicht bereit, versuche später...');
                        }
                    }, 100);
                } else {
                    console.log('❌ Race Selection nicht verfügbar in updateUIForPhase');
                    console.log('🔍 raceSelection:', this.raceSelection);
                    console.log('🔍 window.raceSelection:', window.raceSelection);
                }
                break;
                
            case 'playing':
                if (turnIndicator) turnIndicator.className = 'turn-indicator waiting';
                if (endTurnBtn) endTurnBtn.disabled = !this.gameState.isMyTurn;
                if (timerDisplay) timerDisplay.style.display = 'block';
                
                // Hide race status panel
                const raceStatusPanel2 = document.getElementById('raceStatusPanel');
                if (raceStatusPanel2) {
                    raceStatusPanel2.style.display = 'none';
                }
                
                // Ensure race selection modal is hidden
                if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
                    this.raceSelection.hide();
                }
                
                this.updateTurnUI();
                break;
                
            case 'finished':
                if (turnIndicator) turnIndicator.textContent = '🏁 Spiel beendet';
                if (endTurnBtn) endTurnBtn.disabled = true;
                if (timerDisplay) timerDisplay.style.display = 'none';
                
                // Ensure race selection modal is hidden
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
        
        this.setGamePhase('race_selection');
        
        // Stelle sicher, dass Rassen geladen sind
        if (!window.LOADED_RACES || window.LOADED_RACES.length === 0) {
            console.error('❌ Keine Rassen verfügbar!');
            console.log('🔍 LOADED_RACES:', window.LOADED_RACES);
            console.log('🔍 FALLBACK_RACES:', window.FALLBACK_RACES);
            
            // Versuche FALLBACK_RACES zu verwenden
            if (window.FALLBACK_RACES && window.FALLBACK_RACES.length > 0) {
                console.log('🔍 Verwende FALLBACK_RACES...');
                window.LOADED_RACES = window.FALLBACK_RACES;
            } else {
                this.showError('Keine Rassen verfügbar');
                return;
            }
        }
        
        console.log('🔍 Verfügbare Rassen:', window.LOADED_RACES.length);
        
        // Initialize Race Selection if not done yet
        if (!window.raceSelection) {
            console.log('🏛️ Initialisiere Race Selection...');
            if (window.RaceSelection) {
                try {
                    window.raceSelection = new window.RaceSelection();
                    this.raceSelection = window.raceSelection;
                    console.log('✅ Race Selection erfolgreich initialisiert');
                } catch (error) {
                    console.error('❌ Fehler beim Initialisieren der Race Selection:', error);
                    this.showError('Fehler beim Laden der Rassen-Auswahl');
                    return;
                }
            } else {
                console.error('❌ RaceSelection Klasse nicht verfügbar');
                this.showError('RaceSelection Komponente nicht verfügbar');
                return;
            }
        } else {
            this.raceSelection = window.raceSelection;
        }
        
        // Ensure race selection is properly initialized
        if (!this.raceSelection || !this.raceSelection.isInitialized) {
            console.warn('⚠️ Race Selection noch nicht vollständig initialisiert, warte...');
            setTimeout(() => this.startRaceSelection(), 500);
            return;
        }
        
        // Show race selection modal immediately
        if (this.raceSelection && typeof this.raceSelection.show === 'function') {
            console.log('🔍 Zeige Race Selection Modal');
            this.raceSelection.show();
        } else {
            console.error('❌ Race Selection show() Methode nicht verfügbar');
            console.log('🔍 raceSelection Objekt:', this.raceSelection);
            this.showError('Rassen-Auswahl kann nicht angezeigt werden');
        }
    }

    updateRaceStatusPanel() {
        const raceStatusList = document.getElementById('raceStatusList');
        if (!raceStatusList) return;
        
        const players = this.gameSettings?.players || [];
        let html = '';
        
        players.forEach(player => {
            const hasSelected = this.gameState.data.otherPlayersRaces.has(player.name);
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

    // ========================================
    // PLAYING PHASE
    // ========================================

    startPlayingPhase() {
        console.log('🎮 Starte Spielphase...');
        
        // Hide race selection modal first
        if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
            this.raceSelection.hide();
        }
        
        this.setGamePhase('playing');
        
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
        if (!this.gameState.selectedRace || !this.mapSystem) return;
        
        const race = this.gameState.selectedRace;
        const startingGold = race.startingGold || 100;
        
        // Set starting gold
        this.gameState.setPlayerGold(startingGold);
        
        // Find a starting position (near a city if possible)
        const startPos = this.findStartingPosition();
        
        // Create starting unit (cheapest unit)
        const units = race.units || [];
        if (units.length === 0) return;
        
        const cheapestUnit = units.reduce((min, unit) => 
            (unit.cost || 999) < (min.cost || 999) ? unit : min
        );
        
        if (cheapestUnit && startPos) {
            const startingUnit = this.createUnit(cheapestUnit, startPos.x, startPos.y);
            this.gameState.data.playerUnits.push(startingUnit);
            
            // Place unit on map
            if (this.mapSystem) {
                this.mapSystem.placeUnit(startingUnit, startPos.x, startPos.y);
            }
            
            console.log(`👤 Starteinheit erstellt: ${cheapestUnit.name} bei (${startPos.x}, ${startPos.y})`);
        }
    }

    findStartingPosition() {
        if (!this.mapSystem) return { x: 5, y: 5 };
        
        const mapSize = this.gameState.mapSize;
        
        // Look for cities first
        for (let attempts = 0; attempts < 100; attempts++) {
            const x = Math.floor(Math.random() * mapSize);
            const y = Math.floor(Math.random() * mapSize);
            
            const tile = this.mapSystem.getTile(x, y);
            if (tile && tile.terrain === 'city' && !tile.unit) {
                return { x, y };
            }
        }
        
        // Fallback to any empty grass tile
        for (let attempts = 0; attempts < 100; attempts++) {
            const x = Math.floor(Math.random() * mapSize);
            const y = Math.floor(Math.random() * mapSize);
            
            const tile = this.mapSystem.getTile(x, y);
            if (tile && tile.terrain === 'grass' && !tile.unit) {
                return { x, y };
            }
        }
        
        return { x: Math.floor(mapSize / 2), y: Math.floor(mapSize / 2) };
    }

    createUnit(unitDef, x, y) {
        return {
            id: 'unit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            definition: unitDef,
            ownerId: this.gameState.currentPlayer.id,
            x: x,
            y: y,
            level: 1,
            currentStats: { ...(unitDef.baseStats || { hp: 50, attack: 10, defense: 5, movement: 3 }) },
            currentHp: unitDef.baseStats?.hp || 50,
            hasMoved: false,
            hasActed: false
        };
    }

    startFirstTurn() {
        const currentPlayer = this.gameState.data.currentTurnPlayer;
        const isMyTurn = currentPlayer === this.gameState.currentPlayer.name;
        
        this.gameState.setIsMyTurn(isMyTurn);
        this.updateTurnUI();
        
        if (isMyTurn) {
            this.startMyTurn();
        }
        
        console.log(`🎯 Erster Zug gestartet: ${currentPlayer} ${isMyTurn ? '(Du)' : ''}`);
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
        console.log('🔄 Spielphase geändert:', data);
        this.updateUIForPhase(data.newValue);
        
        // Handle specific phase changes
        const newPhase = data.newValue;
        switch (newPhase) {
            case 'race_selection':
                console.log('🏛️ Rassen-Auswahl Phase gestartet');
                if (this.raceSelection && typeof this.raceSelection.show === 'function') {
                    // Add a small delay to ensure everything is ready
                    setTimeout(() => {
                        if (this.raceSelection && this.raceSelection.isInitialized) {
                            console.log('🏛️ onGamePhaseChanged: Zeige Race Selection Modal...');
                            this.raceSelection.show();
                        } else {
                            console.warn('⚠️ Race Selection nicht bereit in onGamePhaseChanged');
                        }
                    }, 200);
                } else {
                    console.warn('⚠️ Race Selection nicht verfügbar in onGamePhaseChanged');
                }
                break;
                
            case 'playing':
                console.log('🎮 Spielphase gestartet');
                if (this.raceSelection && typeof this.raceSelection.hide === 'function') {
                    this.raceSelection.hide();
                }
                break;
                
            case 'finished':
                console.log('🏁 Spiel beendet');
                break;
        }
    }

    onTurnChanged(data) {
        console.log('🎯 Zug geändert:', data);
        this.updateTurnUI();
        
        if (data.value) {
            this.startMyTurn();
        }
    }

    onUnitSelectionChanged(data) {
        console.log('👤 Einheiten-Auswahl geändert:', data);
        this.updateSelectedUnitUI(data.unit);
    }

    onGoldChanged(data) {
        console.log('💰 Gold geändert:', data);
        this.updateGoldDisplay();
    }

    onRaceConfirmed(data) {
        console.log('🏛️ Rasse bestätigt:', data);
        this.updatePlayerDisplay();
        this.updateRaceStatusPanel();
        
        // Send race selection to server
        if (this.socketManager && this.gameState.selectedRace) {
            this.socketManager.selectRace(this.gameState.selectedRace.id);
        }
    }

    onAllRacesSelected(data) {
        console.log('🎯 Alle Rassen gewählt, Spiel beginnt:', data);
        
        // Load server-generated map if available and not already loaded
        if (data.map && this.mapSystem) {
            console.log('🗺️ Lade Server-Karte (alle Rassen gewählt)...');
            this.mapSystem.loadServerMap(data.map);
        }
        
        // Start playing phase
        setTimeout(() => this.startPlayingPhase(), 1000);
    }

    onGameJoined(data) {
        console.log('🎉 Spieler hat das Spiel beigetreten:', data);
        this.updatePlayerDisplay();
        this.updateRaceStatusPanel();
        this.updateMapInfo();
        this.updateUnitsOverview();
        this.startPlayingPhase(); // Start the game flow after joining
    }

    // ========================================
    // SERVER EVENT HANDLERS
    // ========================================

    onGameStarted(data) {
        console.log('🎮 Spiel vom Server gestartet:', data);
        
        // Load server-generated map if available
        if (data.map && this.mapSystem) {
            console.log('🗺️ Lade Server-Karte...');
            this.mapSystem.loadServerMap(data.map);
        } else {
            console.warn('⚠️ Keine Server-Karte verfügbar, verwende lokale Karte');
        }
        
        // Don't call startRaceSelection here - wait for race-selection-phase event
        // The server will emit race-selection-phase after game-started
        console.log('⏳ Warte auf race-selection-phase Event vom Server...');
        
        // Ensure race selection is properly initialized
        if (!this.raceSelection || !this.raceSelection.isInitialized) {
            console.warn('⚠️ Race Selection nicht bereit in onGameStarted, warte...');
            setTimeout(() => {
                if (this.raceSelection && this.raceSelection.isInitialized) {
                    console.log('✅ Race Selection bereit in onGameStarted');
                } else {
                    console.error('❌ Race Selection immer noch nicht bereit in onGameStarted');
                }
            }, 1000);
        }
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
        console.error('❌ Fehler beim Laden des Spielstands vom Server:', data.error);
        this.showError('Fehler beim Laden des Spielstands');
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

    updatePlayerDisplay() {
        const playerName = document.getElementById('playerName');
        const raceDisplay = document.getElementById('raceDisplay');
        
        const player = this.gameState.currentPlayer;
        const race = this.gameState.selectedRace;
        
        if (playerName && player) {
            const raceName = race ? ` (${race.name})` : '';
            playerName.textContent = `${player.name}${raceName}`;
        }
        
        if (raceDisplay && race) {
            raceDisplay.textContent = race.icon || '👑';
            raceDisplay.style.color = race.color || '#3498db';
        }
        
        this.updateGoldDisplay();
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
        
        const mapSize = this.gameState.mapSize;
        const unitCount = this.gameState.data.playerUnits.length;
        
        mapInfo.innerHTML = `
            <strong>Spiel-Info:</strong><br>
            Spieler: ${this.gameState.currentPlayer?.name || 'Unbekannt'}<br>
            Spiel-ID: ${this.gameSettings?.gameId || 'Unbekannt'}<br>
            <hr style="margin: 8px 0; opacity: 0.3;">
            <strong>Deine Statistiken:</strong><br>
            Kartengröße: ${mapSize}x${mapSize}<br>
            Einheiten: ${unitCount}<br>
            Gold: ${this.gameState.playerGold}<br>
            Rasse: ${this.gameState.selectedRace?.name || 'Keine'}
        `;
    }

    updateUnitsOverview() {
        const unitsList = document.getElementById('unitsList');
        if (!unitsList) return;
        
        const units = this.gameState.data.playerUnits;
        
        if (units.length === 0) {
            unitsList.innerHTML = '<div class="info-display">Keine Einheiten</div>';
            return;
        }
        
        unitsList.innerHTML = '';
        
        units.forEach(unit => {
            const unitItem = document.createElement('div');
            unitItem.className = 'unit-item';
            
            if (this.gameState.selectedUnit && this.gameState.selectedUnit.id === unit.id) {
                unitItem.classList.add('selected');
            }
            
            const healthPercentage = Math.round((unit.currentHp / unit.currentStats.hp) * 100);
            const statusIcons = [];
            if (unit.hasMoved) statusIcons.push('🚶');
            if (unit.hasActed) statusIcons.push('⚔️');
            
            unitItem.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <span style="font-size: 1.2em; margin-right: 6px;">${unit.definition.icon || '❓'}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: bold;">${unit.definition.name || 'Unbekannt'}</div>
                        <div style="font-size: 9px; opacity: 0.8;">
                            Lv${unit.level} | HP: ${healthPercentage}% | (${unit.x},${unit.y})
                        </div>
                    </div>
                    <div style="font-size: 10px;">
                        ${statusIcons.join(' ')}
                    </div>
                </div>
            `;
            
            unitItem.addEventListener('click', () => {
                this.gameState.selectUnit(unit);
                this.gameState.selectTile(unit.x, unit.y);
                
                // Center camera on unit
                if (this.mapSystem) {
                    this.mapSystem.camera.x = (unit.x * this.mapSystem.tileSize) - (this.mapSystem.canvas.width / 2 / this.mapSystem.camera.zoom);
                    this.mapSystem.camera.y = (unit.y * this.mapSystem.tileSize) - (this.mapSystem.canvas.height / 2 / this.mapSystem.camera.zoom);
                    this.mapSystem.markForRedraw();
                }
                
                this.updateUnitsOverview(); // Refresh to show selection
            });
            
            unitsList.appendChild(unitItem);
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.style.transform = 'translateX(0)', 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, window.GAME_CONFIG?.NOTIFICATION_DURATION || 4000);
        
        console.log(`📢 Notification [${type}]:`, message);
    }

    showError(message) {
        this.showNotification(message, 'error');
        
        // Redirect to lobby after error
        setTimeout(() => {
            window.location.href = '/';
        }, 5000);
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

    moveUnitTo(unit, targetX, targetY) {
        if (!this.mapSystem || !this.mapSystem.canMoveToTile(unit, targetX, targetY)) {
            this.showNotification('❌ Bewegung nicht möglich', 'error');
            return false;
        }
        
        // Calculate movement cost
        const distance = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);
        if (distance > unit.currentStats.movement) {
            this.showNotification('❌ Zu weit entfernt', 'error');
            return false;
        }
        
        // Move unit
        const success = this.mapSystem.moveUnit(unit, targetX, targetY);
        if (success) {
            // Send to server
            if (this.socketManager) {
                this.socketManager.emit('move-unit', {
                    gameId: this.gameSettings.gameId,
                    unitId: unit.id,
                    fromX: unit.x,
                    fromY: unit.y,
                    toX: targetX,
                    toY: targetY
                });
            }
            
            // Update UI
            this.updateSelectedUnitUI(unit);
            this.updateUnitsOverview();
            
            this.showNotification(`🚶 ${unit.definition.name} bewegt`, 'success');
            console.log(`🚶 Einheit bewegt: ${unit.definition.name} zu (${targetX}, ${targetY})`);
        }
        
        // Exit movement mode
        this.gameState.updateState('movementMode', { active: false, unit: null });
        
        return success;
    }

    buyUnit(unitDef, x, y) {
        if (!unitDef || this.gameState.playerGold < unitDef.cost) {
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
        if (this.socketManager) {
            this.socketManager.emit('buy-unit', {
                gameId: this.gameSettings.gameId,
                unitType: unitDef.id,
                x: x,
                y: y
            });
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

    setupUI() {
        // End Turn Button
        const endTurnBtn = document.getElementById('endTurnBtn');
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => this.endTurn());
        }
        
        // Buy Units Button
        const buyUnitsBtn = document.getElementById('buyUnitsBtn');
        if (buyUnitsBtn) {
            buyUnitsBtn.addEventListener('click', () => this.showUnitShop());
        }
        
        // Map integration
        if (this.mapSystem) {
            this.setupMapIntegration();
        }
        
        // Update UI initially
        this.updatePlayerDisplay();
        this.updateUnitsOverview();
        this.updateMapInfo();
        
        console.log('🎨 UI Integration eingerichtet');
    }

    setupMapIntegration() {
        // Listen for tile clicks for unit movement
        this.mapSystem.canvas.addEventListener('click', (e) => {
            const movementMode = this.gameState.data.movementMode;
            if (!movementMode?.active) return;
            
            const rect = this.mapSystem.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const gridPos = this.mapSystem.screenToGrid(x, y);
            
            if (this.mapSystem.isValidPosition(gridPos.x, gridPos.y)) {
                this.moveUnitTo(movementMode.unit, gridPos.x, gridPos.y);
            }
        });
        
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
        
        let shopHtml = '<h3>🛒 Einheiten kaufen</h3><div style="max-height: 300px; overflow-y: auto;">';
        
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
        console.log('🧹 Game Controller Cleanup...');
        
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        if (this.socketManager) {
            this.socketManager.disconnect();
        }
        
        if (this.mapSystem) {
            this.mapSystem.destroy();
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