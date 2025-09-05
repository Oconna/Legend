// Game Map - 2D Canvas Implementation
class GameMap {
    constructor(canvasId, overlayId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById(overlayId);
        
        // Map data
        this.mapData = null;
        this.width = 0;
        this.height = 0;
        this.tileSize = 32;
        
        // View settings
        this.viewX = 0;
        this.viewY = 0;
        this.zoom = 1;
        this.minZoom = 0.5;
        this.maxZoom = 3;
        
        // Mouse interaction
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.selectedTile = null;
        this.hoveredTile = null;
        
        // ✅ FIX: Initialize highlights properly
        this.moveableTiles = new Set();
        this.attackableTiles = new Set();
        this.pathTiles = [];
        
        // Terrain images cache
        this.terrainImages = new Map();
        this.buildingImages = new Map();
        this.unitImages = new Map();
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
        this.preloadImages();
    }

    setupCanvas() {
        // Set canvas size
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Handle high DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    bindEvents() {
        // Mouse events for map interaction
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Window resize
        window.addEventListener('resize', () => this.onResize());
        
        // Map control buttons
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const resetViewBtn = document.getElementById('reset-view');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (resetViewBtn) resetViewBtn.addEventListener('click', () => this.resetView());
    }

    preloadImages() {
        // Terrain types
        const terrainTypes = [
            { id: 1, name: 'grass', file: 'grass.png' },
            { id: 2, name: 'mountain', file: 'mountain.png' },
            { id: 3, name: 'swamp', file: 'swamp.png' },
            { id: 4, name: 'water', file: 'water.png' },
            { id: 5, name: 'forest', file: 'forest.png' },
            { id: 6, name: 'desert', file: 'desert.png' },
            { id: 7, name: 'snow', file: 'snow.png' }
        ];

        terrainTypes.forEach(terrain => {
            const img = new Image();
            img.src = `/images/terrain/${terrain.file}`;
            img.onerror = () => {
                // Fallback: create colored square
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = this.tileSize;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = this.getTerrainColor(terrain.id);
                ctx.fillRect(0, 0, this.tileSize, this.tileSize);
                this.terrainImages.set(terrain.id, canvas);
            };
            img.onload = () => {
                this.terrainImages.set(terrain.id, img);
            };
        });

        // Building types
        const buildingTypes = [
            { id: 1, name: 'village', file: 'village.png' },
            { id: 2, name: 'castle', file: 'castle.png' }
        ];

        buildingTypes.forEach(building => {
            const img = new Image();
            img.src = `/images/buildings/${building.file}`;
            img.onerror = () => {
                // Fallback: create simple building icon
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = this.tileSize;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = building.id === 1 ? '#8B4513' : '#696969';
                ctx.fillRect(4, 4, this.tileSize - 8, this.tileSize - 8);
                this.buildingImages.set(building.id, canvas);
            };
            img.onload = () => {
                this.buildingImages.set(building.id, img);
            };
        });
    }

    getTerrainColor(terrainId) {
        const colors = {
            1: '#90EE90', // grass - light green
            2: '#A0A0A0', // mountain - gray
            3: '#8B7355', // swamp - brown
            4: '#4682B4', // water - steel blue
            5: '#228B22', // forest - forest green
            6: '#F4A460', // desert - sandy brown
            7: '#FFFAFA'  // snow - snow white
        };
        return colors[terrainId] || '#DDD';
    }

    async loadMap(mapData, units = []) {
        this.mapData = mapData;
        this.units = units;
        
        if (!mapData || mapData.length === 0) {
            console.error('No map data provided');
            return;
        }

        // Calculate map dimensions
        this.width = Math.max(...mapData.map(tile => tile.x_pos)) + 1;
        this.height = Math.max(...mapData.map(tile => tile.y_pos)) + 1;
        
        console.log(`Map loaded: ${this.width}x${this.height} tiles`);
        
        // Center the view
        this.centerView();
        
        // Initial render
        this.render();
    }

    centerView() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        const mapPixelWidth = this.width * this.tileSize * this.zoom;
        const mapPixelHeight = this.height * this.tileSize * this.zoom;
        
        this.viewX = (canvasWidth - mapPixelWidth) / 2;
        this.viewY = (canvasHeight - mapPixelHeight) / 2;
    }

    render() {
        if (!this.mapData) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context
        this.ctx.save();
        
        // Apply view transform
        this.ctx.translate(this.viewX, this.viewY);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Render terrain
        this.renderTerrain();
        
        // Render buildings
        this.renderBuildings();
        
        // Render highlights
        this.renderHighlights();
        
        // Render units
        this.renderUnits();
        
        // Render grid (optional)
        if (this.zoom >= 1) {
            this.renderGrid();
        }
        
        // Restore context
        this.ctx.restore();
        
        // Update coordinate display
        this.updateCoordinateDisplay();
    }

    renderTerrain() {
        this.mapData.forEach(tile => {
            const x = tile.x_pos * this.tileSize;
            const y = tile.y_pos * this.tileSize;
            
            // Get terrain image or use color fallback
            const terrainImage = this.terrainImages.get(tile.terrain_type_id);
            
            if (terrainImage && terrainImage.complete) {
                this.ctx.drawImage(terrainImage, x, y, this.tileSize, this.tileSize);
            } else {
                // Fallback to colored rectangle
                this.ctx.fillStyle = this.getTerrainColor(tile.terrain_type_id);
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
            }
        });
    }

    renderBuildings() {
        this.mapData.forEach(tile => {
            if (tile.building_type_id) {
                const x = tile.x_pos * this.tileSize;
                const y = tile.y_pos * this.tileSize;
                
                // Get building image or use color fallback
                const buildingImage = this.buildingImages.get(tile.building_type_id);
                
                if (buildingImage && buildingImage.complete) {
                    this.ctx.drawImage(buildingImage, x, y, this.tileSize, this.tileSize);
                } else {
                    // Fallback to colored rectangle
                    this.ctx.fillStyle = tile.building_type_id === 1 ? '#8B4513' : '#696969';
                    this.ctx.fillRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
                }
                
                // Show building owner with colored border
                if (tile.building_owner_id) {
                    this.ctx.strokeStyle = this.getPlayerColor(tile.building_owner_id);
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);
                }
            }
        });
    }

    renderUnits() {
        if (!this.units) return;
        
        this.units.forEach(unit => {
            const x = unit.x_pos * this.tileSize;
            const y = unit.y_pos * this.tileSize;
            
            // Unit background circle with player color
            this.ctx.fillStyle = this.getPlayerColor(unit.player_id);
            this.ctx.beginPath();
            this.ctx.arc(x + this.tileSize/2, y + this.tileSize/2, this.tileSize/3, 0, 2 * Math.PI);
            this.ctx.fill();
            
            // Unit image or icon
            const unitImage = this.unitImages.get(unit.unit_id);
            if (unitImage && unitImage.complete) {
                this.ctx.drawImage(unitImage, x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
            } else {
                // Fallback: first letter of unit name
                this.ctx.fillStyle = 'white';
                this.ctx.font = `${this.tileSize/3}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    unit.name ? unit.name.charAt(0).toUpperCase() : 'U',
                    x + this.tileSize/2,
                    y + this.tileSize/2 + 3
                );
            }
            
            // Health bar
            if (unit.current_health < unit.health_points) {
                const barWidth = this.tileSize - 4;
                const barHeight = 4;
                const healthPercent = unit.current_health / unit.health_points;
                
                // Background
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
                this.ctx.fillRect(x + 2, y + this.tileSize - 6, barWidth, barHeight);
                
                // Health
                this.ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
                this.ctx.fillRect(x + 2, y + this.tileSize - 6, barWidth * healthPercent, barHeight);
            }
            
            // Movement indicator
            if (unit.movement_left < unit.movement_points) {
                this.ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
                this.ctx.fillRect(x, y, this.tileSize, 2);
            }
        });
    }

    renderHighlights() {
        // Selected tile
        if (this.selectedTile) {
            this.renderTileHighlight(this.selectedTile.x, this.selectedTile.y, '#2196F3', 0.3);
        }
        
        // ✅ FIX: Safely check and iterate over highlights
        if (this.moveableTiles && this.moveableTiles.forEach) {
            this.moveableTiles.forEach(coord => {
                const [x, y] = coord.split(',').map(Number);
                this.renderTileHighlight(x, y, '#4CAF50', 0.2);
            });
        }
        
        if (this.attackableTiles && this.attackableTiles.forEach) {
            this.attackableTiles.forEach(coord => {
                const [x, y] = coord.split(',').map(Number);
                this.renderTileHighlight(x, y, '#f44336', 0.2);
            });
        }
        
        if (this.pathTiles && Array.isArray(this.pathTiles)) {
            this.pathTiles.forEach(coord => {
                const [x, y] = coord.split(',').map(Number);
                this.renderTileHighlight(x, y, '#FF9800', 0.4);
            });
        }
        
        // Hovered tile
        if (this.hoveredTile) {
            this.renderTileHighlight(this.hoveredTile.x, this.hoveredTile.y, '#FFF', 0.1);
        }
    }

    renderTileHighlight(x, y, color, alpha) {
        const pixelX = x * this.tileSize;
        const pixelY = y * this.tileSize;
        
        this.ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        this.ctx.fillRect(pixelX, pixelY, this.tileSize, this.tileSize);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(pixelX + 1, pixelY + 1, this.tileSize - 2, this.tileSize - 2);
    }

    renderGrid() {
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.tileSize, 0);
            this.ctx.lineTo(x * this.tileSize, this.height * this.tileSize);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.tileSize);
            this.ctx.lineTo(this.width * this.tileSize, y * this.tileSize);
            this.ctx.stroke();
        }
    }

    getPlayerColor(playerId) {
        const colors = [
            '#f44336', // Red
            '#2196F3', // Blue  
            '#4CAF50', // Green
            '#FF9800', // Orange
            '#9C27B0', // Purple
            '#795548', // Brown
            '#607D8B', // Blue Grey
            '#E91E63'  // Pink
        ];
        return colors[(playerId - 1) % colors.length] || '#999';
    }

    // Mouse/Touch Event Handlers
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.lastMouseX = e.clientX - rect.left;
        this.lastMouseY = e.clientY - rect.top;
        this.isDragging = true;
        e.preventDefault();
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        if (this.isDragging) {
            // Pan the map
            const deltaX = mouseX - this.lastMouseX;
            const deltaY = mouseY - this.lastMouseY;
            
            this.viewX += deltaX;
            this.viewY += deltaY;
            
            this.render();
        } else {
            // Update hovered tile
            const tile = this.getTileAtScreenPosition(mouseX, mouseY);
            this.hoveredTile = tile;
            this.render();
        }
        
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        
        // Update coordinate display
        this.updateCoordinateDisplay();
    }

    onMouseUp(e) {
        this.isDragging = false;
    }

    onClick(e) {
        if (this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const tile = this.getTileAtScreenPosition(mouseX, mouseY);
        if (tile) {
            this.selectTile(tile);
        }
    }

    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Zoom towards mouse cursor
        const oldZoom = this.zoom;
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
        
        // Adjust view to keep mouse position stable
        const zoomChange = this.zoom / oldZoom;
        this.viewX = mouseX - (mouseX - this.viewX) * zoomChange;
        this.viewY = mouseY - (mouseY - this.viewY) * zoomChange;
        
        this.render();
    }

    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastMouseX = touch.clientX - rect.left;
            this.lastMouseY = touch.clientY - rect.top;
            this.isDragging = true;
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isDragging) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            
            const deltaX = touchX - this.lastMouseX;
            const deltaY = touchY - this.lastMouseY;
            
            this.viewX += deltaX;
            this.viewY += deltaY;
            
            this.lastMouseX = touchX;
            this.lastMouseY = touchY;
            
            this.render();
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        this.isDragging = false;
    }

    onResize() {
        this.setupCanvas();
        this.render();
    }

    // Utility Methods
    getTileAtScreenPosition(screenX, screenY) {
        const worldX = (screenX - this.viewX) / this.zoom;
        const worldY = (screenY - this.viewY) / this.zoom;
        
        const tileX = Math.floor(worldX / this.tileSize);
        const tileY = Math.floor(worldY / this.tileSize);
        
        if (tileX >= 0 && tileX < this.width && tileY >= 0 && tileY < this.height) {
            // Find the tile data
            const tileData = this.mapData.find(tile => 
                tile.x_pos === tileX && tile.y_pos === tileY
            );
            
            if (tileData) {
                return {
                    x: tileX,
                    y: tileY,
                    data: tileData
                };
            }
        }
        
        return null;
    }

    getTileData(x, y) {
        return this.mapData?.find(tile => tile.x_pos === x && tile.y_pos === y);
    }

    getUnitAt(x, y) {
        return this.units?.find(unit => unit.x_pos === x && unit.y_pos === y);
    }

    selectTile(tile) {
        this.selectedTile = tile;
        this.render();
        
        // Notify game controller
        if (window.gameController) {
            window.gameController.onTileSelected(tile);
        }
    }

    // Control Methods
    zoomIn() {
        this.zoom = Math.min(this.maxZoom, this.zoom * 1.2);
        this.render();
    }

    zoomOut() {
        this.zoom = Math.max(this.minZoom, this.zoom / 1.2);
        this.render();
    }

    resetView() {
        this.zoom = 1;
        this.centerView();
        this.render();
    }

    updateCoordinateDisplay() {
        const coordDisplay = document.getElementById('cursor-coordinates');
        if (coordDisplay && this.hoveredTile) {
            coordDisplay.textContent = `${this.hoveredTile.x}, ${this.hoveredTile.y}`;
        }
    }

    // Highlight Management
    setMoveableTiles(tiles) {
        this.moveableTiles = new Set();
        tiles.forEach(tile => this.moveableTiles.add(`${tile.x},${tile.y}`));
        this.render();
    }

    setAttackableTiles(tiles) {
        this.attackableTiles = new Set();
        tiles.forEach(tile => this.attackableTiles.add(`${tile.x},${tile.y}`));
        this.render();
    }

    setPathTiles(path) {
        this.pathTiles = path.map(tile => `${tile.x},${tile.y}`);
        this.render();
    }

    clearHighlights() {
        this.moveableTiles = new Set();
        this.attackableTiles = new Set();
        this.pathTiles = [];
        this.render();
    }

    clearSelection() {
        this.selectedTile = null;
        this.clearHighlights();
    }

    // Update Methods
    updateUnits(units) {
        this.units = units;
        this.render();
    }

    updateMap(mapData) {
        this.mapData = mapData;
        this.render();
    }
}