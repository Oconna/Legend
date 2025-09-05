const db = require('../database');

module.exports = (io) => {
    // ✅ TRACKING AKTIVER VERBINDUNGEN
    const activeConnections = new Map(); // gameId -> Set of socket.ids
    
    io.on('connection', (socket) => {
        console.log('🔌 User connected:', socket.id);

        // ✅ DEBUG: Log all incoming events
        socket.onAny((eventName, ...args) => {
            console.log(`📡 RECEIVED EVENT: ${eventName} from ${socket.id}`, args);
        });
		
		socket.on('start-game', async (data, acknowledgment) => {
            console.log('🎮 START-GAME EVENT RECEIVED');
            console.log('🎮 Data received:', data);
            console.log('🎮 Socket ID:', socket.id);
            console.log('🎮 Has acknowledgment callback:', typeof acknowledgment === 'function');
            
            try {
                const { gameId, playerName } = data;
                
                console.log(`🎮 Processing start-game: gameId=${gameId}, playerName=${playerName}`);
                
                // Verify data
                if (!gameId || !playerName) {
                    const error = 'Missing gameId or playerName';
                    console.log('❌ START-GAME ERROR:', error);
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Verify player is host
                console.log('🔍 Fetching players for game', gameId);
                const players = await db.players.findByGame(gameId);
                console.log('🔍 Players found:', players.map(p => ({ name: p.player_name, isHost: p.is_host })));
                
                const player = players.find(p => p.player_name === playerName);
                console.log('🔍 Current player:', player);
                
                if (!player || !player.is_host) {
                    const error = 'Only the host can start the game';
                    console.log('❌ START-GAME ERROR:', error);
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }

                // Check if all players are ready
                const allReady = players.every(p => p.is_ready);
                const playerCount = players.length;
                console.log('🔍 All ready:', allReady, 'Player count:', playerCount);
                
                if (!allReady || playerCount < 2) {
                    const error = 'Not all players are ready or insufficient players';
                    console.log('❌ START-GAME ERROR:', error);
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }

                console.log(`✅ All ${playerCount} players are ready, starting game...`);

                // Update game status
                console.log('📝 Updating game status to race_selection...');
                await db.games.updateStatus(gameId, 'race_selection');
                
                // Verify status was updated
                const updatedGame = await db.games.findById(gameId);
                console.log('📝 Game status after update:', updatedGame?.status);

                // Get updated game state
                const gameState = await getGameState(gameId);
                console.log('📝 Sending game state update to all players...');
                io.to(`game-${gameId}`).emit('game-state-update', gameState);
                
                // Send success acknowledgment
                if (acknowledgment) {
                    console.log('✅ Sending success acknowledgment to host');
                    acknowledgment({ success: true, status: 'race_selection' });
                }
                
                // Notify all players to redirect
                const redirectData = { 
                    redirectUrl: `/race-selection/${gameId}`,
                    gameStatus: 'race_selection'
                };
                console.log('🚀 Sending game-started event to all players:', redirectData);
                io.to(`game-${gameId}`).emit('game-started', redirectData);

                console.log(`🎉 Game ${gameId} successfully started!`);

            } catch (error) {
                console.error('❌ CRITICAL ERROR in start-game:', error);
                const errorMessage = 'Failed to start game: ' + error.message;
                socket.emit('error', { message: errorMessage });
                if (acknowledgment) acknowledgment({ success: false, error: errorMessage });
            }
        });

        // ✅ VERBESSERTE JOIN-GAME BEHANDLUNG
        socket.on('join-game', async (data) => {
            console.log('🏠 JOIN-GAME EVENT RECEIVED:', data);
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
                    // ✅ VERBESSERTE KARTENGENERIERUNG
                    console.log('🗺️ All players confirmed races, starting map generation...');
                    io.to(`game-${gameId}`).emit('map-generation-start');
                    
                    try {
                        // Parse map size
                        const [width, height] = gameState.game.map_size.split('x').map(Number);
                        
                        console.log(`🗺️ Starting map generation: ${width}x${height} for ${gameState.players.length} players`);
                        
                        // Generate map
                        await generateMap(gameId, width, height, gameState.players);
                        
                        // Set first player as current turn with gold initialization
                        const firstPlayer = gameState.players.sort((a, b) => a.player_order - b.player_order)[0];
                        
                        // Initialize all players with starting gold
                        for (const player of gameState.players) {
                            await db.query('UPDATE game_players SET gold = ? WHERE id = ?', [200, player.id]);
                        }
                        
                        await db.games.updateCurrentTurn(gameId, 1, firstPlayer.id);
                        
                        // Update game status to playing
                        await db.games.updateStatus(gameId, 'playing');
                        
                        console.log('🗺️ Map generation completed successfully!');
                        
                        // ✅ IMPORTANT: Wait a moment for database updates to complete
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Send completion event
                        io.to(`game-${gameId}`).emit('map-generation-complete', {
                            redirectUrl: `/game/${gameId}`,
                            gameStatus: 'playing'
                        });
                        
                    } catch (error) {
                        console.error('❌ Map generation failed:', error);
                        io.to(`game-${gameId}`).emit('map-generation-failed', {
                            error: 'Kartengenerierung fehlgeschlagen: ' + error.message
                        });
                    }
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

        // ✅ IMPROVED LEAVE-GAME HANDLING
        socket.on('leave-game', async (data) => {
            try {
                const { gameId, playerName } = data;
                console.log(`🚪 LEAVE-GAME EVENT: ${playerName} leaving game ${gameId}`);
                
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
        socket.on('move-unit', async (data, acknowledgment) => {
            try {
                const { gameId, unitId, targetX, targetY, path } = data;
                
                // Validate game and player
                const game = await db.games.findById(gameId);
                if (!game || game.status !== 'playing') {
                    const error = 'Game not in playing state';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Get unit and validate ownership
                const units = await db.units.findByGame(gameId);
                const unit = units.find(u => u.id === parseInt(unitId));
                
                if (!unit) {
                    const error = 'Unit not found';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Validate it's player's turn
                const players = await db.players.findByGame(gameId);
                const player = players.find(p => p.id === unit.player_id);
                
                if (game.current_player_turn !== unit.player_id) {
                    const error = 'Not your turn';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Update unit position and movement
                const movementCost = Math.min(path.length, unit.movement_left || unit.movement_points);
                const newMovementLeft = (unit.movement_left || unit.movement_points) - movementCost;
                
                await db.query(
                    'UPDATE game_units SET x_pos = ?, y_pos = ?, movement_left = ? WHERE id = ?',
                    [targetX, targetY, newMovementLeft, unitId]
                );
                
                // Get updated unit
                const updatedUnits = await db.units.findByGame(gameId);
                const updatedUnit = updatedUnits.find(u => u.id === parseInt(unitId));
                
                // Broadcast to all players
                io.to(`game-${gameId}`).emit('unit-moved', {
                    unit: updatedUnit,
                    playerId: unit.player_id,
                    path: path
                });
                
                if (acknowledgment) acknowledgment({ success: true });
                
            } catch (error) {
                console.error('Error moving unit:', error);
                const errorMessage = 'Failed to move unit';
                socket.emit('error', { message: errorMessage });
                if (acknowledgment) acknowledgment({ success: false, error: errorMessage });
            }
        });

        socket.on('attack-unit', async (data, acknowledgment) => {
            try {
                const { gameId, attackerUnitId, targetX, targetY } = data;
                
                // Get game units
                const units = await db.units.findByGame(gameId);
                const attacker = units.find(u => u.id === parseInt(attackerUnitId));
                const defender = units.find(u => u.x_pos === targetX && u.y_pos === targetY);
                
                if (!attacker || !defender) {
                    const error = 'Unit not found';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                if (attacker.player_id === defender.player_id) {
                    const error = 'Cannot attack own unit';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Calculate damage with tier bonus
                const attackerPlayer = await db.query('SELECT tier_level FROM game_players WHERE id = ?', [attacker.player_id]);
                const tierBonus = getTierBonus(attackerPlayer[0]?.tier_level || 1);
                const damage = Math.round(attacker.attack_power * (1 + tierBonus));
                
                const newHealth = defender.current_health - damage;
                const destroyed = newHealth <= 0;
                
                if (destroyed) {
                    // Remove unit
                    await db.query('DELETE FROM game_units WHERE id = ?', [defender.id]);
                } else {
                    // Update health
                    await db.query('UPDATE game_units SET current_health = ? WHERE id = ?', [newHealth, defender.id]);
                }
                
                // Broadcast attack result
                const attackData = {
                    attacker: { ...attacker, movement_left: 0 }, // Attacking uses all movement
                    defender: destroyed ? null : { ...defender, current_health: newHealth },
                    destroyedUnitId: destroyed ? defender.id : null,
                    damage: damage,
                    destroyed: destroyed
                };
                
                io.to(`game-${gameId}`).emit('unit-attacked', attackData);
                
                if (acknowledgment) acknowledgment({ success: true });
                
            } catch (error) {
                console.error('Error in attack:', error);
                const errorMessage = 'Failed to attack';
                socket.emit('error', { message: errorMessage });
                if (acknowledgment) acknowledgment({ success: false, error: errorMessage });
            }
        });

        socket.on('purchase-unit', async (data, acknowledgment) => {
            try {
                const { gameId, unitTypeId, buildingX, buildingY } = data;
                
                // Get player and validate gold
                const game = await db.games.findById(gameId);
                const players = await db.players.findByGame(gameId);
                const currentPlayer = players.find(p => p.id === game.current_player_turn);
                
                if (!currentPlayer) {
                    const error = 'Player not found';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Get unit type and cost
                const unitType = await db.query('SELECT * FROM units WHERE id = ?', [unitTypeId]);
                if (!unitType || unitType.length === 0) {
                    const error = 'Unit type not found';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                const unit = unitType[0];
                if (currentPlayer.gold < unit.cost) {
                    const error = 'Not enough gold';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Calculate enhanced stats based on tier
                const tierBonus = getTierBonus(currentPlayer.tier_level || 1);
                const enhancedHealth = Math.round(unit.health_points * (1 + tierBonus));
                const enhancedAttack = Math.round(unit.attack_power * (1 + tierBonus));
                const enhancedRange = Math.max(1, Math.round(unit.range * (1 + tierBonus)));
                
                // Create unit
                const insertResult = await db.query(
                    'INSERT INTO game_units (game_id, player_id, unit_id, x_pos, y_pos, current_health, movement_left) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [gameId, currentPlayer.id, unitTypeId, buildingX, buildingY, enhancedHealth, unit.movement_points]
                );
                
                // Update player gold
                const newGold = currentPlayer.gold - unit.cost;
                await db.query('UPDATE game_players SET gold = ? WHERE id = ?', [newGold, currentPlayer.id]);
                
                // Get created unit with full info
                const createdUnit = await db.query(`
                    SELECT gu.*, u.name, u.image_filename, u.attack_power, u.movement_points, u.range, u.can_fly
                    FROM game_units gu
                    JOIN units u ON gu.unit_id = u.id
                    WHERE gu.id = ?
                `, [insertResult.insertId]);
                
                // Broadcast unit purchase
                io.to(`game-${gameId}`).emit('unit-purchased', {
                    unit: createdUnit[0],
                    playerId: currentPlayer.id,
                    playerGold: newGold
                });
                
                if (acknowledgment) acknowledgment({ success: true });
                
            } catch (error) {
                console.error('Error purchasing unit:', error);
                const errorMessage = 'Failed to purchase unit';
                socket.emit('error', { message: errorMessage });
                if (acknowledgment) acknowledgment({ success: false, error: errorMessage });
            }
        });

        socket.on('upgrade-tier', async (data, acknowledgment) => {
            try {
                const { gameId, playerName, newTier } = data;
                
                const players = await db.players.findByGame(gameId);
                const player = players.find(p => p.player_name === playerName);
                
                if (!player) {
                    const error = 'Player not found';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Get upgrade cost
                const race = await db.query('SELECT * FROM races WHERE id = ?', [player.race_id]);
                const upgradeCosts = {
                    2: race[0]?.tier_2_cost || 500,
                    3: race[0]?.tier_3_cost || 1000
                };
                
                const cost = upgradeCosts[newTier];
                if (!cost || newTier < 2 || newTier > 3) {
                    const error = 'Invalid tier upgrade';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                if (player.gold < cost) {
                    const error = 'Not enough gold';
                    socket.emit('error', { message: error });
                    if (acknowledgment) acknowledgment({ success: false, error });
                    return;
                }
                
                // Update player
                const newGold = player.gold - cost;
                await db.query('UPDATE game_players SET gold = ?, tier_level = ? WHERE id = ?', 
                    [newGold, newTier, player.id]);
                
                // Broadcast upgrade
                const gameState = await getGameState(gameId);
                io.to(`game-${gameId}`).emit('game-state-update', gameState);
                
                if (acknowledgment) acknowledgment({ success: true });
                
            } catch (error) {
                console.error('Error upgrading tier:', error);
                const errorMessage = 'Failed to upgrade tier';
                socket.emit('error', { message: errorMessage });
                if (acknowledgment) acknowledgment({ success: false, error: errorMessage });
            }
        });

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
                
                // Reset movement for all units of next player
                await db.query(`
                    UPDATE game_units 
                    SET movement_left = (
                        SELECT movement_points FROM units WHERE units.id = game_units.unit_id
                    )
                    WHERE game_id = ? AND player_id = ?
                `, [gameId, nextPlayer.id]);
                
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

        // ✅ IMPROVED DISCONNECT HANDLING
        socket.on('disconnect', (reason) => {
            console.log('User disconnected:', socket.id, 'Reason:', reason);
            
            // Remove from active connections
            if (socket.gameId && activeConnections.has(socket.gameId)) {
                activeConnections.get(socket.gameId).delete(socket.id);
                if (activeConnections.get(socket.gameId).size === 0) {
                    activeConnections.delete(socket.gameId);
                }
            }
            
            // ✅ CRITICAL: Better disconnect handling for navigation vs actual disconnection
            if (socket.gameId && socket.playerName) {
                const isIntentionalNavigation = 
                    reason === 'client namespace disconnect' || 
                    reason === 'transport close';
                
                if (isIntentionalNavigation) {
                    console.log(`📝 Intentional navigation detected for ${socket.playerName}, allowing grace period`);
                    
                    // Use setTimeout to allow for reconnection attempts during page navigation
                    setTimeout(async () => {
                        try {
                            // Check if player has reconnected
                            const hasReconnected = activeConnections.has(socket.gameId) && 
                                Array.from(activeConnections.get(socket.gameId)).some(socketId => {
                                    const connectedSocket = io.sockets.sockets.get(socketId);
                                    return connectedSocket && connectedSocket.playerName === socket.playerName;
                                });
                            
                            if (!hasReconnected) {
                                console.log(`❌ Player ${socket.playerName} did not reconnect after grace period, treating as disconnect`);
                                await handlePlayerLeave(socket.gameId, socket.playerName, io, true);
                            } else {
                                console.log(`✅ Player ${socket.playerName} successfully reconnected during grace period`);
                            }
                        } catch (error) {
                            console.error('Error handling disconnect cleanup:', error);
                        }
                    }, 10000); // 10 seconds grace period for navigation
                } else {
                    // Immediate disconnect for non-navigation reasons
                    console.log(`💨 Immediate disconnect for ${socket.playerName} due to: ${reason}`);
                    setTimeout(async () => {
                        await handlePlayerLeave(socket.gameId, socket.playerName, io, true);
                    }, 2000); // Short delay to avoid race conditions
                }
            } else {
                console.log(`ℹ️ Not treating ${reason} as game leave (no game/player info)`);
            }
        });
    });

    // ✅ VERBESSERTE HELPER FUNCTIONS

    // Verbesserte handlePlayerLeave Funktion
    async function handlePlayerLeave(gameId, playerName, io, isDisconnect = false) {
        try {
            console.log(`🚪 Handling player leave: ${playerName} from game ${gameId} (disconnect: ${isDisconnect})`);

            // Get current game state BEFORE removing player
            const gameStateBefore = await getGameState(gameId);
            if (!gameStateBefore || !gameStateBefore.players) {
                console.log('⚠️ Game not found or no players');
                return;
            }

            // Find the leaving player
            const leavingPlayer = gameStateBefore.players.find(p => p.player_name === playerName);
            if (!leavingPlayer) {
                console.log('⚠️ Player not found in game');
                return;
            }

            const wasHost = leavingPlayer.is_host;
            console.log(`📝 Player ${playerName} was host: ${wasHost}`);

            // Use the improved database function for safe removal
            const removeResult = await db.players.removeWithHostTransfer(gameId, playerName);
            
            if (!removeResult.success) {
                console.error('❌ Failed to remove player:', removeResult.error);
                return;
            }

            console.log(`📊 Remaining players: ${removeResult.remainingPlayerCount}`);

            if (removeResult.remainingPlayerCount === 0) {
                // Delete the game
                await db.games.deleteGame(gameId);
                console.log(`🗑️ Game ${gameId} deleted - no players remaining`);
                return;
            }

            // Get updated game state after player removal
            const gameStateAfter = await getGameState(gameId);
            
            if (removeResult.hostTransfer) {
                console.log(`👑 Host transferred to: ${removeResult.hostTransfer.newHostName}`);
                
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
            console.error('❌ Error in handlePlayerLeave:', error);
            throw error;
        }
    }

    // Bestehende Helper-Funktionen
    async function getGameState(gameId) {
        console.log('🔍 Getting game state for:', gameId);
        const game = await db.games.findById(gameId);
        const players = await db.players.findByGame(gameId);
        
        const state = { game, players };
        console.log('🔍 Game state retrieved:', { 
            gameExists: !!game, 
            status: game?.status, 
            playerCount: players?.length 
        });
        
        return state;
    }

    async function generateMap(gameId, width, height, players) {
        const mapGenerator = require('../utils/mapGenerator');
        
        try {
            console.log(`🗺️ Generating map: ${width}x${height} for ${players.length} players`);
            await mapGenerator.generateMap(gameId, width, height, players);
            console.log(`✅ Map generation completed for game ${gameId}`);
        } catch (error) {
            console.error('❌ Error generating map:', error);
            throw error;
        }
    }

    async function givePlayerIncome(gameId, playerId) {
        try {
            // Calculate income based on buildings owned
            const buildings = await db.query(`
                SELECT COUNT(*) as count, building_type_id
                FROM game_maps 
                WHERE game_id = ? AND building_owner_id = ?
                GROUP BY building_type_id
            `, [gameId, playerId]);
            
            let income = 50; // Base income
            
            buildings.forEach(building => {
                if (building.building_type_id === 1) { // Village
                    income += building.count * 30;
                } else if (building.building_type_id === 2) { // Castle
                    income += building.count * 50;
                }
            });
            
            // Update player gold
            await db.query('UPDATE game_players SET gold = gold + ? WHERE id = ?', [income, playerId]);
            
            console.log(`💰 Player ${playerId} received ${income} gold income`);
            
        } catch (error) {
            console.error('❌ Error giving player income:', error);
        }
    }

    function getTierBonus(tierLevel) {
        const bonuses = { 1: 0, 2: 0.2, 3: 0.4 };
        return bonuses[tierLevel] || 0;
    }
};