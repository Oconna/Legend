// map-system.js - Karten-Rendering und Interaktion (Komplett)

console.log('🗺️ Initialisiere Map System...');

// ========================================
// TERRAIN DEFINITIONS
// ========================================

const TERRAIN_DEFINITIONS = {
    grass: {
        name: 'Wiese',
        color: '#27ae60',
        movementCost: { ground: 1, flying: 1, naval: -1 },
        symbol: '🌱',
        goldIncome: 0,
        defensiveBonus: 0
    },
    forest: {
        name: 'Wald',
        color: '#229954',
        movementCost: { ground: 2, flying: 1, naval: -1 },
        symbol: '🌲',
        goldIncome: 0,
        defensiveBonus: 1
    },
    mountain: {
        name: 'Berge',
        color: '#95a5a6',
        movementCost: { ground: 3, flying: 1, naval: -1 },
        symbol: '⛰️',
        goldIncome: 0,
        defensiveBonus: 2
    },
    swamp: {
        name: 'Sumpf',
        color: '#8b4513',
        movementCost: { ground: 3, flying: 1, naval: 1 },
        symbol: '🐸',
        goldIncome: 0,
        defensiveBonus: -1
    },
    water: {
        name: 'Wasser',
        color: '#3498db',
        movementCost: { ground: -1, flying: 1, naval: 1 },
        symbol: '💧',
        goldIncome: 0,
        defensiveBonus: 0
    },
    desert: {
        name: 'Wüste',
        color: '#f4d03f',
        movementCost: { ground: 2, flying: 1, naval: -1 },
        symbol: '🏜️',
        goldIncome: 0,
        defensiveBonus: 0
    },
    road: {
        name: 'Straße',
        color: '#7f8c8d',
        movementCost: { ground: 0.5, flying: 1, naval: -1 },
        symbol: '🛤️',
        goldIncome: 0,
        defensiveBonus: 0
    },
    bridge: {
        name: 'Brücke',
        color: '#8d6e63',
        movementCost: { ground: 1, flying: 1, naval: 1 },
        symbol: '🌉',
        goldIncome: 0,
        defensiveBonus: 0
    },
    city: {
        name: 'Stadt',
        color: '#e67e22',
        movementCost: { ground: 1, flying: 1, naval: -1 },
        symbol: '🏘️',
        goldIncome: 3,
        defensiveBonus: 1,
        capturable: true,
        recruitable: true
    },
    castle: {
        name: 'Burg',
        color: '#9b59b6',
        movementCost: { ground: 1, flying: 1, naval: -1 },
        symbol: '🏰',
        goldIncome: 5,
        defensiveBonus: 3,
        capturable: true,
        recruitable: true
    },
    village: {
        name: 'Dorf',
        color: '#d68910',
        movementCost: { ground: 1, flying: 1, naval: -1 },
        symbol: '🏡',
        goldIncome: 1,
        defensiveBonus: 0,
        capturable: true
    },
    tower: {
        name: 'Turm',
        color: '#5d4e75',
        movementCost: { ground: 1, flying: 1, naval: -1 },
        symbol: '🗼',
        goldIncome: 2,
        defensiveBonus: 2,
        capturable: true
    }
};

// ========================================
// GAME CONFIG
// ========================================

const GAME_CONFIG = {
    DEFAULT_MAP_SIZE: 30,
    TILE_SIZE: 32,
    DEFAULT_ZOOM: 1.0,
    MIN_ZOOM: 0.3,
    MAX_ZOOM: 3.0,
    ZOOM_FACTOR: 1.2,
    PAN_SPEED: 50
};

// ========================================
// GAME UTILS
// ========================================

const GameUtils = {
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    
    isValidPosition: (x, y, mapSize) => x >= 0 && x < mapSize && y >= 0 && y < mapSize,
    
    distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    
    debounce: (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), delay);
        };
    }
};

// ========================================
// GAME STATE MANAGER
// ========================================

class GameState {
    constructor() {
        this.data = {
            selectedTile: null,
            selectedUnit: null,
            playerUnits: [],
            mapData: null,
            currentPlayer: null,
            isMyTurn: false,
            selectedRace: null
        };
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    selectTile(x, y) {
        this.data.selectedTile = { x, y };
        this.emit('selectedTileChanged', this.data.selectedTile);
    }

    selectUnit(unit) {
        this.data.selectedUnit = unit;
        this.emit('selectedUnitChanged', unit);
    }

    setMapData(mapData) {
        this.data.mapData = mapData;
    }
}

const gameState = new GameState();

// ========================================
// MAP SYSTEM CLASS
// ========================================

class MapSystem {
    constructor(gameSettings = null) {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = null;
        this.gameSettings = gameSettings;
        
        // Map Properties
        this.mapSize = gameSettings?.mapSize || GAME_CONFIG.DEFAULT_MAP_SIZE;
        this.tileSize = GAME_CONFIG.TILE_SIZE;
        this.mapData = [];
        
        // Camera System
        this.camera = {
            x: 0,
            y: 0,
            zoom: GAME_CONFIG.DEFAULT_ZOOM,
            targetZoom: GAME_CONFIG.DEFAULT_ZOOM,
            minZoom: GAME_CONFIG.MIN_ZOOM,
            maxZoom: GAME_CONFIG.MAX_ZOOM
        };
        
        // Interaction State
        this.isDragging = false;
        this.isRightDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.hoveredTile = null;
        
        // Rendering State
        this.needsRedraw = true;
        this.renderRequestId = null;
        this.lastRenderTime = 0;
        
        // Performance Monitoring
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = 0;
        
        this.init();
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    init() {
        if (!this.canvas) {
            console.error('❌ Canvas nicht gefunden!');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('❌ Canvas Context nicht verfügbar!');
            return;
        }
        
        this.initializeCanvas();
        this.initializeMap();
        this.setupEventListeners();
        this.setupGameStateListeners();
        this.generateMap();
        this.centerCamera();
        this.startRenderLoop();
        
        console.log('✅ Map System initialisiert');
    }

    initializeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // High-DPI support
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        // Set CSS size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        console.log(`📐 Canvas initialisiert: ${this.canvas.width}x${this.canvas.height} (DPR: ${dpr})`);
    }

    initializeMap() {
        this.mapData = [];
        for (let y = 0; y < this.mapSize; y++) {
            this.mapData[y] = [];
            for (let x = 0; x < this.mapSize; x++) {
                this.mapData[y][x] = {
                    terrain: 'grass',
                    explored: true,
                    unit: null,
                    building: null,
                    resources: null,
                    owner: null
                };
            }
        }
        
        gameState.setMapData(this.mapData);
        console.log(`🗺️ Karte initialisiert: ${this.mapSize}x${this.mapSize} = ${this.mapSize * this.mapSize} Felder`);
    }

    setupEventListeners() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Touch Events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Keyboard Events
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Window Events
        window.addEventListener('resize', GameUtils.debounce(() => this.onResize(), 100));
        
        // Custom Events
        window.addEventListener('unitMoved', (e) => this.onUnitMoved(e.detail));
        window.addEventListener('unitAttacked', (e) => this.onUnitAttacked(e.detail));
        window.addEventListener('gameStarted', (e) => this.onGameStarted(e.detail));
    }

    setupGameStateListeners() {
        gameState.on('selectedUnitChanged', () => this.markForRedraw());
        gameState.on('selectedTileChanged', () => this.markForRedraw());
        gameState.on('playerUnitsChanged', () => this.markForRedraw());
        gameState.on('isMyTurnChanged', () => this.markForRedraw());
    }

    // ========================================
    // MAP GENERATION
    // ========================================

    generateMap() {
        console.log('🎨 Generiere Karte...');
        
        // Clear map
        this.clearMap();
        
        // Generate terrain using multiple passes
        this.generateTerrain();
        this.generateWater();
        this.generateMountains();
        this.generateForests();
        this.generateBuildings();
        this.smoothTerrain();
        
        this.markForRedraw();
        console.log('✅ Karte generiert');
    }

    clearMap() {
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                this.mapData[y][x] = {
                    terrain: 'grass',
                    explored: true,
                    unit: null,
                    building: null,
                    resources: null,
                    owner: null
                };
            }
        }
    }

    generateTerrain() {
        // Base terrain - mostly grass
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                this.mapData[y][x].terrain = 'grass';
            }
        }
    }

    generateWater() {
        // Generate water bodies
        const waterSources = Math.floor(this.mapSize / 15);
        
        for (let i = 0; i < waterSources; i++) {
            const centerX = Math.floor(Math.random() * this.mapSize);
            const centerY = Math.floor(Math.random() * this.mapSize);
            const radius = 2 + Math.floor(Math.random() * 4);
            
            this.generateCircularFeature(centerX, centerY, radius, 'water', 0.7);
        }
    }

    generateMountains() {
        // Generate mountain ranges
        const mountainChains = Math.floor(this.mapSize / 20);
        
        for (let i = 0; i < mountainChains; i++) {
            const startX = Math.floor(Math.random() * this.mapSize);
            const startY = Math.floor(Math.random() * this.mapSize);
            const length = 5 + Math.floor(Math.random() * 10);
            
            this.generateLinearFeature(startX, startY, length, 'mountain', 0.6);
        }
    }

    generateForests() {
        // Generate forest patches
        const forestPatches = Math.floor(this.mapSize / 8);
        
        for (let i = 0; i < forestPatches; i++) {
            const centerX = Math.floor(Math.random() * this.mapSize);
            const centerY = Math.floor(Math.random() * this.mapSize);
            const radius = 3 + Math.floor(Math.random() * 5);
            
            this.generateCircularFeature(centerX, centerY, radius, 'forest', 0.5);
        }
    }

    generateBuildings() {
        // Generate cities and castles
        const cityCount = Math.max(2, Math.floor(this.mapSize / 15));
        const castleCount = Math.max(1, Math.floor(this.mapSize / 20));
        
        // Place cities
        for (let i = 0; i < cityCount; i++) {
            this.placeBuildingRandomly('city');
        }
        
        // Place castles
        for (let i = 0; i < castleCount; i++) {
            this.placeBuildingRandomly('castle');
        }
    }

    placeBuildingRandomly(buildingType) {
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            const x = Math.floor(Math.random() * this.mapSize);
            const y = Math.floor(Math.random() * this.mapSize);
            
            if (this.canPlaceBuilding(x, y)) {
                this.mapData[y][x].terrain = buildingType;
                return true;
            }
            attempts++;
        }
        
        return false;
    }

    canPlaceBuilding(x, y) {
        if (!this.isValidPosition(x, y)) return false;
        
        const terrain = this.mapData[y][x].terrain;
        if (terrain !== 'grass') return false;
        
        // Check surrounding area for other buildings
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (this.isValidPosition(checkX, checkY)) {
                    const checkTerrain = this.mapData[checkY][checkX].terrain;
                    if (checkTerrain === 'city' || checkTerrain === 'castle') {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    generateCircularFeature(centerX, centerY, radius, terrainType, density) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                if (!this.isValidPosition(x, y)) continue;
                
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (distance <= radius && Math.random() < density) {
                    this.mapData[y][x].terrain = terrainType;
                }
            }
        }
    }

    generateLinearFeature(startX, startY, length, terrainType, density) {
        const angle = Math.random() * Math.PI * 2;
        const deltaX = Math.cos(angle);
        const deltaY = Math.sin(angle);
        
        for (let i = 0; i < length; i++) {
            const x = Math.round(startX + deltaX * i);
            const y = Math.round(startY + deltaY * i);
            
            if (!this.isValidPosition(x, y)) continue;
            
            if (Math.random() < density) {
                this.mapData[y][x].terrain = terrainType;
                
                // Add some width variation
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const varX = x + dx;
                        const varY = y + dy;
                        
                        if (this.isValidPosition(varX, varY) && Math.random() < density * 0.5) {
                            this.mapData[varY][varX].terrain = terrainType;
                        }
                    }
                }
            }
        }
    }

    smoothTerrain() {
        // Simple terrain smoothing pass
        const tempMap = JSON.parse(JSON.stringify(this.mapData));
        
        for (let y = 1; y < this.mapSize - 1; y++) {
            for (let x = 1; x < this.mapSize - 1; x++) {
                const currentTerrain = this.mapData[y][x].terrain;
                
                // Count surrounding terrain types
                const terrainCounts = {};
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const terrain = this.mapData[y + dy][x + dx].terrain;
                        terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
                    }
                }
                
                // Find most common terrain
                const mostCommon = Object.keys(terrainCounts).reduce((a, b) => 
                    terrainCounts[a] > terrainCounts[b] ? a : b
                );
                
                // Apply smoothing for certain terrain types
                if (currentTerrain === 'grass' && terrainCounts[mostCommon] >= 6) {
                    tempMap[y][x].terrain = mostCommon;
                }
            }
        }
        
        this.mapData = tempMap;
    }

    // ========================================
    // EVENT HANDLERS
    // ========================================

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.lastMousePos = { x, y };
        
        if (e.button === 0) { // Left click
            this.isDragging = true;
        } else if (e.button === 2) { // Right click
            this.isRightDragging = true;
        }
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridPos = this.screenToGrid(x, y);
        
        // Update hovered tile
        if (this.isValidPosition(gridPos.x, gridPos.y)) {
            this.hoveredTile = gridPos;
            this.updateCoordinatesDisplay(gridPos.x, gridPos.y);
        }
        
        // Handle dragging
        if (this.isRightDragging) {
            const deltaX = x - this.lastMousePos.x;
            const deltaY = y - this.lastMousePos.y;
            
            this.camera.x -= deltaX / this.camera.zoom;
            this.camera.y -= deltaY / this.camera.zoom;
            
            this.markForRedraw();
        }
        
        this.lastMousePos = { x, y };
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.isRightDragging = false;
    }

    onClick(e) {
        if (this.isRightDragging || this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridPos = this.screenToGrid(x, y);
        
        if (this.isValidPosition(gridPos.x, gridPos.y)) {
            this.selectTile(gridPos.x, gridPos.y);
        }
    }

    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const oldZoom = this.camera.zoom;
        this.camera.zoom = GameUtils.clamp(
            this.camera.zoom * zoomFactor,
            this.camera.minZoom,
            this.camera.maxZoom
        );
        
        if (this.camera.zoom !== oldZoom) {
            // Zoom towards mouse position
            const zoomChange = this.camera.zoom / oldZoom;
            this.camera.x = mouseX / this.camera.zoom - (mouseX / oldZoom - this.camera.x) * zoomChange;
            this.camera.y = mouseY / this.camera.zoom - (mouseY / oldZoom - this.camera.y) * zoomChange;
            
            this.markForRedraw();
        }
    }

    onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        let moved = false;
        const panSpeed = GAME_CONFIG.PAN_SPEED / this.camera.zoom;
        
        switch (e.code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.camera.x -= panSpeed;
                moved = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.camera.x += panSpeed;
                moved = true;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.camera.y -= panSpeed;
                moved = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.camera.y += panSpeed;
                moved = true;
                break;
            case 'Space':
                e.preventDefault();
                this.centerCamera();
                moved = true;
                break;
            case 'KeyR':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.regenerateMap();
                }
                break;
        }
        
        if (moved) {
            e.preventDefault();
            this.markForRedraw();
        }
    }

    onResize() {
        this.initializeCanvas();
        this.markForRedraw();
    }

    // Touch Events
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastMousePos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            this.isRightDragging = true;
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isRightDragging) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            const deltaX = x - this.lastMousePos.x;
            const deltaY = y - this.lastMousePos.y;
            
            this.camera.x -= deltaX / this.camera.zoom;
            this.camera.y -= deltaY / this.camera.zoom;
            
            this.lastMousePos = { x, y };
            this.markForRedraw();
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        this.isRightDragging = false;
    }

    // Game Events
    onUnitMoved(data) {
        console.log('🚶 Unit moved on map:', data);
        this.markForRedraw();
    }

    onUnitAttacked(data) {
        console.log('⚔️ Unit attacked on map:', data);
        this.markForRedraw();
    }

    onGameStarted(data) {
        console.log('🎮 Game started, updating map');
        this.markForRedraw();
    }

    // ========================================
    // TILE SELECTION
    // ========================================

    selectTile(x, y) {
        gameState.selectTile(x, y);
        
        const tile = this.getTile(x, y);
        if (tile?.unit) {
            gameState.selectUnit(tile.unit);
        } else {
            gameState.selectUnit(null);
        }
        
        console.log(`🎯 Tile selected: (${x}, ${y})`);
        this.markForRedraw();
    }

    // ========================================
    // COORDINATE SYSTEMS
    // ========================================

    screenToGrid(screenX, screenY) {
        const worldX = (screenX / this.camera.zoom) + this.camera.x;
        const worldY = (screenY / this.camera.zoom) + this.camera.y;
        
        return {
            x: Math.floor(worldX / this.tileSize),
            y: Math.floor(worldY / this.tileSize)
        };
    }

    gridToScreen(gridX, gridY) {
        const worldX = gridX * this.tileSize;
        const worldY = gridY * this.tileSize;
        
        return {
            x: (worldX - this.camera.x) * this.camera.zoom,
            y: (worldY - this.camera.y) * this.camera.zoom
        };
    }

    isValidPosition(x, y) {
        return GameUtils.isValidPosition(x, y, this.mapSize);
    }

    getTile(x, y) {
        if (!this.isValidPosition(x, y)) return null;
        return this.mapData[y][x];
    }

    // ========================================
    // CAMERA CONTROLS
    // ========================================

    centerCamera() {
        const rect = this.canvas.getBoundingClientRect();
        const mapPixelWidth = this.mapSize * this.tileSize;
        const mapPixelHeight = this.mapSize * this.tileSize;
        
        this.camera.x = (mapPixelWidth / 2) - (rect.width / 2 / this.camera.zoom);
        this.camera.y = (mapPixelHeight / 2) - (rect.height / 2 / this.camera.zoom);
        
        this.markForRedraw();
    }

    zoomIn() {
        this.camera.zoom = Math.min(this.camera.maxZoom, this.camera.zoom * GAME_CONFIG.ZOOM_FACTOR);
        this.markForRedraw();
    }

    zoomOut() {
        this.camera.zoom = Math.max(this.camera.minZoom, this.camera.zoom / GAME_CONFIG.ZOOM_FACTOR);
        this.markForRedraw();
    }

    resetView() {
        this.camera.zoom = GAME_CONFIG.DEFAULT_ZOOM;
        this.centerCamera();
    }

    regenerateMap() {
        this.generateMap();
        this.updateMapInfo();
    }

    // ========================================
    // RENDERING SYSTEM
    // ========================================

    startRenderLoop() {
        const render = (timestamp) => {
            this.updatePerformanceMetrics(timestamp);
            
            if (this.needsRedraw) {
                this.render();
                this.needsRedraw = false;
            }
            
            this.renderRequestId = requestAnimationFrame(render);
        };
        
        this.renderRequestId = requestAnimationFrame(render);
    }

    stopRenderLoop() {
        if (this.renderRequestId) {
            cancelAnimationFrame(this.renderRequestId);
            this.renderRequestId = null;
        }
    }

    markForRedraw() {
        this.needsRedraw = true;
    }

    updatePerformanceMetrics(timestamp) {
        this.frameCount++;
        
        if (timestamp - this.lastFpsUpdate > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = timestamp;
            
            // Update debug info
            this.updateDebugInfo();
        }
    }

    render() {
        const rect = this.canvas.getBoundingClientRect();
        
        // Clear canvas
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Calculate visible area
        const startX = Math.max(0, Math.floor(this.camera.x / this.tileSize) - 1);
        const startY = Math.max(0, Math.floor(this.camera.y / this.tileSize) - 1);
        const endX = Math.min(this.mapSize, startX + Math.ceil(rect.width / (this.tileSize * this.camera.zoom)) + 2);
        const endY = Math.min(this.mapSize, startY + Math.ceil(rect.height / (this.tileSize * this.camera.zoom)) + 2);
        
        // Render layers
        this.renderTerrain(startX, startY, endX, endY);
        this.renderUnits(startX, startY, endX, endY);
        this.renderUI(startX, startY, endX, endY);
        this.renderGrid(startX, startY, endX, endY);
        
        this.frameCount++;
    }

    renderTerrain(startX, startY, endX, endY) {
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                this.renderTile(x, y);
            }
        }
    }

    renderTile(gridX, gridY) {
        if (!this.isValidPosition(gridX, gridY)) return;
        
        const tile = this.mapData[gridY][gridX];
        const terrain = TERRAIN_DEFINITIONS[tile.terrain];
        if (!terrain) return;
        
        const screenPos = this.gridToScreen(gridX, gridY);
        const size = this.tileSize * this.camera.zoom;
        
        // Render terrain background
        this.ctx.fillStyle = terrain.color;
        this.ctx.fillRect(screenPos.x, screenPos.y, size, size);
        
        // Render terrain symbol
        if (this.camera.zoom >= 0.5 && terrain.symbol) {
            this.ctx.font = `${Math.max(8, size * 0.4)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'white';
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 1;
            
            const centerX = screenPos.x + size / 2;
            const centerY = screenPos.y + size / 2;
            
            this.ctx.strokeText(terrain.symbol, centerX, centerY);
            this.ctx.fillText(terrain.symbol, centerX, centerY);
        }

        // Render ownership indicator
        if (tile.owner && this.camera.zoom >= 0.8) {
            this.ctx.fillStyle = this.getPlayerColor(tile.owner);
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillRect(screenPos.x, screenPos.y, size, size);
            this.ctx.globalAlpha = 1.0;
        }
    }

    renderUnits(startX, startY, endX, endY) {
        // Render all units in visible area
        gameState.data.playerUnits.forEach(unit => {
            if (unit.x >= startX && unit.x < endX && unit.y >= startY && unit.y < endY) {
                this.renderUnit(unit);
            }
        });
    }

    renderUnit(unit) {
        const screenPos = this.gridToScreen(unit.x, unit.y);
        const size = this.tileSize * this.camera.zoom;
        
        // Unit background
        this.ctx.fillStyle = gameState.selectedRace?.color || '#3498db';
        this.ctx.globalAlpha = 0.8;
        this.ctx.fillRect(screenPos.x + 2, screenPos.y + 2, size - 4, size - 4);
        this.ctx.globalAlpha = 1.0;
        
        // Unit icon
        if (this.camera.zoom >= 0.6 && unit.definition?.icon) {
            this.ctx.font = `${Math.max(12, size * 0.6)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = 'white';
            this.ctx.strokeStyle = 'black';
            this.ctx.lineWidth = 2;
            
            const centerX = screenPos.x + size / 2;
            const centerY = screenPos.y + size / 2;
            
            this.ctx.strokeText(unit.definition.icon, centerX, centerY);
            this.ctx.fillText(unit.definition.icon, centerX, centerY);
        }
        
        // Health bar
        if (this.camera.zoom >= 1.0 && unit.currentStats) {
            const barWidth = size - 6;
            const barHeight = 4;
            const barX = screenPos.x + 3;
            const barY = screenPos.y + size - barHeight - 2;
            
            // Background
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // Health
            const healthRatio = unit.currentHp / unit.currentStats.hp;
            this.ctx.fillStyle = healthRatio > 0.5 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 255, 0, 0.7)';
            this.ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        }

        // Unit level indicator
        if (this.camera.zoom >= 1.2 && unit.level > 1) {
            this.ctx.fillStyle = '#f1c40f';
            this.ctx.font = `${Math.max(8, size * 0.2)}px Arial`;
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(`Lv${unit.level}`, screenPos.x + size - 2, screenPos.y + 2);
        }
    }

    renderUI(startX, startY, endX, endY) {
        // Render selection highlight
        const selectedTile = gameState.data.selectedTile;
        if (selectedTile && this.isValidPosition(selectedTile.x, selectedTile.y)) {
            this.renderSelection(selectedTile.x, selectedTile.y);
        }
        
        // Render hover highlight
        if (this.hoveredTile && this.isValidPosition(this.hoveredTile.x, this.hoveredTile.y)) {
            this.renderHover(this.hoveredTile.x, this.hoveredTile.y);
        }
        
        // Render movement/attack ranges if unit selected
        const selectedUnit = gameState.data.selectedUnit;
        if (selectedUnit && gameState.data.isMyTurn) {
            this.renderUnitRanges(selectedUnit);
        }
    }

    renderSelection(gridX, gridY) {
        const screenPos = this.gridToScreen(gridX, gridY);
        const size = this.tileSize * this.camera.zoom;
        
        this.ctx.strokeStyle = '#f1c40f';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(screenPos.x, screenPos.y, size, size);
        this.ctx.setLineDash([]);
    }

    renderHover(gridX, gridY) {
        const screenPos = this.gridToScreen(gridX, gridY);
        const size = this.tileSize * this.camera.zoom;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(screenPos.x, screenPos.y, size, size);
    }

    renderUnitRanges(unit) {
        // Render movement range
        this.renderMovementRange(unit);
        
        // Render attack range
        this.renderAttackRange(unit);
    }

    renderMovementRange(unit) {
        const movementPoints = unit.currentStats?.movement || 3;
        
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        
        for (let dy = -movementPoints; dy <= movementPoints; dy++) {
            for (let dx = -movementPoints; dx <= movementPoints; dx++) {
                const x = unit.x + dx;
                const y = unit.y + dy;
                
                if (!this.isValidPosition(x, y)) continue;
                
                const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
                if (distance <= movementPoints && this.canMoveToTile(unit, x, y)) {
                    const screenPos = this.gridToScreen(x, y);
                    const size = this.tileSize * this.camera.zoom;
                    this.ctx.fillRect(screenPos.x, screenPos.y, size, size);
                }
            }
        }
    }

    renderAttackRange(unit) {
        const attackRange = unit.definition?.attackRange || 1;
        
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        
        for (let dy = -attackRange; dy <= attackRange; dy++) {
            for (let dx = -attackRange; dx <= attackRange; dx++) {
                const x = unit.x + dx;
                const y = unit.y + dy;
                
                if (!this.isValidPosition(x, y)) continue;
                
                const distance = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance
                if (distance <= attackRange && distance > 0) {
                    const screenPos = this.gridToScreen(x, y);
                    const size = this.tileSize * this.camera.zoom;
                    this.ctx.fillRect(screenPos.x, screenPos.y, size, size);
                }
            }
        }
    }

    renderGrid(startX, startY, endX, endY) {
        if (this.camera.zoom < 0.5) return;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        
        // Vertical lines
        for (let x = startX; x <= endX; x++) {
            const screenPos = this.gridToScreen(x, 0);
            this.ctx.moveTo(screenPos.x, 0);
            this.ctx.lineTo(screenPos.x, this.canvas.height);
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY; y++) {
            const screenPos = this.gridToScreen(0, y);
            this.ctx.moveTo(0, screenPos.y);
            this.ctx.lineTo(this.canvas.width, screenPos.y);
        }
        
        this.ctx.stroke();
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    canMoveToTile(unit, x, y) {
        if (!this.isValidPosition(x, y)) return false;
        
        const tile = this.getTile(x, y);
        if (!tile) return false;
        
        // Check if tile is occupied by another unit
        if (tile.unit && tile.unit !== unit) return false;
        
        // Check terrain movement cost
        const terrain = TERRAIN_DEFINITIONS[tile.terrain];
        if (!terrain) return false;
        
        const movementType = unit.definition?.movementType || 'ground';
        const movementCost = terrain.movementCost[movementType];
        
        return movementCost >= 0; // -1 means impassable
    }

    getPlayerColor(playerId) {
        // Return color based on player ID
        const colors = ['#3498db', '#e74c3c', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
        return colors[playerId % colors.length];
    }

    updateCoordinatesDisplay(gridX, gridY) {
        const coords = document.getElementById('coordinates');
        if (!coords) return;
        
        const tile = this.getTile(gridX, gridY);
        const terrain = TERRAIN_DEFINITIONS[tile?.terrain];
        const terrainName = terrain?.name || 'Unbekannt';
        
        coords.innerHTML = `
            X: ${gridX}, Y: ${gridY}<br>
            Terrain: ${terrainName}<br>
            Zoom: ${Math.round(this.camera.zoom * 100)}%
        `;
    }

    updateDebugInfo() {
        const debugElement = document.getElementById('debugInfo');
        if (!debugElement) return;
        
        const selectedUnit = gameState.data.selectedUnit;
        const selectedTile = gameState.data.selectedTile;
        
        debugElement.innerHTML = `
            FPS: ${this.fps}<br>
            Zoom: ${Math.round(this.camera.zoom * 100)}%<br>
            Kamera: ${Math.round(this.camera.x)}, ${Math.round(this.camera.y)}<br>
            ${selectedTile ? `Auswahl: ${selectedTile.x}, ${selectedTile.y}` : 'Keine Auswahl'}<br>
            ${selectedUnit ? `Einheit: ${selectedUnit.definition?.name || 'Unbekannt'}` : 'Keine Einheit'}
        `;
    }

    updateMapInfo() {
        const mapInfoElement = document.getElementById('mapInfo');
        if (!mapInfoElement) return;
        
        const cityCount = this.countTerrain('city');
        const castleCount = this.countTerrain('castle');
        const waterCount = this.countTerrain('water');
        const mountainCount = this.countTerrain('mountain');
        const forestCount = this.countTerrain('forest');
        
        const currentPlayerName = this.gameSettings?.currentPlayer?.name || 'Unbekannt';
        
        mapInfoElement.innerHTML = `
            <strong>Spiel-Info:</strong><br>
            Spieler: ${currentPlayerName}<br>
            Spiel-ID: ${this.gameSettings?.gameId || 'Demo'}<br>
            <hr style="margin: 8px 0; opacity: 0.3;">
            <strong>Karten-Info:</strong><br>
            Größe: ${this.mapSize}x${this.mapSize}<br>
            Städte: ${cityCount}<br>
            Burgen: ${castleCount}<br>
            Wälder: ${forestCount}<br>
            Berge: ${mountainCount}<br>
            Wasser: ${waterCount}
        `;
    }

    countTerrain(terrainType) {
        let count = 0;
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                if (this.mapData[y][x].terrain === terrainType) {
                    count++;
                }
            }
        }
        return count;
    }

    // ========================================
    // PUBLIC API METHODS
    // ========================================

    // Methoden für Button-Callbacks
    handleZoomIn() {
        this.zoomIn();
    }

    handleZoomOut() {
        this.zoomOut();
    }

    handleResetView() {
        this.resetView();
    }

    handleRegenerateMap() {
        this.regenerateMap();
    }

    handleReturnToLobby() {
        if (confirm('🚪 Zur Lobby zurückkehren?\n\nDer Spielfortschritt geht verloren!')) {
            window.location.href = '/';
        }
    }

    // Cleanup method
    destroy() {
        this.stopRenderLoop();
        
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('resize', this.onResize);
        
        console.log('🗑️ MapSystem destroyed');
    }
}

// ========================================
// GLOBAL FUNCTIONS FOR BUTTON INTEGRATION
// ========================================

// Global variable to hold the map system instance
let mapSystemInstance = null;

function initializeMapSystem(gameSettings) {
    mapSystemInstance = new MapSystem(gameSettings);
    return mapSystemInstance;
}

function setupButtonEvents() {
    // Zoom controls
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
    const zoomInBtn2 = document.getElementById('zoomInBtn2');
    const zoomOutBtn2 = document.getElementById('zoomOutBtn2');
    const resetViewBtn2 = document.getElementById('resetViewBtn2');
    const regenerateBtn = document.getElementById('regenerateBtn');
    const returnLobbyBtn = document.getElementById('returnLobbyBtn');
    
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => mapSystemInstance?.handleZoomIn());
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => mapSystemInstance?.handleZoomOut());
    if (resetViewBtn) resetViewBtn.addEventListener('click', () => mapSystemInstance?.handleResetView());
    if (zoomInBtn2) zoomInBtn2.addEventListener('click', () => mapSystemInstance?.handleZoomIn());
    if (zoomOutBtn2) zoomOutBtn2.addEventListener('click', () => mapSystemInstance?.handleZoomOut());
    if (resetViewBtn2) resetViewBtn2.addEventListener('click', () => mapSystemInstance?.handleResetView());
    if (regenerateBtn) regenerateBtn.addEventListener('click', () => mapSystemInstance?.handleRegenerateMap());
    if (returnLobbyBtn) returnLobbyBtn.addEventListener('click', () => mapSystemInstance?.handleReturnToLobby());
    
    console.log('🎮 Button Events eingerichtet');
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapSystem, initializeMapSystem, setupButtonEvents };
}

console.log('✅ Map System Module geladen');