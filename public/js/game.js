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
        console.log('🔍 Player name from URL:', playerName);
        
        // 2. Try localStorage
        if (!playerName) {
            playerName = Utils.getFromStorage('playerName');
            console.log('🔍 Player name from storage:', playerName);
        }
        
        // 3. Try sessionStorage
        if (!playerName) {
            try {
                playerName = sessionStorage.getItem('playerName');
                console.log('🔍 Player name from session:', playerName);
            } catch (e) {
                console.log('Session storage not available');
            }
        }
        
        // 4. Last resort - extract from current page path (for race selection redirects)
        if (!playerName) {
            const urlParams = new URLSearchParams(window.location.search);
            playerName = urlParams.get('player') || urlParams.get('playerName');
            console.log('🔍 Player name from search params:', playerName);
        }
        
        if (!playerName) {
            console.error('❌ No player name found anywhere!');
            Utils.showError('Spielername nicht gefunden. Kehre zur Startseite zurück.');
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
        
        return playerName;
    }

    async init() {
        try {
            console.log('🎮 Initializing Game Controller...');
            console.log(`🎮 Game ID: ${this.gameId}`);
            console.log(`👤 Player Name: ${this.playerName}`);
            
            if (!this.gameId || !this.playerName) {
                throw new Error('Game ID oder Spielername fehlt');
            }
            
            // Initialize components first
            this.initializeComponents();
            
            // Bind events
            this.bindEvents();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Start loading sequence
            await this.startLoadSequence();
            
        } catch (error) {
            console.error('❌ Error initializing game:', error);
            Utils.showError('Fehler beim Initialisieren des Spiels: ' + error.message);
            setTimeout(() => {
                window.location.href = '/';
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

        // Close modal buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || e.target.classList.contains('modal-overlay')) {
                this.closeModals();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSelection();
                this.closeModals();
            }
        });
    }

    setupEventHandlers() {
        // Socket events
        this.socket.on('connect', () => {
            console.log('🔌 Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
        });

        this.socket.on('game-state-update', (gameState) => {
            console.log('📡 Game state update received:', gameState);
            this.handleGameStateUpdate(gameState);
        });

        this.socket.on('turn-update', (data) => {
            console.log('🔄 Turn update received:', data);
            this.handleTurnUpdate(data);
        });

        this.socket.on('unit-moved', (data) => {
            console.log('👣 Unit moved:', data);
            this.handleUnitMoved(data);
        });

        this.socket.on('unit-attacked', (data) => {
            console.log('⚔️ Unit attacked:', data);
            this.handleUnitAttacked(data);
        });

        this.socket.on('unit-purchased', (data) => {
            console.log('💰 Unit purchased:', data);
            this.handleUnitPurchased(data);
        });

        this.socket.on('tier-upgraded', (data) => {
            console.log('📈 Tier upgraded:', data);
            this.handleTierUpgraded(data);
        });

        this.socket.on('player-eliminated', (data) => {
            console.log('💀 Player eliminated:', data);
            this.handlePlayerEliminated(data);
        });

        this.socket.on('game-won', (data) => {
            console.log('🏆 Game won:', data);
            this.handleGameWon(data);
        });

        // Prevent accidental page unload
        this.beforeUnloadHandler = (e) => {
            if (this.isGameLoaded && !this.isNavigating) {
                const message = 'Das Spiel ist noch aktiv. Möchtest du wirklich die Seite verlassen?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        };
        
        window.addEventListener('beforeunload', this.beforeUnloadHandler);

        // Handle visibility change
        this.visibilityChangeHandler = () => {
            if (!document.hidden && this.isGameLoaded) {
                console.log('👁️ Page visible again, refreshing game state...');
                this.refreshGameState();
            }
        };
        
        document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    joinGameRoom() {
        this.socket.emit('join-game', {
            gameId: this.gameId,
            playerName: this.playerName
        });
    }

    // ✅ FIXED: Properly structured loadGameData method
    async loadGameData() {
        try {
            console.log(`📋 Loading game data for game ${this.gameId}...`);
            
            // ✅ STEP 1: Get game data
            console.log('📝 Step 1: Fetching game data...');
            this.gameData = await Utils.get(`/api/games/${this.gameId}/status`);
            
            if (!this.gameData) {
                throw new Error('Spieldaten konnten nicht geladen werden');
            }
            
            console.log('✅ Game data loaded:', this.gameData);
            
            // ✅ STEP 2: Get players
            console.log('📝 Step 2: Fetching players...');
            this.players = await Utils.get(`/api/games/${this.gameId}/players`);
            
            if (!Array.isArray(this.players) || this.players.length === 0) {
                throw new Error('Keine Spieler im Spiel gefunden');
            }
            
            console.log('✅ Players loaded:', this.players);
            
            // ✅ STEP 3: Find current player
            console.log('📝 Step 3: Finding current player...');
            const currentPlayer = this.players.find(p => p.player_name === this.playerName);
            
            if (!currentPlayer) {
                console.log('❌ Player not found in game');
                console.log('Looking for:', this.playerName);
                console.log('Available players:', this.players.map(p => p.player_name));
                
                // Try to find similar players (case insensitive)
                const similarPlayers = this.players.filter(p => 
                    p.player_name.toLowerCase() === this.playerName.toLowerCase()
                );
                
                if (similarPlayers.length > 0) {
                    console.log(`📝 Found similar players: ${similarPlayers.map(p => p.player_name).join(', ')}`);
                } else {
                    throw new Error('Du bist nicht in diesem Spiel. Kehre zur Lobby zurück.');
                }
            }
            
            console.log('✅ Current player found:', currentPlayer);
            
            // ✅ STEP 4: Set player data
            console.log('📝 Step 4: Setting player data...');
            this.currentPlayerId = currentPlayer.id;
            this.playerGold = currentPlayer.gold || 0;
            this.playerTier = currentPlayer.tier_level || 1;
            this.currentTurn = this.gameData.current_turn || 1;
            this.currentPlayerTurn = this.gameData.current_player_turn;

            console.log('✅ Player data set:', {
                currentPlayerId: this.currentPlayerId,
                playerGold: this.playerGold,
                playerTier: this.playerTier,
                currentTurn: this.currentTurn,
                currentPlayerTurn: this.currentPlayerTurn
            });

            console.log('✅ Game data loaded successfully:', {
                gameStatus: this.gameData.status,
                playerCount: this.players.length,
                currentPlayerId: this.currentPlayerId,
                playerGold: this.playerGold,
                currentPlayer: currentPlayer.player_name
            });

            // ✅ STEP 5: Load map data
            console.log('📝 Step 5: Loading map data...');
            await this.loadMapData();
            
            // ✅ STEP 6: Load units
            console.log('📝 Step 6: Loading units data...');
            await this.loadUnitsData();
            
            // ✅ STEP 7: Load available units for purchase
            if (currentPlayer.race_id) {
                console.log('📝 Step 7: Loading available units for race:', currentPlayer.race_id);
                await this.units.loadAvailableUnits(currentPlayer.race_id);
            }

            // ✅ STEP 8: Update UI
            console.log('📝 Step 8: Updating game UI...');
            this.updateGameUI();
            
            console.log('✅ All game data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading game data:', error);
            console.error('❌ Error stack:', error.stack);
            
            // Show user-friendly error message
            if (error.message.includes('nicht in diesem Spiel')) {
                Utils.showError('Du bist nicht mehr in diesem Spiel. Weiterleitung zur Startseite...');
                setTimeout(() => {
                    window.location.href = '/';
                }, 3000);
            } else {
                Utils.showError('Fehler beim Laden der Spieldaten: ' + error.message);
            }
            
            throw error;
        }
    }

    // ✅ FIXED: Properly structured loadMapData method
    async loadMapData() {
        try {
            console.log(`🗺️ Loading map data for game ${this.gameId}...`);
            
            // ✅ CRITICAL: Add retry logic for map loading
            let mapData = null;
            let retries = 0;
            const maxRetries = 5;
            const retryDelay = 1000; // 1 second
            
            while (retries < maxRetries && (!mapData || mapData.length === 0)) {
                try {
                    mapData = await Utils.get(`/api/games/${this.gameId}/map`);
                    
                    if (mapData && mapData.length > 0) {
                        console.log(`✅ Map data loaded successfully: ${mapData.length} tiles`);
                        break;
                    } else {
                        console.log(`⚠️ Map data empty on attempt ${retries + 1}/${maxRetries}`);
                        retries++;
                        
                        if (retries < maxRetries) {
                            console.log(`⏳ Waiting ${retryDelay}ms before retry...`);
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                        }
                    }
                } catch (error) {
                    console.error(`❌ Map loading attempt ${retries + 1} failed:`, error);
                    retries++;
                    
                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
            
            if (mapData && mapData.length > 0) {
                console.log(`🎨 Loading map with ${mapData.length} tiles...`);
                
                // ✅ CRITICAL: Ensure map is properly initialized before loading
                if (!this.map) {
                    console.error('❌ Map component not initialized!');
                    throw new Error('Map component not available');
                }
                
                // ✅ CRITICAL: Wait for map to fully load
                await this.map.loadMap(mapData);
                console.log('✅ Map loaded and rendered successfully');
                
                // ✅ CRITICAL: Verify map was actually loaded
                if (this.map.mapData && this.map.mapData.length > 0) {
                    console.log('✅ Map data verification successful');
                    return mapData;
                } else {
                    throw new Error('Map failed to load properly');
                }
                
            } else {
                console.log('⚠️ No map data available after all retries - using placeholder');
                this.showMapPlaceholder();
                return [];
            }
            
        } catch (error) {
            console.error('❌ Critical error loading map:', error);
            
            // ✅ IMPROVED: Always show placeholder on error
            this.showMapPlaceholder();
            Utils.showError('Karte konnte nicht geladen werden. Platzhalter wird angezeigt.');
            return [];
        }
    }

    // ✅ FIXED: Properly structured loadUnitsData method
    async loadUnitsData() {
        try {
            console.log(`🔍 Loading units data for game ${this.gameId}...`);
            
            // ✅ Add retry logic for units as well
            let unitsData = null;
            let retries = 0;
            const maxRetries = 3;
            
            while (retries < maxRetries) {
                try {
                    unitsData = await Utils.get(`/api/games/${this.gameId}/units`);
                    console.log(`✅ Units data received:`, unitsData);
                    break;
                } catch (error) {
                    console.error(`❌ Units loading attempt ${retries + 1} failed:`, error);
                    retries++;
                    
                    if (retries < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
            
            if (!unitsData) {
                console.warn('⚠️ No units data received after retries');
                unitsData = [];
            }
            
            if (Array.isArray(unitsData)) {
                console.log(`📋 Processing ${unitsData.length} units...`);
                await this.units.loadUnits(unitsData);
                
                // ✅ CRITICAL: Update map with units after loading
                if (this.map && typeof this.map.updateUnits === 'function') {
                    this.map.updateUnits(unitsData);
                    console.log('✅ Map updated with units');
                }
                
                console.log(`✅ Loaded ${unitsData.length} units successfully`);
                return unitsData;
                
            } else {
                console.warn('⚠️ Units data is not an array:', unitsData);
                await this.units.loadUnits([]);
                return [];
            }
            
        } catch (error) {
            console.error('❌ Error loading units:', error);
            
            // ✅ IMPROVED: Don't fail on units error, just use empty array
            await this.units.loadUnits([]);
            Utils.showError('Einheiten konnten nicht geladen werden.');
            return [];
        }
    }

    // ✅ IMPROVED: Better placeholder map for development
    showMapPlaceholder() {
        try {
            console.log('🎨 Creating enhanced placeholder map...');
            
            const placeholderMap = [];
            const size = 25; // Slightly larger for better testing
            
            // ✅ Create more realistic terrain distribution
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    let terrainType = 1; // Default grass
                    
                    // Create terrain patterns for more natural look
                    if (y < 3 || y > size - 4) {
                        // Top and bottom borders - more mountains
                        terrainType = Math.random() < 0.3 ? 2 : 1;
                    } else if (x < 3 || x > size - 4) {
                        // Left and right borders - mix of terrains
                        terrainType = Math.random() < 0.2 ? 2 : 1;
                    } else {
                        // Center area - varied terrain
                        const rand = Math.random();
                        if (rand < 0.6) terrainType = 1;      // Grass
                        else if (rand < 0.7) terrainType = 5; // Forest
                        else if (rand < 0.8) terrainType = 4; // Water
                        else if (rand < 0.9) terrainType = 2; // Mountain
                        else terrainType = 3;                 // Swamp
                    }
                    
                    placeholderMap.push({
                        id: y * size + x + 1,
                        game_id: this.gameId,
                        x_pos: x,
                        y_pos: y,
                        terrain_type_id: terrainType,
                        building_type_id: null,
                        building_owner_id: null
                    });
                }
            }
            
            // Add some buildings for testing
            const playerBuildings = [
                { x: 5, y: 5, type: 1, owner: this.currentPlayerId },   // Village
                { x: 15, y: 15, type: 2, owner: this.currentPlayerId }, // Castle
                { x: 10, y: 20, type: 1, owner: null }                  // Neutral village
            ];
            
            playerBuildings.forEach(building => {
                const tile = placeholderMap.find(t => t.x_pos === building.x && t.y_pos === building.y);
                if (tile) {
                    tile.building_type_id = building.type;
                    tile.building_owner_id = building.owner;
                }
            });
            
            // Load placeholder map
            if (this.map) {
                this.map.loadMap(placeholderMap);
                console.log('✅ Placeholder map loaded successfully');
            }
            
            return placeholderMap;
            
        } catch (error) {
            console.error('❌ Error creating placeholder map:', error);
            return [];
        }
    }

    // Event Handlers
    handleGameStateUpdate(gameState) {
        if (gameState.gameData) {
            this.gameData = gameState.gameData;
            this.currentTurn = gameState.gameData.current_turn;
            this.currentPlayerTurn = gameState.gameData.current_player_turn;
        }
        
        if (gameState.players) {
            this.players = gameState.players;
            const currentPlayer = this.players.find(p => p.player_name === this.playerName);
            if (currentPlayer) {
                this.playerGold = currentPlayer.gold;
                this.playerTier = currentPlayer.tier_level;
            }
        }
        
        this.updateGameUI();
    }

    handleTurnUpdate(data) {
        this.currentTurn = data.currentTurn;
        this.currentPlayerTurn = data.currentPlayerTurn;
        
        // Give income if it's the player's turn
        if (this.isMyTurn() && data.newIncome) {
            this.playerGold += data.newIncome;
            Utils.showSuccess(`Neue Runde! Du erhältst ${data.newIncome} Gold.`);
        }
        
        this.updateGameUI();
    }

    handleUnitMoved(data) {
        // Update unit position
        const unit = this.units.units.find(u => u.id === data.unitId);
        if (unit) {
            unit.x_pos = data.newX;
            unit.y_pos = data.newY;
            unit.movement_left = data.movementLeft;
        }
        
        // Update map
        if (this.map) {
            this.map.updateUnits(this.units.units);
        }
        
        this.units.clearSelection();
    }

    handleUnitAttacked(data) {
        const { attackerId, defenderId, damage, defenderDestroyed } = data;
        
        // Update defender
        const defender = this.units.units.find(u => u.id === defenderId);
        if (defender) {
            if (defenderDestroyed) {
                // Remove from units array
                this.units.units = this.units.units.filter(u => u.id !== defenderId);
                Utils.showInfo(`Einheit zerstört!`);
            } else {
                defender.current_health -= damage;
                Utils.showInfo(`${damage} Schaden verursacht!`);
            }
        }
        
        // Update attacker movement
        const attacker = this.units.units.find(u => u.id === attackerId);
        if (attacker) {
            attacker.movement_left = 0; // Attacking ends turn for unit
        }
        
        // Update map
        if (this.map) {
            this.map.updateUnits(this.units.units);
        }
        
        this.units.clearSelection();
        this.closeModals();
    }

    handleUnitPurchased(data) {
        const { unit, newGold } = data;
        
        // Add unit to array
        this.units.units.push(unit);
        
        // Update player gold
        this.playerGold = newGold;
        
        // Update map
        if (this.map) {
            this.map.updateUnits(this.units.units);
        }
        
        this.updateGameUI();
        Utils.showSuccess(`Einheit gekauft: ${unit.name}`);
    }

    handleTierUpgraded(data) {
        const { newTier, newGold } = data;
        
        this.playerTier = newTier;
        this.playerGold = newGold;
        
        this.updateGameUI();
        this.closeModals();
        
        Utils.showSuccess(`Stufe ${newTier} erreicht! Neue Einheiten sind stärker.`);
    }

    handlePlayerEliminated(data) {
        const { playerName } = data;
        Utils.showInfo(`${playerName} wurde eliminiert!`);
        
        // Remove player from list or mark as eliminated
        const player = this.players.find(p => p.player_name === playerName);
        if (player) {
            player.eliminated = true;
        }
        
        this.updateGameUI();
    }

    handleGameWon(data) {
        const { winnerName } = data;
        
        if (winnerName === this.playerName) {
            Utils.showSuccess(`🎉 Glückwunsch! Du hast gewonnen!`);
        } else {
            Utils.showInfo(`${winnerName} hat das Spiel gewonnen.`);
        }
        
        // Disable game interactions
        this.isGameLoaded = false;
        
        // Show victory/defeat modal or redirect
        setTimeout(() => {
            if (confirm('Spiel beendet. Zurück zur Startseite?')) {
                window.location.href = '/';
            }
        }, 3000);
    }

    // Game Actions
    setAction(action) {
        this.selectedAction = action;
        this.units.clearSelection();
        
        // Update UI to show selected action
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(`${action}${action === 'move' ? '-unit' : ''}-btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        console.log(`Action set to: ${action}`);
    }

    async endTurn() {
        if (!this.isMyTurn()) {
            Utils.showError('Du bist nicht am Zug!');
            return;
        }
        
        try {
            const response = await this.emitWithAck('end-turn', {
                gameId: this.gameId,
                playerName: this.playerName
            });
            
            console.log('Turn ended successfully:', response);
            this.clearSelection();
            
        } catch (error) {
            console.error('Error ending turn:', error);
            Utils.showError('Fehler beim Beenden des Zuges: ' + error.message);
        }
    }

    // Map interaction
    onTileSelected(tile) {
        if (!tile || !this.isMyTurn()) return;
        
        const { x, y } = tile;
        
        switch (this.selectedAction) {
            case 'move':
                this.handleMoveAction(x, y);
                break;
            case 'attack':
                this.handleAttackAction(x, y);
                break;
            case 'buy':
                this.handleBuyAction(x, y);
                break;
            default:
                this.handleTileClick(x, y);
                break;
        }
    }

    handleTileClick(x, y) {
        // Try to select unit
        const unit = this.units.getUnitAt(x, y);
        if (unit && unit.player_id === this.currentPlayerId) {
            this.units.selectUnit(x, y);
            this.showTileInfo(x, y);
        } else {
            this.units.clearSelection();
            this.showTileInfo(x, y);
        }
    }

    handleMoveAction(x, y) {
        if (!this.units.selectedUnit) {
            // Select unit for movement
            this.units.selectUnit(x, y);
        } else {
            // Move unit to target
            this.moveUnit(this.units.selectedUnit.x_pos, this.units.selectedUnit.y_pos, x, y);
        }
    }

    handleAttackAction(x, y) {
        if (!this.units.selectedUnit) {
            // Select unit for attack
            this.units.selectUnit(x, y);
        } else {
            // Attack target
            this.attackUnit(this.units.selectedUnit, x, y);
        }
    }

    handleBuyAction(x, y) {
        // Show purchase modal for this tile
        this.showPurchaseModal(x, y);
    }

    async moveUnit(fromX, fromY, toX, toY) {
        if (!this.units.canMoveToTile(toX, toY)) {
            Utils.showError('Bewegung nicht möglich!');
            return;
        }
        
        try {
            const response = await this.emitWithAck('move-unit', {
                gameId: this.gameId,
                playerName: this.playerName,
                fromX,
                fromY,
                toX,
                toY
            });
            
            console.log('Unit moved successfully:', response);
            
        } catch (error) {
            console.error('Error moving unit:', error);
            Utils.showError('Fehler beim Bewegen der Einheit: ' + error.message);
        }
    }

    attackUnit(attacker, targetX, targetY) {
        const target = this.units.getUnitAt(targetX, targetY);
        
        if (!target) {
            Utils.showError('Kein Ziel zum Angreifen gefunden!');
            return;
        }
        
        if (target.player_id === this.currentPlayerId) {
            Utils.showError('Du kannst deine eigenen Einheiten nicht angreifen!');
            return;
        }
        
        if (!this.units.canAttackTile(targetX, targetY)) {
            Utils.showError('Ziel ist nicht in Reichweite!');
            return;
        }
        
        // Show attack confirmation modal
        this.showAttackModal(attacker, target);
    }

    // UI Updates
    updateGameUI() {
        this.updatePlayerInfo();
        this.updateTurnInfo();
        this.updateActionButtons();
    }

    updatePlayerInfo() {
        const goldElement = document.getElementById('player-gold');
        const tierElement = document.getElementById('player-tier');
        
        if (goldElement) goldElement.textContent = this.playerGold;
        if (tierElement) tierElement.textContent = this.playerTier;
    }

    updateTurnInfo() {
        const turnElement = document.getElementById('current-turn');
        const playerTurnElement = document.getElementById('current-player-turn');
        const turnStatusElement = document.getElementById('turn-status');
        
        if (turnElement) turnElement.textContent = this.currentTurn;
        if (playerTurnElement) {
            const currentPlayer = this.players.find(p => p.player_order === this.currentPlayerTurn);
            playerTurnElement.textContent = currentPlayer ? currentPlayer.player_name : 'Unbekannt';
        }
        
        if (turnStatusElement) {
            if (this.isMyTurn()) {
                turnStatusElement.textContent = 'Du bist am Zug!';
                turnStatusElement.className = 'turn-status my-turn';
            } else {
                const currentPlayer = this.players.find(p => p.player_order === this.currentPlayerTurn);
                turnStatusElement.textContent = `${currentPlayer?.player_name || 'Unbekannt'} ist am Zug`;
                turnStatusElement.className = 'turn-status not-my-turn';
            }
        }
    }

    updateActionButtons() {
        const isMyTurn = this.isMyTurn();
        
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.disabled = !isMyTurn;
        });
        
        // Update end turn button specifically
        const endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) {
            endTurnBtn.disabled = !isMyTurn;
            endTurnBtn.textContent = isMyTurn ? 'Zug beenden' : 'Warten...';
        }
    }

    showTileInfo(x, y) {
        const tile = this.map.getTileData(x, y);
        const unit = this.units.getUnitAt(x, y);
        
        const infoPanel = document.getElementById('tile-info');
        if (!infoPanel) return;
        
        let html = `<h4>Position: ${x}, ${y}</h4>`;
        
        if (tile) {
            html += `<p><strong>Terrain:</strong> ${this.getTerrainName(tile.terrain_type_id)}</p>`;
            
            if (tile.building_type_id) {
                html += `<p><strong>Gebäude:</strong> ${this.getBuildingName(tile.building_type_id)}</p>`;
                if (tile.building_owner_id) {
                    const owner = this.getPlayerName(tile.building_owner_id);
                    html += `<p><strong>Besitzer:</strong> ${owner}</p>`;
                }
            }
        }
        
        if (unit) {
            const owner = this.getPlayerName(unit.player_id);
            const healthPercent = Math.round((unit.current_health / unit.health_points) * 100);
            
            html += `<hr>`;
            html += `<p><strong>Einheit:</strong> ${unit.name}</p>`;
            html += `<p><strong>Besitzer:</strong> ${owner}</p>`;
            html += `<p><strong>Leben:</strong> ${unit.current_health}/${unit.health_points} (${healthPercent}%)</p>`;
            html += `<p><strong>Angriff:</strong> ${unit.attack_power}</p>`;
            html += `<p><strong>Bewegung:</strong> ${unit.movement_left}/${unit.movement_points}</p>`;
            html += `<p><strong>Reichweite:</strong> ${unit.range}</p>`;
        }
        
        infoPanel.innerHTML = html;
    }

    // Modals
    showPurchaseModal(x, y) {
        const tile = this.map.getTileData(x, y);
        
        if (!tile || !tile.building_type_id || tile.building_owner_id !== this.currentPlayerId) {
            Utils.showError('Du kannst nur in deinen eigenen Gebäuden Einheiten kaufen!');
            return;
        }
        
        if (this.units.getUnitAt(x, y)) {
            Utils.showError('Auf diesem Feld steht bereits eine Einheit!');
            return;
        }
        
        const modal = document.getElementById('purchase-modal');
        if (!modal) return;
        
        const unitsList = document.getElementById('available-units');
        if (!unitsList) return;
        
        // Clear previous content
        unitsList.innerHTML = '';
        
        // Get affordable units
        const affordableUnits = this.units.getAffordableUnits(this.playerGold, this.playerTier);
        
        if (affordableUnits.length === 0) {
            unitsList.innerHTML = '<p>Keine Einheiten verfügbar oder nicht genug Gold.</p>';
        } else {
            affordableUnits.forEach(unit => {
                const unitDiv = document.createElement('div');
                unitDiv.className = `unit-option ${unit.affordable ? 'affordable' : 'not-affordable'}`;
                
                unitDiv.innerHTML = `
                    <div class="unit-info">
                        <h4>${unit.name}</h4>
                        <p>Kosten: ${unit.cost} Gold</p>
                        <p>Leben: ${unit.enhancedHealth}</p>
                        <p>Angriff: ${unit.enhancedAttack}</p>
                        <p>Bewegung: ${unit.movement_points}</p>
                        <p>Reichweite: ${unit.enhancedRange}</p>
                    </div>
                    <button class="btn btn-primary" 
                            ${unit.affordable ? '' : 'disabled'}
                            onclick="gameController.purchaseUnit(${unit.id}, ${x}, ${y})">
                        Kaufen
                    </button>
                `;
                
                unitsList.appendChild(unitDiv);
            });
        }
        
        this.selectedBuilding = { x, y };
        modal.style.display = 'block';
    }

    showAttackModal(attacker, target) {
        const modal = document.getElementById('attack-modal');
        if (!modal) return;
        
        const attackerInfo = document.getElementById('attacker-info');
        const targetInfo = document.getElementById('target-info');
        const damagePreview = document.getElementById('damage-preview');
        
        if (attackerInfo) {
            attackerInfo.innerHTML = `
                <h4>Angreifer: ${attacker.name}</h4>
                <p>Leben: ${attacker.current_health}/${attacker.health_points}</p>
                <p>Angriff: ${attacker.attack_power}</p>
            `;
        }
        
        if (targetInfo) {
            targetInfo.innerHTML = `
                <h4>Ziel: ${target.name}</h4>
                <p>Leben: ${target.current_health}/${target.health_points}</p>
                <p>Besitzer: ${this.getPlayerName(target.player_id)}</p>
            `;
        }
        
        if (damagePreview) {
            const damage = this.units.calculateDamage(attacker, target);
            damagePreview.innerHTML = `
                <p><strong>Voraussichtlicher Schaden:</strong> ${damage.damage}</p>
                <p><strong>Verbleibendes Leben:</strong> ${damage.survivedHealth}</p>
                ${damage.willDestroy ? '<p class="warning">⚠️ Einheit wird zerstört!</p>' : ''}
            `;
        }
        
        // Store attack data for confirmation
        this.pendingAttack = { attacker, target };
        modal.style.display = 'block';
    }

    showUpgradeModal() {
        const modal = document.getElementById('upgrade-modal');
        if (!modal) return;
        
        const currentTierElement = document.getElementById('current-tier');
        const nextTierElement = document.getElementById('next-tier');
        const upgradeCostElement = document.getElementById('upgrade-cost');
        const upgradeBtn = document.getElementById('confirm-upgrade');
        
        if (this.playerTier >= 3) {
            if (currentTierElement) currentTierElement.textContent = this.playerTier;
            if (nextTierElement) nextTierElement.textContent = 'Maximale Stufe erreicht';
            if (upgradeCostElement) upgradeCostElement.textContent = '-';
            if (upgradeBtn) upgradeBtn.disabled = true;
        } else {
            const nextTier = this.playerTier + 1;
            const cost = this.getUpgradeCost(nextTier);
            const canAfford = this.playerGold >= cost;
            
            if (currentTierElement) currentTierElement.textContent = this.playerTier;
            if (nextTierElement) nextTierElement.textContent = nextTier;
            if (upgradeCostElement) upgradeCostElement.textContent = `${cost} Gold`;
            if (upgradeBtn) {
                upgradeBtn.disabled = !canAfford;
                upgradeBtn.textContent = canAfford ? 'Aufwerten' : 'Nicht genug Gold';
            }
        }
        
        modal.style.display = 'block';
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        
        this.selectedBuilding = null;
        this.pendingAttack = null;
    }

    // Modal Actions
    async purchaseUnit(unitId, x, y) {
        try {
            const response = await this.emitWithAck('purchase-unit', {
                gameId: this.gameId,
                playerName: this.playerName,
                unitId,
                x,
                y
            });
            
            console.log('Unit purchased successfully:', response);
            this.closeModals();
            
        } catch (error) {
            console.error('Error purchasing unit:', error);
            Utils.showError('Fehler beim Kauf der Einheit: ' + error.message);
        }
    }

    async confirmAttack() {
        if (!this.pendingAttack) return;
        
        const { attacker, target } = this.pendingAttack;
        
        try {
            const response = await this.emitWithAck('attack-unit', {
                gameId: this.gameId,
                playerName: this.playerName,
                attackerId: attacker.id,
                targetId: target.id
            });
            
            console.log('Attack completed successfully:', response);
            
        } catch (error) {
            console.error('Error attacking unit:', error);
            Utils.showError('Fehler beim Angriff: ' + error.message);
        }
    }

    async confirmUpgrade() {
        if (this.playerTier >= 3) {
            Utils.showError('Maximale Stufe bereits erreicht!');
            return;
        }
        
        const nextTier = this.playerTier + 1;
        const cost = this.getUpgradeCost(nextTier);
        
        if (this.playerGold < cost) {
            Utils.showError('Nicht genug Gold für das Upgrade!');
            return;
        }
        
        try {
            const response = await this.emitWithAck('upgrade-tier', {
                gameId: this.gameId,
                playerName: this.playerName,
                targetTier: nextTier
            });
            
            console.log('Tier upgraded successfully:', response);
            
        } catch (error) {
            console.error('Error upgrading tier:', error);
            Utils.showError('Fehler beim Aufwerten: ' + error.message);
        }
    }

    // Helper Methods
    isMyTurn() {
        const currentPlayer = this.players.find(p => p.player_order === this.currentPlayerTurn);
        return currentPlayer && currentPlayer.player_name === this.playerName;
    }

    getUpgradeCost(tier) {
        const costs = { 2: 500, 3: 1000 };
        return costs[tier] || 0;
    }

    clearSelection() {
        this.selectedAction = null;
        this.units.clearSelection();
        
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    getPlayerName(playerId) {
        const player = this.players.find(p => p.id === playerId);
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
        console.log('🧹 Starting game cleanup...');
        
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            console.log('✅ Removed beforeunload handler');
        }
        if (this.visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
            console.log('✅ Removed visibility handler');
        }
        
        if (this.map && typeof this.map.destroy === 'function') {
            this.map.destroy();
            console.log('✅ Destroyed map');
        }
        if (this.units && typeof this.units.destroy === 'function') {
            this.units.destroy();
            console.log('✅ Destroyed units manager');
        }
        if (this.chat && typeof this.chat.destroy === 'function') {
            this.chat.destroy();
            console.log('✅ Destroyed chat');
        }
        
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            console.log('✅ Disconnected socket');
        }
        
        // Remove global reference
        if (window.gameController === this) {
            delete window.gameController;
            console.log('✅ Removed global reference');
        }
        
        console.log('✅ Game cleanup completed');
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