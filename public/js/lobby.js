// Lobby page functionality
class GameLobby {
    constructor() {
        this.socket = io();
        this.gameId = Utils.getGameId();
        this.playerName = Utils.getPlayerName();
        this.gameData = null;
        this.isReady = false;
        this.isHost = false;
        
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
        this.loadChatHistory();
    }

    bindEvents() {
        // Socket events
        this.socket.on('game-state-update', (gameState) => {
            this.handleGameStateUpdate(gameState);
        });

        this.socket.on('all-players-ready', () => {
            this.handleAllPlayersReady();
        });

        this.socket.on('game-started', (data) => {
            this.handleGameStarted(data);
        });

        this.socket.on('player-left', (data) => {
            this.handlePlayerLeft(data);
        });

        this.socket.on('chat-message', (message) => {
            this.addChatMessage(message);
        });

        this.socket.on('error', (error) => {
            Utils.showError(error.message);
        });

        // UI events
        const readyToggle = document.getElementById('ready-toggle');
        if (readyToggle) {
            readyToggle.addEventListener('click', () => this.toggleReady());
        }

        const startGame = document.getElementById('start-game');
        if (startGame) {
            startGame.addEventListener('click', () => this.startGame());
        }

        const leaveGame = document.getElementById('leave-game');
        if (leaveGame) {
            leaveGame.addEventListener('click', () => this.showLeaveConfirmation());
        }

        const confirmLeave = document.getElementById('confirm-leave');
        if (confirmLeave) {
            confirmLeave.addEventListener('click', () => this.leaveGame());
        }

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

        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.socket.emit('leave-game', {
                gameId: this.gameId,
                playerName: this.playerName
            });
        });
    }

    joinGameRoom() {
        this.socket.emit('join-game', {
            gameId: this.gameId,
            playerName: this.playerName
        });
    }

    async loadGameData() {
        try {
            const data = await Utils.get(`/api/games/${this.gameId}`);
            this.gameData = data;
            this.updateGameInfo();
            this.updatePlayersList(data.players);
            
            // Check if current player is host
            const currentPlayer = data.players.find(p => p.player_name === this.playerName);
            this.isHost = currentPlayer?.is_host || false;
            this.updateHostControls();
            
        } catch (error) {
            Utils.showError('Fehler beim Laden der Spieldaten');
            console.error('Error loading game data:', error);
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

    handleGameStateUpdate(gameState) {
        this.gameData = gameState;
        this.updateGameInfo();
        this.updatePlayersList(gameState.players);
        
        // Update current player status
        const currentPlayer = gameState.players.find(p => p.player_name === this.playerName);
        if (currentPlayer) {
            this.isReady = currentPlayer.is_ready;
            this.updateReadyButton();
        }
        
        this.updateHostControls();
    }

    handleAllPlayersReady() {
        if (this.isHost) {
            const startBtn = document.getElementById('start-game');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.classList.add('waiting-pulse');
                Utils.showSuccess('Alle Spieler sind bereit! Du kannst das Spiel starten.');
            }
        } else {
            Utils.showInfo('Alle Spieler sind bereit! Warte auf den Host...');
        }
    }

    handleGameStarted(data) {
        this.showLoadingOverlay('Spiel wird gestartet...', 'Weiterleitung zur Rassenauswahl...');
        
        setTimeout(() => {
            Utils.redirectToGame(data.redirectUrl, this.playerName);
        }, 2000);
    }

    handlePlayerLeft(data) {
        if (data.wasHost && data.newHost) {
            Utils.showInfo(`${data.playerName} hat das Spiel verlassen. ${data.newHost} ist jetzt der Host.`);
            
            // Update host status if current player is new host
            if (data.newHost === this.playerName) {
                this.isHost = true;
                Utils.showSuccess('Du bist jetzt der Host des Spiels!');
            }
        } else {
            Utils.showInfo(`${data.playerName} hat das Spiel verlassen`);
        }
        
        this.updateGameInfo();
        this.updatePlayersList(data.gameState.players);
        this.updateHostControls();
    }

    handleGameDeleted(data) {
        Utils.showError('Das Spiel wurde gelöscht, da keine Spieler mehr vorhanden sind.');
        this.showLoadingOverlay('Spiel gelöscht...', 'Weiterleitung zur Startseite...');
        
        setTimeout(() => {
            window.location.href = '/';
        }, 3000);
    }

    handleNewHostAssigned(data) {
        Utils.showInfo(data.message);
        
        if (data.newHostName === this.playerName) {
            this.isHost = true;
            Utils.showSuccess('Du bist jetzt der Host des Spiels!');
            this.updateHostControls();
            this.updateReadyButton();
        }
        
        // Refresh the game data to get the updated host information
        this.loadGameData();
    }

    updateGameInfo() {
        if (!this.gameData) return;

        const gameNameEl = document.getElementById('game-name');
        const gameDetailsEl = document.getElementById('game-details');
        
        if (gameNameEl) {
            gameNameEl.textContent = this.gameData.game.name;
        }
        
        if (gameDetailsEl) {
            gameDetailsEl.innerHTML = `
                ${this.gameData.players.length}/${this.gameData.game.max_players} Spieler • 
                Kartengröße: ${this.gameData.game.map_size} • 
                Host: ${Utils.escapeHtml(this.gameData.game.host_player)}
            `;
        }
    }

    updatePlayersList(players) {
        const playersList = document.getElementById('players-list');
        if (!playersList) return;

        Utils.clearElement(playersList);

        players.forEach(player => {
            const playerElement = this.createPlayerElement(player);
            playersList.appendChild(playerElement);
        });
    }

    createPlayerElement(player) {
        const playerDiv = Utils.createElement('div', 'player-item');
        
        let classes = 'player-item';
        if (player.is_ready) classes += ' ready';
        if (player.is_host) classes += ' host';
        if (player.player_name === this.playerName) classes += ' current-player';
        
        playerDiv.className = classes;

        const iconClass = player.is_host ? 'host' : (player.is_ready ? 'ready' : 'not-ready');
        const statusClass = player.is_host ? 'host' : (player.is_ready ? 'ready' : 'not-ready');
        const statusText = player.is_host ? 'Host' : (player.is_ready ? 'Bereit' : 'Nicht bereit');
        const iconText = player.is_host ? '👑' : (player.is_ready ? '✅' : '⏳');

        playerDiv.innerHTML = `
            <div class="player-info">
                <div class="player-icon ${iconClass}">
                    ${iconText}
                </div>
                <div class="player-name">
                    ${Utils.escapeHtml(player.player_name)}
                    ${player.player_name === this.playerName ? ' (Du)' : ''}
                </div>
            </div>
            <div class="player-status">
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            </div>
        `;

        return playerDiv;
    }

    updateReadyButton() {
        const readyBtn = document.getElementById('ready-toggle');
        if (!readyBtn) return;

        readyBtn.disabled = false;
        
        if (this.isReady) {
            readyBtn.textContent = '❌ Nicht bereit';
            readyBtn.className = 'btn btn-danger ready';
        } else {
            readyBtn.textContent = '✅ Bereit';
            readyBtn.className = 'btn btn-success';
        }
    }

    updateHostControls() {
        const hostControls = document.getElementById('host-controls');
        const startBtn = document.getElementById('start-game');
        
        if (!hostControls || !startBtn) return;

        console.log('Updating host controls. IsHost:', this.isHost);

        if (this.isHost) {
            hostControls.classList.remove('hidden');
            
            // Check if all players are ready
            const allReady = this.gameData?.players.every(p => p.is_ready) || false;
            const minPlayers = (this.gameData?.players.length || 0) >= 2;
            
            startBtn.disabled = !allReady || !minPlayers;
            
            if (!minPlayers) {
                startBtn.textContent = '🚀 Warte auf mehr Spieler';
            } else if (!allReady) {
                startBtn.textContent = '🚀 Warte auf alle Spieler';
            } else {
                startBtn.textContent = '🚀 Spiel starten';
                startBtn.classList.add('waiting-pulse');
            }
        } else {
            hostControls.classList.add('hidden');
        }
    }

    toggleReady() {
        this.socket.emit('player-ready', {
            gameId: this.gameId,
            playerName: this.playerName,
            isReady: !this.isReady
        });
        
        // Disable button until response
        const readyBtn = document.getElementById('ready-toggle');
        if (readyBtn) {
            readyBtn.disabled = true;
        }
    }

    startGame() {
        if (!this.isHost) {
            Utils.showError('Nur der Host kann das Spiel starten');
            return;
        }

        const startBtn = document.getElementById('start-game');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = '🚀 Starte Spiel...';
        }

        this.socket.emit('start-game', {
            gameId: this.gameId,
            playerName: this.playerName
        });
    }

    showLeaveConfirmation() {
        Utils.showModal('leave-modal');
    }

    leaveGame() {
        Utils.hideModal('leave-modal');
        this.showLoadingOverlay('Verlasse Spiel...', 'Weiterleitung zur Startseite...');
        
        this.socket.emit('leave-game', {
            gameId: this.gameId,
            playerName: this.playerName
        });

        setTimeout(() => {
            window.location.href = '/';
        }, 1500);
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

    showLoadingOverlay(title, subtitle = '') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        
        if (loadingText) {
            loadingText.innerHTML = `
                <div>${title}</div>
                ${subtitle ? `<div style="font-size: 1rem; margin-top: 0.5rem; opacity: 0.8;">${subtitle}</div>` : ''}
            `;
        }
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// Initialize when page loads
let gameLobby;

document.addEventListener('DOMContentLoaded', () => {
    gameLobby = new GameLobby();
    
    // Make debug function globally available
    window.debugLobby = () => gameLobby.debugStatus();
    console.log('🐛 Debug function available: debugLobby()');
});