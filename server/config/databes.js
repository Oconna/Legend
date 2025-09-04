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

    // Chat queries
    chat: {
        addMessage: async (gameId, playerName, message) => {
            const sql = 'INSERT INTO chat_messages (game_id, player_name, message) VALUES (?, ?, ?)';
            return db.query(sql, [gameId, playerName, message]);
        },

        getMessages: async (gameId, limit = 50) => {
            const sql = `
                SELECT * FROM chat_messages 
                WHERE game_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `;
            const results = await db.query(sql, [gameId, limit]);
            return results.reverse(); // Return in chronological order
        }
    }
};

module.exports = db;