// ✅ CRITICAL FIX: Sichere cleanupEmptyGames Funktion in database.js

// Ersetze die bestehende cleanupEmptyGames Funktion in database.js mit dieser Version:

cleanupEmptyGames: async () => {
    console.log('🧹 Starting cleanup of empty games...');
    
    try {
        // ✅ CRITICAL: Nur Lobby-Spiele ohne Spieler löschen, die älter als 10 Minuten sind
        const sql = `
            DELETE g FROM games g
            LEFT JOIN game_players gp ON g.id = gp.game_id
            WHERE gp.id IS NULL 
            AND g.status = 'lobby' 
            AND g.created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        `;
        
        const result = await db.query(sql);
        const deletedCount = result.affectedRows;
        
        if (deletedCount > 0) {
            console.log(`✅ Cleaned up ${deletedCount} empty lobby games`);
        } else {
            console.log('ℹ️ No empty lobby games found for cleanup');
        }
        
        return deletedCount;
        
    } catch (error) {
        console.error('❌ Error during game cleanup:', error);
        return 0;
    }
},

// ✅ NEUE FUNKTION: Spiel-Status validieren
validateGameIntegrity: async (gameId) => {
    try {
        console.log(`🔍 Validating integrity of game ${gameId}...`);
        
        const game = await db.games.findById(gameId);
        if (!game) {
            return { valid: false, error: 'Game not found' };
        }
        
        const players = await db.players.findByGame(gameId);
        const playerCount = players.length;
        
        // Validierungen basierend auf Spielstatus
        switch (game.status) {
            case 'lobby':
                // Lobby muss mindestens 1 Spieler haben
                if (playerCount === 0) {
                    console.log(`⚠️ Lobby game ${gameId} has no players - should be deleted`);
                    return { 
                        valid: false, 
                        error: 'Empty lobby game',
                        action: 'delete'
                    };
                }
                
                // Host validieren
                const hosts = players.filter(p => p.is_host);
                if (hosts.length === 0) {
                    console.log(`⚠️ Lobby game ${gameId} has no host - needs repair`);
                    return { 
                        valid: false, 
                        error: 'No host found',
                        action: 'repair_host'
                    };
                }
                break;
                
            case 'race_selection':
            case 'playing':
                // Aktive Spiele müssen mindestens 2 Spieler haben
                if (playerCount < 2) {
                    console.log(`⚠️ Active game ${gameId} has insufficient players (${playerCount})`);
                    return { 
                        valid: false, 
                        error: 'Insufficient players for active game',
                        action: 'end_game'
                    };
                }
                break;
        }
        
        return { valid: true, playerCount, status: game.status };
        
    } catch (error) {
        console.error(`❌ Error validating game ${gameId}:`, error);
        return { valid: false, error: error.message };
    }
},

// ✅ NEUE FUNKTION: Sichere Spiel-Reparatur
repairGame: async (gameId, issue) => {
    try {
        console.log(`🔧 Repairing game ${gameId} for issue: ${issue}`);
        
        switch (issue) {
            case 'repair_host':
                // Ersten Spieler zum Host machen
                const players = await db.players.findByGame(gameId);
                if (players.length > 0) {
                    const newHost = players.sort((a, b) => a.player_order - b.player_order)[0];
                    await db.hosts.transferHost(gameId, newHost.id);
                    console.log(`✅ Repaired host for game ${gameId} - new host: ${newHost.player_name}`);
                    return { success: true, action: 'host_repaired', newHost: newHost.player_name };
                }
                break;
                
            case 'delete':
                // Nur wenn es wirklich ein leeres Lobby-Spiel ist
                const gameState = await db.games.findById(gameId);
                const playerCount = await db.games.getPlayerCount(gameId);
                
                if (gameState.status === 'lobby' && playerCount === 0) {
                    await db.games.deleteGame(gameId);
                    console.log(`✅ Deleted empty lobby game ${gameId}`);
                    return { success: true, action: 'game_deleted' };
                } else {
                    console.log(`🚫 Refused to delete game ${gameId} - not empty lobby`);
                    return { success: false, error: 'Not eligible for deletion' };
                }
                break;
                
            case 'end_game':
                // Spiel beenden (für später implementieren)
                console.log(`⚠️ Game ${gameId} needs to be ended due to insufficient players`);
                return { success: false, error: 'Game ending not implemented yet' };
        }
        
        return { success: false, error: 'Unknown issue type' };
        
    } catch (error) {
        console.error(`❌ Error repairing game ${gameId}:`, error);
        return { success: false, error: error.message };
    }
}