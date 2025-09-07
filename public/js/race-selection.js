// Race Selection page functionality - NAVIGATION FIXED VERSION
class RaceSelection {
    constructor() {
        this.socket = io({
            closeOnBeforeunload: false,
            forceNew: true // ✅ CRITICAL: Force new connection to prevent issues
        });
        this.gameId = Utils.getGameId();
        
        // ✅ FIX: Improved player name detection
        this.playerName = this.getPlayerName();
        
        this.gameData = null;
        this.availableRaces = [];
        this.selectedRace = null;
        this.selectedRaceData = null;
        this.hasConfirmed = false;
        this.currentTier = 1;
        this.currentUnits = [];
        
        // ✅ CRITICAL: Navigation state management
        this.isNavigating = false;
        this.isMapGenerating = false;
        this.hasReceivedMapComplete = false;
        this.navigationInProgress = false; // ✅ NEW: Prevent duplicate navigation
        
        this.init();
    }

    getPlayerName() {
        let playerName = Utils.getUrlParameter('player');
        if (!playerName) {
            playerName = Utils.getFromStorage('playerName');
        }
        if (!playerName) {
            const transition = Utils.getUrlParameter('transition');
            if (transition === 'start') {
                playerName = Utils.getFromStorage('playerName');
            }
        }
        return playerName;
    }

    init() {
        if (!this.gameId || !this.playerName) {
            Utils.showError('Fehlende Spiel- oder Spielerinformationen');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }

        console.log(`🎯 Initializing race selection for game ${this.gameId}, player ${this.playerName}`);
        
        this.bindEvents();
        this.setupConnectionHandling();
        
        if (this.socket.connected) {
            this.startLoadSequence();
        } else {
            this.socket.on('connect', () => {
                console.log('✅ Socket connected, starting load sequence');
                this.startLoadSequence();
            });
        }
    }

    setupConnectionHandling() {
        this.socket.on('connect', () => {
            console.log('🔌 Socket connected in race selection');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            if (reason !== 'io client disconnect' && !this.isNavigating && !this.isMapGenerating) {
                Utils.showError('Verbindung verloren. Versuche zu reconnectieren...');
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
            if (!this.isNavigating) {
                Utils.showError('Verbindungsfehler. Bitte Seite neu laden.');
            }
        });
    }

    async startLoadSequence() {
        try {
            console.log('📝 Step 1: Verifying game access...');
            await this.verifyGameAccess();
            
            console.log('🏠 Step 2: Joining game room...');
            this.joinGameRoom();
            
            console.log('🛡️ Step 3: Loading races...');
            await this.loadRaces();
            
            console.log('💬 Step 4: Loading chat...');
            await this.loadChatHistory();
            
            console.log('✅ Race selection fully initialized');
            
        } catch (error) {
            console.error('❌ Error in load sequence:', error);
            Utils.showError('Fehler beim Laden der Rassenauswahl: ' + error.message);
            
            setTimeout(() => {
                this.isNavigating = true;
                window.location.href = `/lobby/${this.gameId}?player=${encodeURIComponent(this.playerName)}`;
            }, 3000);
        }
    }

    async verifyGameAccess() {
        try {
            const data = await Utils.get(`/api/games/${this.gameId}`);
            
            if (!data || !data.game) {
                throw new Error('Spiel nicht gefunden');
            }

            if (data.game.status !== 'race_selection' && data.game.status !== 'lobby') {
                throw new Error(`Spiel ist in falscher Phase: ${data.game.status}`);
            }

            const currentPlayer = data.players.find(p => p.player_name === this.playerName);
            if (!currentPlayer) {
                throw new Error('Du bist nicht in diesem Spiel');
            }

            this.gameData = data;
            this.updateGameInfo();
            
            if (currentPlayer.race_confirmed) {
                this.hasConfirmed = true;
                this.selectedRace = currentPlayer.race_id;
                this.showWaitingForConfirmation();
            }
            
            console.log('✅ Game access verified successfully');
            
        } catch (error) {
            console.error('❌ Game access verification failed:', error);
            throw error;
        }
    }

    bindEvents() {
        // Socket events
        this.socket.on('game-state-update', (gameState) => {
            this.handleGameStateUpdate(gameState);
        });

        this.socket.on('race-selected', (data) => {
            console.log('Race selected confirmation:', data);
        });

        this.socket.on('race-confirmation-update', (data) => {
            this.handleRaceConfirmationUpdate(data);
        });

        this.socket.on('map-generation-start', () => {
            console.log('🗺️ Map generation started');
            this.isMapGenerating = true;
            this.showMapGenerationOverlay();
        });

        // ✅ CRITICAL FIX: Better map generation complete handling
        this.socket.on('map-generation-complete', (data) => {
            if (!this.hasReceivedMapComplete && !this.navigationInProgress) {
                this.hasReceivedMapComplete = true;
                this.navigationInProgress = true;
                this.handleMapGenerationComplete(data);
            } else {
                console.log('🚨 Duplicate map-generation-complete event ignored');
            }
        });

        this.socket.on('map-generation-failed', (data) => {
            console.error('❌ Map generation failed:', data);
            this.isMapGenerating = false;
            this.hasReceivedMapComplete = false;
            this.navigationInProgress = false;
            Utils.showError('Kartengenerierung fehlgeschlagen: ' + data.error);
            this.hideMapGenerationOverlay();
        });

        this.socket.on('chat-message', (message) => {
            this.addChatMessage(message);
        });

        this.socket.on('error', (error) => {
            Utils.showError(error.message);
        });

        // UI events
        const confirmRaceBtn = document.getElementById('confirm-race-btn');
        if (confirmRaceBtn) {
            confirmRaceBtn.addEventListener('click', () => this.confirmRace());
        }

        const showUnitsBtn = document.getElementById('show-units-btn');
        if (showUnitsBtn) {
            showUnitsBtn.addEventListener('click', () => this.showUnitsModal());
        }

        const backToLobby = document.getElementById('back-to-lobby');
        if (backToLobby) {
            backToLobby.addEventListener('click', () => this.backToLobby());
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tier-tab')) {
                this.switchTier(parseInt(e.target.dataset.tier));
            }
        });

        // Chat events
        const chatInput = document.getElementById('chat-input');
        const sendChat = document.getElementById('send-chat');
        
        if (chatInput && sendChat) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });

            sendChat.addEventListener('click', () => this.sendChatMessage());
        }
        
        // ✅ CRITICAL FIX: Only add event listeners if not navigating
        this.beforeUnloadHandler = (e) => {
            console.log('🚨 beforeunload event triggered', {
                isNavigating: this.isNavigating,
                isMapGenerating: this.isMapGenerating,
                navigationInProgress: this.navigationInProgress
            });
            
            // ✅ CRITICAL: Don't emit leave-game during navigation or map generation
            if (!this.isNavigating && !this.isMapGenerating && !this.navigationInProgress) {
                console.log('🚨 Emitting leave-game due to page unload');
                try {
                    this.socket.emit('leave-game', {
                        gameId: this.gameId,
                        playerName: this.playerName
                    });
                } catch (error) {
                    console.error('Error emitting leave-game:', error);
                }
            } else {
                console.log('✅ Allowing navigation - intentional navigation in progress');
            }
        };
        
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        
        this.visibilityChangeHandler = () => {
            if (document.visibilityState === 'hidden' && 
                !this.isNavigating && 
                !this.isMapGenerating && 
                !this.navigationInProgress) {
                console.log('🚨 Page hidden - emitting leave-game');
                try {
                    this.socket.emit('leave-game', {
                        gameId: this.gameId,
                        playerName: this.playerName
                    });
                } catch (error) {
                    console.error('Error emitting leave-game on visibility change:', error);
                }
            }
        };
        
        document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    joinGameRoom() {
        if (this.socket.connected) {
            this.socket.emit('join-game', {
                gameId: this.gameId,
                playerName: this.playerName
            });
        }
    }

    async loadRaces() {
        try {
            const races = await Utils.get(`/api/games/${this.gameId}/races`);
            this.availableRaces = races;
            this.renderRacesGrid();
        } catch (error) {
            Utils.showError('Fehler beim Laden der Rassen');
            console.error('Error loading races:', error);
        }
    }

    async loadChatHistory() {
        try {
            const messages = await Utils.get(`/api/games/${this.gameId}/chat`);
            const chatMessages = document.getElementById('chat-messages');
            
            if (chatMessages) {
                Utils.clearElement(chatMessages);
                messages.forEach(message => {
                    this.addChatMessage({
                        playerName: message.player_name,
                        message: message.message,
                        timestamp: message.created_at
                    }, false);
                });
                
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    renderRacesGrid() {
        const racesGrid = document.getElementById('races-grid');
        if (!racesGrid || this.hasConfirmed) return;

        Utils.clearElement(racesGrid);

        this.availableRaces.forEach(race => {
            const raceCard = this.createRaceCard(race);
            racesGrid.appendChild(raceCard);
        });
    }

    createRaceCard(race) {
        const raceDiv = Utils.createElement('div', 'race-card');
        raceDiv.setAttribute('data-race-id', race.id);

        if (this.selectedRace === race.id) {
            raceDiv.classList.add('selected');
        }

        const imageUrl = race.image_filename ? `/images/races/${race.image_filename}` : '/images/races/default.png';

        raceDiv.innerHTML = `
            <div class="race-image-container">
                <img src="${imageUrl}" alt="${Utils.escapeHtml(race.name)}" class="race-image" 
                     onerror="this.src='/images/races/default.png'">
            </div>
            <div class="race-info">
                <h3>${Utils.escapeHtml(race.name)}</h3>
                <p>${Utils.escapeHtml(race.description || 'Keine Beschreibung verfügbar')}</p>
                <div class="race-stats">
                    <div class="race-stat">
                        <div class="stat-label">Stufe 2</div>
                        <div class="stat-value">${race.tier_2_cost || 500}🪙</div>
                    </div>
                    <div class="race-stat">
                        <div class="stat-label">Stufe 3</div>
                        <div class="stat-value">${race.tier_3_cost || 1000}🪙</div>
                    </div>
                </div>
            </div>
        `;

        raceDiv.addEventListener('click', () => this.selectRace(race));

        return raceDiv;
    }

    selectRace(race) {
        if (this.hasConfirmed) return;

        document.querySelectorAll('.race-card').forEach(card => {
            card.classList.remove('selected');
        });

        const raceCard = document.querySelector(`[data-race-id="${race.id}"]`);
        if (raceCard) {
            raceCard.classList.add('selected');
        }

        this.selectedRace = race.id;
        this.selectedRaceData = race;

        this.socket.emit('select-race', {
            gameId: this.gameId,
            playerName: this.playerName,
            raceId: race.id
        });

        this.showSelectedRace(race);
    }

    showSelectedRace(race) {
        const selectedDisplay = document.getElementById('selected-race-display');
        const racesGrid = document.getElementById('races-grid');
        
        if (selectedDisplay && racesGrid) {
            selectedDisplay.classList.remove('hidden');
            
            const raceImage = document.getElementById('selected-race-image');
            const raceName = document.getElementById('selected-race-name');
            const raceDescription = document.getElementById('selected-race-description');
            const tier2Cost = document.getElementById('selected-race-tier2');
            const tier3Cost = document.getElementById('selected-race-tier3');

            const imageUrl = race.image_filename ? `/images/races/${race.image_filename}` : '/images/races/default.png';
            
            if (raceImage) {
                raceImage.src = imageUrl;
                raceImage.alt = race.name;
                raceImage.onerror = () => raceImage.src = '/images/races/default.png';
            }
            if (raceName) raceName.textContent = race.name;
            if (raceDescription) raceDescription.textContent = race.description || 'Keine Beschreibung verfügbar';
            if (tier2Cost) tier2Cost.textContent = `${race.tier_2_cost || 500} Gold`;
            if (tier3Cost) tier3Cost.textContent = `${race.tier_3_cost || 1000} Gold`;

            racesGrid.style.maxHeight = '300px';
            racesGrid.style.overflowY = 'auto';
        }
    }

    async showUnitsModal() {
        if (!this.selectedRaceData) {
            Utils.showError('Keine Rasse ausgewählt');
            return;
        }

        try {
            const units = await Utils.get(`/api/games/${this.gameId}/races/${this.selectedRace}/units`);
            this.currentUnits = units;
            
            const modalTitle = document.getElementById('units-modal-title');
            if (modalTitle) {
                modalTitle.textContent = `Einheiten von ${this.selectedRaceData.name}`;
            }

            this.currentTier = 1;
            this.updateTierTabs();
            this.renderUnitsGrid();

            Utils.showModal('units-modal');
        } catch (error) {
            Utils.showError('Fehler beim Laden der Einheiten');
            console.error('Error loading units:', error);
        }
    }

    switchTier(tier) {
        this.currentTier = tier;
        this.updateTierTabs();
        this.renderUnitsGrid();
    }

    updateTierTabs() {
        document.querySelectorAll('.tier-tab').forEach(tab => {
            tab.classList.remove('active');
            if (parseInt(tab.dataset.tier) === this.currentTier) {
                tab.classList.add('active');
            }
        });
    }

    renderUnitsGrid() {
        const unitsGrid = document.getElementById('units-grid');
        if (!unitsGrid || !this.currentUnits) return;

        Utils.clearElement(unitsGrid);

        const tierBonus = this.currentTier === 1 ? 0 : (this.currentTier === 2 ? 0.2 : 0.4);
        const tierMultiplier = 1 + tierBonus;

        this.currentUnits.forEach(unit => {
            const unitCard = this.createUnitCard(unit, tierMultiplier);
            unitsGrid.appendChild(unitCard);
        });
    }

    createUnitCard(unit, tierMultiplier) {
        const unitDiv = Utils.createElement('div', 'unit-card');

        const imageUrl = unit.image_filename ? `/images/units/${unit.image_filename}` : '/images/units/default.png';
        
        const enhancedHealth = Math.round(unit.health_points * tierMultiplier);
        const enhancedAttack = Math.round(unit.attack_power * tierMultiplier);
        const enhancedRange = Math.max(1, Math.round(unit.range * tierMultiplier));

        unitDiv.innerHTML = `
            <div class="unit-image-container">
                <img src="${imageUrl}" alt="${Utils.escapeHtml(unit.name)}" class="unit-image"
                     onerror="this.src='/images/units/default.png'">
            </div>
            <div class="unit-name">${Utils.escapeHtml(unit.name)}</div>
            <div class="unit-stats">
                <div class="unit-stat ${tierMultiplier > 1 ? 'highlight' : ''}">
                    <span><span class="stat-icon">❤️</span>Leben:</span>
                    <span>${enhancedHealth}</span>
                </div>
                <div class="unit-stat ${tierMultiplier > 1 ? 'highlight' : ''}">
                    <span><span class="stat-icon">⚔️</span>Angriff:</span>
                    <span>${enhancedAttack}</span>
                </div>
                <div class="unit-stat">
                    <span><span class="stat-icon">🏃</span>Bewegung:</span>
                    <span>${unit.movement_points}</span>
                </div>
                <div class="unit-stat ${tierMultiplier > 1 ? 'highlight' : ''}">
                    <span><span class="stat-icon">🎯</span>Reichweite:</span>
                    <span>${enhancedRange}</span>
                </div>
                <div class="unit-stat">
                    <span><span class="stat-icon">🪙</span>Kosten:</span>
                    <span>${unit.cost}</span>
                </div>
                <div class="unit-stat">
                    <span><span class="stat-icon">${unit.can_fly ? '🦅' : '🚶'}</span>Typ:</span>
                    <span>${unit.can_fly ? 'Fliegend' : 'Boden'}</span>
                </div>
            </div>
        `;

        return unitDiv;
    }

    confirmRace() {
        if (!this.selectedRace || this.hasConfirmed) return;

        this.socket.emit('confirm-race', {
            gameId: this.gameId,
            playerName: this.playerName
        });

        this.hasConfirmed = true;
        this.showWaitingForConfirmation();
    }

    showWaitingForConfirmation() {
        const selectedDisplay = document.getElementById('selected-race-display');
        const racesGrid = document.getElementById('races-grid');
        const waitingConfirmation = document.getElementById('waiting-confirmation');

        if (selectedDisplay) selectedDisplay.classList.add('hidden');
        if (racesGrid) racesGrid.classList.add('hidden');
        if (waitingConfirmation) waitingConfirmation.classList.remove('hidden');

        this.updateConfirmationProgress();
    }

    handleGameStateUpdate(gameState) {
        if (!gameState || !gameState.players) return;

        this.gameData = gameState;
        this.updateGameInfo();
        this.updateConfirmationProgress();
    }

    handleRaceConfirmationUpdate(data) {
        console.log('Race confirmation update:', data);
        this.updateConfirmationProgress(data.confirmedCount, data.totalPlayers);
    }

    updateConfirmationProgress(confirmedCount = null, totalPlayers = null) {
        if (confirmedCount === null && this.gameData) {
            confirmedCount = this.gameData.players.filter(p => p.race_confirmed).length;
            totalPlayers = this.gameData.players.length;
        }

        const confirmedCountEl = document.getElementById('confirmed-count');
        const totalPlayersEl = document.getElementById('total-players');
        if (confirmedCountEl) confirmedCountEl.textContent = confirmedCount || 0;
        if (totalPlayersEl) totalPlayersEl.textContent = totalPlayers || 0;

        const confirmationProgress = document.getElementById('confirmation-progress');
        const confirmationText = document.getElementById('confirmation-text');
        
        if (confirmationProgress && totalPlayers > 0) {
            const percentage = (confirmedCount / totalPlayers) * 100;
            confirmationProgress.style.width = `${percentage}%`;
        }
        
        if (confirmationText) {
            confirmationText.textContent = `${confirmedCount || 0} von ${totalPlayers || 0} bestätigt`;
        }
    }

    showMapGenerationOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('show');
            
            const loadingText = document.getElementById('loading-text');
            if (loadingText) {
                loadingText.textContent = 'Karte wird generiert...';
            }
            
            const progressText = document.getElementById('progress-text');
            if (progressText) {
                progressText.textContent = 'Dies kann einen Moment dauern...';
            }
        }
    }

    hideMapGenerationOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    // ✅ CRITICAL FIX: Completely rewritten map generation complete handling
    handleMapGenerationComplete(data) {
        console.log('🗺️ Map generation complete event received for navigation:', data);
        
        // ✅ CRITICAL: Immediate state changes
        this.isMapGenerating = false;
        this.isNavigating = true;
        
        console.log('🔌 Starting IMMEDIATE cleanup for navigation...');
        
        // ✅ CRITICAL: Remove event listeners IMMEDIATELY to prevent any leave-game events
        this.cleanup();
        
        // Update UI
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const loadingText = document.getElementById('loading-text');
            if (loadingText) {
                loadingText.textContent = 'Weiterleitung zum Spiel...';
            }
            
            const progressText = document.getElementById('progress-text');
            if (progressText) {
                progressText.textContent = 'Das Spiel wird geladen...';
            }
        }
        
        Utils.showSuccess('Karte generiert! Weiterleitung zum Spiel...');
        
        // ✅ CRITICAL: Prepare redirect URL
        let redirectUrl = data.redirectUrl || `/game/${this.gameId}`;
        
        if (this.playerName) {
            const separator = redirectUrl.includes('?') ? '&' : '?';
            redirectUrl = `${redirectUrl}${separator}player=${encodeURIComponent(this.playerName)}`;
        }
        
        console.log('🚀 Final redirect URL prepared:', redirectUrl);
        
        // ✅ CRITICAL: Navigate IMMEDIATELY - no delay
        console.log('🎮 Executing IMMEDIATE navigation...');
        window.location.href = redirectUrl;
    }

    backToLobby() {
        if (this.hasConfirmed) {
            Utils.showError('Du hast bereits bestätigt und kannst nicht mehr zurück');
            return;
        }

        if (confirm('Möchtest du wirklich zur Lobby zurückkehren? Deine Rassenauswahl geht verloren.')) {
            this.isNavigating = true;
            this.cleanup();
            window.location.href = `/lobby/${this.gameId}?player=${encodeURIComponent(this.playerName)}`;
        }
    }

    updateGameInfo() {
        if (!this.gameData) return;

        const gameNameEl = document.getElementById('game-name');
        if (gameNameEl) {
            gameNameEl.textContent = this.gameData.game.name;
        }
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        this.socket.emit('send-chat-message', {
            gameId: this.gameId,
            playerName: this.playerName,
            message: message
        });

        chatInput.value = '';
    }

    addChatMessage(messageData, scrollToBottom = true) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageDiv = Utils.createElement('div', 'chat-message');
        const timestamp = Utils.formatTime(messageData.timestamp || new Date());
        
        messageDiv.innerHTML = `
            <span class="player-name">${Utils.escapeHtml(messageData.playerName)}:</span>
            ${Utils.escapeHtml(messageData.message)}
            <span class="timestamp">${timestamp}</span>
        `;

        chatMessages.appendChild(messageDiv);

        if (scrollToBottom) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // ✅ CRITICAL: Improved cleanup method
    cleanup() {
        console.log('🧹 Starting race selection cleanup...');
        
        this.isNavigating = true;
        this.navigationInProgress = true;
        
        try {
            if (this.beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this.beforeUnloadHandler);
                this.beforeUnloadHandler = null;
                console.log('✅ Removed beforeunload handler');
            }
            
            if (this.visibilityChangeHandler) {
                document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
                this.visibilityChangeHandler = null;
                console.log('✅ Removed visibility handler');
            }
            
            if (this.socket) {
                this.socket.removeAllListeners();
                this.socket.disconnect();
                console.log('✅ Disconnected socket');
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
        
        console.log('✅ Race selection cleanup completed');
    }

    debugStatus() {
        console.log('=== RACE SELECTION DEBUG STATUS ===');
        console.log('Game ID:', this.gameId);
        console.log('Player Name:', this.playerName);
        console.log('Selected Race:', this.selectedRace);
        console.log('Has Confirmed:', this.hasConfirmed);
        console.log('Is Navigating:', this.isNavigating);
        console.log('Is Map Generating:', this.isMapGenerating);
        console.log('Navigation In Progress:', this.navigationInProgress);
        console.log('Has Received Map Complete:', this.hasReceivedMapComplete);
        console.log('Available Races:', this.availableRaces.length);
        console.log('Game Data:', this.gameData);
        console.log('Socket Connected:', this.socket.connected);
        console.log('===================================');
    }
}

// Initialize when page loads
let raceSelection;

document.addEventListener('DOMContentLoaded', () => {
    raceSelection = new RaceSelection();
    
    window.debugRaceSelection = () => raceSelection.debugStatus();
    console.log('🐛 Debug function available: debugRaceSelection()');
    
    // ✅ CRITICAL: Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (raceSelection && typeof raceSelection.cleanup === 'function') {
            raceSelection.cleanup();
        }
    });
});