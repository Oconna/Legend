const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/games - Get all available games
router.get('/', async (req, res) => {
    try {
        const games = await db.games.findAvailable();
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// POST /api/games - Create a new game
router.post('/', async (req, res) => {
    try {
        const { gameName, playerName, maxPlayers, mapSize } = req.body;

        // Validation
        if (!gameName || !playerName || !maxPlayers || !mapSize) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (maxPlayers < 2 || maxPlayers > 8) {
            return res.status(400).json({ error: 'Max players must be between 2 and 8' });
        }

        const validMapSizes = ['20x20', '30x30', '50x50', '100x100'];
        if (!validMapSizes.includes(mapSize)) {
            return res.status(400).json({ error: 'Invalid map size' });
        }

        // Create game
        const gameResult = await db.games.create({
            name: gameName,
            host_player: playerName,
            max_players: maxPlayers,
            map_size: mapSize
        });

        const gameId = gameResult.insertId;

        // Add host as first player
        await db.players.addToGame(gameId, playerName, true);

        res.json({ 
            gameId, 
            message: 'Game created successfully',
            redirectUrl: `/lobby/${gameId}?player=${encodeURIComponent(playerName)}`
        });

    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

// GET /api/games/:gameId - Get game details
router.get('/:gameId', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        
        if (!gameId || isNaN(gameId)) {
            return res.status(400).json({ error: 'Invalid game ID' });
        }
        
        const game = await db.games.findById(gameId);
        
        if (!game) {
            console.log(`Game ${gameId} not found in database`);
            return res.status(404).json({ error: 'Game not found' });
        }

        const players = await db.players.findByGame(gameId);
        
        console.log(`Game ${gameId} found: status=${game.status}, players=${players.length}`);
        
        res.json({
            game,
            players
        });

    } catch (error) {
        console.error('Error fetching game details:', error);
        res.status(500).json({ error: 'Failed to fetch game details' });
    }
});

// ✅ VERBESSERTE JOIN-LOGIK
router.post('/:gameId/join', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const { playerName } = req.body;

        if (!playerName) {
            return res.status(400).json({ error: 'Player name is required' });
        }

        // Check if game exists and is joinable
        const game = await db.games.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        if (game.status !== 'lobby') {
            return res.status(400).json({ error: 'Game is not in lobby state' });
        }

        // Get current players
        const currentPlayers = await db.players.findByGame(gameId);
        
        // ✅ PRÜFEN OB SPIELER BEREITS EXISTIERT (REJOIN-SZENARIO)
        const existingPlayer = currentPlayers.find(p => p.player_name === playerName);
        
        if (existingPlayer) {
            // Player already exists in game - this is a rejoin attempt
            console.log(`Player ${playerName} rejoining game ${gameId}`);
            
            // Allow rejoin - just return success
            return res.json({ 
                message: 'Rejoined game successfully',
                redirectUrl: `/lobby/${gameId}?player=${encodeURIComponent(playerName)}`,
                isRejoin: true
            });
        }

        // New player joining - check capacity
        if (currentPlayers.length >= game.max_players) {
            return res.status(400).json({ error: 'Game is full' });
        }

        // Determine if player should be host (if no current host exists)
        const currentHost = currentPlayers.find(p => p.is_host);
        const shouldBeHost = !currentHost;
        
        // If becoming host, also update the game's host_player field
        if (shouldBeHost) {
            await db.query('UPDATE games SET host_player = ? WHERE id = ?', [playerName, gameId]);
        }

        // Add new player to game
        await db.players.addToGame(gameId, playerName, shouldBeHost);

        console.log(`Player ${playerName} joined game ${gameId}${shouldBeHost ? ' as host' : ''}`);

        res.json({ 
            message: 'Joined game successfully',
            redirectUrl: `/lobby/${gameId}?player=${encodeURIComponent(playerName)}`,
            isNewPlayer: true,
            isHost: shouldBeHost
        });

    } catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({ error: 'Failed to join game' });
    }
});

// ✅ NEUE ENDPOINT: CHECK PLAYER MEMBERSHIP
router.get('/:gameId/players/:playerName/status', async (req, res) => {
    try {
        const { gameId, playerName } = req.params;
        
        const game = await db.games.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const players = await db.players.findByGame(gameId);
        const player = players.find(p => p.player_name === playerName);
        
        if (!player) {
            return res.status(404).json({ 
                error: 'Player not found in game',
                inGame: false
            });
        }

        res.json({
            inGame: true,
            player: player,
            gameStatus: game.status
        });

    } catch (error) {
        console.error('Error checking player status:', error);
        res.status(500).json({ error: 'Failed to check player status' });
    }
});

// GET /api/games/:gameId/status - Check game status
router.get('/:gameId/status', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const game = await db.games.findById(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const players = await db.players.findByGame(gameId);
        
        res.json({
            status: game.status,
            playerCount: players.length,
            maxPlayers: game.max_players,
            created: game.created_at,
            gameExists: true
        });

    } catch (error) {
        console.error('Error checking game status:', error);
        res.status(500).json({ error: 'Failed to check game status' });
    }
});

// GET /api/games/:gameId/races - Get all races
router.get('/:gameId/races', async (req, res) => {
    try {
        const races = await db.races.findAll();
        res.json(races);
    } catch (error) {
        console.error('Error fetching races:', error);
        res.status(500).json({ error: 'Failed to fetch races' });
    }
});

// GET /api/games/:gameId/races/:raceId/units - Get units for a race
router.get('/:gameId/races/:raceId/units', async (req, res) => {
    try {
        const raceId = req.params.raceId;
        const units = await db.units.findByRace(raceId);
        res.json(units);
    } catch (error) {
        console.error('Error fetching race units:', error);
        res.status(500).json({ error: 'Failed to fetch race units' });
    }
});

// GET /api/games/:gameId/chat - Get chat messages
router.get('/:gameId/chat', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const limit = req.query.limit || 50;
        
        console.log(`📝 Fetching chat messages for game: ${gameId} limit: ${limit}`);
        
        // ✅ Validate gameId
        const gameIdNum = parseInt(gameId);
        if (!gameIdNum || isNaN(gameIdNum) || gameIdNum <= 0) {
            console.error('❌ Invalid game ID for chat:', gameId);
            return res.status(400).json({ error: 'Invalid game ID' });
        }
        
        // ✅ Check if game exists first
        const game = await db.games.findById(gameIdNum);
        if (!game) {
            console.log(`❌ Game ${gameIdNum} not found for chat messages`);
            return res.status(404).json({ error: 'Game not found' });
        }
        
        // ✅ Get messages with proper error handling
        const messages = await db.chat.getMessages(gameIdNum, limit);
        console.log(`✅ Retrieved ${messages.length} chat messages for game ${gameIdNum}`);
        
        res.json(messages);
        
    } catch (error) {
        console.error('❌ Error fetching chat messages:', error);
        res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
});

// GET /api/games/:gameId/terrain - Get terrain types
router.get('/:gameId/terrain', async (req, res) => {
    try {
        const terrainTypes = await db.terrain.findAll();
        res.json(terrainTypes);
    } catch (error) {
        console.error('Error fetching terrain types:', error);
        res.status(500).json({ error: 'Failed to fetch terrain types' });
    }
});

// GET /api/games/:gameId/buildings - Get building types
router.get('/:gameId/buildings', async (req, res) => {
    try {
        const buildingTypes = await db.buildings.findAll();
        res.json(buildingTypes);
    } catch (error) {
        console.error('Error fetching building types:', error);
        res.status(500).json({ error: 'Failed to fetch building types' });
    }
});

// GET /api/games/:gameId/map - Get map data
router.get('/:gameId/map', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        
        if (!gameId || isNaN(gameId)) {
            return res.status(400).json({ error: 'Invalid game ID' });
        }
        
        const game = await db.games.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        const mapData = await db.maps.findByGame(gameId);
        res.json(mapData);
        
    } catch (error) {
        console.error('Error fetching map data:', error);
        res.status(500).json({ error: 'Failed to fetch map data' });
    }
});

// GET /api/games/:gameId/units - Get units data
router.get('/:gameId/units', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        
        if (!gameId || isNaN(gameId)) {
            return res.status(400).json({ error: 'Invalid game ID' });
        }
        
        const game = await db.games.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        const unitsData = await db.units.findByGame(gameId);
        res.json(unitsData);
        
    } catch (error) {
        console.error('Error fetching units data:', error);
        res.status(500).json({ error: 'Failed to fetch units data' });
    }
});

// ✅ NEUE ENDPOINT: GAME REPAIR
router.post('/:gameId/repair', async (req, res) => {
    try {
        const gameId = req.params.gameId;
        const repairResult = await db.games.validateAndRepair(gameId);
        
        res.json(repairResult);
    } catch (error) {
        console.error('Error repairing game:', error);
        res.status(500).json({ error: 'Failed to repair game' });
    }
});

module.exports = router;