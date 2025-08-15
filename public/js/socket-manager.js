// socket-manager.js - Socket.io Verbindungsmanagement

console.log('🔌 Initialisiere Socket Manager...');

// ========================================
// SOCKET MANAGER CLASS
// ========================================

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = GAME_CONFIG.RECONNECT_ATTEMPTS;
        this.reconnectDelay = GAME_CONFIG.RECONNECT_DELAY;
        this.pingInterval = null;
        
        this.initSocket();
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
            
            gameState.setSocket(this.socket);
            this.setupEventListeners();
            this.startPingMonitoring();
            
            console.log('✅ Socket.io initialisiert');
        } catch (error) {
            console.error('❌ Socket.io Fehler:', error);
            this.showNotification('Fehler beim Verbinden zum Server', NOTIFICATION_TYPES.ERROR);
        }
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    setupEventListeners() {
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
        
        gameState.setConnectionStatus(true);
        this.showNotification('Verbunden!', NOTIFICATION_TYPES.SUCCESS);
        
        // Request current game state if in a game
        if (gameState.gameSettings?.gameId) {
            this.requestTurnInfo();
        }
    }

    onDisconnect(reason) {
        console.log('❌ Verbindung zum Server getrennt:', reason);
        this.isConnected = false;
        
        gameState.setConnectionStatus(false);
        
        if (reason === 'io server disconnect') {
            this.showNotification('Server hat Verbindung getrennt', NOTIFICATION_TYPES.WARNING);
        } else {
            this.showNotification('Verbindung verloren - Versuche Wiederverbindung...', NOTIFICATION_TYPES.WARNING);
        }
    }

    onConnectError(error) {
        console.error('🔌 Verbindungsfehler:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            this.showNotification(
                `Verbindungsfehler - Versuch ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, 
                NOTIFICATION_TYPES.WARNING
            );
        } else {
            this.showNotification('Verbindung fehlgeschlagen - Bitte Seite neu laden', NOTIFICATION_TYPES.ERROR);
        }
    }

    onReconnect(attemptNumber) {
        console.log('🔄 Erfolgreich wieder verbunden nach', attemptNumber, 'Versuchen');
        this.showNotification('Wieder verbunden!', NOTIFICATION_TYPES.SUCCESS);
        
        // Request current game state
        if (gameState.gameSettings?.gameId) {
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
            NOTIFICATION_TYPES.ERROR
        );
    }

    // ========================================
    // GAME EVENT HANDLERS
    // ========================================

    onGameStarted(data) {
        console.log('🎮 Spiel gestartet, wechsle zu Rassen-Auswahl');
        gameState.setGamePhase(GAME_PHASES.RACE_SELECTION);
        
        // Trigger race selection modal
        window.dispatchEvent(new CustomEvent('showRaceSelection'));
        
        this.showNotification('Spiel gestartet! Wähle deine Rasse.', NOTIFICATION_TYPES.INFO);
    }

    onRaceSelected(data) {
        console.log('🏛️ Spieler hat Rasse gewählt:', data.playerName, data.raceId);
        gameState.setOtherPlayerRace(data.playerName, data.raceId);
        
        // Update race selection UI
        window.dispatchEvent(new CustomEvent('raceSelectionUpdate', { detail: data }));
        
        this.showNotification(`${data.playerName} hat eine Rasse gewählt`, NOTIFICATION_TYPES.INFO);
    }

    onRaceSelectionFailed(data) {
        console.error('❌ Rassen-Auswahl fehlgeschlagen:', data.error);
        this.showNotification(`Rassen-Auswahl fehlgeschlagen: ${data.error}`, NOTIFICATION_TYPES.ERROR);
        
        // Re-enable race selection
        window.dispatchEvent(new CustomEvent('raceSelectionFailed', { detail: data }));
    }

    onAllRacesSelected(data) {
        console.log('🎯 Alle Rassen gewählt, Spiel beginnt!');
        gameState.setGamePhase(GAME_PHASES.PLAYING);
        gameState.setTurnData({
            turnOrder: data.turnOrder,
            currentPlayer: data.currentPlayer,
            turnNumber: 1,
            timeRemaining: GAME_CONFIG.TURN_TIME_LIMIT
        });
        
        // Hide race selection and show game
        window.dispatchEvent(new CustomEvent('hideRaceSelection'));
        window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
        
        const isFirstPlayer = data.currentPlayer === gameState.currentPlayer?.name;
        this.showGameStartMessage(data, isFirstPlayer);
    }

    // ========================================
    // TURN SYSTEM EVENT HANDLERS
    // ========================================

    onTurnEnded(data) {
        console.log('⏭️ Zug beendet:', data.previousPlayer, '->', data.currentPlayer);
        
        gameState.setTurnData({
            currentPlayer: data.currentPlayer,
            turnNumber: data.turnNumber,
            timeRemaining: GAME_CONFIG.TURN_TIME_LIMIT
        });
        
        // Reset turn state
        gameState.nextTurn();
        
        // Update UI
        window.dispatchEvent(new CustomEvent('turnChanged', { detail: data }));
        
        this.showTurnChangeMessage(data);
    }

    onTurnForced(data) {
        console.log('⏰ Zug erzwungen:', data.message);
        
        gameState.setTurnData({
            currentPlayer: data.currentPlayer,
            turnNumber: data.turnNumber,
            timeRemaining: GAME_CONFIG.TURN_TIME_LIMIT
        });
        
        window.dispatchEvent(new CustomEvent('turnForced', { detail: data }));
        this.showNotification(data.message, NOTIFICATION_TYPES.WARNING);
    }

    onTurnInfo(data) {
        gameState.setTurnData({
            currentPlayer: data.currentPlayer,
            turnNumber: data.turnNumber,
            timeRemaining: data.remainingTime
        });
        
        window.dispatchEvent(new CustomEvent('turnInfoUpdate', { detail: data }));
    }

    onEndTurnFailed(data) {
        console.error('❌ Zug beenden fehlgeschlagen:', data.error);
        this.showNotification(`Zug beenden fehlgeschlagen: ${data.error}`, NOTIFICATION_TYPES.ERROR);
    }

    // ========================================
    // PLAYER EVENT HANDLERS
    // ========================================

    onPlayerJoined(data) {
        console.log('👤 Spieler beigetreten:', data.player.name);
        this.showNotification(`${data.player.name} ist beigetreten`, NOTIFICATION_TYPES.INFO);
        
        window.dispatchEvent(new CustomEvent('playerJoined', { detail: data }));
    }

    onPlayerLeft(data) {
        console.log('👋 Spieler hat verlassen:', data.playerName);
        this.showNotification(`${data.playerName} hat das Spiel verlassen`, NOTIFICATION_TYPES.WARNING);
        
        window.dispatchEvent(new CustomEvent('playerLeft', { detail: data }));
    }

    onPlayerReadyChanged(data) {
        const status = data.player.ready ? 'bereit' : 'nicht bereit';
        console.log(`${data.player.name} ist ${status}`);
        
        window.dispatchEvent(new CustomEvent('playerReadyChanged', { detail: data }));
    }

    // ========================================
    // GAME STATE EVENT HANDLERS
    // ========================================

    onGameSettingsUpdated(data) {
        console.log('⚙️ Spieleinstellungen aktualisiert');
        gameState.updateState('gameSettings', data.game);
        
        window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: data }));
    }

    onUnitMoved(data) {
        console.log('🚶 Einheit bewegt:', data.unitId, 'nach', data.newPosition);
        
        // Update unit position in game state
        gameState.updateUnit(data.unitId, {
            x: data.newPosition.x,
            y: data.newPosition.y,
            hasMoved: true
        });
        
        window.dispatchEvent(new CustomEvent('unitMoved', { detail: data }));
    }

    onUnitAttacked(data) {
        console.log('⚔️ Einheit angegriffen:', data.attackerId, '->', data.defenderId);
        
        window.dispatchEvent(new CustomEvent('unitAttacked', { detail: data }));
        
        if (data.defenderDestroyed) {
            this.showNotification(`${data.defenderName} wurde zerstört!`, NOTIFICATION_TYPES.WARNING);
        }
    }

    // ========================================
    // MISC EVENT HANDLERS
    // ========================================

    onServerMessage(data) {
        console.log('📢 Server-Nachricht:', data.message);
        this.showNotification(data.message, data.type || NOTIFICATION_TYPES.INFO);
    }

    onError(error) {
        console.error('⚠️ Socket Fehler:', error);
        this.showNotification('Serverfehler aufgetreten', NOTIFICATION_TYPES.ERROR);
    }

    onPong() {
        // Silent pong response
    }

    // ========================================
    // OUTGOING SOCKET METHODS
    // ========================================

    selectRace(raceId) {
        if (gameState.gamePhase !== GAME_PHASES.RACE_SELECTION) {
            console.warn('⚠️ Rassen-Auswahl nicht aktiv');
            return false;
        }
        
        this.emit('select-race', {
            gameId: gameState.gameSettings.gameId,
            raceId: raceId
        });
        
        return true;
    }

    endTurn() {
        if (!gameState.isMyTurn || gameState.gamePhase !== GAME_PHASES.PLAYING) {
            console.warn('⚠️ Nicht am Zug oder Spiel nicht aktiv');
            return false;
        }
        
        this.emit('end-turn', {
            gameId: gameState.gameSettings.gameId
        });
        
        return true;
    }

    moveUnit(unitId, newPosition) {
        this.emit('move-unit', {
            gameId: gameState.gameSettings.gameId,
            unitId: unitId,
            newPosition: newPosition
        });
    }

    attackUnit(attackerId, defenderId) {
        this.emit('attack-unit', {
            gameId: gameState.gameSettings.gameId,
            attackerId: attackerId,
            defenderId: defenderId
        });
    }

    buyUnit(unitType, position) {
        this.emit('buy-unit', {
            gameId: gameState.gameSettings.gameId,
            unitType: unitType,
            position: position
        });
    }

    upgradeUnit(unitId) {
        this.emit('upgrade-unit', {
            gameId: gameState.gameSettings.gameId,
            unitId: unitId
        });
    }

    requestTurnInfo() {
        if (gameState.gameSettings?.gameId) {
            this.emit('get-turn-info', {
                gameId: gameState.gameSettings.gameId
            });
        }
    }

    requestGameState() {
        if (gameState.gameSettings?.gameId) {
            this.emit('get-game-state', {
                gameId: gameState.gameSettings.gameId
            });
        }
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
        this.pingInterval = setInterval(() => {
            if (this.socket && this.isConnected) {
                this.socket.emit('ping');
            }
        }, GAME_CONFIG.PING_INTERVAL);
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

    showNotification(message, type = NOTIFICATION_TYPES.INFO) {
        window.dispatchEvent(new CustomEvent('showNotification', {
            detail: { message, type }
        }));
    }

    showGameStartMessage(data, isFirstPlayer) {
        const raceName = gameState.selectedRace?.name || 'Unbekannt';
        const startingPlayer = data.currentPlayer;
        
        let message = `🎮 Spiel gestartet!\n\nDu spielst als: ${raceName}\n`;
        
        if (isFirstPlayer) {
            message += 'Du beginnst das Spiel!';
        } else {
            message += `${startingPlayer} beginnt das Spiel.`;
        }
        
        this.showNotification(message, NOTIFICATION_TYPES.SUCCESS);
    }

    showTurnChangeMessage(data) {
        const isMyTurn = data.currentPlayer === gameState.currentPlayer?.name;
        
        if (isMyTurn) {
            this.showNotification(
                `🎯 Du bist dran! (Runde ${data.turnNumber})`, 
                NOTIFICATION_TYPES.SUCCESS
            );
        } else {
            this.showNotification(
                `⏳ ${data.currentPlayer} ist dran`, 
                NOTIFICATION_TYPES.INFO
            );
        }
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
        gameState.setConnectionStatus(false);
        
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
            transport: this.socket?.io?.engine?.transport?.name
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
        if (!socketManager) {
            socketManager = new SocketManager();
            window.socketManager = socketManager;
        }
    });
}

console.log('✅ Socket Manager bereit');

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SocketManager };
}