// Main Game Controller - COMPLETE FIXED VERSION
class GameController {
    constructor() {
        this.socket = io({
            closeOnBeforeunload: false // ✅ CRITICAL: Prevent automatic disconnect
        });
        this.gameId = Utils.getGameId();
        
        // ✅ FIX: Try multiple methods to get player name
        this.playerName = this.getPlayerName();
        
        this.gameData = null;
        this.players = []; // ✅ CRITICAL: Initialize as empty array to prevent undefined errors
        this.currentPlayerId = null;
        this.currentTurn = 1;
        this.currentPlayerTurn = null;
        this.playerGold = 0;
        this.playerTier = 1;
        
        // Game components
        this.map = null;
        this.units = null;
        this.chat = null;
        
        // UI state
        this.selectedAction = null;
        this.selectedBuilding = null;
        
        // ✅ NEW: Navigation tracking
        this.isNavigating = false;
        this.isGameLoaded = false;
        
        this.init();
    }

    // ✅ IMPROVED: Multiple methods to get player name
    getPlayerName() {
        // 1. Try URL parameter
        let playerName = Utils.getUrlParameter('player');
        
        // 2. Try localStorage
        if (!playerName) {
            playerName = Utils.getFromStorage('playerName');
        }
        
        // 3. Try to prompt user if both fail
        if (!playerName) {
            console.warn('No player name found, redirecting to lobby');
            // We'll handle this in init()
        }
        
        return playerName;
    }

    async init() {
        // ✅ IMPROVED: Better validation
        if (!this.gameId) {
            Utils.showError('Keine Spiel-ID gefunden');
            setTimeout(() => {
                this.isNavigating = true;
                window.location.href = '/';
            }, 2000);
            return;
        }

        if (!this.playerName) {
            Utils.showError('Kein Spielername gefunden');
            setTimeout(() => {
                this.isNavigating = true;
                window.location.href = `/lobby/${this.gameId}`;
            }, 2000);
            return;
        }

        console.log(`🎮 Initializing game ${this.gameId} for player ${this.playerName}`);

        try {
            // Initialize components
            this.initializeComponents();
            
            // Setup event handlers
            this.bindEvents();
            this.setupSocketHandlers();
            
            // ✅ WAIT FOR SOCKET CONNECTION
            if (this.socket.connected) {
                await this.startLoadSequence();
            } else {
                this.socket.on('connect', async () => {
                    console.log('✅ Socket connected, starting load sequence');
                    await this.startLoadSequence();
                });
            }
            
        } catch (error) {
            console.error('❌ Error initializing game:', error);
            Utils.showError('Fehler beim Laden des Spiels: ' + error.message);
            
            setTimeout(() => {
                this.isNavigating = true;
                window.location.href = `/lobby/${this.gameId}?player=${encodeURIComponent(this.playerName)}`;
            }, 3000);
        }
    }

    async startLoadSequence() {
        try {
            // Step 1: Load game data and verify access
            console.log('📝 Step 1: Loading game data...');
            await this.loadGameData();
            
            // Step 2: Join game room
            console.log('🏠 Step 2: Joining game room...');
            this.joinGameRoom();
            
            console.log('✅ Game initialized successfully');
            this.isGameLoaded = true;
            
        } catch (error) {
            console.error('❌ Error in game load sequence:', error);
            throw error;
        }
    }

    initializeComponents() {
        // Initialize map
        this.map = new GameMap('game-map', 'map-overlay');
        
        // Initialize units manager
        this.units = new GameUnits(this);
        
        // Initialize chat
        this.chat = new GameChat(this.gameId, this.playerName, this.socket);
        
        // Make game controller globally available
        window.gameController = this;
    }

    bindEvents() {
        // Action buttons
        const moveBtn = document.getElementById('move-unit-btn');
        const attackBtn = document.getElementById('attack-btn');
        const buyBtn = document.getElementById('buy-unit-btn');
        const upgradeBtn = document.getElementById('upgrade-tier-btn');
        const endTurnBtn = document.getElementById('end-turn-btn');

        if (moveBtn) moveBtn.addEventListener('click', () => this.setAction('move'));
        if (attackBtn) attackBtn.addEventListener('click', () => this.setAction('attack'));
        if (buyBtn) buyBtn.addEventListener('click', () => this.setAction('buy'));
        if (upgradeBtn) upgradeBtn.addEventListener('click', () => this.showUpgradeModal());
        if (endTurnBtn) endTurnBtn.addEventListener('click', () => this.endTurn());

        // Modal events
        const confirmUpgrade = document.getElementById('confirm-upgrade');
        const confirmAttack = document.getElementById('confirm-attack');

        if (confirmUpgrade) confirmUpgrade.addEventListener('click', () => this.confirmUpgrade());
        if (confirmAttack) confirmAttack.addEventListener('click', () => this.confirmAttack());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isGameLoaded) {
                this.refreshGameState();
            }
        });
        
        // ✅ IMPROVED: Better beforeunload handling
        this.beforeUnloadHandler = (e) => {
            console.log('🚨 beforeunload event triggered in game', {
                isNavigating: this.isNavigating,
                isGameLoaded: this.isGameLoaded
            });
            
            // Only emit leave-game if not intentionally navigating
            if (!this.isNavigating && this.isGameLoaded) {
                console.log('🚨 Emitting leave-game due to page unload');
                this.socket.emit('leave-game', {
                    gameId: this.gameId,
                    playerName: this.playerName
                });
            } else {
                console.log('✅ Allowing navigation - intentional or game not loaded');
            }
        };
        
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        
        // ✅ NEW: Additional cleanup on page hide
        this.visibilityChangeHandler = () => {
            if (document.visibilityState === 'hidden' && !this.isNavigating && this.isGameLoaded) {
                console.log('🚨 Page hidden - emitting leave-game');
                this.socket.emit('leave-game', {
                    gameId: this.gameId,
                    playerName: this.playerName
                });
            }
        };
        
        document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    setupSocketHandlers() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('🔌 Socket connected');
            if (this.gameId && this.playerName && this.isGameLoaded) {
                this.joinGameRoom();
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            if (reason !== 'io client disconnect' && !this.isNavigating) {
                Utils.showError('Verbindung zum Server verloren');
            }
        });

        // Game events
        this.socket.on('game-state-update', (gameState) => {
            this.handleGameStateUpdate(gameState);
        });

        this.socket.on('turn-changed', (data) => {
            this.handleTurnChange(data);
        });

        this.socket.on('unit-moved', (data) => {
            this.handleUnitMoved(data);
        });

        this.socket.on('unit-attacked', (data) => {
            this.handleUnitAttacked(data);
        });

        this.socket.on('unit-purchased', (data) => {
            this.handleUnitPurchased(data);
        });

        this.socket.on('player-eliminated', (data) => {
            this.handlePlayerEliminated(data);
        });

        this.socket.on('game-ended', (data) => {
            this.handleGameEnded(data);
        });

        this.socket.on('error', (error) => {
            Utils.showError(error.message || 'Ein Fehler ist aufgetreten');
        });
    }

    async loadGameData() {
        try {
            // Load game info
            const gameData = await Utils.get(`/api/games/${this.gameId}`);
            
            if (!gameData || !gameData.game) {
                throw new Error('Spiel nicht gefunden');
            }

            if (gameData.game.status !== 'playing') {
                console.warn(`Game status is ${gameData.game.status}, redirecting to appropriate page`);
                
                if (gameData.game.status === 'race_selection') {
                    this.isNavigating = true;
                    window.location.href = `/race-selection/${this.gameId}?player=${encodeURIComponent(this.playerName)}`;
                } else if (gameData.game.status === 'lobby') {
                    this.isNavigating = true;
                    window.location.href = `/lobby/${this.gameId}?player=${encodeURIComponent(this.playerName)}`;
                } else {
                    throw new Error(`Unbekannter Spielstatus: ${gameData.game.status}`);
                }
                return;
            }

            this.gameData = gameData.game;
            this.players = gameData.players || []; // ✅ CRITICAL: Ensure players is always an array
            
            // ✅ CRITICAL: Validate players array before accessing
            if (!Array.isArray(this.players)) {
                console.error('Players data is not an array:', this.players);
                this.players = [];
            }
            
            // Find current player
            const currentPlayer = this.players.find(p => p.player_name === this.playerName);
            if (!currentPlayer) {
                console.warn('Current player not found in game, attempting to rejoin...');
                
                // ✅ NEW: Try to rejoin the game automatically
                try {
                    const rejoinResponse = await Utils.post(`/api/games/${this.gameId}/join`, {
                        playerName: this.playerName
                    });
                    
                    if (rejoinResponse.isRejoin) {
                        console.log('✅ Successfully rejoined game, reloading data...');
                        // Retry loading game data
                        return this.loadGameData();
                    }
                } catch (rejoinError) {
                    console.error('Failed to rejoin game:', rejoinError);
                }
                
                throw new Error('Du bist nicht in diesem Spiel');
            }
            
            this.currentPlayerId = currentPlayer.id;
            this.playerGold = currentPlayer.gold || 0;
            this.playerTier = currentPlayer.tier_level || 1;
            this.currentTurn = this.gameData.current_turn || 1;
            this.currentPlayerTurn = this.gameData.current_player_turn;

            console.log('✅ Game data loaded:', {
                gameStatus: this.gameData.status,
                playerCount: this.players.length,
                currentPlayerId: this.currentPlayerId,
                playerGold: this.playerGold
            });

            // Load map data
            await this.loadMapData();
            
            // Load units
            await this.loadUnitsData();
            
            // Load available units for purchase
            if (currentPlayer.race_id) {
                await this.units.loadAvailableUnits(currentPlayer.race_id);
            }

            // Update UI
            this.updateGameUI();
            
        } catch (error) {
            console.error('Error loading game data:', error);
            throw error;
        }
    }

    async loadMapData() {
        try {
            console.log(`🗺️ Loading map data for game ${this.gameId}...`);
            const mapData = await Utils.get(`/api/games/${this.gameId}/map`);
            
            if (mapData && mapData.length > 0) {
                console.log(`✅ Map data loaded: ${mapData.length} tiles`);
                await this.map.loadMap(mapData);
                console.log('✅ Map loaded successfully');
            } else {
                console.log('⚠️ No map data found, showing placeholder');
                this.showPlaceholderMap();
            }
        } catch (error) {
            console.error('❌ Error loading map:', error);
            // Show placeholder map for development
            this.showPlaceholderMap();
        }
    }

    async loadUnitsData() {
        try {
            console.log(`🔍 Loading units data for game ${this.gameId}...`);
            const unitsData = await Utils.get(`/api/games/${this.gameId}/units`);
            
            console.log(`✅ Units data received:`, unitsData);
            await this.units.loadUnits(unitsData || []);
            
            // Update map with units
            this.map.updateUnits(unitsData || []);
            
            console.log(`✅ Loaded ${unitsData?.length || 0} units`);
        } catch (error) {
            console.error('❌ Error loading units:', error);
            // Don't throw error, just use empty units array
            await this.units.loadUnits([]);
            this.map.updateUnits([]);
        }
    }

    showPlaceholderMap() {
        // Development placeholder until map generation is fully implemented
        const placeholderMap = [];
        const size = 20;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                placeholderMap.push({
                    x_pos: x,
                    y_pos: y,
                    terrain_type_id: Math.floor(Math.random() * 7) + 1,
                    building_type_id: (x === 5 && y === 5) ? 1 : null,
                    building_owner_id: (x === 5 && y === 5) ? this.currentPlayerId : null
                });
            }
        }
        
        this.map.loadMap(placeholderMap, []);
        Utils.showInfo('Development-Karte geladen (Kartengenerierung wird noch implementiert)');
    }

    joinGameRoom() {
        if (this.socket.connected) {
            this.socket.emit('join-game', {
                gameId: this.gameId,
                playerName: this.playerName
            });
        }
    }

    // UI Updates
    updateGameUI() {
        this.updateGameHeader();
        this.updatePlayersList();
        this.updateActionButtons();
    }

    updateGameHeader() {
        const gameNameEl = document.getElementById('game-name');
        const currentTurnEl = document.getElementById('current-turn');
        const currentPlayerNameEl = document.getElementById('current-player-name');
        const currentPlayerGoldEl = document.getElementById('current-player-gold');
        const currentPlayerAvatar = document.getElementById('current-player-avatar');

        if (gameNameEl) gameNameEl.textContent = this.gameData?.name || 'Strategiespiel';
        if (currentTurnEl) currentTurnEl.textContent = this.currentTurn;

        // Current player info
        const currentPlayer = this.getCurrentTurnPlayer();
        if (currentPlayer) {
            if (currentPlayerNameEl) {
                const isMyTurn = currentPlayer.id === this.currentPlayerId;
                currentPlayerNameEl.textContent = isMyTurn ? 'Du bist dran!' : currentPlayer.player_name;
            }
            
            if (currentPlayerGoldEl) {
                const gold = currentPlayer.id === this.currentPlayerId ? this.playerGold : (currentPlayer.gold || 0);
                currentPlayerGoldEl.textContent = `💰 ${gold}`;
            }

            if (currentPlayerAvatar) {
                currentPlayerAvatar.textContent = currentPlayer.player_name.charAt(0).toUpperCase();
                currentPlayerAvatar.style.backgroundColor = this.map.getPlayerColor(currentPlayer.id);
            }
        }
    }

    updatePlayersList() {
        const playersList = document.getElementById('players-list');
        if (!playersList || !Array.isArray(this.players)) return;

        Utils.clearElement(playersList);

        this.players.forEach(player => {
            const playerElement = this.createPlayerElement(player);
            playersList.appendChild(playerElement);
        });
    }

    createPlayerElement(player) {
        const playerDiv = Utils.createElement('div', 'player-item');
        
        const isCurrentTurn = player.id === this.currentPlayerTurn;
        const isCurrentPlayer = player.id === this.currentPlayerId;
        
        if (isCurrentTurn) playerDiv.classList.add('current');
        if (player.eliminated) playerDiv.classList.add('eliminated');

        const playerColor = this.map.getPlayerColor(player.id);
        
        playerDiv.innerHTML = `
            <div class="player-avatar-small" style="background-color: ${playerColor}">
                ${player.player_name.charAt(0).toUpperCase()}
            </div>
            <div class="player-details">
                <div class="player-name">
                    ${Utils.escapeHtml(player.player_name)}
                    ${isCurrentPlayer ? ' (Du)' : ''}
                    ${isCurrentTurn ? ' 🎯' : ''}
                </div>
                <div class="player-stats">
                    <span>💰 ${player.gold || 0}</span>
                    <span>⭐ Stufe ${player.tier_level || 1}</span>
                    ${player.eliminated ? '<span>❌ Ausgeschieden</span>' : ''}
                </div>
            </div>
        `;

        return playerDiv;
    }

    updateActionButtons() {
        const isMyTurn = this.isMyTurn();
        const moveBtn = document.getElementById('move-unit-btn');
        const attackBtn = document.getElementById('attack-btn');
        const buyBtn = document.getElementById('buy-unit-btn');
        const upgradeBtn = document.getElementById('upgrade-tier-btn');
        const endTurnBtn = document.getElementById('end-turn-btn');

        // Enable/disable buttons based on turn
        [moveBtn, attackBtn, buyBtn, upgradeBtn].forEach(btn => {
            if (btn) btn.disabled = !isMyTurn;
        });

        if (endTurnBtn) {
            endTurnBtn.disabled = !isMyTurn;
            endTurnBtn.textContent = isMyTurn ? '⏭️ Zug beenden' : '⏳ Warte auf Zug';
        }

        // Update upgrade button
        if (upgradeBtn && this.playerTier >= 3) {
            upgradeBtn.disabled = true;
            upgradeBtn.textContent = '✅ Max. Stufe';
        }

        // Update active action button
        this.updateActionButtonStates();
    }

    updateActionButtonStates() {
        const buttons = ['move-unit-btn', 'attack-btn', 'buy-unit-btn'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.classList.toggle('active', this.selectedAction === btnId.replace('-btn', '').replace('-unit', ''));
            }
        });
    }

    // Game Actions
    setAction(action) {
        if (!this.isMyTurn()) {
            Utils.showError('Du bist nicht am Zug');
            return;
        }

        // Toggle action
        if (this.selectedAction === action) {
            this.selectedAction = null;
            this.units.clearSelection();
        } else {
            this.selectedAction = action;
        }

        this.updateActionButtonStates();
    }

    onTileSelected(tile) {
        if (!this.isMyTurn()) return;

        const tileData = tile.data;
        const unit = this.units.getUnitAt(tile.x, tile.y);

        console.log(`Tile selected: ${tile.x}, ${tile.y}`, { tileData, unit, action: this.selectedAction });

        switch (this.selectedAction) {
            case 'move':
                this.handleMoveAction(tile, unit);
                break;
            case 'attack':
                this.handleAttackAction(tile, unit);
                break;
            case 'buy':
                this.handleBuyAction(tile, tileData);
                break;
            default:
                this.handleDefaultTileSelection(tile, unit, tileData);
        }

        this.updateSelectionInfo(tile, unit, tileData);
    }

    handleMoveAction(tile, unit) {
        if (!this.units.selectedUnit) {
            // Select unit to move
            if (unit && unit.player_id === this.currentPlayerId) {
                this.units.selectUnit(tile.x, tile.y);
            } else {
                Utils.showError('Wähle eine deiner Einheiten aus');
            }
        } else {
            // Try to move selected unit
            if (this.units.canMoveToTile(tile.x, tile.y)) {
                this.moveSelectedUnit(tile.x, tile.y);
            } else {
                Utils.showError('Kann nicht zu diesem Feld bewegen');
            }
        }
    }

    handleAttackAction(tile, unit) {
        if (!this.units.selectedUnit) {
            // Select attacking unit
            if (unit && unit.player_id === this.currentPlayerId) {
                this.units.selectUnit(tile.x, tile.y);
            } else {
                Utils.showError('Wähle eine deiner Einheiten aus');
            }
        } else {
            // Try to attack
            if (this.units.canAttackTile(tile.x, tile.y)) {
                this.showAttackModal(this.units.selectedUnit, unit);
            } else {
                Utils.showError('Kann dieses Ziel nicht angreifen');
            }
        }
    }

    handleBuyAction(tile, tileData) {
        if (tileData.building_type_id && tileData.building_owner_id === this.currentPlayerId) {
            if (this.units.isValidPurchaseLocation(tile.x, tile.y)) {
                this.selectedBuilding = { x: tile.x, y: tile.y, type: tileData.building_type_id };
                this.showPurchaseModal();
            } else {
                Utils.showError('Auf diesem Gebäude steht bereits eine Einheit');
            }
        } else {
            Utils.showError('Du kannst nur in deinen eigenen Gebäuden Einheiten kaufen');
        }
    }

    handleDefaultTileSelection(tile, unit, tileData) {
        if (unit && unit.player_id === this.currentPlayerId) {
            // Select own unit
            this.units.selectUnit(tile.x, tile.y);
        } else {
            // Just show tile info
            this.units.clearSelection();
        }
    }

    async moveSelectedUnit(x, y) {
        if (!this.units.selectedUnit) return;

        try {
            const response = await this.units.moveUnit(this.units.selectedUnit, x, y);
            Utils.showSuccess('Einheit bewegt');
            this.units.clearSelection();
            this.selectedAction = null;
            this.updateActionButtonStates();
        } catch (error) {
            Utils.showError(error.message);
        }
    }

    showAttackModal(attacker, defender) {
        const modal = document.getElementById('attack-modal');
        const attackerDetails = document.getElementById('attacker-details');
        const defenderDetails = document.getElementById('defender-details');
        const damagePreview = document.getElementById('damage-preview');

        if (!modal || !attackerDetails || !defenderDetails || !damagePreview) return;

        const attackerInfo = this.units.getUnitDisplayInfo(attacker);
        const defenderInfo = this.units.getUnitDisplayInfo(defender);
        const damage = this.units.calculateDamage(attacker, defender);

        attackerDetails.innerHTML = `
            <div><strong>${attackerInfo.name}</strong></div>
            <div>❤️ ${attackerInfo.health}/${attackerInfo.maxHealth}</div>
            <div>⚔️ ${attackerInfo.attack}</div>
        `;

        defenderDetails.innerHTML = `
            <div><strong>${defenderInfo.name}</strong></div>
            <div>❤️ ${defenderInfo.health}/${defenderInfo.maxHealth}</div>
            <div>🛡️ Verteidiger</div>
        `;

        damagePreview.innerHTML = `
            <strong>Schaden: ${damage.damage}</strong><br>
            ${damage.willDestroy ? 
                '<span style="color: #f44336;">Einheit wird zerstört!</span>' : 
                `Verbleibt: ${damage.survivedHealth} HP`
            }
        `;

        this.attackTarget = { x: defender.x_pos, y: defender.y_pos };
        Utils.showModal('attack-modal');
    }

    async confirmAttack() {
        if (!this.units.selectedUnit || !this.attackTarget) return;

        try {
            const response = await this.units.attackUnit(
                this.units.selectedUnit, 
                this.attackTarget.x, 
                this.attackTarget.y
            );
            
            Utils.hideModal('attack-modal');
            Utils.showSuccess('Angriff erfolgreich');
            this.units.clearSelection();
            this.selectedAction = null;
            this.updateActionButtonStates();
        } catch (error) {
            Utils.showError(error.message);
        }
    }

    showPurchaseModal() {
        if (!this.selectedBuilding) return;

        const modal = document.getElementById('purchase-modal');
        const unitsGrid = document.getElementById('available-units');

        if (!modal || !unitsGrid) return;

        Utils.clearElement(unitsGrid);

        const affordableUnits = this.units.getAffordableUnits(this.playerGold, this.playerTier);

        affordableUnits.forEach(unit => {
            const unitCard = this.createPurchaseUnitCard(unit);
            unitsGrid.appendChild(unitCard);
        });

        Utils.showModal('purchase-modal');
    }

    createPurchaseUnitCard(unit) {
        const unitDiv = Utils.createElement('div', 'unit-card');
        
        if (unit.affordable) {
            unitDiv.classList.add('affordable');
        } else {
            unitDiv.classList.add('expensive');
        }

        unitDiv.innerHTML = `
            <div class="unit-image">
                ${unit.name.charAt(0).toUpperCase()}
            </div>
            <div class="unit-name">${Utils.escapeHtml(unit.name)}</div>
            <div class="unit-cost">💰 ${unit.cost}</div>
            <div class="unit-stats-mini">
                <span>❤️ ${unit.enhancedHealth}</span>
                <span>⚔️ ${unit.enhancedAttack}</span>
                <span>🎯 ${unit.enhancedRange}</span>
            </div>
        `;

        if (unit.affordable) {
            unitDiv.addEventListener('click', () => this.purchaseUnit(unit));
        }

        return unitDiv;
    }

    async purchaseUnit(unit) {
        if (!this.selectedBuilding) return;

        try {
            const response = await this.units.purchaseUnit(
                unit.id, 
                this.selectedBuilding.x, 
                this.selectedBuilding.y
            );
            
            Utils.hideModal('purchase-modal');
            Utils.showSuccess(`${unit.name} gekauft`);
            
            // Update gold
            this.playerGold -= unit.cost;
            this.updateGameUI();
            
            this.selectedBuilding = null;
            this.selectedAction = null;
            this.updateActionButtonStates();
        } catch (error) {
            Utils.showError(error.message);
        }
    }

    showUpgradeModal() {
        if (!this.isMyTurn() || this.playerTier >= 3) return;

        const modal = document.getElementById('upgrade-modal');
        const currentTierEl = document.getElementById('current-tier-level');
        const upgradeCostEl = document.getElementById('upgrade-cost');

        if (!modal) return;

        const nextTier = this.playerTier + 1;
        const upgradeCosts = { 2: 500, 3: 1000 };
        const cost = upgradeCosts[nextTier] || 0;

        if (currentTierEl) currentTierEl.textContent = this.playerTier;
        if (upgradeCostEl) upgradeCostEl.textContent = cost;

        const confirmBtn = document.getElementById('confirm-upgrade');
        if (confirmBtn) {
            confirmBtn.disabled = this.playerGold < cost;
            confirmBtn.textContent = this.playerGold < cost ? 'Nicht genug Gold' : 'Stufe erhöhen';
        }

        Utils.showModal('upgrade-modal');
    }

    async confirmUpgrade() {
        const nextTier = this.playerTier + 1;
        const upgradeCosts = { 2: 500, 3: 1000 };
        const cost = upgradeCosts[nextTier] || 0;

        if (this.playerGold < cost) {
            Utils.showError('Nicht genug Gold');
            return;
        }

        try {
            const response = await this.emitWithAck('upgrade-tier', {
                gameId: this.gameId,
                playerName: this.playerName,
                newTier: nextTier
            });

            if (response.success) {
                Utils.hideModal('upgrade-modal');
                Utils.showSuccess(`Auf Stufe ${nextTier} aufgestiegen!`);
                
                this.playerTier = nextTier;
                this.playerGold -= cost;
                this.updateGameUI();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            Utils.showError(error.message || 'Fehler beim Aufstieg');
        }
    }

    async endTurn() {
        if (!this.isMyTurn()) {
            Utils.showError('Du bist nicht am Zug');
            return;
        }

        try {
            this.socket.emit('end-turn', {
                gameId: this.gameId,
                playerName: this.playerName
            });

            // Clear selection
            this.units.clearSelection();
            this.selectedAction = null;
            this.updateActionButtonStates();
            
            Utils.showInfo('Zug beendet');
        } catch (error) {
            Utils.showError('Fehler beim Beenden des Zugs');
        }
    }

    updateSelectionInfo(tile, unit, tileData) {
        const selectionInfo = document.getElementById('selection-info');
        const selectionContent = document.getElementById('selection-content');

        if (!selectionInfo || !selectionContent) return;

        Utils.clearElement(selectionContent);

        if (unit) {
            // Show unit info
            const unitInfo = this.units.getUnitDisplayInfo(unit);
            const isOwnUnit = unit.player_id === this.currentPlayerId;

            const unitInfoDiv = Utils.createElement('div', 'unit-info');
            unitInfoDiv.innerHTML = `
                <h4>${Utils.escapeHtml(unitInfo.name)} ${isOwnUnit ? '(Deine)' : ''}</h4>
                <div class="unit-health-bar">
                    <div class="health-fill ${this.getHealthClass(unitInfo.healthPercent)}" 
                         style="width: ${unitInfo.healthPercent}%"></div>
                </div>
                <div class="unit-stats">
                    <div class="stat-item">
                        <span>❤️ Leben:</span>
                        <span>${unitInfo.health}/${unitInfo.maxHealth}</span>
                    </div>
                    <div class="stat-item">
                        <span>⚔️ Angriff:</span>
                        <span>${unitInfo.attack}</span>
                    </div>
                    <div class="stat-item">
                        <span>🚶 Bewegung:</span>
                        <span>${unitInfo.movement}/${unitInfo.maxMovement}</span>
                    </div>
                    <div class="stat-item">
                        <span>🎯 Reichweite:</span>
                        <span>${unitInfo.range}</span>
                    </div>
                    <div class="stat-item">
                        <span>✈️ Typ:</span>
                        <span>${unitInfo.canFly ? 'Fliegend' : 'Boden'}</span>
                    </div>
                    <div class="stat-item">
                        <span>📍 Position:</span>
                        <span>${tile.x}, ${tile.y}</span>
                    </div>
                </div>
            `;

            selectionContent.appendChild(unitInfoDiv);
        } else {
            // Show tile info
            const tileInfoDiv = Utils.createElement('div', 'tile-info');
            tileInfoDiv.innerHTML = `
                <h4>Feld (${tile.x}, ${tile.y})</h4>
                <div class="tile-stats">
                    <div class="stat-item">
                        <span>🌍 Terrain:</span>
                        <span>${this.getTerrainName(tileData.terrain_type_id)}</span>
                    </div>
                    ${tileData.building_type_id ? `
                        <div class="stat-item">
                            <span>🏰 Gebäude:</span>
                            <span>${this.getBuildingName(tileData.building_type_id)}</span>
                        </div>
                    ` : ''}
                    ${tileData.building_owner_id ? `
                        <div class="stat-item">
                            <span>👤 Besitzer:</span>
                            <span>${this.getPlayerName(tileData.building_owner_id)}</span>
                        </div>
                    ` : ''}
                </div>
            `;

            selectionContent.appendChild(tileInfoDiv);
        }

        selectionInfo.classList.remove('hidden');
    }

    // Socket Event Handlers
    handleGameStateUpdate(gameState) {
        console.log('Game state update received:', gameState);
        
        if (gameState.game) {
            this.gameData = gameState.game;
            this.currentTurn = gameState.game.current_turn;
            this.currentPlayerTurn = gameState.game.current_player_turn;
        }

        if (gameState.players) {
            this.players = gameState.players;
            
            // Update current player data
            const currentPlayer = this.players.find(p => p.id === this.currentPlayerId);
            if (currentPlayer) {
                this.playerGold = currentPlayer.gold || 0;
                this.playerTier = currentPlayer.tier_level || 1;
            }
        }

        this.updateGameUI();
    }

    handleTurnChange(data) {
        console.log('Turn changed:', data);
        
        this.currentPlayerTurn = this.getPlayerByName(data.currentPlayer)?.id;
        this.currentTurn = data.turn;
        
        // Clear selections when turn changes
        this.units.clearSelection();
        this.selectedAction = null;
        
        this.updateGameUI();
        
        if (this.isMyTurn()) {
            Utils.showSuccess('Du bist dran!');
        } else {
            Utils.showInfo(`${data.currentPlayer} ist am Zug`);
        }
    }

    handleUnitMoved(data) {
        console.log('Unit moved:', data);
        
        // Update unit position
        if (data.unit) {
            this.units.updateUnit(data.unit);
            this.map.updateUnits(this.units.units);
        }
        
        // Update player gold if applicable
        if (data.playerGold !== undefined) {
            const player = this.players.find(p => p.id === data.playerId);
            if (player) {
                player.gold = data.playerGold;
                if (player.id === this.currentPlayerId) {
                    this.playerGold = data.playerGold;
                }
            }
        }
        
        this.updateGameUI();
    }

    handleUnitAttacked(data) {
        console.log('Unit attacked:', data);
        
        // Update attacker
        if (data.attacker) {
            this.units.updateUnit(data.attacker);
        }
        
        // Update or remove defender
        if (data.defender) {
            this.units.updateUnit(data.defender);
        } else if (data.destroyedUnitId) {
            this.units.removeUnit(data.destroyedUnitId);
        }
        
        this.map.updateUnits(this.units.units);
        
        const message = data.destroyed ? 
            `Einheit zerstört! ${data.damage} Schaden` : 
            `${data.damage} Schaden verursacht`;
        Utils.showInfo(message);
    }

    handleUnitPurchased(data) {
        console.log('Unit purchased:', data);
        
        // Add new unit
        if (data.unit) {
            this.units.addUnit(data.unit);
            this.map.updateUnits(this.units.units);
        }
        
        // Update player gold
        if (data.playerGold !== undefined) {
            const player = this.players.find(p => p.id === data.playerId);
            if (player) {
                player.gold = data.playerGold;
                if (player.id === this.currentPlayerId) {
                    this.playerGold = data.playerGold;
                }
            }
        }
        
        this.updateGameUI();
    }

    handlePlayerEliminated(data) {
        console.log('Player eliminated:', data);
        
        const player = this.players.find(p => p.id === data.playerId);
        if (player) {
            player.eliminated = true;
            Utils.showInfo(`${player.player_name} wurde eliminiert!`);
        }
        
        this.updateGameUI();
    }

    handleGameEnded(data) {
        console.log('Game ended:', data);
        
        const winnerName = data.winner ? this.getPlayerName(data.winner) : 'Unbekannt';
        const isWinner = data.winner === this.currentPlayerId;
        
        this.showVictoryModal(winnerName, isWinner, data.stats);
    }

    showVictoryModal(winnerName, isWinner, stats) {
        const modal = document.getElementById('victory-modal');
        const victoryTitle = document.getElementById('victory-title');
        const victoryMessage = document.getElementById('victory-message');
        const gameStats = document.getElementById('game-stats');

        if (!modal) return;

        if (victoryTitle) {
            victoryTitle.textContent = isWinner ? '🎉 Sieg!' : '💔 Niederlage';
        }

        if (victoryMessage) {
            victoryMessage.innerHTML = isWinner ? 
                `<strong>Herzlichen Glückwunsch!</strong><br>Du hast das Spiel gewonnen!` :
                `<strong>Spiel beendet</strong><br>${Utils.escapeHtml(winnerName)} hat gewonnen.`;
        }

        if (gameStats && stats) {
            gameStats.innerHTML = `
                <h4>📊 Spielstatistiken</h4>
                <div class="stat-item">
                    <span>🏁 Runden gespielt:</span>
                    <span>${stats.totalTurns || this.currentTurn}</span>
                </div>
                <div class="stat-item">
                    <span>⏱️ Spieldauer:</span>
                    <span>${this.formatGameDuration(stats.duration)}</span>
                </div>
                <div class="stat-item">
                    <span>👥 Spieler:</span>
                    <span>${this.players.length}</span>
                </div>
                ${stats.unitsKilled ? `
                    <div class="stat-item">
                        <span>⚔️ Einheiten besiegt:</span>
                        <span>${stats.unitsKilled}</span>
                    </div>
                ` : ''}
            `;
        }

        Utils.showModal('victory-modal');
    }

    // Keyboard Handlers
    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case '1':
                if (this.isMyTurn()) this.setAction('move');
                break;
            case '2':
                if (this.isMyTurn()) this.setAction('attack');
                break;
            case '3':
                if (this.isMyTurn()) this.setAction('buy');
                break;
            case 'u':
            case 'U':
                if (this.isMyTurn()) this.showUpgradeModal();
                break;
            case ' ':
                if (this.isMyTurn()) {
                    e.preventDefault();
                    this.endTurn();
                }
                break;
            case 'Escape':
                this.units.clearSelection();
                this.selectedAction = null;
                this.updateActionButtonStates();
                break;
            case 'c':
            case 'C':
                this.chat.focusInput();
                break;
        }
    }

    // Utility Methods
    isMyTurn() {
        return this.currentPlayerTurn === this.currentPlayerId;
    }

    getCurrentTurnPlayer() {
        // ✅ FIXED: Add safety check for players array
        if (!Array.isArray(this.players)) {
            console.error('Players is not an array:', this.players);
            return null;
        }
        return this.players.find(p => p.id === this.currentPlayerTurn);
    }

    getPlayer(playerId) {
        // ✅ FIXED: Add safety check for players array
        if (!Array.isArray(this.players)) {
            console.error('Players is not an array:', this.players);
            return null;
        }
        return this.players.find(p => p.id === playerId);
    }

    getPlayerByName(playerName) {
        // ✅ FIXED: Add safety check for players array
        if (!Array.isArray(this.players)) {
            console.error('Players is not an array:', this.players);
            return null;
        }
        return this.players.find(p => p.player_name === playerName);
    }

    getPlayerName(playerId) {
        const player = this.getPlayer(playerId);
        return player ? player.player_name : 'Unbekannt';
    }

    getTerrainName(terrainId) {
        const names = {
            1: 'Grasland',
            2: 'Gebirge', 
            3: 'Sumpf',
            4: 'Wasser',
            5: 'Wald',
            6: 'Wüste',
            7: 'Schnee'
        };
        return names[terrainId] || 'Unbekannt';
    }

    getBuildingName(buildingId) {
        const names = {
            1: 'Dorf',
            2: 'Burg'
        };
        return names[buildingId] || 'Unbekannt';
    }

    getHealthClass(healthPercent) {
        if (healthPercent <= 25) return 'low';
        if (healthPercent <= 50) return 'medium';
        return '';
    }

    formatGameDuration(durationMs) {
        if (!durationMs) return 'Unbekannt';
        
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        
        if (minutes > 60) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        }
        
        return `${minutes}m ${seconds}s`;
    }

    async refreshGameState() {
        try {
            await this.loadGameData();
            console.log('Game state refreshed');
        } catch (error) {
            console.error('Error refreshing game state:', error);
        }
    }

    // Socket helper for acknowledgments
    emitWithAck(event, data) {
        return new Promise((resolve, reject) => {
            this.socket.emit(event, data, (response) => {
                if (response && response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response?.error || 'Unknown error'));
                }
            });
        });
    }

    // ✅ NEW: Cleanup method
    cleanup() {
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        }
        if (this.visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
        }
        
        if (this.map) this.map.destroy?.();
        if (this.units) this.units.destroy?.();
        if (this.chat) this.chat.destroy?.();
        
        this.socket?.disconnect();
        
        // Remove global reference
        if (window.gameController === this) {
            delete window.gameController;
        }
    }

    // Development/Debug Methods
    debugStatus() {
        console.log('=== GAME DEBUG STATUS ===');
        console.log('Game ID:', this.gameId);
        console.log('Player Name:', this.playerName);
        console.log('Current Player ID:', this.currentPlayerId);
        console.log('Current Turn:', this.currentTurn);
        console.log('Current Player Turn:', this.currentPlayerTurn);
        console.log('Is My Turn:', this.isMyTurn());
        console.log('Player Gold:', this.playerGold);
        console.log('Player Tier:', this.playerTier);
        console.log('Selected Action:', this.selectedAction);
        console.log('Socket Connected:', this.socket?.connected);
        console.log('Game Data:', this.gameData);
        console.log('Players:', this.players);
        console.log('Units Count:', this.units?.units?.length || 0);
        console.log('Map Loaded:', !!this.map?.mapData);
        console.log('Is Game Loaded:', this.isGameLoaded);
        console.log('Is Navigating:', this.isNavigating);
        console.log('========================');
    }
}

// Initialize game when page loads
let gameController;

document.addEventListener('DOMContentLoaded', () => {
    try {
        gameController = new GameController();
        
        // Make debug function globally available
        window.debugGame = () => gameController.debugStatus();
        console.log('🐛 Debug function available: debugGame()');
        
        // ✅ NEW: Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (gameController) {
                gameController.cleanup();
            }
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize game controller:', error);
        Utils.showError('Fehler beim Laden des Spiels: ' + error.message);
        
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    }
});