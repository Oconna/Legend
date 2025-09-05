// Lobby page functionality
class GameLobby {
    constructor() {
        this.socket = io();
        this.gameId = Utils.getGameId();
        this.playerName = Utils.getPlayerName();
        this.gameData = null;
        this.isReady = false;
        this.isHost = false;
        this.isLeaving = false; // ✅ Flag to track intentional leaving
        this.isNavigating = false; // ✅ NEW: Track intentional navigation
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        
        this.init();
    }

    init() {
        if (!this.gameId || !this.playerName) {
            Utils.showError('Fehlende Spiel- oder Spielerinformationen');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }

        this.bindEvents();
        this.setupReconnectionHandling();
        this.joinGameRoom();
        this.loadGameData();
        this.loadChatHistory();
    }

    // ✅ NEUE RECONNECTION-BEHANDLUNG
    setupReconnectionHandling() {
        // Handle socket disconnection
        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            
            if (!this.isLeaving && !this.isNavigating && reason !== 'io client disconnect') {
                this.showReconnectingOverlay();
                this.attemptReconnection();
            }
        });

        // Handle successful reconnection
        this.socket.on('connect', () => {
            console.log('Socket connected/reconnected');
            this.hideReconnectingOverlay();
            this.reconnectAttempts = 0;
            
            // Rejoin the game room after reconnection
            if (this.gameId && this.playerName && !this.isLeaving && !this.isNavigating) {
                this.joinGameRoom();
                this.loadGameData();
            }
        });

        // Handle connection errors
        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.showConnectionFailedOverlay();
            }
        });
    }

    attemptReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isLeaving && !this.isNavigating) {
            setTimeout(() => {
                if (!this.socket.connected && !this.isLeaving && !this.isNavigating) {
                    this.socket.connect();
                }
            }, 2000 * (this.reconnectAttempts + 1)); // Progressive delay
        }
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

        this.socket.on('new-host-assigned', (data) => {
            this.handleNewHostAssigned(data);
        });

        this.socket.on('chat-message', (message) => {
            this.addChatMessage(message);
        });
		
		// ✅ DEBUG: Log all socket events
        this.socket.onAny((eventName, ...args) => {
        console.log(`📡 SOCKET EVENT RECEIVED: ${eventName}`, args);
        });
    
        this.socket.onAnyOutgoing((eventName, ...args) => {
        console.log(`📤 SOCKET EVENT SENT: ${eventName}`, args);
        });
    
        // ✅ Debug error events specifically
        this.socket.on('error', (error) => {
        console.error('❌ SOCKET ERROR:', error);
        Utils.showError(`Socket-Fehler: ${error.message || error}`);
        });
    
        // ✅ Debug connect/disconnect
        this.socket.on('connect', () => {
        console.log('✅ Socket connected in lobby');
        });
    
        this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected in lobby:', reason);
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

        // ✅ VERBESSERTE PAGE UNLOAD BEHANDLUNG
        window.addEventListener('beforeunload', (e) => {
            // Don't treat game start redirection as leaving
            if (this.isNavigating) {
                console.log('Intentional navigation, not emitting leave-game');
                return; // Allow navigation without triggering leave
            }
            
            // Only handle actual page closes/refreshes, not programmatic navigation
            if (!this.isLeaving && !this.isNavigating) {
                console.log('Page unload detected, emitting leave-game');
                this.isLeaving = true;
                this.socket.emit('leave-game', {
                    gameId: this.gameId,
                    playerName: this.playerName
                });
            }
        });

        // ✅ NEUE VISIBILITY CHANGE BEHANDLUNG
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isLeaving && !this.isNavigating) {
                // Page became visible again - check if still in game
                this.verifyGameMembership();
            }
        });
    }

    // ✅ NEUE FUNKTION: Überprüfen ob Spieler noch im Spiel ist
    async verifyGameMembership() {
        try {
            const gameState = await Utils.get(`/api/games/${this.gameId}`);
            const playerInGame = gameState.players.find(p => p.player_name === this.playerName);
            
            if (!playerInGame) {
                // Player is no longer in the game
                Utils.showError('Du bist nicht mehr in diesem Spiel. Weiterleitung zur Startseite...');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
                return;
            }
            
            // Update game state if player is still in game
            this.handleGameStateUpdate(gameState);
            
        } catch (error) {
            console.error('Error verifying game membership:', error);
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
            const data = await Utils.get(`/api/games/${this.gameId}`);
            
            // ✅ VERBESSERTE VALIDIERUNG
            if (!data || !data.game) {
                throw new Error('Spiel nicht gefunden');
            }

            // Check if player is in the game
            const currentPlayer = data.players.find(p => p.player_name === this.playerName);
            if (!currentPlayer) {
                Utils.showError('Du bist nicht in diesem Spiel. Weiterleitung zur Startseite...');
                setTimeout(() => window.location.href = '/', 2000);
                return;
            }

            this.gameData = data;
            this.updateGameInfo();
            this.updatePlayersList(data.players);
            
            // Update current player status
            this.isReady = currentPlayer.is_ready;
            this.isHost = currentPlayer.is_host || false;
            this.updateHostControls();
            this.updateReadyButton();
            
        } catch (error) {
            Utils.showError('Fehler beim Laden der Spieldaten');
            console.error('Error loading game data:', error);
            
            // If game not found, redirect to home
            if (error.message.includes('404') || error.message.includes('nicht gefunden')) {
                setTimeout(() => window.location.href = '/', 2000);
            }
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
        // ✅ VERBESSERTE GAME STATE BEHANDLUNG
        if (!gameState || !gameState.players) {
            console.warn('Invalid game state received:', gameState);
            return;
        }

        this.gameData = gameState;
        this.updateGameInfo();
        this.updatePlayersList(gameState.players);
        
        // Update current player status
        const currentPlayer = gameState.players.find(p => p.player_name === this.playerName);
        if (currentPlayer) {
            this.isReady = currentPlayer.is_ready;
            this.isHost = currentPlayer.is_host || false;
            this.updateReadyButton();
            this.updateHostControls();
        } else {
            // Current player not found in game - they might have been removed
            console.warn('Current player not found in game state');
            this.verifyGameMembership();
        }
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
        console.log('🎮 Game started, transitioning to race selection...', data);
        
        // ✅ CRITICAL: Set navigation flags and remove event listeners
        this.isNavigating = true;
        this.isLeaving = false;
        
        // ✅ CRITICAL: Remove event listeners to prevent leave-game
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        window.removeEventListener('unload', this.unloadHandler);
        
        this.showLoadingOverlay('Spiel wird gestartet...', 'Weiterleitung zur Rassenauswahl...');
        
        // Clear any existing intervals
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
        }
        
        setTimeout(() => {
            const redirectUrl = `${data.redirectUrl}?player=${encodeURIComponent(this.playerName)}&transition=start`;
            console.log('🚀 Redirecting to race selection with navigation flag set:', redirectUrl);
            window.location.href = redirectUrl;
        }, 1000);
    }
    }

    handlePlayerLeft(data) {
        if (data.wasHost && data.newHost) {
            const wasTransferredToMe = data.newHost === this.playerName;
            
            if (wasTransferredToMe) {
                Utils.showSuccess(`${data.playerName} hat das Spiel verlassen. Du bist jetzt der Host!`);
                this.isHost = true;
            } else {
                Utils.showInfo(`${data.playerName} hat das Spiel verlassen. ${data.newHost} ist jetzt der Host.`);
            }
        } else {
            const message = data.disconnected 
                ? `${data.playerName} ist disconnected` 
                : `${data.playerName} hat das Spiel verlassen`;
            Utils.showInfo(message);
        }
        
        // Update UI with new game state
        if (data.gameState) {
            this.gameData = data.gameState;
            this.updateGameInfo();
            this.updatePlayersList(data.gameState.players);
        }
        
        this.updateHostControls();
    }

    handleNewHostAssigned(data) {
        console.log('New host assigned:', data);
        
        if (data.newHostName === this.playerName) {
            this.isHost = true;
            Utils.showSuccess('Du bist jetzt der Host des Spiels!');
            this.updateHostControls();
        } else {
            Utils.showInfo(data.message);
        }
        
        // Refresh game data to ensure consistency
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

        console.log('Updating host controls. IsHost:', this.isHost, 'GameData:', this.gameData);

        if (this.isHost) {
            hostControls.classList.remove('hidden');
            
            // Check if all players are ready
            const allReady = this.gameData?.players.every(p => p.is_ready) || false;
            const minPlayers = (this.gameData?.players.length || 0) >= 2;
            
            startBtn.disabled = !allReady || !minPlayers;
            startBtn.classList.remove('waiting-pulse');
            
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
        console.log('🎮 START GAME CLICKED - Beginning checks...');
        console.log('🎮 Is Host:', this.isHost);
        console.log('🎮 Game Data:', this.gameData);
        console.log('🎮 Socket Connected:', this.socket.connected);
        
        if (!this.isHost) {
            console.log('❌ Not host - aborting');
            Utils.showError('Nur der Host kann das Spiel starten');
            return;
        }

        if (!this.socket.connected) {
            console.log('❌ Socket not connected - aborting');
            Utils.showError('Keine Verbindung zum Server');
            return;
        }

        const startBtn = document.getElementById('start-game');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = '🚀 Starte Spiel...';
        }

        console.log('🎮 Emitting start-game event with data:', {
            gameId: this.gameId,
            playerName: this.playerName
        });

        // Emit mit Acknowledgment für besseres Debugging
        this.socket.emit('start-game', {
            gameId: this.gameId,
            playerName: this.playerName
        }, (acknowledgment) => {
            console.log('🎮 Start-game acknowledgment received:', acknowledgment);
        });
        
        // Timeout falls nichts passiert
        setTimeout(() => {
            console.log('⏰ Start game timeout - no response after 10 seconds');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = '🚀 Spiel starten';
            }
            Utils.showError('Timeout beim Starten des Spiels. Versuche es erneut.');
        }, 10000);
    }

    showLeaveConfirmation() {
        Utils.showModal('leave-modal');
    }

    leaveGame() {
        Utils.hideModal('leave-modal');
        
        // ✅ Set leaving flag before emitting leave event
        this.isLeaving = true;
        
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

    // ✅ NEUE RECONNECTION OVERLAYS
    showReconnectingOverlay() {
        this.showLoadingOverlay('Verbindung verloren...', 'Versuche erneut zu verbinden...');
    }

    hideReconnectingOverlay() {
        this.hideLoadingOverlay();
    }

    showConnectionFailedOverlay() {
        this.showLoadingOverlay(
            'Verbindung fehlgeschlagen', 
            'Bitte lade die Seite neu oder kehre zur Startseite zurück'
        );
    }

    // Debug method
    debugStatus() {
        console.log('=== LOBBY DEBUG STATUS ===');
        console.log('Game ID:', this.gameId);
        console.log('Player Name:', this.playerName);
        console.log('Is Host:', this.isHost);
        console.log('Is Ready:', this.isReady);
        console.log('Is Leaving:', this.isLeaving);
        console.log('Is Navigating:', this.isNavigating);
        console.log('Socket Connected:', this.socket.connected);
        console.log('Game Data:', this.gameData);
        console.log('========================');
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