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
        
        // Game components - ✅ CRITICAL: Initialize components properly
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
            return 'Unknown';
        }
        
        console.log('✅ Player name resolved:', playerName);
        return playerName;
    }

    async init() {
        try {
            console.log('🎮 Initializing game controller...');
            
            // ✅ CRITICAL: Initialize components in correct order
            await this.initializeComponents();
            
            // Set up socket events
            this.setupSocketEvents();
            
            // Load game data
            await this.loadGameData();
            
            // Join game room
            this.joinGameRoom();
            
            console.log('✅ Game controller initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing game:', error);
            Utils.showError('Fehler beim Laden des Spiels: ' + error.message);
        }
    }

    // ✅ CRITICAL: Initialize all components properly
    async initializeComponents() {
        try {
            console.log('🔧 Initializing game components...');
            
            // ✅ CRITICAL: Initialize map component first
            const canvas = document.getElementById('game-map');
            const overlay = document.getElementById('map-overlay');
            
            if (!canvas) {
                throw new Error('Game map canvas not found! Check if game.html has the correct canvas element.');
            }
            
            if (!overlay) {
                throw new Error('Map overlay element not found! Check if game.html has the correct overlay element.');
            }
            
            // Initialize map
            this.map = new GameMap('game-map', 'map-overlay');
            console.log('✅ Map component initialized');
            
            // Initialize units manager
            this.units = new GameUnits(this.socket, this.gameId, this.playerName);
            console.log('✅ Units component initialized');
            
            // Initialize chat
            this.chat = new GameChat(this.socket, this.gameId, this.playerName);
            console.log('✅ Chat component initialized');
            
            // Set up UI event handlers
            this.setupUIEvents();
            
            console.log('✅ All components initialized successfully');
            
        } catch (error) {
            console.error('❌ Error initializing components:', error);
            throw error;
        }
    }

    setupUIEvents() {
        // End turn button
        const endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => this.endTurn());
        }

        // Action buttons
        const buyUnitBtn = document.getElementById('buy-unit-btn');
        const moveUnitBtn = document.getElementById('move-unit-btn');
        const attackUnitBtn = document.getElementById('attack-unit-btn');
        const upgradeTierBtn = document.getElementById('upgrade-tier-btn');

        if (buyUnitBtn) buyUnitBtn.addEventListener('click', () => this.showUnitPurchase());
        if (moveUnitBtn) moveUnitBtn.addEventListener('click', () => this.toggleMoveMode());
        if (attackUnitBtn) attackUnitBtn.addEventListener('click', () => this.toggleAttackMode());
        if (upgradeTierBtn) upgradeTierBtn.addEventListener('click', () => this.upgradeTier());

        // Modal confirmation buttons
        const confirmMovement = document.getElementById('confirm-movement');
        const confirmAttack = document.getElementById('confirm-attack');

        if (confirmMovement) confirmMovement.addEventListener('click', () => this.confirmMovement());
        if (confirmAttack) confirmAttack.addEventListener('click', () => this.confirmAttack());
    }

    setupSocketEvents() {
        // ✅ CRITICAL: Handle disconnections properly
        this.socket.on('disconnect', (reason) => {
            console.warn('🔌 Socket disconnected:', reason);
            if (!this.isNavigating) {
                Utils.showError('Verbindung zum Server verloren. Versuche neu zu verbinden...');
            }
        });

        this.socket.on('connect', () => {
            console.log('🔌 Socket connected');
            if (this.gameId && this.playerName && !this.isNavigating) {
                this.joinGameRoom();
            }
        });

        // Game state updates
        this.socket.on('game-state-update', (gameState) => {
            console.log('📡 Game state update received');
            this.handleGameStateUpdate(gameState);
        });

        // Map updates
        this.socket.on('map-ready', async (data) => {
            console.log('🗺️ Map ready event received');
            await this.loadMapData();
        });

        // Unit updates
        this.socket.on('units-update', (data) => {
            console.log('🛡️ Units update received');
            if (this.units) {
                this.units.updateUnits(data.units);
            }
        });

        // Turn updates
        this.socket.on('turn-update', (data) => {
            console.log('🔄 Turn update received');
            this.handleTurnUpdate(data);
        });

        // Chat messages - ✅ CRITICAL FIX for chat sync
        this.socket.on('chat-message', (message) => {
            console.log('💬 Chat message received:', message);
            if (this.chat) {
                this.chat.handleIncomingMessage(message);
            }
        });

        // Error handling
        this.socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
            Utils.showError(error.message || 'Ein Fehler ist aufgetreten');
        });
    }

    async loadGameData() {
        try {
            console.log(`🎲 Loading game data for game ${this.gameId}...`);
            
            const gameState = await Utils.get(`/api/games/${this.gameId}/state`);
            
            if (!gameState || !gameState.game) {
                throw new Error('Game not found');
            }

            this.gameData = gameState.game;
            this.players = gameState.players || [];
            this.currentPlayerTurn = gameState.game.current_player_turn || 1;
            this.currentTurn = gameState.game.turn_number || 1;

            // Find current player
            const currentPlayer = this.players.find(p => p.player_name === this.playerName);
            if (currentPlayer) {
                this.currentPlayerId = currentPlayer.id;
                this.playerGold = currentPlayer.gold || 0;
                this.playerTier = currentPlayer.tier || 1;
            }

            console.log('✅ Game data loaded successfully');
            
            // Load map data
            await this.loadMapData();
            
            // Load chat history
            if (this.chat) {
                await this.chat.loadChatHistory();
            }
            
            // Update UI
            this.updateGameUI();
            
            this.isGameLoaded = true;
            
        } catch (error) {
            console.error('❌ Error loading game data:', error);
            
            if (error.message === 'Game not found') {
                Utils.showError('Spiel nicht gefunden. Weiterleitung zur Startseite...');
                setTimeout(() => {
                    window.location.href = '/';
                }, 3000);
            } else {
                Utils.showError('Fehler beim Laden der Spieldaten: ' + error.message);
            }
            
            throw error;
        }
    }

    // ✅ CRITICAL FIX: Improved map loading with better error handling
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

    // ✅ IMPROVED: Better placeholder map generation
    showMapPlaceholder() {
        try {
            console.log('🎨 Creating placeholder map...');
            
            // Create a simple test map
            const placeholderMap = [];
            const size = 20; // 20x20 placeholder map
            
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    // Create varied terrain
                    let terrainType = 1; // Default grass
                    if (Math.random() < 0.1) terrainType = 2; // Mountain
                    if (Math.random() < 0.05) terrainType = 4; // Water
                    if (Math.random() < 0.15) terrainType = 5; // Forest
                    
                    // Add some buildings randomly
                    let buildingType = null;
                    if (Math.random() < 0.03) buildingType = 1; // Village
                    if (Math.random() < 0.01) buildingType = 2; // Castle
                    
                    placeholderMap.push({
                        x_pos: x,
                        y_pos: y,
                        terrain_type: terrainType,
                        building_type: buildingType,
                        owner_id: buildingType ? Math.floor(Math.random() * 4) + 1 : null,
                        terrain_name: this.getTerrainName(terrainType),
                        building_name: buildingType ? this.getBuildingName(buildingType) : null
                    });
                }
            }
            
            console.log(`🎨 Generated placeholder map with ${placeholderMap.length} tiles`);
            
            // ✅ CRITICAL: Ensure map component exists before loading
            if (!this.map) {
                console.error('❌ Map component not available for placeholder');
                return;
            }
            
            // ✅ CRITICAL: Load placeholder map with current units
            this.map.loadMap(placeholderMap, this.units ? this.units.units : []).then(() => {
                console.log('✅ Placeholder map loaded successfully');
                Utils.showInfo('Development-Karte geladen (Echte Karte wird im Hintergrund generiert)');
            }).catch(error => {
                console.error('❌ Error loading placeholder map:', error);
                Utils.showError('Fehler beim Laden der Platzhalter-Karte');
            });
            
        } catch (error) {
            console.error('❌ Error creating placeholder map:', error);
            Utils.showError('Fehler beim Erstellen der Platzhalter-Karte');
        }
    }

    getTerrainName(terrainType) {
        const names = {
            1: 'Gras',
            2: 'Berg',
            3: 'Sumpf',
            4: 'Wasser',
            5: 'Wald',
            6: 'Wüste',
            7: 'Schnee'
        };
        return names[terrainType] || 'Unbekannt';
    }

    getBuildingName(buildingType) {
        const names = {
            1: 'Dorf',
            2: 'Burg'
        };
        return names[buildingType] || 'Unbekannt';
    }

    joinGameRoom() {
        if (this.socket.connected) {
            console.log('🏠 Joining game room...');
            this.socket.emit('join-game', {
                gameId: this.gameId,
                playerName: this.playerName
            });
        } else {
            console.warn('⚠️ Socket not connected, cannot join room');
        }
    }

    // UI Updates
    updateGameUI() {
        try {
            console.log('🎨 Updating game UI...');
            this.updateGameHeader();
            this.updatePlayersList();
            this.updateActionButtons();
            console.log('✅ Game UI updated successfully');
        } catch (error) {
            console.error('❌ Error updating game UI:', error);
        }
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
                const gold = currentPlayer.id === this.currentPlayerId ? 
                    this.playerGold : '???';
                currentPlayerGoldEl.textContent = `💰 ${gold}`;
            }
            
            if (currentPlayerAvatar) {
                currentPlayerAvatar.textContent = currentPlayer.player_name.charAt(0).toUpperCase();
                currentPlayerAvatar.style.backgroundColor = this.getPlayerColor(currentPlayer.id);
            }
        }
    }

    updatePlayersList() {
        const playersListEl = document.getElementById('players-list');
        if (!playersListEl) return;

        Utils.clearElement(playersListEl);

        this.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            if (player.turn_order === this.currentPlayerTurn) {
                playerItem.classList.add('current-turn');
            }
            
            if (player.is_eliminated) {
                playerItem.classList.add('eliminated');
            }

            playerItem.innerHTML = `
                <div class="player-name-display">${player.player_name}</div>
                <div class="player-status">
                    ${player.turn_order === this.currentPlayerTurn ? '🎯 Am Zug' : '⏳ Wartet'}
                    ${player.is_eliminated ? '💀 Ausgeschieden' : ''}
                </div>
            `;

            playersListEl.appendChild(playerItem);
        });
    }

    updateActionButtons() {
        const isMyTurn = this.isCurrentPlayerTurn();
        
        const endTurnBtn = document.getElementById('end-turn-btn');
        const buyUnitBtn = document.getElementById('buy-unit-btn');
        const moveUnitBtn = document.getElementById('move-unit-btn');
        const attackUnitBtn = document.getElementById('attack-unit-btn');
        const upgradeTierBtn = document.getElementById('upgrade-tier-btn');

        if (endTurnBtn) endTurnBtn.disabled = !isMyTurn;
        if (buyUnitBtn) buyUnitBtn.disabled = !isMyTurn;
        if (moveUnitBtn) moveUnitBtn.disabled = !isMyTurn;
        if (attackUnitBtn) attackUnitBtn.disabled = !isMyTurn;
        if (upgradeTierBtn) upgradeTierBtn.disabled = !isMyTurn;
    }

    // Game State Handlers
    handleGameStateUpdate(gameState) {
        console.log('🔄 Handling game state update...');
        
        this.gameData = gameState.game;
        this.players = gameState.players || [];
        this.currentPlayerTurn = gameState.game.current_player_turn;
        this.currentTurn = gameState.game.turn_number;

        // Update current player data
        const currentPlayer = this.players.find(p => p.player_name === this.playerName);
        if (currentPlayer) {
            this.playerGold = currentPlayer.gold || 0;
            this.playerTier = currentPlayer.tier || 1;
        }

        this.updateGameUI();
    }

    handleTurnUpdate(data) {
        console.log('🔄 Handling turn update...', data);
        
        this.currentPlayerTurn = data.currentPlayerTurn;
        this.currentTurn = data.turnNumber;
        
        if (data.newGold !== undefined) {
            this.playerGold = data.newGold;
        }

        this.updateGameUI();

        // Show turn notification
        if (this.isCurrentPlayerTurn()) {
            Utils.showSuccess('Du bist dran!');
        }
    }

    // Game Actions
    async endTurn() {
        if (!this.isCurrentPlayerTurn()) {
            Utils.showWarning('Du bist nicht am Zug!');
            return;
        }

        try {
            const response = await Utils.post(`/api/games/${this.gameId}/end-turn`, {
                playerName: this.playerName
            });

            if (response.success) {
                Utils.showSuccess('Zug beendet');
            }
        } catch (error) {
            console.error('❌ Error ending turn:', error);
            Utils.showError('Fehler beim Beenden des Zugs');
        }
    }

    showUnitPurchase() {
        if (!this.isCurrentPlayerTurn()) {
            Utils.showWarning('Du bist nicht am Zug!');
            return;
        }

        // TODO: Implement unit purchase modal
        Utils.showModal('unit-purchase-modal');
    }

    toggleMoveMode() {
        if (!this.isCurrentPlayerTurn()) {
            Utils.showWarning('Du bist nicht am Zug!');
            return;
        }

        // TODO: Implement move mode
        console.log('Move mode toggled');
    }

    toggleAttackMode() {
        if (!this.isCurrentPlayerTurn()) {
            Utils.showWarning('Du bist nicht am Zug!');
            return;
        }

        // TODO: Implement attack mode
        console.log('Attack mode toggled');
    }

    async upgradeTier() {
        if (!this.isCurrentPlayerTurn()) {
            Utils.showWarning('Du bist nicht am Zug!');
            return;
        }

        try {
            const response = await Utils.post(`/api/games/${this.gameId}/upgrade-tier`, {
                playerName: this.playerName
            });

            if (response.success) {
                this.playerTier = response.newTier;
                this.playerGold = response.newGold;
                Utils.showSuccess(`Aufstieg zu Stufe ${this.playerTier}!`);
                this.updateGameUI();
            }
        } catch (error) {
            console.error('❌ Error upgrading tier:', error);
            Utils.showError('Fehler beim Stufenaufstieg: ' + error.message);
        }
    }

    confirmMovement() {
        // TODO: Implement movement confirmation
        Utils.hideModal('movement-modal');
    }

    confirmAttack() {
        // TODO: Implement attack confirmation
        Utils.hideModal('attack-modal');
    }

    // Helper Methods
    isCurrentPlayerTurn() {
        const currentPlayer = this.players.find(p => p.player_name === this.playerName);
        return currentPlayer && currentPlayer.turn_order === this.currentPlayerTurn;
    }

    getCurrentTurnPlayer() {
        return this.players.find(p => p.turn_order === this.currentPlayerTurn);
    }

    getPlayerColor(playerId) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FFB74D'];
        return colors[(playerId - 1) % colors.length] || '#999';
    }
}

// ✅ CRITICAL: Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 DOM loaded, initializing game...');
    
    // Check if we have the required elements
    const canvas = document.getElementById('game-map');
    if (!canvas) {
        console.error('❌ Game canvas not found in DOM!');
        Utils.showError('Spielkarte konnte nicht geladen werden. Seite wird neu geladen...');
        setTimeout(() => {
            window.location.reload();
        }, 3000);
        return;
    }
    
    try {
        window.gameController = new GameController();
        console.log('✅ Game controller created successfully');
    } catch (error) {
        console.error('❌ Error creating game controller:', error);
        Utils.showError('Fehler beim Initialisieren des Spiels: ' + error.message);
    }
});