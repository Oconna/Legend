// map-system.js - Kartengenerierung und -verwaltung

console.log('🗺️ Initialisiere Map System...');

// ========================================
// MAP SYSTEM CLASS
// ========================================

class MapSystem {
    constructor(gameSettings = {}) {
        this.gameSettings = gameSettings;
        this.mapData = null;
        this.canvas = null;
        this.ctx = null;
        this.tileSize = 32;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.selectedTile = null;
        this.hoveredTile = null;
        
        // Map generation settings
        this.mapSize = gameSettings.mapSize || 20;
        this.seed = gameSettings.seed || Math.random();
        this.serverMapLoaded = false;
        this.mapSyncId = null;
        
        this.initialize();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    initialize() {
        console.log('🗺️ Initialisiere Map System...');
        
        // Find canvas element
        this.canvas = document.getElementById('mapCanvas');
        if (!this.canvas) {
            console.error('❌ Map Canvas nicht gefunden!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('❌ Canvas 2D Context nicht verfügbar!');
            return;
        }
        
        // Setup canvas
        this.setupCanvas();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Generate initial map if no server map
        if (!this.serverMapLoaded) {
            this.generateMap();
        }
        
        console.log('✅ Map System initialisiert');
    }

    setupCanvas() {
        // Set canvas size
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        
        // Configure context
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Center view on map
        this.centerView();
    }

    setupEventListeners() {
        // Mouse events for map interaction
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('click', (e) => this.onMapClick(e));
        
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Window resize
        window.addEventListener('resize', () => this.onResize());
        
        // Context menu prevention
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // ========================================
    // MAP GENERATION
    // ========================================

    generateMap(size = this.mapSize, customSeed = null) {
        console.log(`🗺️ Generiere Karte (${size}x${size})...`);
        
        const seed = customSeed || this.seed;
        this.mapSize = size;
        
        // Initialize map array
        this.mapData = [];
        for (let y = 0; y < size; y++) {
            this.mapData[y] = [];
            for (let x = 0; x < size; x++) {
                this.mapData[y][x] = this.generateTile(x, y, seed);
            }
        }
        
        // Add buildings
        this.placeBuildingsOnMap();
        
        // Center view
        this.centerView();
        
        // Render map
        this.render();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('mapGenerated', {
            detail: { 
                mapData: this.mapData, 
                size: size,
                seed: seed
            }
        }));
        
        console.log('✅ Karte generiert');
        return this.mapData;
    }

    generateTile(x, y, seed) {
        // Seeded random number generator
        const random = this.seededRandom(x + y * 1000 + seed * 10000);
        
        // Base terrain selection with noise
        let terrain = this.selectBaseTerrain(x, y, random);
        
        // Apply biome rules
        terrain = this.applyBiomeRules(x, y, terrain, random);
        
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

    selectBaseTerrain(x, y, random) {
        const terrains = window.TERRAIN_TYPES || [
            { id: "grassland", name: "Grasland", color: "#90EE90", probability: 0.3 },
            { id: "forest", name: "Wald", color: "#228B22", probability: 0.2 },
            { id: "mountains", name: "Berge", color: "#A0522D", probability: 0.15 },
            { id: "hills", name: "Hügel", color: "#DEB887", probability: 0.15 },
            { id: "plains", name: "Ebene", color: "#FFFF99", probability: 0.2 }
        ];
        
        // Weighted selection
        let cumulativeProbability = 0;
        for (const terrain of terrains) {
            cumulativeProbability += terrain.probability || 0.1;
            if (random < cumulativeProbability) {
                return terrain;
            }
        }
        
        // Fallback
        return terrains[0];
    }

    applyBiomeRules(x, y, terrain, random) {
        const centerX = this.mapSize / 2;
        const centerY = this.mapSize / 2;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
        const normalizedDistance = distanceFromCenter / maxDistance;
        
        // Mountains more likely at edges
        if (normalizedDistance > 0.7 && random < 0.3) {
            return { id: "mountains", name: "Berge", color: "#A0522D", movementCost: 3, defenseBonus: 2 };
        }
        
        // Water at edges
        if (normalizedDistance > 0.8 && random < 0.4) {
            return { id: "water", name: "Wasser", color: "#4169E1", movementCost: 2, defenseBonus: 0 };
        }
        
        // Forest clusters
        if (terrain.id === "grassland" && random < 0.2) {
            return { id: "forest", name: "Wald", color: "#228B22", movementCost: 2, defenseBonus: 1 };
        }
        
        return terrain;
    }

    placeBuildingsOnMap() {
        if (!this.mapData) return;
        
        const buildingTypes = window.BUILDING_TYPES || [
            { id: "city", name: "Stadt", icon: "🏘️", color: "#FFD700" },
            { id: "castle", name: "Burg", icon: "🏰", color: "#8B4513" },
            { id: "village", name: "Dorf", icon: "🏘️", color: "#DEB887" }
        ];
        
        // Calculate number of buildings based on map size
        const totalTiles = this.mapSize * this.mapSize;
        const buildingCount = Math.floor(totalTiles / 50); // 1 building per 50 tiles
        
        console.log(`🏘️ Platziere ${buildingCount} Gebäude...`);
        
        for (let i = 0; i < buildingCount; i++) {
            let attempts = 0;
            let placed = false;
            
            while (!placed && attempts < 100) {
                const x = Math.floor(Math.random() * this.mapSize);
                const y = Math.floor(Math.random() * this.mapSize);
                const tile = this.mapData[y][x];
                
                // Check if tile is suitable for building
                if (this.isSuitableForBuilding(tile)) {
                    const buildingType = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
                    tile.building = {
                        type: buildingType.id,
                        name: buildingType.name,
                        hp: 100,
                        maxHp: 100,
                        owner: null
                    };
                    placed = true;
                }
                attempts++;
            }
        }
    }

    isSuitableForBuilding(tile) {
        // No building on water or mountains
        if (tile.terrain.id === "water" || tile.terrain.id === "mountains") {
            return false;
        }
        
        // No building if already has one
        if (tile.building) {
            return false;
        }
        
        return true;
    }

    // ========================================
    // SERVER MAP SYNCHRONIZATION
    // ========================================

    loadServerMap(serverMapData) {
        console.log('🗺️ Lade Server-Karte...', serverMapData);
        
        if (!serverMapData || !Array.isArray(serverMapData)) {
            console.error('❌ Ungültige Server-Kartendaten');
            return false;
        }
        
        this.mapData = serverMapData;
        this.mapSize = serverMapData.length;
        this.serverMapLoaded = true;
        
        // Center view and render
        this.centerView();
        this.render();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('mapLoaded', {
            detail: { 
                mapData: this.mapData,
                source: 'server'
            }
        }));
        
        console.log('✅ Server-Karte geladen');
        return true;
    }

    requestMapSync() {
        if (window.socketManager && window.socketManager.socket) {
            console.log('📡 Fordere Kartensynchronisation an...');
            socketManager.socket.emit('request-map-sync');
        } else {
            console.warn('⚠️ Socket Manager nicht verfügbar für Kartensynchronisation');
        }
    }

    // ========================================
    // RENDERING
    // ========================================

    render() {
        if (!this.ctx || !this.mapData) return;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Calculate visible tiles
        const visibleArea = this.getVisibleArea();
        
        // Render tiles
        for (let y = visibleArea.startY; y <= visibleArea.endY; y++) {
            for (let x = visibleArea.startX; x <= visibleArea.endX; x++) {
                if (this.isValidTile(x, y)) {
                    this.renderTile(x, y);
                }
            }
        }
        
        // Render UI overlays
        this.renderUI();
    }

    renderTile(x, y) {
        const tile = this.mapData[y][x];
        const screenPos = this.worldToScreen(x, y);
        const tileSize = this.tileSize * this.scale;
        
        // Skip if tile is not visible on screen
        if (screenPos.x + tileSize < 0 || screenPos.x > this.canvas.width ||
            screenPos.y + tileSize < 0 || screenPos.y > this.canvas.height) {
            return;
        }
        
        // Render terrain
        this.ctx.fillStyle = tile.terrain.color || '#90EE90';
        this.ctx.fillRect(screenPos.x, screenPos.y, tileSize, tileSize);
        
        // Render terrain border
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(screenPos.x, screenPos.y, tileSize, tileSize);
        
        // Render building
        if (tile.building) {
            this.renderBuilding(tile, screenPos, tileSize);
        }
        
        // Render unit
        if (tile.unit) {
            this.renderUnit(tile, screenPos, tileSize);
        }
        
        // Render selection/hover effects
        if (this.selectedTile && this.selectedTile.x === x && this.selectedTile.y === y) {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(screenPos.x, screenPos.y, tileSize, tileSize);
        } else if (this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y) {
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(screenPos.x, screenPos.y, tileSize, tileSize);
        }
    }

    renderBuilding(tile, screenPos, tileSize) {
        const building = tile.building;
        const buildingType = window.BUILDING_TYPES?.find(t => t.id === building.type);
        
        // Building background
        this.ctx.fillStyle = buildingType?.color || '#8B4513';
        this.ctx.fillRect(
            screenPos.x + tileSize * 0.1,
            screenPos.y + tileSize * 0.1,
            tileSize * 0.8,
            tileSize * 0.8
        );
        
        // Building icon/text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `${Math.max(12, tileSize * 0.4)}px Arial`;
        this.ctx.fillText(
            buildingType?.icon || '🏘️',
            screenPos.x + tileSize / 2,
            screenPos.y + tileSize / 2
        );
        
        // Owner indicator
        if (tile.owner) {
            this.ctx.fillStyle = this.getPlayerColor(tile.owner);
            this.ctx.fillRect(
                screenPos.x,
                screenPos.y,
                tileSize * 0.2,
                tileSize * 0.2
            );
        }
    }

    renderUnit(tile, screenPos, tileSize) {
        const unit = tile.unit;
        
        // Unit background circle
        this.ctx.fillStyle = this.getPlayerColor(unit.owner) || '#666666';
        this.ctx.beginPath();
        this.ctx.arc(
            screenPos.x + tileSize / 2,
            screenPos.y + tileSize / 2,
            tileSize * 0.3,
            0,
            2 * Math.PI
        );
        this.ctx.fill();
        
        // Unit icon/text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `${Math.max(10, tileSize * 0.3)}px Arial`;
        this.ctx.fillText(
            unit.icon || '⚔️',
            screenPos.x + tileSize / 2,
            screenPos.y + tileSize / 2
        );
        
        // Health bar
        if (unit.hp < unit.maxHp) {
            const barWidth = tileSize * 0.8;
            const barHeight = 4;
            const healthPercent = unit.hp / unit.maxHp;
            
            // Background
            this.ctx.fillStyle = '#FF0000';
            this.ctx.fillRect(
                screenPos.x + tileSize * 0.1,
                screenPos.y + tileSize * 0.85,
                barWidth,
                barHeight
            );
            
            // Health
            this.ctx.fillStyle = '#00FF00';
            this.ctx.fillRect(
                screenPos.x + tileSize * 0.1,
                screenPos.y + tileSize * 0.85,
                barWidth * healthPercent,
                barHeight
            );
        }
    }

    renderUI() {
        // Render minimap (optional)
        // Render coordinates
        // Render debug info
        
        if (window.GAME_CONFIG?.DEBUG_MODE) {
            this.renderDebugInfo();
        }
    }

    renderDebugInfo() {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        
        const debugInfo = [
            `Map Size: ${this.mapSize}x${this.mapSize}`,
            `Scale: ${this.scale.toFixed(2)}`,
            `Offset: (${this.offsetX.toFixed(0)}, ${this.offsetY.toFixed(0)})`,
            `Server Map: ${this.serverMapLoaded ? 'Yes' : 'No'}`
        ];
        
        debugInfo.forEach((info, index) => {
            this.ctx.fillText(info, 10, 20 + index * 15);
        });
        
        this.ctx.textAlign = 'center'; // Reset
    }

    // ========================================
    // COORDINATE CONVERSION
    // ========================================

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX * this.tileSize * this.scale) + this.offsetX,
            y: (worldY * this.tileSize * this.scale) + this.offsetY
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: Math.floor((screenX - this.offsetX) / (this.tileSize * this.scale)),
            y: Math.floor((screenY - this.offsetY) / (this.tileSize * this.scale))
        };
    }

    getVisibleArea() {
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this.canvas.width, this.canvas.height);
        
        return {
            startX: Math.max(0, topLeft.x - 1),
            startY: Math.max(0, topLeft.y - 1),
            endX: Math.min(this.mapSize - 1, bottomRight.x + 1),
            endY: Math.min(this.mapSize - 1, bottomRight.y + 1)
        };
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    onMouseDown(e) {
        if (e.button === 2) { // Right mouse button
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.canvas.style.cursor = 'grabbing';
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (this.isDragging) {
            // Pan the map
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            
            this.offsetX += deltaX;
            this.offsetY += deltaY;
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            
            this.render();
        } else {
            // Update hovered tile
            const worldPos = this.screenToWorld(mouseX, mouseY);
            if (this.isValidTile(worldPos.x, worldPos.y)) {
                this.hoveredTile = worldPos;
                this.render();
            }
        }
    }

    onMouseUp(e) {
        if (e.button === 2) {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        }
    }

    onMapClick(e) {
        if (this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldPos = this.screenToWorld(mouseX, mouseY);
        
        if (this.isValidTile(worldPos.x, worldPos.y)) {
            this.selectedTile = worldPos;
            this.render();
            
            // Dispatch map click event
            window.dispatchEvent(new CustomEvent('mapTileClicked', {
                detail: {
                    x: worldPos.x,
                    y: worldPos.y,
                    tile: this.mapData[worldPos.y][worldPos.x]
                }
            }));
            
            // Notify game controller
            if (window.gameController && typeof gameController.handleMapClick === 'function') {
                gameController.handleMapClick(worldPos.x, worldPos.y);
            }
        }
    }

    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.5, Math.min(3, this.scale * zoomFactor));
        
        if (newScale !== this.scale) {
            // Zoom towards mouse position
            const worldPos = this.screenToWorld(mouseX, mouseY);
            
            this.scale = newScale;
            
            const newScreenPos = this.worldToScreen(worldPos.x, worldPos.y);
            this.offsetX += mouseX - newScreenPos.x;
            this.offsetY += mouseY - newScreenPos.y;
            
            this.render();
        }
    }

    onKeyDown(e) {
        const moveSpeed = 20;
        
        switch (e.key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                this.offsetY += moveSpeed;
                this.render();
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                this.offsetY -= moveSpeed;
                this.render();
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                this.offsetX += moveSpeed;
                this.render();
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                this.offsetX -= moveSpeed;
                this.render();
                break;
            case ' ':
                this.centerView();
                this.render();
                e.preventDefault();
                break;
        }
    }

    onResize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this.render();
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    centerView() {
        if (!this.mapData) return;
        
        const mapPixelWidth = this.mapSize * this.tileSize * this.scale;
        const mapPixelHeight = this.mapSize * this.tileSize * this.scale;
        
        this.offsetX = (this.canvas.width - mapPixelWidth) / 2;
        this.offsetY = (this.canvas.height - mapPixelHeight) / 2;
    }

    isValidTile(x, y) {
        return x >= 0 && x < this.mapSize && y >= 0 && y < this.mapSize;
    }

    getTile(x, y) {
        if (this.isValidTile(x, y)) {
            return this.mapData[y][x];
        }
        return null;
    }

    setTileUnit(x, y, unit) {
        const tile = this.getTile(x, y);
        if (tile) {
            tile.unit = unit;
            this.render();
        }
    }

    setTileOwner(x, y, playerId) {
        const tile = this.getTile(x, y);
        if (tile) {
            tile.owner = playerId;
            this.render();
        }
    }

    getPlayerColor(playerId) {
        const colors = [
            '#FF0000', '#0000FF', '#00FF00', '#FFFF00',
            '#FF00FF', '#00FFFF', '#FFA500', '#800080'
        ];
        
        if (typeof playerId === 'number') {
            return colors[playerId % colors.length];
        }
        
        // Hash string to color
        let hash = 0;
        for (let i = 0; i < playerId.length; i++) {
            hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    // ========================================
    // PUBLIC API METHODS
    // ========================================

    zoom(factor) {
        this.scale = Math.max(0.5, Math.min(3, this.scale * factor));
        this.centerView();
        this.render();
    }

    zoomIn() {
        this.zoom(1.2);
    }

    zoomOut() {
        this.zoom(0.8);
    }

    resetView() {
        this.scale = 1;
        this.centerView();
        this.render();
    }

    export() {
        return {
            mapData: this.mapData,
            mapSize: this.mapSize,
            seed: this.seed
        };
    }

    import(mapConfig) {
        if (mapConfig.mapData) {
            this.mapData = mapConfig.mapData;
            this.mapSize = mapConfig.mapSize || this.mapData.length;
            this.seed = mapConfig.seed || this.seed;
            this.centerView();
            this.render();
            return true;
        }
        return false;
    }
}

// ========================================
// GLOBAL EXPORT
// ========================================

// Make MapSystem available globally
window.MapSystem = MapSystem;

// Debug functions for browser console
window.debugMap = () => {
    if (window.mapSystem) {
        console.log('🗺️ Map System Debug Info:');
        console.log('  Map Size:', mapSystem.mapSize);
        console.log('  Scale:', mapSystem.scale);
        console.log('  Server Map Loaded:', mapSystem.serverMapLoaded);
        console.log('  Map Data:', mapSystem.mapData);
    }
};

console.log('✅ Map System geladen und bereit');
console.log('🧪 Verwende window.debugMap() für Debug-Informationen');