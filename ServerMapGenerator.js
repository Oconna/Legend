// ServerMapGenerator.js - Server-seitige Kartengenerierung (Railway-kompatibel)

console.log('🗺️ Initialisiere Server Map Generator...');

class ServerMapGenerator {
    constructor() {
        this.terrainTypes = [
            { id: "grassland", name: "Grasland", color: "#90EE90", movementCost: 1, defenseBonus: 0, goldBonus: 0, probability: 0.3 },
            { id: "forest", name: "Wald", color: "#228B22", movementCost: 2, defenseBonus: 1, goldBonus: 0, probability: 0.2 },
            { id: "mountains", name: "Berge", color: "#A0522D", movementCost: 3, defenseBonus: 2, goldBonus: 1, probability: 0.15 },
            { id: "hills", name: "Hügel", color: "#DEB887", movementCost: 2, defenseBonus: 1, goldBonus: 0, probability: 0.15 },
            { id: "plains", name: "Ebene", color: "#FFFF99", movementCost: 1, defenseBonus: 0, goldBonus: 1, probability: 0.2 }
        ];

        this.buildingTypes = [
            { id: "city", name: "Stadt", hp: 100, goldIncome: 20, canTrain: true, probability: 0.4 },
            { id: "castle", name: "Burg", hp: 150, goldIncome: 15, canTrain: true, defensiveBonus: 3, probability: 0.3 },
            { id: "village", name: "Dorf", hp: 50, goldIncome: 10, canTrain: false, probability: 0.3 }
        ];

        this.generatedMaps = new Map();
    }

    // ========================================
    // HAUPTMETHODE: KARTENGENERIERUNG
    // ========================================

    generateSynchronizedMap(gameId, mapSize = 20, seed = null, players = []) {
        console.log(`🗺️ Generiere synchronisierte Karte für Spiel ${gameId}...`);
        
        try {
            const mapSeed = seed || this.generateSeedFromGameId(gameId);
            const map = this.generateBaseMap(mapSize, mapSeed);
            this.placeBuildingsOnMap(map, mapSize, mapSeed, players.length);
            this.generateStartingPositions(map, mapSize, players, mapSeed);
            
            this.generatedMaps.set(gameId, {
                map: map,
                seed: mapSeed,
                size: mapSize,
                generatedAt: Date.now()
            });
            
            console.log(`✅ Karte für Spiel ${gameId} erfolgreich generiert (Seed: ${mapSeed})`);
            
            return {
                success: true,
                map: map,
                seed: mapSeed,
                size: mapSize,
                gameId: gameId
            };
            
        } catch (error) {
            console.error(`❌ Fehler bei Kartengenerierung für Spiel ${gameId}:`, error);
            return {
                success: false,
                error: error.message,
                gameId: gameId
            };
        }
    }

    // ========================================
    // BASIS-KARTENGENERIERUNG
    // ========================================

    generateBaseMap(size, seed) {
        console.log(`🗺️ Generiere Basis-Karte (${size}x${size}, Seed: ${seed})`);
        
        const map = [];
        
        for (let y = 0; y < size; y++) {
            map[y] = [];
            for (let x = 0; x < size; x++) {
                map[y][x] = this.generateTile(x, y, size, seed);
            }
        }
        
        this.smoothTerrain(map, size, seed);
        return map;
    }

    generateTile(x, y, mapSize, seed) {
        const random = this.seededRandom(x + y * 1000 + seed * 10000);
        const terrain = this.selectTerrain(x, y, mapSize, random);
        
        return {
            x: x,
            y: y,
            terrain: terrain,
            unit: null,
            building: null,
            owner: null,
            explored: false,
            visible: true
        };
    }

    selectTerrain(x, y, mapSize, random) {
        const centerX = mapSize / 2;
        const centerY = mapSize / 2;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
        const normalizedDistance = distanceFromCenter / maxDistance;
        
        let terrainProbabilities = [...this.terrainTypes];
        
        if (normalizedDistance > 0.6) {
            const mountainIndex = terrainProbabilities.findIndex(t => t.id === 'mountains');
            if (mountainIndex >= 0) {
                terrainProbabilities[mountainIndex].probability *= 2;
            }
        }
        
        if (normalizedDistance < 0.4) {
            const plainsIndex = terrainProbabilities.findIndex(t => t.id === 'plains');
            if (plainsIndex >= 0) {
                terrainProbabilities[plainsIndex].probability *= 1.5;
            }
        }
        
        const totalProbability = terrainProbabilities.reduce((sum, t) => sum + t.probability, 0);
        let normalizedRandom = random * totalProbability;
        
        for (const terrain of terrainProbabilities) {
            normalizedRandom -= terrain.probability;
            if (normalizedRandom <= 0) {
                return { ...terrain };
            }
        }
        
        return { ...this.terrainTypes[0] };
    }

    smoothTerrain(map, size, seed) {
        console.log('🌍 Glätte Terrain für realistische Cluster...');
        
        for (let pass = 0; pass < 3; pass++) {
            const newMap = JSON.parse(JSON.stringify(map));
            
            for (let y = 1; y < size - 1; y++) {
                for (let x = 1; x < size - 1; x++) {
                    const neighbors = this.getNeighbors(map, x, y);
                    const dominantTerrain = this.findDominantTerrain(neighbors);
                    
                    if (dominantTerrain && this.seededRandom(x + y * size + pass * 10000 + seed) < 0.3) {
                        newMap[y][x].terrain = { ...dominantTerrain };
                    }
                }
            }
            
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    map[y][x] = newMap[y][x];
                }
            }
        }
    }

    getNeighbors(map, x, y) {
        const neighbors = [];
        const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < map[0].length && ny >= 0 && ny < map.length) {
                neighbors.push(map[ny][nx]);
            }
        }
        
        return neighbors;
    }

    findDominantTerrain(neighbors) {
        const terrainCounts = {};
        
        for (const neighbor of neighbors) {
            const terrainId = neighbor.terrain.id;
            terrainCounts[terrainId] = (terrainCounts[terrainId] || 0) + 1;
        }
        
        let maxCount = 0;
        let dominantTerrain = null;
        
        for (const [terrainId, count] of Object.entries(terrainCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantTerrain = this.terrainTypes.find(t => t.id === terrainId);
            }
        }
        
        return maxCount >= 3 ? dominantTerrain : null;
    }

    // ========================================
    // GEBÄUDE-PLATZIERUNG
    // ========================================

    placeBuildingsOnMap(map, mapSize, seed, playerCount = 4) {
        console.log(`🏘️ Platziere Gebäude auf der Karte...`);
        
        const totalTiles = mapSize * mapSize;
        const buildingDensity = 0.025;
        const totalBuildings = Math.floor(totalTiles * buildingDensity);
        const mainBuildings = Math.max(playerCount + 2, Math.floor(totalBuildings * 0.4));
        const otherBuildings = totalBuildings - mainBuildings;
        
        console.log(`  Platziere ${mainBuildings} Hauptgebäude und ${otherBuildings} weitere Gebäude`);
        
        this.placeMainBuildings(map, mapSize, mainBuildings, seed);
        this.placeOtherBuildings(map, mapSize, otherBuildings, seed);
        
        console.log('✅ Gebäude-Platzierung abgeschlossen');
    }

    placeMainBuildings(map, mapSize, count, seed) {
        const mainBuildingTypes = this.buildingTypes.filter(b => b.id === 'city' || b.id === 'castle');
        let placed = 0;
        let attempts = 0;
        const maxAttempts = count * 10;
        
        while (placed < count && attempts < maxAttempts) {
            const x = Math.floor(this.seededRandom(seed + attempts * 2) * mapSize);
            const y = Math.floor(this.seededRandom(seed + attempts * 2 + 1) * mapSize);
            
            if (this.isSuitableForBuilding(map, x, y, mapSize, true)) {
                const buildingType = mainBuildingTypes[Math.floor(this.seededRandom(seed + attempts * 3) * mainBuildingTypes.length)];
                
                map[y][x].building = {
                    type: buildingType.id,
                    name: buildingType.name,
                    hp: buildingType.hp,
                    maxHp: buildingType.hp,
                    goldIncome: buildingType.goldIncome,
                    canTrain: buildingType.canTrain,
                    owner: null
                };
                
                placed++;
            }
            
            attempts++;
        }
        
        console.log(`  ${placed}/${count} Hauptgebäude platziert`);
    }

    placeOtherBuildings(map, mapSize, count, seed) {
        const otherBuildingTypes = this.buildingTypes.filter(b => b.id !== 'city' && b.id !== 'castle');
        let placed = 0;
        let attempts = 0;
        const maxAttempts = count * 10;
        
        while (placed < count && attempts < maxAttempts) {
            const x = Math.floor(this.seededRandom(seed + 10000 + attempts * 2) * mapSize);
            const y = Math.floor(this.seededRandom(seed + 10000 + attempts * 2 + 1) * mapSize);
            
            if (this.isSuitableForBuilding(map, x, y, mapSize, false)) {
                const buildingType = otherBuildingTypes[Math.floor(this.seededRandom(seed + 10000 + attempts * 3) * otherBuildingTypes.length)];
                
                map[y][x].building = {
                    type: buildingType.id,
                    name: buildingType.name,
                    hp: buildingType.hp || 50,
                    maxHp: buildingType.hp || 50,
                    goldIncome: buildingType.goldIncome || 5,
                    canTrain: buildingType.canTrain || false,
                    owner: null
                };
                
                placed++;
            }
            
            attempts++;
        }
        
        console.log(`  ${placed}/${count} weitere Gebäude platziert`);
    }

    isSuitableForBuilding(map, x, y, mapSize, isMainBuilding = false) {
        if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) {
            return false;
        }
        
        const tile = map[y][x];
        
        if (tile.building) {
            return false;
        }
        
        if (tile.terrain.id === 'water' || tile.terrain.id === 'mountains') {
            return false;
        }
        
        if (isMainBuilding) {
            const minDistance = 3;
            
            for (let dy = -minDistance; dy <= minDistance; dy++) {
                for (let dx = -minDistance; dx <= minDistance; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    
                    if (nx >= 0 && nx < mapSize && ny >= 0 && ny < mapSize) {
                        if (map[ny][nx].building) {
                            return false;
                        }
                    }
                }
            }
        }
        
        return true;
    }

    // ========================================
    // STARTPOSITIONEN FÜR SPIELER
    // ========================================

    generateStartingPositions(map, mapSize, players, seed) {
        console.log(`🏠 Generiere Startpositionen für ${players.length} Spieler...`);
        
        if (players.length === 0) {
            console.log('  Keine Spieler vorhanden, überspringe Startpositionen');
            return;
        }
        
        const availableBuildings = this.findAllBuildings(map, 'city', 'castle');
        
        if (availableBuildings.length < players.length) {
            console.warn(`⚠️ Nicht genug Gebäude für alle Spieler (${availableBuildings.length} < ${players.length})`);
        }
        
        this.shuffleArray(availableBuildings, seed);
        
        for (let i = 0; i < players.length && i < availableBuildings.length; i++) {
            const player = players[i];
            const building = availableBuildings[i];
            
            map[building.y][building.x].owner = player.id;
            map[building.y][building.x].building.owner = player.id;
            
            const unitPosition = this.findNearbyEmptyTile(map, building.x, building.y, mapSize);
            if (unitPosition) {
                const startingUnit = this.createStartingUnit(player, seed + i);
                map[unitPosition.y][unitPosition.x].unit = startingUnit;
                
                console.log(`  Spieler ${player.name}: Gebäude bei (${building.x}, ${building.y}), Einheit bei (${unitPosition.x}, ${unitPosition.y})`);
            } else {
                console.warn(`⚠️ Keine freie Position für Starteinheit von Spieler ${player.name} gefunden`);
            }
        }
        
        console.log('✅ Startpositionen generiert');
    }

    findAllBuildings(map, ...buildingTypes) {
        const buildings = [];
        
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const tile = map[y][x];
                if (tile.building && buildingTypes.includes(tile.building.type)) {
                    buildings.push({ x, y, building: tile.building });
                }
            }
        }
        
        return buildings;
    }

    findNearbyEmptyTile(map, centerX, centerY, mapSize, maxRadius = 3) {
        for (let radius = 1; radius <= maxRadius; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
                        const tile = map[y][x];
                        if (!tile.unit && !tile.building && tile.terrain.id !== 'water') {
                            return { x, y };
                        }
                    }
                }
            }
        }
        
        return null;
    }

    createStartingUnit(player, seed) {
        return {
            id: `unit_${player.id}_${Date.now()}`,
            type: 'warrior',
            name: 'Krieger',
            owner: player.id,
            hp: 30,
            maxHp: 30,
            attack: 8,
            defense: 4,
            movement: 2,
            maxMovement: 2,
            range: 1,
            level: 1,
            experience: 0,
            icon: '⚔️'
        };
    }

    // ========================================
    // HILFSFUNKTIONEN
    // ========================================

    generateSeedFromGameId(gameId) {
        let hash = 0;
        const str = gameId.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash);
    }

    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    shuffleArray(array, seed) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.seededRandom(seed + i) * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // ========================================
    // MAP CACHE VERWALTUNG
    // ========================================

    getMap(gameId) {
        return this.generatedMaps.get(gameId);
    }

    hasMap(gameId) {
        return this.generatedMaps.has(gameId);
    }

    removeMap(gameId) {
        const deleted = this.generatedMaps.delete(gameId);
        if (deleted) {
            console.log(`🗑️ Karte für Spiel ${gameId} aus Cache entfernt`);
        }
        return deleted;
    }

    clearOldMaps(maxAge = 3600000) {
        const now = Date.now();
        let cleared = 0;
        
        for (const [gameId, mapData] of this.generatedMaps.entries()) {
            if (now - mapData.generatedAt > maxAge) {
                this.generatedMaps.delete(gameId);
                cleared++;
            }
        }
        
        if (cleared > 0) {
            console.log(`🧹 ${cleared} alte Karten aus Cache entfernt`);
        }
        
        return cleared;
    }

    getCacheStats() {
        return {
            totalMaps: this.generatedMaps.size,
            cacheSize: JSON.stringify(Array.from(this.generatedMaps.values())).length,
            maps: Array.from(this.generatedMaps.keys())
        };
    }

    // ========================================
    // MAP VALIDATION
    // ========================================

    validateMap(map, expectedSize) {
        const errors = [];
        
        if (!Array.isArray(map)) {
            errors.push('Map ist kein Array');
            return errors;
        }
        
        if (map.length !== expectedSize) {
            errors.push(`Map-Höhe ist ${map.length}, erwartet ${expectedSize}`);
        }
        
        for (let y = 0; y < map.length; y++) {
            if (!Array.isArray(map[y])) {
                errors.push(`Zeile ${y} ist kein Array`);
                continue;
            }
            
            if (map[y].length !== expectedSize) {
                errors.push(`Zeile ${y} hat Länge ${map[y].length}, erwartet ${expectedSize}`);
            }
            
            for (let x = 0; x < map[y].length; x++) {
                const tile = map[y][x];
                
                if (!tile || typeof tile !== 'object') {
                    errors.push(`Tile bei (${x}, ${y}) ist ungültig`);
                    continue;
                }
                
                if (tile.x !== x || tile.y !== y) {
                    errors.push(`Tile-Koordinaten bei (${x}, ${y}) stimmen nicht überein`);
                }
                
                if (!tile.terrain || typeof tile.terrain !== 'object') {
                    errors.push(`Tile bei (${x}, ${y}) hat kein gültiges Terrain`);
                }
            }
        }
        
        return errors;
    }

    // ========================================
    // MAP STATISTICS
    // ========================================

    generateMapStatistics(map) {
        const stats = {
            size: map.length,
            totalTiles: map.length * map.length,
            terrain: {},
            buildings: {},
            players: new Set()
        };
        
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const tile = map[y][x];
                
                const terrainId = tile.terrain.id;
                stats.terrain[terrainId] = (stats.terrain[terrainId] || 0) + 1;
                
                if (tile.building) {
                    const buildingType = tile.building.type;
                    stats.buildings[buildingType] = (stats.buildings[buildingType] || 0) + 1;
                }
                
                if (tile.owner) {
                    stats.players.add(tile.owner);
                }
            }
        }
        
        stats.playerCount = stats.players.size;
        stats.players = Array.from(stats.players);
        
        return stats;
    }

    // ========================================
    // DEBUG METHODEN
    // ========================================

    debugMap(gameId) {
        const mapData = this.generatedMaps.get(gameId);
        if (!mapData) {
            console.log(`❌ Keine Karte für Spiel ${gameId} gefunden`);
            return;
        }
        
        const stats = this.generateMapStatistics(mapData.map);
        
        console.log(`🗺️ Debug Info für Karte ${gameId}`);
        console.log('Seed:', mapData.seed);
        console.log('Größe:', mapData.size);
        console.log('Generiert am:', new Date(mapData.generatedAt));
        console.log('Terrain-Verteilung:', stats.terrain);
        console.log('Gebäude-Verteilung:', stats.buildings);
        console.log('Spieler:', stats.players);
    }

    testMapGeneration(testCount = 3) {
        console.log(`🧪 Teste Kartengenerierung (${testCount} Karten)...`);
        
        const results = [];
        
        for (let i = 0; i < testCount; i++) {
            const testGameId = `test_${i}`;
            const mapSize = 15;
            const testPlayers = [
                { id: `player_0`, name: `TestPlayer0` },
                { id: `player_1`, name: `TestPlayer1` }
            ];
            
            const startTime = Date.now();
            const result = this.generateSynchronizedMap(testGameId, mapSize, null, testPlayers);
            const duration = Date.now() - startTime;
            
            if (result.success) {
                const stats = this.generateMapStatistics(result.map);
                results.push({
                    gameId: testGameId,
                    mapSize: mapSize,
                    playerCount: testPlayers.length,
                    duration: duration,
                    stats: stats,
                    success: true
                });
            } else {
                results.push({
                    gameId: testGameId,
                    mapSize: mapSize,
                    playerCount: testPlayers.length,
                    duration: duration,
                    error: result.error,
                    success: false
                });
            }
        }
        
        console.log('🧪 Test-Ergebnisse:');
        results.forEach(r => {
            console.log(`  ${r.gameId}: ${r.success ? '✅' : '❌'} (${r.duration}ms)`);
        });
        
        results.forEach(r => this.removeMap(r.gameId));
        
        return results;
    }
}

// ========================================
// EXPORT
// ========================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ServerMapGenerator;
}

if (typeof window !== 'undefined') {
    window.ServerMapGenerator = ServerMapGenerator;
}

console.log('✅ Server Map Generator geladen (Railway-kompatibel)');