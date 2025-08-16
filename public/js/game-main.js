// game-main.js - Überarbeitete Hauptsteuerung mit vollständiger Integration
console.log('🎮 Initialisiere Game Main (Überarbeitet)...');

class GameController {
    constructor() {
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
                console.warn('⚠️ Fehler beim Parsen der Spiel-Einstellungen:', error);
            }
        }
        
        // Fallback settings für Demo/Development
        if (!this.gameSettings) {
            this.gameSettings = {
                gameId: 'demo-game',
                mapSize: 30,
                playerCount: 2,
                players: [
                    { name: 'Du', id: 'local' },
                    { name: 'Spieler 2', id: 'player2' }
                ],
                currentPlayer: { name: 'Du', id: 'local' }
            };
            console.log('📋 Demo-Einstellungen verwendet');
        }
        
        // Update game state
        this.gameState.updateState('gameSettings', this.gameSettings);
        this.gameState.setCurrentPlayer(this.gameSettings.currentPlayer);
        this.gameState.setMapSize(this.gameSettings.mapSize);
    }

    async initializeSystems() {
        // Initialize Socket Manager
        if (window.SocketManager && this.gameSettings.gameId !== 'demo-game') {
            this.socketManager = new window.SocketManager();
            this.gameState.setSocket(this.socketManager.socket);
            console.log('🔌 Socket Manager initialisiert');
        }
        
        // Initialize Map System
        if (window.MapSystem) {
            this.mapSystem = new window.MapSystem(this.gameSettings);
            console.log('🗺️ Map System initialisiert');
        }
        
        // Initialize Race Selection
        if (window.RaceSelection) {
            this.raceSelection = new window.RaceSelection();
            console.log('🏛️ Race Selection initialisiert');
        }
        
        // Load race data
        await this.loadRaceData();
    }

    async loadRaceData() {
        try {
            const response = await fetch('/races-data.json');
            if (response.ok) {
                const data = await response.json();
                if (data.races && Array.isArray(data.races)) {
                    window.LOADED_RACES = data.races;
                    console.log('🏛️ Rassen-Daten geladen:', data.races.length, 'Rassen');
                    return;
                }
            }
        } catch (error) {
            console.warn('⚠️ Konnte Rassen-Daten nicht laden:', error);
        }
        
        // Fallback zu FALLBACK_RACES
        window.LOADED_RACES = window.FALLBACK_RACES || [];
        console.log('🏛️ Fallback-Rassen verwendet:', window.LOADED_RACES.length, 'Rassen');
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
        
        // Custom game events
        window.addEventListener('raceSelected', (e) => this.onRaceSelected(e.detail));
        window.addEventListener('unitPurchased', (e) => this.onUnitPurchased(e.detail));
        window.addEventListener('endTurnRequested', () => this.endTurn());
        
        console.log('🎯 Event Handler eingerichtet');
    }

    setupSocketEvents() {
        const socket = this.socketManager.socket;
        
        // Game flow events
        socket.on('game-started', (data) => this.onGameStarted(data));
        socket.on('race-selection-phase', () => this.startRaceSelection());
        socket.on('all-races-selected', (data) => this.onAllRacesSelected(data));
        socket.on('game-phase-changed', (data) => this.onServerPhaseChanged(data));
        
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
        
        // Determine initial phase based on game settings
        if (this.gameSettings.gameId === 'demo-game') {
            // Demo mode - skip lobby, go straight to race selection
            this.setGamePhase('race_selection');
            setTimeout(() => this.startRaceSelection(), 500);
        } else {
            // Online mode - start with lobby or race selection
            this.setGamePhase('lobby');
            
            // Request current game state from server
            if (this.socketManager) {
                this.socketManager.emit('get-game-state', {
                    gameId: this.gameSettings.gameId
                });
            }
        }
    }

    setGamePhase(phase) {
        const oldPhase = this.gamePhase;
        this.gamePhase = phase;
        this.gameState.setGamePhase(phase);
        
        console.log(`🔄 Spielphase: ${oldPhase} → ${phase}`);
        
        // Update UI based on phase
        this.updateUIForPhase(phase);
    }

    updateUIForPhase(phase) {
        const turnSection = document.getElementById('turnInfoSection');
        const turnIndicator = document.getElementById('turnIndicator');
        const endTurnBtn = document.getElementById('endTurnBtn');
        const timerDisplay = document.getElementById('timerDisplay');
        
        switch (phase) {
            case 'lobby':
                if (turnIndicator) turnIndicator.textContent = '⏳ Warten auf Spieler...';
                if (endTurnBtn) endTurnBtn.disabled = true;
                if (timerDisplay) timerDisplay.style.display = 'none';
                break;
                
            case 'race_selection':
                if (turnIndicator) turnIndicator.textContent = '🏛️ Rassen-Auswahl läuft...';
                if (endTurnBtn) endTurnBtn.disabled = true;
                if (timerDisplay) timerDisplay.style.display = 'none';
                break;
                
            case 'playing':
                if (turnIndicator) turnIndicator.className = 'turn-indicator waiting';
                if (endTurnBtn) endTurnBtn.disabled = !this.gameState.isMyTurn;
                if (timerDisplay) timerDisplay.style.display = 'block';
                this.updateTurnUI();
                break;
                
            case 'finished':
                if (turnIndicator) turnIndicator.textContent = '🏁 Spiel beendet';
                if (endTurnBtn) endTurnBtn.disabled = true;
                if (timerDisplay) timerDisplay.style.display = 'none';
                break;
        }
    }

    // ========================================
    // RACE SELECTION
    // ========================================

    startRaceSelection() {
        console.log('🏛️ Starte Rassen-Auswahl...');
        
        this.setGamePhase('race_selection');
        
        // Show race selection modal
        const modal = document.getElementById('raceSelectionModal');
        if (modal) {
            modal.style.display = 'flex';
            this.populateRaceSelection();
        }
    }

    populateRaceSelection() {
        const racesGrid = document.getElementById('racesGrid');
        if (!racesGrid) return;
        
        racesGrid.innerHTML = '';
        
        const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
        
        availableRaces.forEach((race, index) => {
            const raceCard = this.createRaceCard(race, index);
            racesGrid.appendChild(raceCard);
        });
        
        console.log(`🏛️ ${availableRaces.length} Rassen zur Auswahl angezeigt`);
    }

    createRaceCard(race, index) {
        const card = document.createElement('div');
        card.className = 'race-card';
        card.dataset.raceId = race.id;
        
        // Check if race is already taken
        const isTaken = this.gameState.data.otherPlayersRaces.has(race.id);
        if (isTaken) {
            card.classList.add('taken');
        }
        
        const unitsPreview = race.units ? race.units.slice(0, 6).map(unit => `
            <div class="unit-preview" title="${unit.name} - ${unit.cost}💰">
                <div class="unit-icon">${unit.icon}</div>
                <div class="unit-name">${unit.name}</div>
                <div class="unit-cost">${unit.cost}💰</div>
            </div>
        `).join('') : '';
        
        card.innerHTML = `
            <div class="race-icon" style="color: ${race.color || '#3498db'}">${race.icon || '👑'}</div>
            <div class="race-name">${race.name}</div>
            <div class="race-description">${race.description || 'Keine Beschreibung verfügbar'}</div>
            <div class="race-special">
                <strong>Spezial:</strong> ${race.specialAbility || 'Keine besonderen Fähigkeiten'}
            </div>
            <div class="race-stats">
                <div class="stat-item">
                    <span class="stat-label">Startgold:</span>
                    <span class="stat-value" style="color: #f1c40f;">💰 ${race.startingGold || 100}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Einheiten:</span>
                    <span class="stat-value">${race.units ? race.units.length : 0}</span>
                </div>
            </div>
            <div class="unit-grid">
                ${unitsPreview}
                ${race.units && race.units.length > 6 ? `
                    <div class="unit-preview more-units">
                        <div class="unit-icon">⋯</div>
                        <div class="unit-name">+${race.units.length - 6}</div>
                    </div>
                ` : ''}
            </div>
        `;
        
        if (!isTaken) {
            card.addEventListener('click', () => this.selectRace(race));
        }
        
        return card;
    }

    selectRace(race) {
        console.log('🏛️ Rasse ausgewählt:', race.name);
        
        // Update UI
        document.querySelectorAll('.race-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.querySelector(`[data-race-id="${race.id}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        // Enable confirm button
        const confirmBtn = document.getElementById('confirmRaceBtn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.onclick = () => this.confirmRaceSelection(race);
        }
        
        // Update local state
        this.gameState.setSelectedRace(race);
    }

    confirmRaceSelection(race) {
        console.log('✅ Rasse bestätigt:', race.name);
        
        // Update game state
        this.gameState.updateState('raceConfirmed', true);
        
        // Send to server
        if (this.socketManager) {
            this.socketManager.emit('select-race', {
                gameId: this.gameSettings.gameId,
                playerId: this.gameState.currentPlayer.id,
                raceId: race.id
            });
        }
        
        // Hide modal
        const modal = document.getElementById('raceSelectionModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Update player display
        this.updatePlayerDisplay();
        
        // For demo mode, simulate other players and start game
        if (this.gameSettings.gameId === 'demo-game') {
            setTimeout(() => this.simulateDemoRaceSelection(), 1000);
        }
    }

    simulateDemoRaceSelection() {
        console.log('🤖 Simuliere Demo Rassen-Auswahl...');
        
        // Simulate other players selecting races
        const availableRaces = window.LOADED_RACES || window.FALLBACK_RACES || [];
        const players = this.gameSettings.players || [];
        
        players.forEach((player, index) => {
            if (player.id !== 'local' && index < availableRaces.length) {
                const race = availableRaces[index + 1] || availableRaces[0];
                this.gameState.setOtherPlayerRace(player.name, race.id);
            }
        });
        
        // Start playing phase
        setTimeout(() => this.startPlayingPhase(), 1000);
    }

    // ========================================
    // PLAYING PHASE
    // ========================================

    startPlayingPhase() {
        console.log('🎮 Starte Spielphase...');
        
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
    }

    initializeTurnSystem() {
        const players = this.gameSettings.players || [];
        const turnOrder = [...players].sort(() => Math.random() - 0.5); // Shuffle
        
        this.gameState.setTurnData({
            turnOrder: turnOrder.map(p => p.name),
            currentPlayer: turnOrder[0]?.name,
            turnNumber: 1,
            isMyTurn: turnOrder[0]?.id === 'local'
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
        const cheapestUnit = race.units.reduce((min, unit) => 
            unit.cost < min.cost ? unit : min
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
            currentStats: { ...unitDef.baseStats },
            currentHp: unitDef.baseStats.hp,
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
            this.socketManager.emit('end-turn', {
                gameId: this.gameSettings.gameId,
                playerId: this.gameState.currentPlayer.id
            });
        } else {
            // Demo mode - simulate turn end
            this.simulateNextTurn();
        }
        
        // Update UI
        this.gameState.setIsMyTurn(false);
        this.updateTurnUI();
        
        this.showNotification('⏭️ Zug beendet', 'info');
    }

    simulateNextTurn() {
        const turnOrder = this.gameState.data.turnOrder;
        const currentIndex = turnOrder.indexOf(this.gameState.data.currentTurnPlayer);
        const nextIndex = (currentIndex + 1) % turnOrder.length;
        const nextPlayer = turnOrder[nextIndex];
        
        // Increase turn number if we completed a full round
        if (nextIndex === 0) {
            this.gameState.updateState('turnNumber', this.gameState.turnNumber + 1);
        }
        
        setTimeout(() => {
            this.gameState.setTurnData({
                currentPlayer: nextPlayer,
                isMyTurn: nextPlayer === this.gameState.currentPlayer.name
            });
            
            if (this.gameState.isMyTurn) {
                this.startMyTurn();
            } else {
                this.updateTurnUI();
                // Simulate AI turn
                setTimeout(() => this.simulateNextTurn(), 2000);
            }
        }, 1000);
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    onGamePhaseChanged(data) {
        console.log('🔄 Spielphase geändert:', data);
        this.updateUIForPhase(data.newValue);
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

    onRaceSelected(data) {
        console.log('🏛️ Rasse ausgewählt:', data);
        this.updatePlayerDisplay();
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
        const goldAmount = document.getElementById('goldAmount');
        
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
        const upgradeUnitBtn = document.getElementById('upgradeUnitBtn');
        const moveUnitBtn = document.getElementById('moveUnitBtn');
        
        if (!selectedUnitSection) return;
        
        if (unit) {
            selectedUnitSection.style.display = 'block';
            
            if (selectedUnitInfo) {
                const def = unit.definition;
                const healthPercentage = Math.round((unit.currentHp / unit.currentStats.hp) * 100);
                
                selectedUnitInfo.innerHTML = `
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 1.5em; margin-right: 8px;">${def.icon}</span>
                        <div>
                            <strong>${def.name}</strong> (Level ${unit.level})<br>
                            <small>${def.description}</small>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                        <div><strong>❤️ Leben:</strong> ${unit.currentHp}/${unit.currentStats.hp} (${healthPercentage}%)</div>
                        <div><strong>⚔️ Angriff:</strong> ${unit.currentStats.attack}</div>
                        <div><strong>🛡️ Verteidigung:</strong> ${unit.currentStats.defense}</div>
                        <div><strong>🏃 Bewegung:</strong> ${unit.currentStats.movement}</div>
                        <div><strong>🎯 Reichweite:</strong> ${def.attackRange}</div>
                        <div><strong>📍 Position:</strong> (${unit.x}, ${unit.y})</div>
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; opacity: 0.8;">
                        ${unit.hasMoved ? '🚶 Bewegt' : '⚡ Kann sich bewegen'} | 
                        ${unit.hasActed ? '⚔️ Hat gehandelt' : '🎯 Kann angreifen'}
                    </div>
                `;
            }
            
            // Update buttons
            if (upgradeUnitBtn) {
                const upgradeCost = this.getUpgradeCost(unit);
                const canUpgrade = upgradeCost && this.gameState.playerGold >= upgradeCost && unit.level < 5;
                
                upgradeUnitBtn.disabled = !canUpgrade || !this.gameState.isMyTurn;
                upgradeUnitBtn.textContent = upgradeCost ? 
                    `⬆️ Aufwerten (${upgradeCost}💰)` : 
                    '⬆️ Max Level';
                    
                upgradeUnitBtn.onclick = () => this.upgradeUnit(unit);
            }
            
            if (moveUnitBtn) {
                moveUnitBtn.disabled = unit.hasMoved || !this.gameState.isMyTurn;
                moveUnitBtn.onclick = () => this.startUnitMovement(unit);
            }
            
        } else {
            selectedUnitSection.style.display = 'none';
        }
    }

    updateMapInfo() {
        const mapInfo = document.getElementById('mapInfo');
        if (!mapInfo || !this.mapSystem) return;
        
        const mapSize = this.gameState.mapSize;
        const unitCount = this.gameState.data.playerUnits.length;
        const cityCount = this.countOwnedBuildings('city');
        const castleCount = this.countOwnedBuildings('castle');
        
        mapInfo.innerHTML = `
            <strong>Spiel-Info:</strong><br>
            Spieler: ${this.gameState.currentPlayer?.name || 'Unbekannt'}<br>
            Spiel-ID: ${this.gameSettings?.gameId || 'Demo'}<br>
            <hr style="margin: 8px 0; opacity: 0.3;">
            <strong>Deine Statistiken:</strong><br>
            Kartengröße: ${mapSize}x${mapSize}<br>
            Einheiten: ${unitCount}<br>
            Städte: ${cityCount}<br>
            Burgen: ${castleCount}<br>
            Gold/Runde: ${this.calculateGoldIncome()}<br>
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
                    <span style="font-size: 1.2em; margin-right: 6px;">${unit.definition.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: bold;">${unit.definition.name}</div>
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
    // SERVER EVENT HANDLERS
    // ========================================

    onGameStarted(data) {
        console.log('🎮 Spiel vom Server gestartet:', data);
        this.startRaceSelection();
    }

    onAllRacesSelected(data) {
        console.log('🏛️ Alle Rassen vom Server gewählt:', data);
        this.startPlayingPhase();
    }

    onServerPhaseChanged(data) {
        console.log('📡 Server Phasen-Änderung:', data);
        this.setGamePhase(data.phase);
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
    }, 100);
});

// Setup button events after map system loads
window.addEventListener('load', () => {
    if (window.setupButtonEvents) {
        window.setupButtonEvents();
    }
});

console.log('✅ Game Main (Überarbeitet) Module geladen');