const db = require('../database');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Join a game room
        socket.on('join-game', async (data) => {
            const { gameId, playerName } = data;
            socket.join(`game-${gameId}`);
            socket.gameId = gameId;
            socket.playerName = playerName;

            try {
                // Get updated game state and broadcast to all players in the game
                const gameState = await getGameState(gameId);
                io.to(`game-${gameId}`).emit('game-state-update', gameState);
            } catch (error) {
                console.error('Error joining game:', error);
                socket.emit('error', { message: 'Failed to join game' });
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
                
                // Verify player is host
                const players = await db.players.findByGame(gameId);
                const player = players.find(p => p.player_name === playerName);
                
                if (!player || !player.is_host) {
                    socket.emit('error', { message: 'Only the host can start the game' });
                    return;
                }

                // Check if all players are ready
                const allReady = players.every(p => p.is_ready);
                if (!allReady) {
                    socket.emit('error', { message: 'Not all players are ready' });
                    return;
                }

                // Update game status to race selection
                await db.games.updateStatus(gameId, 'race_selection');
                
                // Notify all players to move to race selection
                io.to(`game-${gameId}`).emit('game-started', { 
                    redirectUrl: `/race-selection/${gameId}`
                });

            } catch (error) {
                console.error('Error starting game:', error);
                socket.emit('error', { message: 'Failed to start game' });
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
                    // Start map generation and move to game
                    await db.games.updateStatus(gameId, 'playing');
                    await generateMap(gameId, gameState.game.map_size, gameState.players);
                    
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
                
                // Remove player from database
                await db.players.removeFromGame(gameId, playerName);
                
                // Leave socket room
                socket.leave(`game-${gameId}`);
                
                // Update game state for remaining players
                const gameState = await getGameState(gameId);
                io.to(`game-${gameId}`).emit('player-left', { 
                    playerName,
                    gameState 
                });

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

        // Disconnect handler
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            
            // If user was in a game, handle it as leaving the game
            if (socket.gameId && socket.playerName) {
                // Use setTimeout to allow for reconnection attempts
                setTimeout(async () => {
                    try {
                        // Check if player is still in game (might have reconnected)
                        const gameState = await getGameState(socket.gameId);
                        const playerStillInGame = gameState?.players?.find(p => p.player_name === socket.playerName);
                        
                        if (playerStillInGame) {
                            // Auto-leave the game after disconnect timeout
                            const leavingPlayer = playerStillInGame;
                            const wasHost = leavingPlayer.is_host || false;
                            
                            // Remove player from database
                            await db.players.removeFromGame(socket.gameId, socket.playerName);
                            
                            // Check remaining player count
                            const remainingPlayerCount = await db.games.getPlayerCount(socket.gameId);
                            
                            if (remainingPlayerCount === 0) {
                                // Delete the game
                                await db.games.deleteGame(socket.gameId);
                                console.log(`Game ${socket.gameId} deleted after disconnect - no players remaining`);
                            } else {
                                // Handle host reassignment if needed
                                if (wasHost) {
                                    const updatedGameState = await getGameState(socket.gameId);
                                    if (updatedGameState.players.length > 0) {
                                        const newHost = updatedGameState.players[0];
                                        await db.query(
                                            'UPDATE game_players SET is_host = TRUE WHERE game_id = ? AND id = ?', 
                                            [socket.gameId, newHost.id]
                                        );
                                        
                                        const finalGameState = await getGameState(socket.gameId);
                                        
                                        io.to(`game-${socket.gameId}`).emit('player-left', { 
                                            playerName: socket.playerName,
                                            gameState: finalGameState,
                                            newHost: newHost.player_name,
                                            wasHost: true,
                                            disconnected: true
                                        });
                                        
                                        io.to(`game-${socket.gameId}`).emit('new-host-assigned', {
                                            newHostName: newHost.player_name,
                                            message: `${newHost.player_name} ist jetzt der neue Host! (${socket.playerName} ist disconnected)`
                                        });
                                    }
                                } else {
                                    const updatedGameState = await getGameState(socket.gameId);
                                    io.to(`game-${socket.gameId}`).emit('player-left', { 
                                        playerName: socket.playerName,
                                        gameState: updatedGameState,
                                        wasHost: false,
                                        disconnected: true
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error handling disconnect cleanup:', error);
                    }
                }, 10000); // 10 seconds grace period for reconnection
            }
        });
    });

    // Helper functions
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