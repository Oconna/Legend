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
                await handlePlayerLeave(gameId, playerName, io, false);
                socket.leave(`game-${gameId}`);
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
                        await handlePlayerLeave(socket.gameId, socket.playerName, io, true);
                    } catch (error) {
                        console.error('Error handling disconnect cleanup:', error);
                    }
                }, 10000); // 10 seconds grace period for reconnection
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

            // Remove player from database
            await db.players.removeFromGame(gameId, playerName);

            // Check remaining player count
            const remainingPlayerCount = await db.games.getPlayerCount(gameId);
            console.log(`Remaining players: ${remainingPlayerCount}`);

            if (remainingPlayerCount === 0) {
                // Delete the game
                await db.games.deleteGame(gameId);
                console.log(`Game ${gameId} deleted - no players remaining`);
                return;
            }

            // Get updated game state after player removal
            const gameStateAfter = await getGameState(gameId);
            
            if (wasHost && gameStateAfter.players.length > 0) {
                // Transfer host to next player
                const newHost = await transferHostStatus(gameId, gameStateAfter.players);
                
                if (newHost) {
                    console.log(`Host transferred to: ${newHost.player_name}`);
                    
                    // Get final game state with updated host info
                    const finalGameState = await getGameState(gameId);
                    
                    // Notify all remaining players
                    io.to(`game-${gameId}`).emit('player-left', { 
                        playerName,
                        gameState: finalGameState,
                        newHost: newHost.player_name,
                        wasHost: true,
                        disconnected: isDisconnect
                    });
                    
                    io.to(`game-${gameId}`).emit('new-host-assigned', {
                        newHostName: newHost.player_name,
                        message: `${newHost.player_name} ist jetzt der neue Host! ${isDisconnect ? `(${playerName} ist disconnected)` : ''}`
                    });
                } else {
                    console.error('Failed to transfer host status');
                }
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

    // Neue, robuste Host-Übertragungsfunktion
    async function transferHostStatus(gameId, remainingPlayers) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Select the first remaining player as new host (by player order)
            const newHost = remainingPlayers.sort((a, b) => a.player_order - b.player_order)[0];
            
            console.log(`Transferring host to player ID ${newHost.id} (${newHost.player_name})`);
            
            // 1. Remove host status from all players in this game
            await connection.execute(
                'UPDATE game_players SET is_host = FALSE WHERE game_id = ?', 
                [gameId]
            );
            
            // 2. Set new host
            await connection.execute(
                'UPDATE game_players SET is_host = TRUE WHERE game_id = ? AND id = ?', 
                [gameId, newHost.id]
            );
            
            // 3. Update game table host_player field
            await connection.execute(
                'UPDATE games SET host_player = ? WHERE id = ?',
                [newHost.player_name, gameId]
            );
            
            // 4. Verify the changes
            const [verifyResult] = await connection.execute(
                'SELECT player_name, is_host FROM game_players WHERE game_id = ? AND is_host = TRUE',
                [gameId]
            );
            
            if (verifyResult.length !== 1 || verifyResult[0].player_name !== newHost.player_name) {
                throw new Error('Host transfer verification failed');
            }
            
            await connection.commit();
            console.log(`Host successfully transferred to ${newHost.player_name}`);
            
            return newHost;
            
        } catch (error) {
            await connection.rollback();
            console.error('Error transferring host status:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    // Bestehende Helper-Funktionen bleiben unverändert
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