// server.js - Erweiterte Kartengenerierung mit Synchronisation
// Fügen Sie diese Klasse zu Ihrem server.js hinzu:

class ServerMapGenerator {
    constructor() {
        this.terrainTypes = ['grass', 'forest', 'mountain', 'water', 'swamp'];
        this.buildingTypes = ['city', 'castle'];
    }

    // Hauptfunktion für Kartengenerierung
    generateSynchronizedMap(gameId, mapSize, playerCount) {
        console.log(`🗺️ Generiere synchronisierte Karte für Spiel ${gameId}: ${mapSize}x${mapSize}`);
        
        // Verwende Game-ID als Seed für konsistente Generierung
        const seed = this.createSeed(gameId);
        const random = this.seededRandom(seed);
        
        // Initialisiere leere Karte
        const map = this.initializeEmptyMap(mapSize);
        
        // Generiere Terrain-Features in mehreren Phasen
        this.generateBaseTerrain(map, mapSize, random);
        this.generateWaterBodies(map, mapSize, random);
        this.generateMountainRanges(map, mapSize, random);
        this.generateForestPatches(map, mapSize, random);
        this.generateSwampAreas(map, mapSize, random);
        this.generateBuildings(map, mapSize, playerCount, random);
        this.smoothTerrain(map, mapSize, random);
        this.ensureConnectivity(map, mapSize);
        
        // Validiere Karte
        const validation = this.validateMap(map, mapSize, playerCount);
        if (!validation.valid) {
            console.warn('⚠️ Karte invalid, regeneriere...', validation.issues);
            return this.generateSynchronizedMap(gameId, mapSize, playerCount);
        }
        
        console.log(`✅ Synchronisierte Karte generiert für ${gameId}`);
        return {
            mapData: map,
            mapSize: mapSize,
            seed: seed,
            generatedAt: new Date(),
            validation: validation
        };
    }

    // Seed-Generierung basierend auf Game-ID
    createSeed(gameId) {
        let hash = 0;
        for (let i = 0; i < gameId.length; i++) {
            const char = gameId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Konvertierung zu 32-Bit Integer
        }
        return Math.abs(hash);
    }

    // Seeded Random Number Generator für konsistente Ergebnisse
    seededRandom(seed) {
        let value = seed;
        return function() {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }

    // Initialisiere leere Karte
    initializeEmptyMap(size) {
        const map = [];
        for (let y = 0; y < size; y++) {
            map[y] = [];
            for (let x = 0; x < size; x++) {
                map[y][x] = {
                    terrain: 'grass',
                    unit: null,
                    owner: null,
                    resources: null,
                    elevation: 0,
                    moisture: 0.5
                };
            }
        }
        return map;
    }

    // Generiere Basis-Terrain mit Noise
    generateBaseTerrain(map, size, random) {
        // Erstelle Höhen- und Feuchtigkeitskarten
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Verwende Perlin-Noise-ähnlichen Algorithmus
                const elevation = this.generateNoise(x, y, size, random, 0.1);
                const moisture = this.generateNoise(x, y, size, random, 0.15, 1000);
                
                map[y][x].elevation = elevation;
                map[y][x].moisture = moisture;
                
                // Setze Basis-Terrain basierend auf Elevation/Moisture
                if (elevation > 0.7) {
                    map[y][x].terrain = 'mountain';
                } else if (elevation < 0.3 && moisture > 0.6) {
                    map[y][x].terrain = 'swamp';
                } else if (moisture > 0.7) {
                    map[y][x].terrain = 'forest';
                } else {
                    map[y][x].terrain = 'grass';
                }
            }
        }
    }

    // Einfacher Noise-Generator
    generateNoise(x, y, size, random, frequency, offset = 0) {
        const scale = size * frequency;
        const scaledX = (x + offset) / scale;
        const scaledY = (y + offset) / scale;
        
        // Einfache Interpolation zwischen zufälligen Werten
        const x1 = Math.floor(scaledX);
        const y1 = Math.floor(scaledY);
        const x2 = x1 + 1;
        const y2 = y1 + 1;
        
        const fx = scaledX - x1;
        const fy = scaledY - y1;
        
        // Generiere Eckwerte
        const corner1 = this.pseudoRandom(x1, y1, random);
        const corner2 = this.pseudoRandom(x2, y1, random);
        const corner3 = this.pseudoRandom(x1, y2, random);
        const corner4 = this.pseudoRandom(x2, y2, random);
        
        // Bilineare Interpolation
        const i1 = this.interpolate(corner1, corner2, fx);
        const i2 = this.interpolate(corner3, corner4, fx);
        return this.interpolate(i1, i2, fy);
    }

    pseudoRandom(x, y, random) {
        // Pseudo-zufälliger Wert basierend auf Koordinaten
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 0.5 + 0.25;
    }

    interpolate(a, b, t) {
        return a * (1 - t) + b * t;
    }

    // Generiere Wasserkörper
    generateWaterBodies(map, size, random) {
        const waterBodies = Math.max(2, Math.floor(size / 15));
        
        for (let i = 0; i < waterBodies; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const maxRadius = 3 + Math.floor(random() * (size / 10));
            
            this.generateCircularFeature(map, size, centerX, centerY, maxRadius, 'water', 0.8, random);
        }
    }

    // Generiere Gebirgsketten
    generateMountainRanges(map, size, random) {
        const ranges = Math.max(1, Math.floor(size / 20));
        
        for (let i = 0; i < ranges; i++) {
            const startX = Math.floor(random() * size);
            const startY = Math.floor(random() * size);
            const length = 8 + Math.floor(random() * (size / 5));
            
            this.generateLinearFeature(map, size, startX, startY, length, 'mountain', 0.7, random);
        }
    }

    // Generiere Waldgebiete
    generateForestPatches(map, size, random) {
        const patches = Math.max(3, Math.floor(size / 8));
        
        for (let i = 0; i < patches; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const radius = 4 + Math.floor(random() * 6);
            
            this.generateCircularFeature(map, size, centerX, centerY, radius, 'forest', 0.6, random);
        }
    }

    // Generiere Sumpfgebiete
    generateSwampAreas(map, size, random) {
        const swamps = Math.max(1, Math.floor(size / 25));
        
        for (let i = 0; i < swamps; i++) {
            const centerX = Math.floor(random() * size);
            const centerY = Math.floor(random() * size);
            const radius = 2 + Math.floor(random() * 4);
            
            this.generateCircularFeature(map, size, centerX, centerY, radius, 'swamp', 0.5, random);
        }
    }

    // Generiere Gebäude (Städte und Burgen)
    generateBuildings(map, size, playerCount, random) {
        // Anzahl Gebäude basierend auf Kartengröße und Spieleranzahl
        const citiesPerPlayer = Math.max(1, Math.floor(size / 20));
        const totalCities = playerCount * citiesPerPlayer;
        const totalCastles = Math.max(playerCount, Math.floor(totalCities / 3));
        
        console.log(`🏰 Generiere ${totalCities} Städte und ${totalCastles} Burgen`);
        
        // Platziere Städte
        this.placeBuildingsWithSpacing(map, size, 'city', totalCities, random, 5);
        
        // Platziere Burgen
        this.placeBuildingsWithSpacing(map, size, 'castle', totalCastles, random, 8);
    }

    // Platziere Gebäude mit Mindestabstand
    placeBuildingsWithSpacing(map, size, buildingType, count, random, minSpacing) {
        const placed = [];
        let attempts = 0;
        const maxAttempts = size * size;
        
        while (placed.length < count && attempts < maxAttempts) {
            const x = Math.floor(random() * size);
            const y = Math.floor(random() * size);
            
            // Prüfe ob Position gültig ist
            if (this.isValidBuildingPosition(map, size, x, y, placed, minSpacing)) {
                map[y][x].terrain = buildingType;
                placed.push({ x, y, type: buildingType });
                console.log(`🏘️ ${buildingType} platziert bei (${x}, ${y})`);
            }
            
            attempts++;
        }
        
        if (placed.length < count) {
            console.warn(`⚠️ Nur ${placed.length}/${count} ${buildingType} platziert nach ${attempts} Versuchen`);
        }
    }

    // Prüfe ob Position für Gebäude geeignet ist
    isValidBuildingPosition(map, size, x, y, existingBuildings, minSpacing) {
        // Prüfe Kartengrenzen
        if (x < 1 || x >= size - 1 || y < 1 || y >= size - 1) return false;
        
        // Prüfe ob Terrain geeignet ist (nicht Wasser/Berg)
        const terrain = map[y][x].terrain;
        if (terrain === 'water' || terrain === 'mountain') return false;
        
        // Prüfe Mindestabstand zu anderen Gebäuden
        for (const building of existingBuildings) {
            const distance = Math.sqrt(
                Math.pow(x - building.x, 2) + Math.pow(y - building.y, 2)
            );
            if (distance < minSpacing) return false;
        }
        
        return true;
    }

    // Generiere kreisförmige Features
    generateCircularFeature(map, size, centerX, centerY, maxRadius, terrainType, density, random) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const distance = Math.sqrt(
                    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
                );
                
                if (distance <= maxRadius) {
                    const probability = density * (1 - distance / maxRadius);
                    if (random() < probability) {
                        map[y][x].terrain = terrainType;
                    }
                }
            }
        }
    }

    // Generiere lineare Features (Gebirgsketten)
    generateLinearFeature(map, size, startX, startY, length, terrainType, density, random) {
        const angle = random() * Math.PI * 2;
        const deltaX = Math.cos(angle);
        const deltaY = Math.sin(angle);
        
        for (let i = 0; i < length; i++) {
            const x = Math.round(startX + deltaX * i);
            const y = Math.round(startY + deltaY * i);
            
            if (x >= 0 && x < size && y >= 0 && y < size) {
                if (random() < density) {
                    map[y][x].terrain = terrainType;
                    
                    // Füge Breiten-Variation hinzu
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const varX = x + dx;
                            const varY = y + dy;
                            
                            if (varX >= 0 && varX < size && varY >= 0 && varY < size) {
                                if (random() < density * 0.4) {
                                    map[varY][varX].terrain = terrainType;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Glätte Terrain für natürlicheres Aussehen
    smoothTerrain(map, size, random) {
        const tempMap = JSON.parse(JSON.stringify(map));
        
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                // Nur bei niedriger Wahrscheinlichkeit glätten
                if (random() > 0.1) continue;
                
                const terrainCounts = {};
                
                // Zähle umgebende Terrain-Typen
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const terrain = map[y + dy][x + dx].terrain;
                        terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
                    }
                }
                
                // Finde häufigsten Terrain-Typ
                const mostCommon = Object.keys(terrainCounts).reduce((a, b) =>
                    terrainCounts[a] > terrainCounts[b] ? a : b
                );
                
                // Glätte nur wenn deutliche Mehrheit vorhanden
                if (terrainCounts[mostCommon] >= 6) {
                    tempMap[y][x].terrain = mostCommon;
                }
            }
        }
        
        // Kopiere geglättete Werte zurück
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                map[y][x].terrain = tempMap[y][x].terrain;
            }
        }
    }

    // Stelle sicher, dass alle Landgebiete verbunden sind
    ensureConnectivity(map, size) {
        // Einfache Connectivity-Prüfung und -Korrektur
        // Finde alle Landgebiete und verbinde isolierte Inseln
        
        const visited = new Set();
        const landTiles = [];
        
        // Sammle alle Landfelder
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (map[y][x].terrain !== 'water') {
                    landTiles.push({ x, y });
                }
            }
        }
        
        if (landTiles.length === 0) return;
        
        // Finde größte zusammenhängende Landmasse
        const mainLand = this.findLargestLandmass(map, size, landTiles);
        
        // Verbinde isolierte Gebiete mit Hauptlandmasse
        this.connectIsolatedAreas(map, size, mainLand, landTiles);
    }

    findLargestLandmass(map, size, landTiles) {
        const visited = new Set();
        let largestGroup = [];
        
        for (const tile of landTiles) {
            const key = `${tile.x},${tile.y}`;
            if (visited.has(key)) continue;
            
            const group = this.floodFill(map, size, tile.x, tile.y, visited);
            if (group.length > largestGroup.length) {
                largestGroup = group;
            }
        }
        
        return largestGroup;
    }

    floodFill(map, size, startX, startY, visited) {
        const group = [];
        const stack = [{ x: startX, y: startY }];
        
        while (stack.length > 0) {
            const { x, y } = stack.pop();
            const key = `${x},${y}`;
            
            if (visited.has(key)) continue;
            if (x < 0 || x >= size || y < 0 || y >= size) continue;
            if (map[y][x].terrain === 'water') continue;
            
            visited.add(key);
            group.push({ x, y });
            
            // Füge Nachbarn hinzu
            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }
        
        return group;
    }

    connectIsolatedAreas(map, size, mainLand, allLandTiles) {
        // Vereinfachte Verbindung: Wandle einige Wasserfelder in Grasland um
        const mainLandSet = new Set(mainLand.map(t => `${t.x},${t.y}`));
        
        for (const tile of allLandTiles) {
            const key = `${tile.x},${tile.y}`;
            if (mainLandSet.has(key)) continue;
            
            // Finde nächsten Punkt zur Hauptlandmasse
            const nearest = this.findNearestMainLandTile(tile, mainLand);
            if (nearest && this.getDistance(tile, nearest) <= 3) {
                // Erstelle einfache Verbindung
                this.createSimplePath(map, size, tile, nearest);
            }
        }
    }

    findNearestMainLandTile(tile, mainLand) {
        let nearest = null;
        let minDistance = Infinity;
        
        for (const landTile of mainLand) {
            const distance = this.getDistance(tile, landTile);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = landTile;
            }
        }
        
        return nearest;
    }

    getDistance(tile1, tile2) {
        return Math.sqrt(
            Math.pow(tile1.x - tile2.x, 2) + Math.pow(tile1.y - tile2.y, 2)
        );
    }

    createSimplePath(map, size, from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        for (let i = 0; i <= steps; i++) {
            const x = Math.round(from.x + (dx * i) / steps);
            const y = Math.round(from.y + (dy * i) / steps);
            
            if (x >= 0 && x < size && y >= 0 && y < size) {
                if (map[y][x].terrain === 'water') {
                    map[y][x].terrain = 'grass';
                }
            }
        }
    }

    // Validiere generierte Karte
    validateMap(map, size, playerCount) {
        const issues = [];
        const stats = this.calculateMapStats(map, size);
        
        // Prüfe Minimum-Anforderungen
        if (stats.cities < playerCount) {
            issues.push(`Zu wenige Städte: ${stats.cities} < ${playerCount}`);
        }
        
        if (stats.castles < Math.ceil(playerCount / 2)) {
            issues.push(`Zu wenige Burgen: ${stats.castles} < ${Math.ceil(playerCount / 2)}`);
        }
        
        if (stats.landPercentage < 0.6) {
            issues.push(`Zu wenig Land: ${(stats.landPercentage * 100).toFixed(1)}% < 60%`);
        }
        
        if (stats.waterPercentage > 0.4) {
            issues.push(`Zu viel Wasser: ${(stats.waterPercentage * 100).toFixed(1)}% > 40%`);
        }
        
        return {
            valid: issues.length === 0,
            issues: issues,
            stats: stats
        };
    }

    calculateMapStats(map, size) {
        const stats = {
            totalTiles: size * size,
            terrainCounts: {},
            cities: 0,
            castles: 0,
            landPercentage: 0,
            waterPercentage: 0
        };
        
        // Zähle Terrain-Typen
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const terrain = map[y][x].terrain;
                stats.terrainCounts[terrain] = (stats.terrainCounts[terrain] || 0) + 1;
                
                if (terrain === 'city') stats.cities++;
                if (terrain === 'castle') stats.castles++;
            }
        }
        
        // Berechne Prozentsätze
        const waterTiles = stats.terrainCounts.water || 0;
        const landTiles = stats.totalTiles - waterTiles;
        
        stats.waterPercentage = waterTiles / stats.totalTiles;
        stats.landPercentage = landTiles / stats.totalTiles;
        
        return stats;
    }
}

// Export the class
module.exports = ServerMapGenerator;