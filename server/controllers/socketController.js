const db = require('../database');

module.exports = (io) => {
    // ✅ TRACKING AKTIVER VERBINDUNGEN
    const activeConnections = new Map(); // gameId -> Set of socket.ids
    
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // ✅ VERBESSERTE JOIN-GAME BEHANDLUNG
        socket.on('join-game', async (data) => {
            const { gameId, playerName } = data;
            
            try {
                // Prüfen ob Spiel existiert
                const gameState = await getGameState(gameId);
                if (!gameState || !gameState.game) {
                    socket.emit('error', { message: 'Game not found' });
                    return;
                }

                // Prüfen ob Spieler bereits im Spiel ist (wichtig für Seitenwechsel)
                const existingPlayer = gameState.players.find(p => p.player_name === playerName);
                
                if (!existingPlayer) {
                    // Spieler ist nicht im Spiel - das ist ein Problem
                    console.warn(`Player ${playerName} trying to join room for game ${gameId} but not in player list`);
                    socket.emit('error', { message: 'You are not a member of this game' });
                    return;
                }

                // ✅ WICHTIG: Bei allen Spiel-Phasen beitreten erlauben
                console.log(`Player ${playerName} joining game ${gameId} in phase: ${gameState.game.status}`);

                // Socket zu Spiel-Room hinzufügen
                socket.join(`game-${gameId}`);
                socket.gameId = gameId;
                socket.playerName = playerName;

                // Aktive Verbindungen tracken
                if (!activeConnections.has(gameId)) {
                    activeConnections.set(gameId, new Set());
                }
                activeConnections.get(gameId).add(socket.id);

                console.log(`Player ${playerName} joined room for game ${gameId} (${gameState.game.status})`);

                // Aktuellen Game State an alle Spieler senden
                const updatedGameState = await getGameState(gameId);
                io.to(`game-${gameId}`).emit('game-state-update', updatedGameState);

                // ✅ SPEZIELLE BEHANDLUNG FÜR RACE SELECTION PHASE
                if (gameState.game.status === 'race_selection') {
                    // Bestätigungsstand senden
                    const confirmedCount = gameState.players.filter(p => p.race_confirmed).length;
                    socket.emit('race-confirmation-update', {
                        confirmedCount,
                        totalPlayers: gameState.players.length
                    });
                }

            } catch (error) {
                console.error('Error in join-game:', error);
                socket.emit('error', { message: 'Failed to join game room' });
            }
        });

        // Player ready toggle
        socket.on('player-ready', async (data) => {
            try {
                const { gameId, playerName, isReady } = data;
                await db.players.updateReady(gameId, playerName, isReady);
                
                const gameState = await getGameState(gameId);
                io.to(`game-${gameId}`).emit('game-state-update', gameState);

                // Check if all players are ready
                const allReady = gameState.players.every(p => p.is_ready);
                if (allReady && gameState.players.length >= 2) {
                    io.to(`game-${gameId}`).emit('all-players-ready');
                }
            } catch (error) {
                console.error('Error updating player ready status:', error);
                socket.emit('error', { message: 'Failed to update ready status' });
            }
        });

        // Start game (only host can do this)
socket.on('start-game', async (data) => {
    try {
        const { gameId, playerName } = data;
        
        console.log(`Starting game ${gameId} by ${playerName}`);
        
        // Verify player is host
        const players = await db.players.findByGame(gameId);
        const player = players.find(p => p.player_name === playerName);
        
        if (!player || !player.is_host) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }

        // Check if all players are ready
        const allReady = players.every(p => p.is_ready);
        if (!allReady || players.length < 2) {
            socket.emit('error', { message: 'Not all players are ready or insufficient players' });
            return;
        }

        console.log(`All ${players.length} players are ready, starting game...`);

        // Update game status BEFORE sending redirect
        await db.games.updateStatus(gameId, 'race_selection');
        
        // Wait a moment to ensure database update is complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('Game status updated to race_selection');
        
        // Send initial race selection state to all players
        const gameState = await getGameState(gameId);
        io.to(`game-${gameId}`).emit('game-state-update', gameState);
        
        // Then notify all players to move to race selection
        io.to(`game-${gameId}`).emit('game-started', { 
            redirectUrl: `/race-selection/${gameId}`,
            gameStatus: 'race_selection'
        });

        console.log(`Game ${gameId} successfully started, players redirected to race selection`);

    } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: 'Failed to start game: ' + error.message });
    }
});

        // Race selection
        socket.on('select-race', async (data) => {
            try {
                const { gameId, playerName, raceId } = data;
                await db.players.updateRace(gameId, playerName, raceId);
                
                const gameState = await getGameState(gameId);
                // Don't broadcast selected races to other players (hidden selection)
                socket.emit('race-selected', { raceId });
            } catch (error) {
                console.error('Error selecting race:', error);
                socket.emit('error', { message: 'Failed to select race' });
            }
        });

        // Confirm race selection
        socket.on('confirm-race', async (data) => {
            try {
                const { gameId, playerName } = data;
                await db.players.confirmRace(gameId, playerName);
                
                const gameState = await getGameState(gameId);
                io.to(`game-${gameId}`).emit('race-confirmation-update', {
                    playerName,
                    confirmedCount: gameState.players.filter(p => p.race_confirmed).length,
                    totalPlayers: gameState.players.length
                });

                // Check if all players have confirmed their races
                const allConfirmed = gameState.players.every(p => p.race_confirmed && p.race_id);
                if (allConfirmed) {
                    // ✅ SPÄTER: Kartengenerierung implementieren
                    // await db.games.updateStatus(gameId, 'playing');
                    // await generateMap(gameId, gameState.game.map_size, gameState.players);
                    
                    // Für jetzt: Direkte Weiterleitung zum Spiel
                    await db.games.updateStatus(gameId, 'playing');
                    
                    io.to(`game-${gameId}`).emit('map-generation-complete', {
                        redirectUrl: `/game/${gameId}`
                    });
                }
            } catch (error) {
                console.error('Error confirming race:', error);
                socket.emit('error', { message: 'Failed to confirm race' });
            }
        });

        // Chat message
        socket.on('send-chat-message', async (data) => {
            try {
                const { gameId, playerName, message } = data;
                await db.chat.addMessage(gameId, playerName, message);
                
                // Broadcast message to all players in the game
                io.to(`game-${gameId}`).emit('chat-message', {
                    playerName,
                    message,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error sending chat message:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Leave game
        socket.on('leave-game', async (data) => {
            try {
                const { gameId, playerName } = data;
                await handlePlayerLeave(gameId, playerName, io, false);
                socket.leave(`game-${gameId}`);
                
                // Remove from active connections
                if (activeConnections.has(gameId)) {
                    activeConnections.get(gameId).delete(socket.id);
                    if (activeConnections.get(gameId).size === 0) {
                        activeConnections.delete(gameId);
                    }
                }
                
            } catch (error) {
                console.error('Error leaving game:', error);
                socket.emit('error', { message: 'Failed to leave game' });
            }
        });

        // Game actions (for game.html)
        socket.on('end-turn', async (data) => {
            try {
                const { gameId, playerName } = data;
                
                // Get current game state
                const game = await db.games.findById(gameId);
                const players = await db.players.findByGame(gameId);
                
                // Find next player
                const currentPlayerIndex = players.findIndex(p => p.id === game.current_player_turn);
                const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
                const nextPlayer = players[nextPlayerIndex];
                
                // Update current turn
                const newTurn = nextPlayerIndex === 0 ? game.current_turn + 1 : game.current_turn;
                await db.games.updateCurrentTurn(gameId, newTurn, nextPlayer.id);
                
                // Give gold to next player based on buildings
                await givePlayerIncome(gameId, nextPlayer.id);
                
                // Broadcast turn change
                io.to(`game-${gameId}`).emit('turn-changed', {
                    currentPlayer: nextPlayer.player_name,
                    turn: newTurn
                });
                
            } catch (error) {
                console.error('Error ending turn:', error);
                socket.emit('error', { message: 'Failed to end turn' });
            }
        });

        // ✅ VERBESSERTE DISCONNECT BEHANDLUNG
        socket.on('disconnect', (reason) => {
            console.log('User disconnected:', socket.id, 'Reason:', reason);
            
            // Remove from active connections
            if (socket.gameId && activeConnections.has(socket.gameId)) {
                activeConnections.get(socket.gameId).delete(socket.id);
                if (activeConnections.get(socket.gameId).size === 0) {
                    activeConnections.delete(socket.gameId);
                }
            }
            
            // Only handle as leave if it's not a client-side disconnect (page refresh)
            if (socket.gameId && socket.playerName && reason !== 'client namespace disconnect') {
                // Use setTimeout to allow for reconnection attempts
                setTimeout(async () => {
                    try {
                        // Check if player has reconnected
                        const hasReconnected = activeConnections.has(socket.gameId) && 
                            Array.from(activeConnections.get(socket.gameId)).some(socketId => {
                                const connectedSocket = io.sockets.sockets.get(socketId);
                                return connectedSocket && connectedSocket.playerName === socket.playerName;
                            });
                        
                        if (!hasReconnected) {
                            console.log(`Player ${socket.playerName} did not reconnect, handling as disconnect`);
                            await handlePlayerLeave(socket.gameId, socket.playerName, io, true);
                        } else {
                            console.log(`Player ${socket.playerName} successfully reconnected`);
                        }
                    } catch (error) {
                        console.error('Error handling disconnect cleanup:', error);
                    }
                }, 15000); // 15 seconds grace period for reconnection
            }
        });
    });

    // ✅ VERBESSERTE HELPER FUNCTIONS

    // Verbesserte handlePlayerLeave Funktion
    async function handlePlayerLeave(gameId, playerName, io, isDisconnect = false) {
        try {
            console.log(`Handling player leave: ${playerName} from game ${gameId} (disconnect: ${isDisconnect})`);

            // Get current game state BEFORE removing player
            const gameStateBefore = await getGameState(gameId);
            if (!gameStateBefore || !gameStateBefore.players) {
                console.log('Game not found or no players');
                return;
            }

            // Find the leaving player
            const leavingPlayer = gameStateBefore.players.find(p => p.player_name === playerName);
            if (!leavingPlayer) {
                console.log('Player not found in game');
                return;
            }

            const wasHost = leavingPlayer.is_host;
            console.log(`Player ${playerName} was host: ${wasHost}`);

            // Use the improved database function for safe removal
            const removeResult = await db.players.removeWithHostTransfer(gameId, playerName);
            
            if (!removeResult.success) {
                console.error('Failed to remove player:', removeResult.error);
                return;
            }

            console.log(`Remaining players: ${removeResult.remainingPlayerCount}`);

            if (removeResult.remainingPlayerCount === 0) {
                // Delete the game
                await db.games.deleteGame(gameId);
                console.log(`Game ${gameId} deleted - no players remaining`);
                return;
            }

            // Get updated game state after player removal
            const gameStateAfter = await getGameState(gameId);
            
            if (removeResult.hostTransfer) {
                console.log(`Host transferred to: ${removeResult.hostTransfer.newHostName}`);
                
                // Notify all remaining players
                io.to(`game-${gameId}`).emit('player-left', { 
                    playerName,
                    gameState: gameStateAfter,
                    newHost: removeResult.hostTransfer.newHostName,
                    wasHost: true,
                    disconnected: isDisconnect
                });
                
                io.to(`game-${gameId}`).emit('new-host-assigned', {
                    newHostName: removeResult.hostTransfer.newHostName,
                    message: `${removeResult.hostTransfer.newHostName} ist jetzt der neue Host! ${isDisconnect ? `(${playerName} ist disconnected)` : ''}`
                });
            } else {
                // Normal player left (not host)
                io.to(`game-${gameId}`).emit('player-left', { 
                    playerName,
                    gameState: gameStateAfter,
                    wasHost: false,
                    disconnected: isDisconnect
                });
            }

        } catch (error) {
            console.error('Error in handlePlayerLeave:', error);
            throw error;
        }
    }

    // Bestehende Helper-Funktionen
    async function getGameState(gameId) {
        const game = await db.games.findById(gameId);
        const players = await db.players.findByGame(gameId);
        
        return {
            game,
            players
        };
    }

    async function generateMap(gameId, mapSize, players) {
        const [width, height] = mapSize.split('x').map(Number);
        const mapGenerator = require('../utils/mapGenerator');
        
        try {
            await mapGenerator.generateMap(gameId, width, height, players);
        } catch (error) {
            console.error('Error generating map:', error);
            throw error;
        }
    }

    async function givePlayerIncome(gameId, playerId) {
        try {
            // This would calculate income based on buildings owned
            // For now, give base income of 100 gold per turn
            const player = await db.query('SELECT gold FROM game_players WHERE id = ?', [playerId]);
            const currentGold = player[0]?.gold || 0;
            const newGold = currentGold + 100; // Base income
            
            await db.query('UPDATE game_players SET gold = ? WHERE id = ?', [newGold, playerId]);
        } catch (error) {
            console.error('Error giving player income:', error);
        }
    }
};