const db = require('../database');

class MapGenerator {
    constructor() {
        // Terrain distribution percentages
        this.terrainDistribution = {
            1: 0.45, // Gras (45%)
            2: 0.12, // Berg (12%)
            3: 0.08, // Sumpf (8%)
            4: 0.15, // Wasser (15%)
            5: 0.10, // Wald (10%)
            6: 0.06, // Wüste (6%)
            7: 0.04  // Schnee (4%)
        };
    }

    async generateMap(gameId, width, height, players) {
        console.log(`Generating map for game ${gameId}: ${width}x${height}`);

        try {
            // Initialize map with base terrain
            const map = this.createBaseMap(width, height);
            
            // Apply terrain distribution
            this.applyTerrainDistribution(map, width, height);
            
            // Make terrain look natural
            this.smoothTerrain(map, width, height);
            
            // Place buildings for each player
            await this.placeBuildings(map, width, height, players);
            
            // Save map to database
            await this.saveMapToDatabase(gameId, map, width, height);
            
            // Give each player a starting unit in one of their villages
            await this.placeStartingUnits(gameId, players);
            
            console.log(`Map generation complete for game ${gameId}`);
            
        } catch (error) {
            console.error('Error in map generation:', error);
            throw error;
        }
    }

    createBaseMap(width, height) {
        const map = [];
        for (let y = 0; y < height; y++) {
            map[y] = [];
            for (let x = 0; x < width; x++) {
                map[y][x] = {
                    terrainType: 1, // Start with grass
                    buildingType: null,
                    buildingOwner: null
                };
            }
        }
        return map;
    }

    applyTerrainDistribution(map, width, height) {
        const totalTiles = width * height;
        
        // Create terrain seeds
        for (const [terrainId, percentage] of Object.entries(this.terrainDistribution)) {
            const count = Math.floor(totalTiles * percentage);
            const terrain = parseInt(terrainId);
            
            for (let i = 0; i < count; i++) {
                let x, y;
                let attempts = 0;
                
                do {
                    x = Math.floor(Math.random() * width);
                    y = Math.floor(Math.random() * height);
                    attempts++;
                } while (map[y][x].terrainType !== 1 && attempts < 100);
                
                if (attempts < 100) {
                    map[y][x].terrainType = terrain;
                }
            }
        }
    }

    smoothTerrain(map, width, height) {
        // Multiple passes to make terrain look more natural
        for (let pass = 0; pass < 3; pass++) {
            const newMap = JSON.parse(JSON.stringify(map));
            
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const neighbors = this.getNeighbors(map, x, y, width, height);
                    const terrainCounts = {};
                    
                    neighbors.forEach(terrain => {
                        terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
                    });
                    
                    // Find most common terrain in neighborhood
                    let maxCount = 0;
                    let dominantTerrain = map[y][x].terrainType;
                    
                    for (const [terrain, count] of Object.entries(terrainCounts)) {
                        if (count > maxCount) {
                            maxCount = count;
                            dominantTerrain = parseInt(terrain);
                        }
                    }
                    
                    // Change terrain if neighbors strongly suggest it
                    if (maxCount >= 5) {
                        newMap[y][x].terrainType = dominantTerrain;
                    }
                }
            }
            
            // Copy smoothed map back
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    map[y][x].terrainType = newMap[y][x].terrainType;
                }
            }
        }
    }

    getNeighbors(map, x, y, width, height) {
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    neighbors.push(map[ny][nx].terrainType);
                }
            }
        }
        return neighbors;
    }

    async placeBuildings(map, width, height, players) {
        const buildingsPerPlayer = {
            village: 5,
            castle: 2
        };

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            
            // Place villages (buildingType: 1)
            for (let v = 0; v < buildingsPerPlayer.village; v++) {
                const pos = this.findSuitableBuildingPosition(map, width, height, player.id, i, players.length);
                if (pos) {
                    map[pos.y][pos.x].buildingType = 1; // Village
                    map[pos.y][pos.x].buildingOwner = player.id;
                    
                    // First village is owned by player at start
                    if (v === 0) {
                        map[pos.y][pos.x].owned = true;
                    }
                }
            }
            
            // Place castles (buildingType: 2)
            for (let c = 0; c < buildingsPerPlayer.castle; c++) {
                const pos = this.findSuitableBuildingPosition(map, width, height, player.id, i, players.length);
                if (pos) {
                    map[pos.y][pos.x].buildingType = 2; // Castle
                    map[pos.y][pos.x].buildingOwner = player.id;
                }
            }
        }
    }

    findSuitableBuildingPosition(map, width, height, playerId, playerIndex, totalPlayers) {
        // Try to place buildings in player's "sector" of the map
        const sectorAngle = (2 * Math.PI / totalPlayers) * playerIndex;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.3;
        
        for (let attempt = 0; attempt < 100; attempt++) {
            const angle = sectorAngle + (Math.random() - 0.5) * (2 * Math.PI / totalPlayers);
            const distance = Math.random() * radius;
            
            const x = Math.floor(centerX + Math.cos(angle) * distance);
            const y = Math.floor(centerY + Math.sin(angle) * distance);
            
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const tile = map[y][x];
                
                // Suitable terrain for buildings (not water, not too many buildings nearby)
                if (tile.terrainType !== 4 && !tile.buildingType) {
                    const nearbyBuildings = this.countNearbyBuildings(map, x, y, width, height, 3);
                    if (nearbyBuildings === 0) {
                        return { x, y };
                    }
                }
            }
        }
        
        // Fallback: find any suitable position
        for (let attempt = 0; attempt < 200; attempt++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            const tile = map[y][x];
            
            if (tile.terrainType !== 4 && !tile.buildingType) {
                return { x, y };
            }
        }
        
        return null;
    }

    countNearbyBuildings(map, x, y, width, height, range) {
        let count = 0;
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
                    (dx !== 0 || dy !== 0) && map[ny][nx].buildingType) {
                    count++;
                }
            }
        }
        return count;
    }

    async saveMapToDatabase(gameId, map, width, height) {
        const mapData = [];
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = map[y][x];
                mapData.push({
                    sql: `INSERT INTO game_maps (game_id, x_pos, y_pos, terrain_type_id, building_type_id, building_owner_id) 
                          VALUES (?, ?, ?, ?, ?, ?)`,
                    params: [
                        gameId, 
                        x, 
                        y, 
                        tile.terrainType, 
                        tile.buildingType, 
                        tile.buildingOwner
                    ]
                });
            }
        }
        
        await db.transaction(mapData);
    }

    async placeStartingUnits(gameId, players) {
        // Give each player one starting unit in their first village
        for (const player of players) {
            // Find player's first village
            const villageQuery = `
                SELECT x_pos, y_pos FROM game_maps 
                WHERE game_id = ? AND building_owner_id = ? AND building_type_id = 1 
                LIMIT 1
            `;
            const villages = await db.query(villageQuery, [gameId, player.id]);
            
            if (villages.length > 0) {
                const village = villages[0];
                
                // Get a basic unit from player's race (first unit)
                const units = await db.units.findByRace(player.race_id);
                if (units.length > 0) {
                    const startingUnit = units[0];
                    
                    // Place the unit
                    const insertUnitQuery = `
                        INSERT INTO game_units (game_id, player_id, unit_id, x_pos, y_pos, current_health, movement_left) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    await db.query(insertUnitQuery, [
                        gameId, 
                        player.id, 
                        startingUnit.id, 
                        village.x_pos, 
                        village.y_pos, 
                        startingUnit.health_points, 
                        startingUnit.movement_points
                    ]);
                }
            }
        }
    }
}

module.exports = new MapGenerator();