// socket-manager.js - Socket.io Verbindungsmanagement (Korrigiert)

console.log('🔌 Initialisiere Socket Manager...');

// ========================================
// SOCKET MANAGER CLASS
// ========================================

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = GAME_CONFIG?.RECONNECT_ATTEMPTS || 5;
        this.reconnectDelay = GAME_CONFIG?.RECONNECT_DELAY || 2000;
        this.pingInterval = null;
        
        // Nur initialisieren wenn wir nicht im Demo-Modus sind
        const urlParams = new URLSearchParams(window.location.search);
        const settingsParam = urlParams.get('settings');
        let gameSettings = null;
        
        if (settingsParam) {
            try {
                gameSettings = JSON.parse(decodeURIComponent(settingsParam));
            } catch (error) {
                console.warn('⚠️ Fehler beim Parsen der Spiel-Einstellungen:', error);
            }
        }
        
        // Nur Socket initialisieren wenn wir eine echte gameId haben
        if (gameSettings && gameSettings.gameId && gameSettings.gameId !== 'demo-game') {
            this.initSocket();
        } else {
            console.log('🤖 Demo-Modus erkannt - Socket Manager deaktiviert');
            this.isConnected = false;
        }
    }

    // ========================================
    // SOCKET INITIALIZATION
    // ========================================

    initSocket() {
        console.log('🔌 Initialisiere Socket.io Verbindung...');
        
        try {
            this.socket = io({
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 10000,
                forceNew: false
            });
            
            if (window.gameState) {
                gameState.setSocket(this.socket);
            }
            this.setupEventListeners();
            this.startPingMonitoring();
            
            console.log('✅ Socket.io initialisiert');
        } catch (error) {
            console.error('❌ Socket.io Fehler:', error);
            this.showNotification('Fehler beim Verbinden zum Server', 'error');
        }
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    setupEventListeners() {
        if (!this.socket) return;
        
        // Connection Events
        this.socket.on('connect', () => this.onConnect());
        this.socket.on('disconnect', (reason) => this.onDisconnect(reason));
        this.socket.on('connect_error', (error) => this.onConnectError(error));
        this.socket.on('reconnect', (attemptNumber) => this.onReconnect(attemptNumber));
        this.socket.on('reconnect_error', (error) => this.onReconnectError(error));
        this.socket.on('reconnect_failed', () => this.onReconnectFailed());

        // Game Events
        this.socket.on('game-started', (data) => this.onGameStarted(data));
        this.socket.on('race-selected', (data) => this.onRaceSelected(data));
        this.socket.on('race-selection-failed', (data) => this.onRaceSelectionFailed(data));
        this.socket.on('all-races-selected', (data) => this.onAllRacesSelected(data));

        // Turn System Events
        this.socket.on('turn-ended', (data) => this.onTurnEnded(data));
        this.socket.on('turn-forced', (data) => this.onTurnForced(data));
        this.socket.on('turn-info', (data) => this.onTurnInfo(data));
        this.socket.on('end-turn-failed', (data) => this.onEndTurnFailed(data));

        // Player Events
        this.socket.on('player-joined', (data) => this.onPlayerJoined(data));
        this.socket.on('player-left', (data) => this.onPlayerLeft(data));
        this.socket.on('player-ready-changed', (data) => this.onPlayerReadyChanged(data));

        // Game State Events
        this.socket.on('game-settings-updated', (data) => this.onGameSettingsUpdated(data));
        this.socket.on('unit-moved', (data) => this.onUnitMoved(data));
        this.socket.on('unit-attacked', (data) => this.onUnitAttacked(data));

        // Server Messages
        this.socket.on('server-message', (data) => this.onServerMessage(data));
        this.socket.on('error', (error) => this.onError(error));

        // Ping/Pong
        this.socket.on('pong', () => this.onPong());
    }

    // ========================================
    // CONNECTION EVENT HANDLERS
    // ========================================

    onConnect() {
        console.log('✅ Mit Server verbunden - Socket ID:', this.socket.id);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        if (window.gameState) {
            gameState.setConnectionStatus(true);
        }
        this.showNotification('Verbunden!', 'success');
        
        // Request current game state if in a game
        if (window.gameState && gameState.data.gameSettings?.gameId) {
            this.requestTurnInfo();
        }
    }

    onDisconnect(reason) {
        console.log('❌ Verbindung zum Server getrennt:', reason);
        this.isConnected = false;
        
        if (window.gameState) {
            gameState.setConnectionStatus(false);
        }
        
        if (reason === 'io server disconnect') {
            this.showNotification('Server hat Verbindung getrennt', 'warning');
        } else {
            this.showNotification('Verbindung verloren - Versuche Wiederverbindung...', 'warning');
        }
    }

    onConnectError(error) {
        console.error('🔌 Verbindungsfehler:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            this.showNotification(
                `Verbindungsfehler - Versuch ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, 
                'warning'
            );
        } else {
            this.showNotification('Verbindung fehlgeschlagen - Bitte Seite neu laden', 'error');
        }
    }

    onReconnect(attemptNumber) {
        console.log('🔄 Erfolgreich wieder verbunden nach', attemptNumber, 'Versuchen');
        this.showNotification('Wieder verbunden!', 'success');
        
        // Request current game state
        if (window.gameState && gameState.data.gameSettings?.gameId) {
            setTimeout(() => this.requestTurnInfo(), 1000);
        }
    }

    onReconnectError(error) {
        console.error('🔄 Neuverbindungsfehler:', error);
    }

    onReconnectFailed() {
        console.error('❌ Alle Neuverbindungsversuche fehlgeschlagen');
        this.showNotification(
            'Verbindung zum Server verloren. Bitte laden Sie die Seite neu.', 
            'error'
        );
    }

    // ========================================
    // GAME EVENT HANDLERS
    // ========================================

    onGameStarted(data) {
        console.log('🎮 Spiel vom Server gestartet:', data);
        if (window.gameState) {
            gameState.setGamePhase('race_selection');
        }
        
        // Trigger race selection modal
        window.dispatchEvent(new CustomEvent('showRaceSelection'));
        
        this.showNotification('Spiel gestartet! Wähle deine Rasse.', 'info');
    }

    onRaceSelected(data) {
        console.log('🏛️ Spieler hat Rasse gewählt:', data.playerName, data.raceId);
        if (window.gameState) {
            gameState.setOtherPlayerRace(data.playerName, data.raceId);
        }
        
        // Update race selection UI
        window.dispatchEvent(new CustomEvent('raceSelectionUpdate', { detail: data }));
        
        this.showNotification(`${data.playerName} hat eine Rasse gewählt`, 'info');
    }

    onRaceSelectionFailed(data) {
        console.error('❌ Rassen-Auswahl fehlgeschlagen:', data.error);
        this.showNotification(`Rassen-Auswahl fehlgeschlagen: ${data.error}`, 'error');
        
        // Re-enable race selection
        window.dispatchEvent(new CustomEvent('raceSelectionFailed', { detail: data }));
    }

    onAllRacesSelected(data) {
        console.log('🎯 Alle Rassen vom Server gewählt!');
        if (window.gameState) {
            gameState.setGamePhase('playing');
            gameState.setTurnData({
                turnOrder: data.turnOrder,
                currentPlayer: data.currentPlayer,
                turnNumber: 1,
                timeRemaining: GAME_CONFIG?.TURN_TIME_LIMIT || 120
            });
        }
        
        // Hide race selection and show game
        window.dispatchEvent(new CustomEvent('hideRaceSelection'));
        window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
        
        const isFirstPlayer = data.currentPlayer === (window.gameState ? gameState.currentPlayer?.name : null);
        this.showGameStartMessage(data, isFirstPlayer);
    }

    // ========================================
    // OUTGOING SOCKET METHODS
    // ========================================

    selectRace(raceId) {
        if (!window.gameState || gameState.gamePhase !== 'race_selection') {
            console.warn('⚠️ Rassen-Auswahl nicht aktiv');
            return false;
        }
        
        return this.emit('select-race', {
            gameId: gameState.data.gameSettings.gameId,
            raceId: raceId
        });
    }

    endTurn() {
        if (!window.gameState || !gameState.isMyTurn || gameState.gamePhase !== 'playing') {
            console.warn('⚠️ Nicht am Zug oder Spiel nicht aktiv');
            return false;
        }
        
        return this.emit('end-turn', {
            gameId: gameState.data.gameSettings.gameId
        });
    }

    requestTurnInfo() {
        if (window.gameState && gameState.data.gameSettings?.gameId) {
            return this.emit('get-turn-info', {
                gameId: gameState.data.gameSettings.gameId
            });
        }
        return false;
    }

    requestGameState() {
        if (window.gameState && gameState.data.gameSettings?.gameId) {
            return this.emit('get-game-state', {
                gameId: gameState.data.gameSettings.gameId
            });
        }
        return false;
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    emit(event, data) {
        if (!this.socket || !this.isConnected) {
            console.warn('⚠️ Socket nicht verbunden, kann Event nicht senden:', event);
            return false;
        }
        
        this.socket.emit(event, data);
        console.log('📤 Socket Event gesendet:', event, data);
        return true;
    }

    startPingMonitoring() {
        if (!this.socket) return;
        
        this.pingInterval = setInterval(() => {
            if (this.socket && this.isConnected) {
                this.socket.emit('ping');
            }
        }, GAME_CONFIG?.PING_INTERVAL || 30000);
    }

    stopPingMonitoring() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // ========================================
    // NOTIFICATION METHODS
    // ========================================

    showNotification(message, type = 'info') {
        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: { message, type }
        }));
    }

    showGameStartMessage(data, isFirstPlayer) {
        const raceName = window.gameState ? (gameState.selectedRace?.name || 'Unbekannt') : 'Unbekannt';
        const startingPlayer = data.currentPlayer;
        
        let message = `🎮 Spiel gestartet!\n\nDu spielst als: ${raceName}\n`;
        
        if (isFirstPlayer) {
            message += 'Du beginnst das Spiel!';
        } else {
            message += `${startingPlayer} beginnt das Spiel.`;
        }
        
        this.showNotification(message, 'success');
    }

    // ========================================
    // PLACEHOLDER EVENT HANDLERS
    // ========================================

    onTurnEnded(data) {
        console.log('⏭️ Turn ended:', data);
        window.dispatchEvent(new CustomEvent('turnEnded', { detail: data }));
    }

    onTurnForced(data) {
        console.log('⏰ Turn forced:', data);
        window.dispatchEvent(new CustomEvent('turnForced', { detail: data }));
    }

    onTurnInfo(data) {
        console.log('ℹ️ Turn info:', data);
        window.dispatchEvent(new CustomEvent('turnInfo', { detail: data }));
    }

    onEndTurnFailed(data) {
        console.error('❌ End turn failed:', data);
        this.showNotification(`Zug beenden fehlgeschlagen: ${data.error}`, 'error');
    }

    onPlayerJoined(data) {
        console.log('👤 Player joined:', data);
        this.showNotification(`${data.player.name} ist beigetreten`, 'info');
    }

    onPlayerLeft(data) {
        console.log('👋 Player left:', data);
        this.showNotification(`${data.playerName} hat das Spiel verlassen`, 'warning');
    }

    onPlayerReadyChanged(data) {
        console.log('✅ Player ready changed:', data);
    }

    onGameSettingsUpdated(data) {
        console.log('⚙️ Game settings updated:', data);
        if (window.gameState) {
            gameState.updateState('gameSettings', data.game);
        }
    }

    onUnitMoved(data) {
        console.log('🚶 Unit moved:', data);
        window.dispatchEvent(new CustomEvent('unitMoved', { detail: data }));
    }

    onUnitAttacked(data) {
        console.log('⚔️ Unit attacked:', data);
        window.dispatchEvent(new CustomEvent('unitAttacked', { detail: data }));
    }

    onServerMessage(data) {
        console.log('📢 Server message:', data.message);
        this.showNotification(data.message, data.type || 'info');
    }

    onError(error) {
        console.error('⚠️ Socket error:', error);
        this.showNotification('Serverfehler aufgetreten', 'error');
    }

    onPong() {
        // Silent pong response
    }

    // ========================================
    // CLEANUP
    // ========================================

    disconnect() {
        this.stopPingMonitoring();
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.isConnected = false;
        if (window.gameState) {
            gameState.setConnectionStatus(false);
        }
        
        console.log('🔌 Socket Manager getrennt');
    }

    // ========================================
    // DEBUG METHODS
    // ========================================

    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            socketId: this.socket?.id,
            reconnectAttempts: this.reconnectAttempts,
            transport: this.socket?.io?.engine?.transport?.name,
            hasSocket: !!this.socket
        };
    }

    forceReconnect() {
        if (this.socket) {
            this.socket.disconnect();
            setTimeout(() => {
                this.socket.connect();
            }, 1000);
        }
    }
}

// ========================================
// GLOBAL INSTANCE
// ========================================

let socketManager = null;

// Initialize after DOM is ready
if (typeof window !== 'undefined') {
    window.SocketManager = SocketManager;
    
    // Auto-initialize when script loads
    document.addEventListener('DOMContentLoaded', () => {
        // Warte bis Game State verfügbar ist
        setTimeout(() => {
            if (!socketManager) {
                socketManager = new SocketManager();
                window.socketManager = socketManager;
            }
        }, 200);
    });
}

console.log('✅ Socket Manager bereit');

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SocketManager };
}