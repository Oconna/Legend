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
        const game = await db.games.findById(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const players = await db.players.findByGame(gameId);
        
        res.json({
            game,
            players
        });

    } catch (error) {
        console.error('Error fetching game details:', error);
        res.status(500).json({ error: 'Failed to fetch game details' });
    }
});

// POST /api/games/:gameId/join - Join a game
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

        // Check current player count
        const currentPlayers = await db.players.findByGame(gameId);
        if (currentPlayers.length >= game.max_players) {
            return res.status(400).json({ error: 'Game is full' });
        }

        // Check if player name is already taken
        const existingPlayer = currentPlayers.find(p => p.player_name === playerName);
        if (existingPlayer) {
            return res.status(400).json({ error: 'Player name already taken' });
        }

        // Add player to game
        await db.players.addToGame(gameId, playerName, false);

        res.json({ 
            message: 'Joined game successfully',
            redirectUrl: `/lobby/${gameId}?player=${encodeURIComponent(playerName)}`
        });

    } catch (error) {
        console.error('Error joining game:', error);
        res.status(500).json({ error: 'Failed to join game' });
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
        const messages = await db.chat.getMessages(gameId);
        res.json(messages);
    } catch (error) {
        console.error('Error fetching chat messages:', error);
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

module.exports = router;