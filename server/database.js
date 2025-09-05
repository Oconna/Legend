const mysql = require('mysql2');

// Database connection configuration
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
    reconnect: process.env.DB_RECONNECT === 'true',
    charset: 'utf8mb4'
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Promisify for async/await
const promisePool = pool.promise();

// Database helper functions
const db = {
    // Get connection from pool
    getConnection: () => {
        return promisePool.getConnection();
    },

    // Execute query
    query: async (sql, params = []) => {
        try {
            const [results] = await promisePool.execute(sql, params);
            return results;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    },

    // Execute multiple queries in transaction
    transaction: async (queries) => {
        const connection = await promisePool.getConnection();
        try {
            await connection.beginTransaction();
            
            const results = [];
            for (const query of queries) {
                const [result] = await connection.execute(query.sql, query.params || []);
                results.push(result);
            }
            
            await connection.commit();
            return results;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    // Game-specific queries
    games: {
        create: async (gameData) => {
            const sql = `
                INSERT INTO games (name, host_player, max_players, map_size) 
                VALUES (?, ?, ?, ?)
            `;
            return db.query(sql, [gameData.name, gameData.host_player, gameData.max_players, gameData.map_size]);
        },

        findById: async (gameId) => {
            const sql = 'SELECT * FROM games WHERE id = ?';
            const results = await db.query(sql, [gameId]);
            return results[0];
        },

        findAvailable: async () => {
            const sql = `
                SELECT g.*, 
                       COUNT(gp.id) as current_players
                FROM games g 
                LEFT JOIN game_players gp ON g.id = gp.game_id 
                WHERE g.status = 'lobby'
                GROUP BY g.id
                HAVING current_players < g.max_players
                ORDER BY g.created_at DESC
            `;
            return db.query(sql);
        },

        updateStatus: async (gameId, status) => {
            const sql = 'UPDATE games SET status = ? WHERE id = ?';
            return db.query(sql, [status, gameId]);
        },

        updateCurrentTurn: async (gameId, turn, playerId) => {
            const sql = 'UPDATE games SET current_turn = ?, current_player_turn = ? WHERE id = ?';
            return db.query(sql, [turn, playerId, gameId]);
        },

        deleteGame: async (gameId) => {
            const connection = await db.getConnection();
            try {
                await connection.beginTransaction();
                
                // Delete in correct order to avoid foreign key constraints
                await connection.execute('DELETE FROM chat_messages WHERE game_id = ?', [gameId]);
                await connection.execute('DELETE FROM game_units WHERE game_id = ?', [gameId]);
                await connection.execute('DELETE FROM game_maps WHERE game_id = ?', [gameId]);
                await connection.execute('DELETE FROM game_players WHERE game_id = ?', [gameId]);
                await connection.execute('DELETE FROM games WHERE id = ?', [gameId]);
                
                await connection.commit();
                return { success: true };
                
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        getPlayerCount: async (gameId) => {
            const sql = 'SELECT COUNT(*) as count FROM game_players WHERE game_id = ?';
            const result = await db.query(sql, [gameId]);
            return result[0]?.count || 0;
        },

        cleanupEmptyGames: async () => {
    // Only delete games that are in 'lobby' status and have been empty for more than 10 minutes
    const sql = `
        DELETE g FROM games g
        LEFT JOIN game_players gp ON g.id = gp.game_id
        WHERE gp.id IS NULL 
        AND g.status = 'lobby' 
        AND g.created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
    `;
    const result = await db.query(sql);
    return result.affectedRows;
},

        // ✅ NEUE FUNKTION: Spiel-Konsistenz prüfen und reparieren
        validateAndRepair: async (gameId) => {
            const repairs = [];
            
            try {
                // 1. Host-Status prüfen
                const hostRepair = await db.hosts.validateAndRepairHost(gameId);
                if (hostRepair.repaired) {
                    repairs.push('host-status');
                }
                
                // 2. Spieler-Reihenfolge prüfen
                const players = await db.players.findByGame(gameId);
                if (players.length > 0) {
                    const orders = players.map(p => p.player_order).sort((a, b) => a - b);
                    const expectedOrders = Array.from({length: players.length}, (_, i) => i + 1);
                    
                    if (JSON.stringify(orders) !== JSON.stringify(expectedOrders)) {
                        // Player order reparieren
                        for (let i = 0; i < players.length; i++) {
                            await db.query(
                                'UPDATE game_players SET player_order = ? WHERE id = ?',
                                [i + 1, players[i].id]
                            );
                        }
                        repairs.push('player-order');
                    }
                }
                
                return { success: true, repairs };
                
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    },

    // Player-specific queries
    players: {
        addToGame: async (gameId, playerName, isHost = false) => {
            const orderSql = 'SELECT MAX(player_order) as max_order FROM game_players WHERE game_id = ?';
            const orderResult = await db.query(orderSql, [gameId]);
            const playerOrder = (orderResult[0]?.max_order || 0) + 1;

            const sql = `
                INSERT INTO game_players (game_id, player_name, player_order, is_host) 
                VALUES (?, ?, ?, ?)
            `;
            return db.query(sql, [gameId, playerName, playerOrder, isHost]);
        },

        findByGame: async (gameId) => {
            const sql = `
                SELECT gp.*, r.name as race_name, r.image_filename as race_image
                FROM game_players gp
                LEFT JOIN races r ON gp.race_id = r.id
                WHERE gp.game_id = ?
                ORDER BY gp.player_order
            `;
            return db.query(sql, [gameId]);
        },

        updateReady: async (gameId, playerName, isReady) => {
            const sql = 'UPDATE game_players SET is_ready = ? WHERE game_id = ? AND player_name = ?';
            return db.query(sql, [isReady, gameId, playerName]);
        },

        updateRace: async (gameId, playerName, raceId) => {
            const sql = 'UPDATE game_players SET race_id = ? WHERE game_id = ? AND player_name = ?';
            return db.query(sql, [raceId, gameId, playerName]);
        },

        confirmRace: async (gameId, playerName) => {
            const sql = 'UPDATE game_players SET race_confirmed = TRUE WHERE game_id = ? AND player_name = ?';
            return db.query(sql, [gameId, playerName]);
        },

        removeFromGame: async (gameId, playerName) => {
            const sql = 'DELETE FROM game_players WHERE game_id = ? AND player_name = ?';
            return db.query(sql, [gameId, playerName]);
        },

        updateGold: async (gameId, playerName, gold) => {
            const sql = 'UPDATE game_players SET gold = ? WHERE game_id = ? AND player_name = ?';
            return db.query(sql, [gold, gameId, playerName]);
        },

        updateTier: async (gameId, playerName, tier) => {
            const sql = 'UPDATE game_players SET tier_level = ? WHERE game_id = ? AND player_name = ?';
            return db.query(sql, [tier, gameId, playerName]);
        },

        // ✅ NEUE FUNKTION: Sichere Spieler-Entfernung mit Host-Übertragung
        removeWithHostTransfer: async (gameId, playerName) => {
            const connection = await db.getConnection();
            
            try {
                await connection.beginTransaction();
                
                // 1. Spieler-Info vor Entfernung holen
                const [playerInfo] = await connection.execute(
                    'SELECT id, is_host, player_order FROM game_players WHERE game_id = ? AND player_name = ?',
                    [gameId, playerName]
                );
                
                if (playerInfo.length === 0) {
                    await connection.rollback();
                    return { success: false, error: 'Player not found' };
                }
                
                const wasHost = playerInfo[0].is_host;
                
                // 2. Spieler entfernen
                await connection.execute(
                    'DELETE FROM game_players WHERE game_id = ? AND player_name = ?',
                    [gameId, playerName]
                );
                
                // 3. Verbleibende Spieler prüfen
                const [remainingPlayers] = await connection.execute(
                    'SELECT id, player_name, player_order FROM game_players WHERE game_id = ? ORDER BY player_order ASC',
                    [gameId]
                );
                
                let hostTransfer = null;
                
                if (remainingPlayers.length > 0 && wasHost) {
                    // Host übertragen zum ersten verbleibenden Spieler
                    const newHost = remainingPlayers[0];
                    
                    await connection.execute(
                        'UPDATE game_players SET is_host = TRUE WHERE game_id = ? AND id = ?',
                        [gameId, newHost.id]
                    );
                    
                    await connection.execute(
                        'UPDATE games SET host_player = ? WHERE id = ?',
                        [newHost.player_name, gameId]
                    );
                    
                    hostTransfer = {
                        newHostId: newHost.id,
                        newHostName: newHost.player_name
                    };
                }
                
                await connection.commit();
                
                return {
                    success: true,
                    wasHost,
                    remainingPlayerCount: remainingPlayers.length,
                    hostTransfer
                };
                
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    },

    // ✅ NEUE HOST-SPEZIFISCHE FUNKTIONEN
    hosts: {
        // Sicherstellen, dass nur ein Host pro Spiel existiert
        ensureSingleHost: async (gameId) => {
            const hostCount = await db.query(
                'SELECT COUNT(*) as count FROM game_players WHERE game_id = ? AND is_host = TRUE',
                [gameId]
            );
            
            if (hostCount[0].count > 1) {
                // Repariere multiple Hosts - behalte nur den ersten
                await db.query(`
                    UPDATE game_players 
                    SET is_host = FALSE 
                    WHERE game_id = ? AND is_host = TRUE AND id NOT IN (
                        SELECT * FROM (
                            SELECT id FROM game_players 
                            WHERE game_id = ? AND is_host = TRUE 
                            ORDER BY player_order ASC 
                            LIMIT 1
                        ) as temp
                    )
                `, [gameId, gameId]);
            }
            
            return hostCount[0].count;
        },

        // Host-Status übertragen
        transferHost: async (gameId, newHostPlayerId) => {
            const connection = await db.getConnection();
            
            try {
                await connection.beginTransaction();
                
                // 1. Alle Hosts in diesem Spiel entfernen
                await connection.execute(
                    'UPDATE game_players SET is_host = FALSE WHERE game_id = ?',
                    [gameId]
                );
                
                // 2. Neuen Host setzen
                const [result] = await connection.execute(
                    'UPDATE game_players SET is_host = TRUE WHERE game_id = ? AND id = ?',
                    [gameId, newHostPlayerId]
                );
                
                if (result.affectedRows === 0) {
                    throw new Error('Player not found for host transfer');
                }
                
                // 3. Spielername des neuen Hosts holen
                const [hostInfo] = await connection.execute(
                    'SELECT player_name FROM game_players WHERE game_id = ? AND id = ?',
                    [gameId, newHostPlayerId]
                );
                
                if (hostInfo.length === 0) {
                    throw new Error('Host player info not found');
                }
                
                // 4. Games-Tabelle aktualisieren
                await connection.execute(
                    'UPDATE games SET host_player = ? WHERE id = ?',
                    [hostInfo[0].player_name, gameId]
                );
                
                // 5. Validierung
                const [validation] = await connection.execute(`
                    SELECT 
                        gp.player_name,
                        g.host_player,
                        (gp.player_name = g.host_player) as is_consistent
                    FROM game_players gp
                    JOIN games g ON g.id = gp.game_id
                    WHERE gp.game_id = ? AND gp.is_host = TRUE
                `, [gameId]);
                
                if (validation.length !== 1 || !validation[0].is_consistent) {
                    throw new Error('Host transfer validation failed');
                }
                
                await connection.commit();
                
                return {
                    success: true,
                    newHostName: hostInfo[0].player_name,
                    newHostId: newHostPlayerId
                };
                
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        // Host validieren und ggf. reparieren
        validateAndRepairHost: async (gameId) => {
            const players = await db.players.findByGame(gameId);
            const hosts = players.filter(p => p.is_host);
            
            if (hosts.length === 0 && players.length > 0) {
                // Kein Host vorhanden - ersten Spieler zum Host machen
                const newHost = players.sort((a, b) => a.player_order - b.player_order)[0];
                await db.hosts.transferHost(gameId, newHost.id);
                return { repaired: true, newHost: newHost.player_name };
                
            } else if (hosts.length > 1) {
                // Mehrere Hosts - nur ersten behalten
                await db.hosts.ensureSingleHost(gameId);
                return { repaired: true, fixedMultipleHosts: true };
            }
            
            return { repaired: false };
        }
    },

    // Race and unit queries
    races: {
        findAll: async () => {
            return db.query('SELECT * FROM races ORDER BY name');
        },

        findById: async (raceId) => {
            const sql = 'SELECT * FROM races WHERE id = ?';
            const results = await db.query(sql, [raceId]);
            return results[0];
        }
    },

    units: {
        findByRace: async (raceId) => {
            const sql = 'SELECT * FROM units WHERE race_id = ? ORDER BY cost';
            return db.query(sql, [raceId]);
        },

        // ✅ NEUE FUNKTION: Einheit auf dem Spielfeld platzieren
        placeOnMap: async (gameId, playerId, unitId, x, y, health, movement) => {
            const sql = `
                INSERT INTO game_units (game_id, player_id, unit_id, x_pos, y_pos, current_health, movement_left)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            return db.query(sql, [gameId, playerId, unitId, x, y, health, movement]);
        },

        // ✅ NEUE FUNKTION: Einheiten eines Spiels laden
        findByGame: async (gameId) => {
            const sql = `
                SELECT gu.*, u.name, u.image_filename, u.attack_power, u.movement_points, u.range, u.can_fly
                FROM game_units gu
                JOIN units u ON gu.unit_id = u.id
                WHERE gu.game_id = ?
            `;
            return db.query(sql, [gameId]);
        }
    },

    // Terrain and building queries
    terrain: {
        findAll: async () => {
            return db.query('SELECT * FROM terrain_types');
        }
    },

    buildings: {
        findAll: async () => {
            return db.query('SELECT * FROM building_types');
        }
    },

    // ✅ NEUE MAP-FUNKTIONEN
    maps: {
        // Karte für ein Spiel laden
        findByGame: async (gameId) => {
            const sql = `
                SELECT 
                    gm.*,
                    tt.name as terrain_name,
                    tt.image_filename as terrain_image,
                    tt.movement_cost,
                    bt.name as building_name,
                    bt.image_filename as building_image
                FROM game_maps gm
                LEFT JOIN terrain_types tt ON gm.terrain_type_id = tt.id
                LEFT JOIN building_types bt ON gm.building_type_id = bt.id
                WHERE gm.game_id = ?
                ORDER BY gm.y_pos, gm.x_pos
            `;
            return db.query(sql, [gameId]);
        },

        // Einzelnes Tile laden
        getTile: async (gameId, x, y) => {
            const sql = `
                SELECT gm.*, tt.movement_cost, bt.income
                FROM game_maps gm
                LEFT JOIN terrain_types tt ON gm.terrain_type_id = tt.id
                LEFT JOIN building_types bt ON gm.building_type_id = bt.id
                WHERE gm.game_id = ? AND gm.x_pos = ? AND gm.y_pos = ?
            `;
            const results = await db.query(sql, [gameId, x, y]);
            return results[0];
        }
    },

    // Chat queries
chat: {
    addMessage: async (gameId, playerName, message) => {
        const sql = 'INSERT INTO chat_messages (game_id, player_name, message) VALUES (?, ?, ?)';
        return db.query(sql, [gameId, playerName, message]);
    },

    getMessages: async (gameId, limit = 50) => {
        // ✅ FIX: Ensure both parameters are properly typed and validated
        const gameIdNum = parseInt(gameId);
        let limitNum = parseInt(limit);
        
        // Validate inputs
        if (isNaN(gameIdNum) || gameIdNum <= 0) {
            console.error('Invalid gameId for chat messages:', gameId);
            return [];
        }
        
        if (isNaN(limitNum) || limitNum <= 0) {
            limitNum = 50; // Default fallback
        }

        // ✅ IMPORTANT: Use direct values instead of parameters for LIMIT
        const sql = `
            SELECT * FROM chat_messages 
            WHERE game_id = ? 
            ORDER BY created_at DESC 
            LIMIT ${limitNum}
        `;
        
        try {
            console.log(`📝 Executing chat query: gameId=${gameIdNum}, limit=${limitNum}`);
            const results = await db.query(sql, [gameIdNum]);
            console.log(`✅ Chat query successful: ${results.length} messages retrieved`);
            return results.reverse(); // Return in chronological order
        } catch (error) {
            console.error('❌ Error fetching chat messages for game', gameIdNum, ':', error);
            return []; // Return empty array on error to prevent page crashes
        }
    }
}
};

module.exports = db;