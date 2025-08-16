// ServerMapGenerator.js - Server-seitige Kartengenerierung

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

        this.generatedMaps = new Map(); // Cache für generierte Karten
    }

    // ========================================
    // HAUPTMETHODE: KARTENGENERIERUNG
    // ========================================

    generateSynchronizedMap(gameId, mapSize = 20, seed = null, players = []) {
        console.log(`🗺️ Generiere synchronisierte Karte für Spiel ${gameId}...`);
        
        try {
            // Verwende gameId als Seed für Determinismus
            const mapSeed = seed || this.generateSeedFromGameId(gameId);
            
            // Generiere Basis-Karte
            const map = this.generateBaseMap(mapSize, mapSeed);
            
            // Platziere Gebäude
            this.placeBuildingsOnMap(map, mapSize, mapSeed, players.length);
            
            // Generiere Startpositionen für Spieler
            this.generateStartingPositions(map, mapSize, players, mapSeed);
            
            // Cache die Karte
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
        
        // Nachbearbeitung für realistische Terrain-Cluster
        this.smoothTerrain(map, size, seed);
        
        return map;
    }

    generateTile(x, y, mapSize, seed) {
        // Seeded Random für Determinismus
        const random = this.seededRandom(x + y * 1000 + seed * 10000);
        
        // Terrain-Auswahl basierend auf Position und Noise
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
        
        // Terrain-Wahrscheinlichkeiten basierend auf Position
        let terrainProbabilities = [...this.terrainTypes];
        
        // Berge eher am Rand
        if (normalizedDistance > 0.6) {
            const mountainIndex = terrainProbabilities.findIndex(t => t.id === 'mountains');
            if (mountainIndex >= 0) {
                terrainProbabilities[mountainIndex].probability *= 2;
            }
        }
        
        // Ebenen eher in der Mitte
        if (normalizedDistance < 0.4) {
            const plainsIndex = terrainProbabilities.findIndex(t => t.id === 'plains');
            if (plainsIndex >= 0) {
                terrainProbabilities[plainsIndex].probability *= 1.5;
            }
        }
        
        // Weighted Selection
        const totalProbability = terrainProbabilities.reduce((sum, t) => sum + t.probability, 0);
        let normalizedRandom = random * totalProbability;
        
        for (const terrain of terrainProbabilities) {
            normalizedRandom -= terrain.probability;
            if (normalizedRandom <= 0) {
                return { ...terrain }; // Kopie zurückgeben
            }
        }
        
        // Fallback
        return { ...this.terrainTypes[0] };
    }

    smoothTerrain(map, size, seed) {
        console.log('🌍 Glätte Terrain für realistische Cluster...');
        
        // Mehrere Durchgänge für natürlichere Terrain-Verteilung
        for (let pass = 0; pass < 3; pass++) {
            const newMap = JSON.parse(JSON.stringify(map)); // Deep copy
            
            for (let y = 1; y < size - 1; y++) {
                for (let x = 1; x < size - 1; x++) {
                    const neighbors = this.getNeighbors(map, x, y);
                    const dominantTerrain = this.findDominantTerrain(neighbors);
                    
                    // 30% Chance, das Terrain dem dominanten Nachbarn anzupassen
                    if (dominantTerrain && this.seededRandom(x + y * size + pass * 10000 + seed) < 0.3) {
                        newMap[y][x].terrain = { ...dominantTerrain };
                    }
                }
            }
            
            // Aktualisiere Map für nächsten Durchgang
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
        
        // Berechne Anzahl der Gebäude basierend auf Kartengröße
        const totalTiles = mapSize * mapSize;
        const buildingDensity = 0.025; // 2.5% der Felder haben Gebäude
        const totalBuildings = Math.floor(totalTiles * buildingDensity);
        
        // Stelle sicher, dass genug Hauptgebäude für Spieler vorhanden sind
        const mainBuildings = Math.max(playerCount + 2, Math.floor(totalBuildings * 0.4));
        const otherBuildings = totalBuildings - mainBuildings;
        
        console.log(`  Platziere ${mainBuildings} Hauptgebäude und ${otherBuildings} weitere Gebäude`);
        
        // Platziere Hauptgebäude (Städte und Burgen)
        this.placeMainBuildings(map, mapSize, mainBuildings, seed);
        
        // Platziere andere Gebäude
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
        // Bounds check
        if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) {
            return false;
        }
        
        const tile = map[y][x];
        
        // Schon ein Gebäude vorhanden
        if (tile.building) {
            return false;
        }
        
        // Ungeeignetes Terrain
        if (tile.terrain.id === 'water' || tile.terrain.id === 'mountains') {
            return false;
        }
        
        // Für Hauptgebäude: Mindestabstand zu anderen Gebäuden
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
        
        // Finde alle verfügbaren Gebäude
        const availableBuildings = this.findAllBuildings(map, 'city', 'castle');
        
        if (availableBuildings.length < players.length) {
            console.warn(`⚠️ Nicht genug Gebäude für alle Spieler (${availableBuildings.length} < ${players.length})`);
        }
        
        // Shuffle buildings für faire Verteilung
        this.shuffleArray(availableBuildings, seed);
        
        // Weise jedem Spieler ein Gebäude zu
        for (let i = 0; i < players.length && i < availableBuildings.length; i++) {
            const player = players[i];
            const building = availableBuildings[i];
            
            // Setze Spieler als Besitzer
            map[building.y][building.x].owner = player.id;
            map[building.y][building.x].building.owner = player.id;
            
            // Erstelle Starteinheit neben dem Gebäude
            const unitPosition = this.findNearbyEmptyTile(map, building.x, building.y, mapSize);
            if (unitPosition) {
                const startingUnit = this.createStartingUnit(player, seed + i);
                map[unitPosition.y][unitPosition.x].unit = startingUnit;
                
                console.log