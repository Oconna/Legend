// Index page functionality
class GameLobbyIndex {
    constructor() {
        this.socket = io();
        this.currentPlayerName = '';
        this.isPlayerNameValid = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAvailableGames();
        this.restorePlayerName();
        this.updateUI();
    }

    bindEvents() {
        // Player name input
        const playerNameInput = document.getElementById('player-name');
        if (playerNameInput) {
            playerNameInput.addEventListener('input', Utils.debounce(() => {
                this.handlePlayerNameChange();
            }, 300));

            playerNameInput.addEventListener('blur', () => {
                this.validatePlayerName();
            });
        }

        // Create game form
        const createForm = document.getElementById('create-game-form');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreateGame(e));
        }

        // Refresh games button
        const refreshBtn = document.getElementById('refresh-games');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadAvailableGames());
        }

        // Auto-refresh games every 15 seconds
        setInterval(() => this.loadAvailableGames(), 15000);
    }

    restorePlayerName() {
        const savedName = Utils.getFromStorage('playerName');
        if (savedName) {
            const playerNameInput = document.getElementById('player-name');
            if (playerNameInput) {
                playerNameInput.value = savedName;
                this.currentPlayerName = savedName;
                this.validatePlayerName();
            }
        }
    }

    handlePlayerNameChange() {
        const playerNameInput = document.getElementById('player-name');
        const playerName = playerNameInput?.value?.trim() || '';
        
        this.currentPlayerName = playerName;
        this.validatePlayerName();
        this.updateUI();
    }

    validatePlayerName() {
        const playerNameInput = document.getElementById('player-name');
        if (!playerNameInput) return false;

        const playerName = this.currentPlayerName;
        const error = Utils.validatePlayerName(playerName);
        const formGroup = playerNameInput.closest('.form-group');

        if (error && playerName.length > 0) {
            Utils.showFieldError(playerNameInput, error);
            formGroup?.classList.add('invalid');
            formGroup?.classList.remove('valid');
            this.isPlayerNameValid = false;
        } else if (playerName.length >= 2) {
            Utils.clearFieldError(playerNameInput);
            formGroup?.classList.add('valid');
            formGroup?.classList.remove('invalid');
            this.isPlayerNameValid = true;
            
            // Save valid player name
            Utils.savePlayerName(playerName);
        } else {
            Utils.clearFieldError(playerNameInput);
            formGroup?.classList.remove('valid', 'invalid');
            this.isPlayerNameValid = false;
        }

        return this.isPlayerNameValid;
    }

    updateUI() {
        this.updatePlayerNameStatus();
        this.updateCreateGameButton();
        this.updateGamesList();
    }

    updatePlayerNameStatus() {
        const statusElement = document.getElementById('player-name-status');
        if (!statusElement) return;

        if (this.isPlayerNameValid) {
            statusElement.className = 'status-indicator ready';
            statusElement.innerHTML = `✅ Bereit als "${this.currentPlayerName}"`;
        } else {
            statusElement.className = 'status-indicator not-ready';
            statusElement.innerHTML = '❌ Spielername eingeben';
        }
    }

    updateCreateGameButton() {
        const createButton = document.querySelector('#create-game-form button[type="submit"]');
        const formInfo = document.querySelector('#create-game-form .form-info small');
        
        if (!createButton) return;

        if (this.isPlayerNameValid) {
            createButton.disabled = false;
            createButton.textContent = '🚀 Spiel erstellen';
            if (formInfo) {
                formInfo.textContent = 'Alle Felder ausfüllen und erstellen';
                formInfo.style.color = '#666';
            }
        } else {
            createButton.disabled = true;
            createButton.textContent = '🚀 Spiel erstellen';
            if (formInfo) {
                formInfo.textContent = 'Gib zuerst deinen Spielernamen oben ein';
                formInfo.style.color = '#f44336';
            }
        }
    }

    updateGamesList() {
        // Update existing game items to show if they can be joined
        const gameItems = document.querySelectorAll('.game-item');
        gameItems.forEach(gameItem => {
            const joinBtn = gameItem.querySelector('.join-game-btn');
            if (joinBtn) {
                if (this.isPlayerNameValid && !joinBtn.disabled) {
                    gameItem.classList.remove('disabled');
                    joinBtn.style.opacity = '1';
                } else if (!this.isPlayerNameValid) {
                    gameItem.classList.add('disabled');
                    joinBtn.style.opacity = '0.5';
                }
            }
        });
    }

    async handleCreateGame(e) {
        e.preventDefault();

        // Validate player name first
        if (!this.validatePlayerName()) {
            Utils.showError('Bitte gib einen gültigen Spielernamen ein');
            document.getElementById('player-name')?.focus();
            return;
        }

        const formData = new FormData(e.target);
        const gameName = formData.get('game-name')?.trim();
        const maxPlayers = parseInt(formData.get('max-players'));
        const mapSize = formData.get('map-size');

        // Validate game name
        if (!gameName || gameName.length < 3) {
            Utils.showError('Spielname muss mindestens 3 Zeichen lang sein');
            return;
        }

        if (gameName.length > 100) {
            Utils.showError('Spielname darf maximal 100 Zeichen lang sein');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '🚀 Erstelle Spiel...';

            const response = await Utils.post('/api/games', {
                gameName,
                playerName: this.currentPlayerName,
                maxPlayers,
                mapSize
            });

            Utils.showSuccess('Spiel erfolgreich erstellt! Weiterleitung...');
            
            setTimeout(() => {
                window.location.href = response.redirectUrl;
            }, 1000);

        } catch (error) {
            Utils.showError(error.message || 'Fehler beim Erstellen des Spiels');
            
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Spiel erstellen';
        }
    }

    async loadAvailableGames() {
        const gamesList = document.getElementById('games-list');
        if (!gamesList) return;

        try {
            Utils.showLoading(gamesList, 'Lade verfügbare Spiele...');
            
            const games = await Utils.get('/api/games');
            this.renderGamesList(games);

        } catch (error) {
            console.error('Error loading games:', error);
            this.renderGamesError();
        }
    }

    renderGamesList(games) {
        const gamesList = document.getElementById('games-list');
        Utils.clearElement(gamesList);

        if (games.length === 0) {
            this.renderEmptyState();
            return;
        }

        games.forEach(game => {
            const gameElement = this.createGameElement(game);
            gamesList.appendChild(gameElement);
        });

        // Update UI state after rendering
        this.updateGamesList();
    }

    createGameElement(game) {
        const gameDiv = Utils.createElement('div', 'game-item');
        gameDiv.setAttribute('data-game-id', game.id);

        const isFull = game.current_players >= game.max_players;
        const canJoin = this.isPlayerNameValid && !isFull;
        const statusClass = isFull ? 'full' : 'available';
        const statusText = isFull ? 'Voll' : 'Verfügbar';

        // Add disabled class if player name is not valid
        if (!canJoin) {
            gameDiv.classList.add('disabled');
        }

        gameDiv.innerHTML = `
            <div class="game-header">
                <h3 class="game-name">${Utils.escapeHtml(game.name)}</h3>
                <span class="game-status ${statusClass}">${statusText}</span>
            </div>
            <div class="game-details">
                <div class="game-detail">
                    <span class="game-detail-label">Spieler</span>
                    <span class="game-detail-value game-players ${isFull ? 'full' : ''}">
                        ${game.current_players}/${game.max_players}
                    </span>
                </div>
                <div class="game-detail">
                    <span class="game-detail-label">Kartengröße</span>
                    <span class="game-detail-value">${game.map_size}</span>
                </div>
                <div class="game-detail">
                    <span class="game-detail-label">Host</span>
                    <span class="game-detail-value">${Utils.escapeHtml(game.host_player)}</span>
                </div>
                <div class="game-detail">
                    <span class="game-detail-label">Erstellt</span>
                    <span class="game-detail-value">${Utils.formatTime(game.created_at)}</span>
                </div>
            </div>
            <div class="game-actions">
                ${this.createJoinButton(game.id, isFull, canJoin)}
            </div>
        `;

        return gameDiv;
    }

    createJoinButton(gameId, isFull, canJoin) {
        if (isFull) {
            return '<button class="btn btn-secondary" disabled>Spiel voll</button>';
        }

        if (!this.isPlayerNameValid) {
            return '<button class="btn btn-primary join-game-btn" disabled style="opacity: 0.5">Spielername eingeben</button>';
        }

        return `<button class="btn btn-primary join-game-btn" onclick="gameLobbyIndex.handleJoinGame('${gameId}')">🎮 Beitreten</button>`;
    }

    async handleJoinGame(gameId) {
        // Double-check player name validity
        if (!this.validatePlayerName()) {
            Utils.showError('Bitte gib einen gültigen Spielernamen ein');
            document.getElementById('player-name')?.focus();
            return;
        }

        try {
            const joinBtn = document.querySelector(`[data-game-id="${gameId}"] .join-game-btn`);
            if (joinBtn) {
                const originalText = joinBtn.textContent;
                joinBtn.disabled = true;
                joinBtn.textContent = 'Trete bei...';

                const response = await Utils.post(`/api/games/${gameId}/join`, {
                    playerName: this.currentPlayerName
                });

                Utils.showSuccess('Spiel erfolgreich beigetreten! Weiterleitung...');
                
                setTimeout(() => {
                    window.location.href = response.redirectUrl;
                }, 1000);
            }

        } catch (error) {
            Utils.showError(error.message || 'Fehler beim Beitreten');
            
            // Reset button
            const joinBtn = document.querySelector(`[data-game-id="${gameId}"] .join-game-btn`);
            if (joinBtn) {
                joinBtn.disabled = false;
                joinBtn.textContent = '🎮 Beitreten';
            }
        }
    }

    renderEmptyState() {
        const gamesList = document.getElementById('games-list');
        const emptyDiv = Utils.createElement('div', 'empty-state');
        
        emptyDiv.innerHTML = `
            <h3>🎯 Keine verfügbaren Spiele</h3>
            <p>Derzeit gibt es keine verfügbaren Spiele. Erstelle dein eigenes Spiel, um zu beginnen!</p>
            <button class="btn btn-primary" onclick="document.getElementById('player-name').focus()">
                👤 Spielername eingeben
            </button>
        `;

        gamesList.appendChild(emptyDiv);
    }

    renderGamesError() {
        const gamesList = document.getElementById('games-list');
        const errorDiv = Utils.createElement('div', 'empty-state');
        
        errorDiv.innerHTML = `
            <h3>⚠️ Fehler beim Laden</h3>
            <p>Die verfügbaren Spiele konnten nicht geladen werden. Bitte versuche es erneut.</p>
            <button class="btn btn-secondary" onclick="gameLobbyIndex.loadAvailableGames()">
                🔄 Erneut versuchen
            </button>
        `;

        Utils.clearElement(gamesList);
        gamesList.appendChild(errorDiv);
    }

    // Debug method
    debugStatus() {
        console.log('=== INDEX DEBUG STATUS ===');
        console.log('Current Player Name:', this.currentPlayerName);
        console.log('Is Player Name Valid:', this.isPlayerNameValid);
        console.log('=========================');
    }
}

// Initialize when page loads
let gameLobbyIndex;

document.addEventListener('DOMContentLoaded', () => {
    gameLobbyIndex = new GameLobbyIndex();
    
    // Make debug function globally available
    window.debugIndex = () => gameLobbyIndex.debugStatus();
    console.log('🐛 Debug function available: debugIndex()');
});