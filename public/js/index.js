// Index page functionality
class GameLobbyIndex {
    constructor() {
        this.socket = io();
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadAvailableGames();
        this.restorePlayerName();
    }

    bindEvents() {
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

        // Player name input for joining games
        const joinPlayerInput = document.getElementById('join-player-name');
        if (joinPlayerInput) {
            joinPlayerInput.addEventListener('input', Utils.debounce(() => {
                this.validateJoinPlayerName();
            }, 300));
        }

        // Auto-refresh games every 10 seconds
        setInterval(() => this.loadAvailableGames(), 10000);
    }

    restorePlayerName() {
        const savedName = Utils.getFromStorage('playerName');
        if (savedName) {
            const playerNameInput = document.getElementById('player-name');
            const joinPlayerNameInput = document.getElementById('join-player-name');
            
            if (playerNameInput) playerNameInput.value = savedName;
            if (joinPlayerNameInput) joinPlayerNameInput.value = savedName;
        }
    }

    async handleCreateGame(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const playerName = formData.get('player-name')?.trim();
        const gameName = formData.get('game-name')?.trim();
        const maxPlayers = parseInt(formData.get('max-players'));
        const mapSize = formData.get('map-size');

        // Validate player name
        const nameError = Utils.validatePlayerName(playerName);
        if (nameError) {
            Utils.showError(nameError);
            return;
        }

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
                playerName,
                maxPlayers,
                mapSize
            });

            Utils.showSuccess('Spiel erfolgreich erstellt! Weiterleitung...');
            
            // Save player name and redirect
            Utils.savePlayerName(playerName);
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
    }

    createGameElement(game) {
        const gameDiv = Utils.createElement('div', 'game-item');
        gameDiv.setAttribute('data-game-id', game.id);

        const isFull = game.current_players >= game.max_players;
        const statusClass = isFull ? 'full' : 'available';
        const statusText = isFull ? 'Voll' : 'Verfügbar';

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
                <button class="btn btn-primary join-game-btn" 
                        ${isFull ? 'disabled' : ''}>
                    ${isFull ? 'Spiel voll' : '🎮 Beitreten'}
                </button>
            </div>
        `;

        // Add click handler for join button
        const joinBtn = gameDiv.querySelector('.join-game-btn');
        if (joinBtn && !isFull) {
            joinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleJoinGame(game.id);
            });
        }

        return gameDiv;
    }

    async handleJoinGame(gameId) {
        const playerNameInput = document.getElementById('join-player-name');
        const playerName = playerNameInput?.value?.trim();

        // Validate player name
        const nameError = Utils.validatePlayerName(playerName);
        if (nameError) {
            Utils.showError(nameError);
            playerNameInput?.focus();
            return;
        }

        try {
            const joinBtn = document.querySelector(`[data-game-id="${gameId}"] .join-game-btn`);
            if (joinBtn) {
                const originalText = joinBtn.textContent;
                joinBtn.disabled = true;
                joinBtn.textContent = 'Trete bei...';

                const response = await Utils.post(`/api/games/${gameId}/join`, {
                    playerName
                });

                Utils.showSuccess('Spiel erfolgreich beigetreten! Weiterleitung...');
                
                // Save player name and redirect
                Utils.savePlayerName(playerName);
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

    validateJoinPlayerName() {
        const input = document.getElementById('join-player-name');
        if (!input) return;

        const playerName = input.value.trim();
        const error = Utils.validatePlayerName(playerName);

        if (error && playerName.length > 0) {
            Utils.showFieldError(input, error);
        } else {
            Utils.clearFieldError(input);
        }
    }

    renderEmptyState() {
        const gamesList = document.getElementById('games-list');
        const emptyDiv = Utils.createElement('div', 'empty-state');
        
        emptyDiv.innerHTML = `
            <h3>🎯 Keine verfügbaren Spiele</h3>
            <p>Derzeit gibt es keine verfügbaren Spiele. Erstelle dein eigenes Spiel, um zu beginnen!</p>
            <button class="btn btn-primary" onclick="document.getElementById('player-name').focus()">
                🚀 Spiel erstellen
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
}

// Initialize when page loads
let gameLobbyIndex;

document.addEventListener('DOMContentLoaded', () => {
    gameLobbyIndex = new GameLobbyIndex();
});