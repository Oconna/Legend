// Race Selection page functionality
class RaceSelection {
    constructor() {
        this.socket = io();
        this.gameId = Utils.getGameId();
        this.playerName = Utils.getPlayerName();
        this.gameData = null;
        this.availableRaces = [];
        this.selectedRace = null;
        this.selectedRaceData = null;
        this.hasConfirmed = false;
        this.currentTier = 1;
        this.currentUnits = [];
        
        this.init();
    }

    init() {
        if (!this.gameId || !this.playerName) {
            Utils.showError('Fehlende Spiel- oder Spielerinformationen');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }

        this.bindEvents();
        this.joinGameRoom();
        this.loadGameData();
        this.loadRaces();
        this.loadChatHistory();
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

        this.socket.on('map-generation-complete', (data) => {
            this.handleMapGenerationComplete(data);
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

        // Tier tabs in units modal
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
    }

    joinGameRoom() {
        if (this.socket.connected) {
            this.socket.emit('join-game', {
                gameId: this.gameId,
                playerName: this.playerName
            });
        }
    }

    async loadGameData() {
        try {
            console.log(`Loading game data for game ${this.gameId}...`);
            const data = await Utils.get(`/api/games/${this.gameId}`);
            
            if (!data || !data.game) {
                throw new Error('Spiel nicht gefunden');
            }

            console.log('Game data loaded:', data.game.status, 'Players:', data.players.length);

            // ✅ FLEXIBLERE STATUS-PRÜFUNG
            if (data.game.status !== 'race_selection' && data.game.status !== 'lobby') {
                Utils.showError(`Das Spiel befindet sich in Phase: ${data.game.status}`);
                setTimeout(() => window.location.href = `/lobby/${this.gameId}?player=${encodeURIComponent(this.playerName)}`, 2000);
                return;
            }

            // Check if player is in the game
            const currentPlayer = data.players.find(p => p.player_name === this.playerName);
            if (!currentPlayer) {
                Utils.showError('Du bist nicht in diesem Spiel');
                setTimeout(() => window.location.href = '/', 2000);
                return;
            }

            this.gameData = data;
            this.updateGameInfo();
            
            // Check if player already confirmed race
            if (currentPlayer.race_confirmed) {
                this.hasConfirmed = true;
                this.selectedRace = currentPlayer.race_id;
                this.showWaitingForConfirmation();
                console.log('Player already confirmed race:', currentPlayer.race_id);
            }
            
        } catch (error) {
            console.error('Error loading game data:', error);
            Utils.showError('Fehler beim Laden der Spieldaten: ' + error.message);
            
            // Fallback nach 5 Sekunden
            setTimeout(() => {
                window.location.href = `/lobby/${this.gameId}?player=${encodeURIComponent(this.playerName)}`;
            }, 5000);
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
                
                // Scroll to bottom
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

        // Check if this race is selected
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

        // Remove previous selection
        document.querySelectorAll('.race-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Select new race
        const raceCard = document.querySelector(`[data-race-id="${race.id}"]`);
        if (raceCard) {
            raceCard.classList.add('selected');
        }

        this.selectedRace = race.id;
        this.selectedRaceData = race;

        // Emit race selection to server (but don't confirm yet)
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
            
            // Update selected race display
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

            // Scroll races grid up
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
            // Load units for selected race
            const units = await Utils.get(`/api/games/${this.gameId}/races/${this.selectedRace}/units`);
            this.currentUnits = units;
            
            // Update modal title
            const modalTitle = document.getElementById('units-modal-title');
            if (modalTitle) {
                modalTitle.textContent = `Einheiten von ${this.selectedRaceData.name}`;
            }

            // Reset to tier 1
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

        // Calculate tier bonuses
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
        
        // Calculate enhanced stats
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

        // Confirm race selection
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

        // Update header status
        const confirmedCountEl = document.getElementById('confirmed-count');
        const totalPlayersEl = document.getElementById('total-players');
        if (confirmedCountEl) confirmedCountEl.textContent = confirmedCount || 0;
        if (totalPlayersEl) totalPlayersEl.textContent = totalPlayers || 0;

        // Update waiting confirmation display
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

    handleMapGenerationComplete(data) {
        // ✅ ENTFERNT: Kartengenerierung wird später implementiert
        // Für jetzt: Direkter Sprung zum Spiel nach Rassenbestätigung
        console.log('Map generation would start here - implementing later');
        
        Utils.showSuccess('Alle Rassen bestätigt! Weiterleitung zum Spiel...');
        setTimeout(() => {
            window.location.href = data.redirectUrl;
        }, 2000);
    }

    showMapGenerationProgress() {
        // ✅ ENTFERNT: Wird später implementiert
        console.log('Map generation progress - implementing later');
    }

    backToLobby() {
        if (this.hasConfirmed) {
            Utils.showError('Du hast bereits bestätigt und kannst nicht mehr zurück');
            return;
        }

        if (confirm('Möchtest du wirklich zur Lobby zurückkehren? Deine Rassenauswahl geht verloren.')) {
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

    debugStatus() {
        console.log('=== RACE SELECTION DEBUG STATUS ===');
        console.log('Game ID:', this.gameId);
        console.log('Player Name:', this.playerName);
        console.log('Selected Race:', this.selectedRace);
        console.log('Has Confirmed:', this.hasConfirmed);
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
    
    // Make debug function globally available
    window.debugRaceSelection = () => raceSelection.debugStatus();
    console.log('🐛 Debug function available: debugRaceSelection()');
});