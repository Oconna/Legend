// socket-manager.js - Socket.io Verbindungsmanagement (Syntaxfehler behoben)

console.log('🔌 Initialisiere Socket Manager...');

// ========================================
// SOCKET MANAGER CLASS
// ========================================

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = (window.GAME_CONFIG && window.GAME_CONFIG.RECONNECT_ATTEMPTS) || 5;
        this.reconnectDelay = (window.GAME_CONFIG && window.GAME_CONFIG.RECONNECT_DELAY) || 2000;
        this.pingInterval = null;
        this.mapSyncEnabled = true;
        this.pendingMapRequest = false;
        
        this.initSocket();
    }

    // ========================================
    // SOCKET INITIALIZATION
    // ========================================

    initSocket() {
        if (this.socket && this.isConnected) {
            console.log('🔌 Bereits verbunden, überspringe Socket-Initialisierung');
            return;
        }
        
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

        // Game flow events
        this.socket.on('game-started', (data) => this.onGameStarted(data));
        this.socket.on('race-selection-phase', (data) => this.onRaceSelectionPhase(data));
        this.socket.on('all-races-selected', (data) => this.onAllRacesSelected(data));
        this.socket.on('game-phase-changed', (data) => this.onGamePhaseChanged(data));
        this.socket.on('game-joined', (data) => this.onGameJoined(data));
        
        // Game state events
        this.socket.on('game-state', (data) => this.onGameState(data));
        this.socket.on('game-state-failed', (data) => this.onGameStateFailed(data));

        // Neue Event-Listener für Kartensynchronisation
        this.socket.on('game-map-ready', (data) => this.onGameMapReady(data));
        this.socket.on('map-data', (data) => this.onMapData(data));
        this.socket.on('map-request-failed', (data) => this.onMapRequestFailed(data));
        this.socket.on('race-selection-phase', (data) => this.onRaceSelectionPhase(data));
        
        // Turn system events
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
        this.showNotification('Mit Server verbunden!', 'success');
        
        // Automatically join the game if we have game settings
        if (window.gameState && gameState.data.gameSettings && gameState.data.gameSettings.gameId) {
            console.log('🎮 Automatisch Spiel beitreten...');
            this.emit('join-game', {
                gameId: gameState.data.gameSettings.gameId,
                player: gameState.data.gameSettings.currentPlayer
            });
        }
        
        // Request current game state if in a game
        if (window.gameState && gameState.data.gameSettings && gameState.data.gameSettings.gameId) {
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
        if (window.gameState && gameState.data.gameSettings && gameState.data.gameSettings.gameId) {
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


    // Neue Event-Handler für Kartensynchronisation
    onGameMapReady(data) {
        console.log('🗺️ Server-Karte empfangen:', data);
        
        if (data.success && data.map) {
            // Lade Server-Karte in Map-System
            if (window.mapSystem) {
                const success = window.mapSystem.loadServerMap(data.map);
                if (success) {
                    console.log('✅ Server-Karte erfolgreich geladen');
                    
                    // Update Game State
                    if (window.gameState) {
                        gameState.setMapData(data.map);
                        gameState.setGamePhase('playing');
                    }
                    
                    // Benachrichtige Game Controller
                    if (window.gameController) {
                        gameController.onMapReady(data);
                    }
                    
                    this.showNotification('Karte synchronisiert! Das Spiel beginnt.');
                } else {
                    console.error('❌ Fehler beim Laden der Server-Karte');
                    this.showNotification('Fehler beim Laden der Karte!', 'error');
                }
            }
        } else {
            console.error('❌ Ungültige Kartendaten:', data);
            this.showNotification('Fehler: Ungültige Kartendaten', 'error');
        }
    }

    onMapData(data) {
        console.log('📥 Kartendaten empfangen:', data);
        this.pendingMapRequest = false;
        
        if (data.success && data.map) {
            if (window.mapSystem) {
                window.mapSystem.loadServerMap(data.map);
                this.showNotification('Karte synchronisiert!');
            }
        }
    }

    onMapRequestFailed(data) {
        console.warn('⚠️ Karten-Anfrage fehlgeschlagen:', data.error);
        this.pendingMapRequest = false;
        this.showNotification('Kartensynchronisation fehlgeschlagen', 'warning');
    }

    onRaceSelectionPhase(data) {
        console.log('🏛️ Rassenauswahl-Phase gestartet:', data);
        
        // Aktualisiere Game State
        if (window.gameState) {
            gameState.setGamePhase('race_selection');
        }
        
        // Starte Rassenauswahl UI
        if (window.gameController && window.gameController.raceSelection) {
            setTimeout(() => {
                gameController.raceSelection.show();
            }, 500);
        }
    }

    // Neue Methoden
    requestMap(gameId) {
        if (this.pendingMapRequest) {
            console.log('⏳ Karten-Anfrage bereits ausstehend...');
            return;
        }
        
        console.log('📡 Fordere Karte vom Server an...');
        this.pendingMapRequest = true;
        this.socket.emit('request-map', { gameId });
    }

    selectRace(gameId, raceId) {
        console.log(`🏛️ Sende Rassenauswahl: ${raceId} für Spiel ${gameId}`);
        this.socket.emit('select-race', { gameId, raceId });
    }
}

    onGameStarted(data) {
        console.log('🎮 Spiel gestartet:', data);
        
        // Update game state
        if (window.gameState) {
            gameState.setGamePhase('race_selection');
        }
        
        // Ensure race selection is ready before dispatching event
        if (window.raceSelection && window.raceSelection.isInitialized) {
            console.log('🏛️ Race Selection bereit, dispatche showRaceSelection Event');
            window.dispatchEvent(new CustomEvent('showRaceSelection'));
        } else {
            console.warn('⚠️ Race Selection nicht bereit, warte...');
            setTimeout(() => {
                if (window.raceSelection && window.raceSelection.isInitialized) {
                    console.log('🏛️ Race Selection jetzt bereit, dispatche showRaceSelection Event');
                    window.dispatchEvent(new CustomEvent('showRaceSelection'));
                } else {
                    console.error('❌ Race Selection immer noch nicht bereit');
                }
            }, 1000);
        }
        
        // Dispatch gameStarted event with map data if available
        if (data.map) {
            window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
        }
    }

    onRaceSelectionPhase(data) {
        console.log('🏛️ Rassen-Auswahl Phase beginnt', data);
        if (window.gameState) {
            gameState.setGamePhase('race_selection');
        }
        
        // Ensure race selection is ready before dispatching event
        if (window.raceSelection && window.raceSelection.isInitialized) {
            console.log('🏛️ Race Selection bereit, dispatche showRaceSelection Event');
            window.dispatchEvent(new CustomEvent('showRaceSelection'));
        } else {
            console.warn('⚠️ Race Selection nicht bereit, warte...');
            setTimeout(() => {
                if (window.raceSelection && window.raceSelection.isInitialized) {
                    console.log('🏛️ Race Selection jetzt bereit, dispatche showRaceSelection Event');
                    window.dispatchEvent(new CustomEvent('showRaceSelection'));
                } else {
                    console.error('❌ Race Selection immer noch nicht bereit');
                }
            }, 1000);
        }
    }

    onGamePhaseChanged(data) {
        console.log('🔄 Spielphase geändert:', data);
        if (window.gameState) {
            gameState.setGamePhase(data.phase);
        }
    }

    onGameState(data) {
        console.log('📊 Spielstand vom Server erhalten:', data);
        
        // Update game state
        if (window.gameState) {
            gameState.updateFromServer(data);
        }
        
        // Load map if available
        if (data.map && window.mapSystem) {
            console.log('🗺️ Lade Karte vom Spielstand...');
            window.mapSystem.loadServerMap(data.map);
        }
        
        this.showNotification('Spielstand geladen', 'info');
    }

    onGameStateFailed(data) {
        console.error('❌ Spielstand konnte nicht geladen werden:', data.error);
        
        // Don't show error notification for "Spiel nicht gefunden" during initial setup
        if (data.error === 'Spiel nicht gefunden' && !this.gameStateRequested) {
            console.warn('⚠️ Spiel noch nicht auf Server verfügbar, das ist normal beim Start');
            return;
        }
        
        this.showNotification(`Spielstand konnte nicht geladen werden: ${data.error}`, 'error');
        
        // Dispatch event for game controller to handle
        window.dispatchEvent(new CustomEvent('gameStateFailed', { detail: data }));
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
                timeRemaining: (window.GAME_CONFIG && window.GAME_CONFIG.TURN_TIME_LIMIT) || 120
            });
        }
        
        // Hide race selection and show game
        window.dispatchEvent(new CustomEvent('hideRaceSelection'));
        window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
        
        // If map data is available, trigger map loading
        if (data.map) {
            console.log('🗺️ Karte vom Server erhalten (alle Rassen gewählt), lade in Map System...');
            window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
        }
        
        const isFirstPlayer = data.currentPlayer === (window.gameState ? gameState.currentPlayer.name : null);
        this.showGameStartMessage(data, isFirstPlayer);
    }

    onGameJoined(data) {
        console.log('🎉 Spiel erfolgreich beigetreten:', data);
        this.showNotification('Spiel erfolgreich beigetreten!', 'success');
        
        // Update game state if available
        if (window.gameState && data.game) {
            gameState.updateFromServer(data.game);
        }
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('gameJoined', { detail: data }));
    }

    // ========================================
    // TURN SYSTEM EVENT HANDLERS
    // ========================================

    onTurnEnded(data) {
        console.log('⏭️ Turn ended:', data);
        window.dispatchEvent(new CustomEvent('turnEnded', { detail: data }));
    }

    onTurnForced(data) {
        console.log('⏰ Turn forced:', data);
        window.dispatchEvent(new CustomEvent('turnForced', { detail: data }));
        this.showNotification(data.message, 'warning');
    }

    onTurnInfo(data) {
        console.log('ℹ️ Turn info:', data);
        if (window.gameState) {
            gameState.setTurnData({
                currentPlayer: data.currentPlayer,
                turnNumber: data.turnNumber,
                isMyTurn: data.currentPlayer === gameState.currentPlayer.name,
                timeRemaining: data.remainingTime
            });
        }
        window.dispatchEvent(new CustomEvent('turnInfo', { detail: data }));
    }

    onEndTurnFailed(data) {
        console.error('❌ End turn failed:', data);
        this.showNotification(`Zug beenden fehlgeschlagen: ${data.error}`, 'error');
    }

    // ========================================
    // PLAYER EVENT HANDLERS
    // ========================================

    onPlayerJoined(data) {
        console.log('👤 Player joined:', data);
        this.showNotification(`${data.player.name} ist beigetreten`, 'info');
        window.dispatchEvent(new CustomEvent('playerJoined', { detail: data }));
    }

    onPlayerLeft(data) {
        console.log('👋 Player left:', data);
        this.showNotification(`${data.playerName} hat das Spiel verlassen`, 'warning');
        window.dispatchEvent(new CustomEvent('playerLeft', { detail: data }));
    }

    onPlayerReadyChanged(data) {
        console.log('✅ Player ready changed:', data);
        const status = data.player.ready ? 'bereit' : 'nicht bereit';
        this.showNotification(`${data.player.name} ist ${status}`, 'info');
        window.dispatchEvent(new CustomEvent('playerReadyChanged', { detail: data }));
    }

    // ========================================
    // GAME STATE EVENT HANDLERS
    // ========================================

    onGameSettingsUpdated(data) {
        console.log('⚙️ Game settings updated:', data);
        if (window.gameState) {
            gameState.updateState('gameSettings', data.game);
        }
        this.showNotification('Spieleinstellungen aktualisiert', 'info');
        window.dispatchEvent(new CustomEvent('gameSettingsUpdated', { detail: data }));
    }

    onUnitMoved(data) {
        console.log('🚶 Unit moved:', data);
        window.dispatchEvent(new CustomEvent('unitMoved', { detail: data }));
    }

    onUnitAttacked(data) {
        console.log('⚔️ Unit attacked:', data);
        if (data.defenderDestroyed) {
            this.showNotification(`⚔️ ${data.defenderName || 'Einheit'} wurde zerstört!`, 'warning');
        }
        window.dispatchEvent(new CustomEvent('unitAttacked', { detail: data }));
    }

    // ========================================
    // MISC EVENT HANDLERS
    // ========================================

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
            gameId: gameState.data.gameSettings.gameId,
            playerId: gameState.currentPlayer.id
        });
    }

    moveUnit(unitId, fromX, fromY, toX, toY) {
        return this.emit('move-unit', {
            gameId: window.gameState ? gameState.data.gameSettings.gameId : null,
            unitId: unitId,
            fromX: fromX,
            fromY: fromY,
            toX: toX,
            toY: toY
        });
    }

    attackUnit(attackerId, defenderId) {
        return this.emit('attack-unit', {
            gameId: window.gameState ? gameState.data.gameSettings.gameId : null,
            attackerId: attackerId,
            defenderId: defenderId
        });
    }

    buyUnit(unitType, x, y) {
        return this.emit('buy-unit', {
            gameId: window.gameState ? gameState.data.gameSettings.gameId : null,
            unitType: unitType,
            x: x,
            y: y
        });
    }

    upgradeUnit(unitId) {
        return this.emit('upgrade-unit', {
            gameId: window.gameState ? gameState.data.gameSettings.gameId : null,
            unitId: unitId
        });
    }

    requestTurnInfo() {
        if (window.gameState && gameState.data.gameSettings && gameState.data.gameSettings.gameId) {
            return this.emit('get-turn-info', {
                gameId: gameState.data.gameSettings.gameId
            });
        }
        return false;
    }

    requestGameState() {
        if (!window.gameState) {
            console.warn('⚠️ GameState nicht verfügbar');
            return false;
        }
        
        if (!gameState.data.gameSettings) {
            console.warn('⚠️ Keine Spiel-Einstellungen verfügbar');
            return false;
        }
        
        if (!gameState.data.gameSettings.gameId) {
            console.warn('⚠️ Keine Game ID verfügbar');
            return false;
        }
        
        console.log('📡 Fordere Spielstand an für Game ID:', gameState.data.gameSettings.gameId);
        
        if (window.gameState && gameState.data.gameSettings && gameState.data.gameSettings.gameId) {
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
        }, (window.GAME_CONFIG && window.GAME_CONFIG.PING_INTERVAL) || 30000);
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
        const raceName = window.gameState ? (gameState.selectedRace ? gameState.selectedRace.name : 'Unbekannt') : 'Unbekannt';
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
            socketId: this.socket ? this.socket.id : null,
            reconnectAttempts: this.reconnectAttempts,
            transport: this.socket && this.socket.io && this.socket.io.engine ? this.socket.io.engine.transport.name : null,
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