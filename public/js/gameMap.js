// Game Map - 2D Canvas Implementation - FIXED VERSION
class GameMap {
    constructor(canvasId, overlayId) {
        console.log('🗺️ Initializing GameMap with canvas:', canvasId);
        
        this.canvas = document.getElementById(canvasId);
        this.overlay = document.getElementById(overlayId);
        
        // ✅ CRITICAL: Validate canvas exists
        if (!this.canvas) {
            throw new Error(`Canvas element with id '${canvasId}' not found!`);
        }
        
        if (!this.overlay) {
            throw new Error(`Overlay element with id '${overlayId}' not found!`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // ✅ CRITICAL: Validate context
        if (!this.ctx) {
            throw new Error('Failed to get 2D rendering context from canvas!');
        }
        
        // Map data
        this.mapData = null;
        this.units = [];
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
        
        // Highlights
        this.moveableTiles = new Set();
        this.attackableTiles = new Set();
        this.pathTiles = [];
        
        // Images cache
        this.terrainImages = new Map();
        this.buildingImages = new Map();
        this.unitImages = new Map();
        
        // ✅ CRITICAL: Initialize properly
        this.init();
        
        console.log('✅ GameMap initialized successfully');
    }

    init() {
        try {
            console.log('🔧 Setting up GameMap...');
            this.setupCanvas();
            this.bindEvents();
            this.preloadImages();
            console.log('✅ GameMap setup complete');
        } catch (error) {
            console.error('❌ Error initializing GameMap:', error);
            throw error;
        }
    }

    setupCanvas() {
        try {
            console.log('🎨 Setting up canvas...');
            
            // ✅ CRITICAL: Get parent container dimensions
            const container = this.canvas.parentElement;
            if (!container) {
                throw new Error('Canvas has no parent container!');
            }
            
            // Set canvas size to fill container
            const containerRect = container.getBoundingClientRect();
            console.log('📐 Container dimensions:', containerRect.width, 'x', containerRect.height);
            
            // ✅ CRITICAL: Set minimum size if container is too small
            const minWidth = 400;
            const minHeight = 300;
            const canvasWidth = Math.max(containerRect.width, minWidth);
            const canvasHeight = Math.max(containerRect.height, minHeight);
            
            // Handle high DPI displays
            const dpr = window.devicePixelRatio || 1;
            
            // Set actual canvas size (accounting for DPR)
            this.canvas.width = canvasWidth * dpr;
            this.canvas.height = canvasHeight * dpr;
            
            // Set CSS size (what user sees)
            this.canvas.style.width = canvasWidth + 'px';
            this.canvas.style.height = canvasHeight + 'px';
            
            // Scale context for high DPI
            this.ctx.scale(dpr, dpr);
            
            // Set canvas background
            this.canvas.style.background = '#e8f4f8';
            
            console.log(`✅ Canvas setup: ${canvasWidth}x${canvasHeight} (DPR: ${dpr})`);
            
        } catch (error) {
            console.error('❌ Error setting up canvas:', error);
            throw error;
        }
    }

    bindEvents() {
        try {
            console.log('🔗 Binding map events...');
            
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
            
            console.log('✅ Events bound successfully');
            
        } catch (error) {
            console.error('❌ Error binding events:', error);
        }
    }

    preloadImages() {
        console.log('🖼️ Preloading map images...');
        
        // Terrain types - create colored rectangles as fallback
        const terrainTypes = [
            { id: 1, name: 'grass', color: '#90EE90' },
            { id: 2, name: 'mountain', color: '#A0A0A0' },
            { id: 3, name: 'swamp', color: '#8B7355' },
            { id: 4, name: 'water', color: '#4682B4' },
            { id: 5, name: 'forest', color: '#228B22' },
            { id: 6, name: 'desert', color: '#F4A460' },
            { id: 7, name: 'snow', color: '#FFFAFA' }
        ];

        terrainTypes.forEach(terrain => {
            // Create colored rectangle as fallback
            const canvas = document.createElement('canvas');
            canvas.width = this.tileSize;
            canvas.height = this.tileSize;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = terrain.color;
            ctx.fillRect(0, 0, this.tileSize, this.tileSize);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(0, 0, this.tileSize, this.tileSize);
            
            this.terrainImages.set(terrain.id, canvas);
        });

        // Building types
        const buildingTypes = [
            { id: 1, name: 'village', color: '#8B4513' },
            { id: 2, name: 'castle', color: '#696969' }
        ];

        buildingTypes.forEach(building => {
            const canvas = document.createElement('canvas');
            canvas.width = this.tileSize;
            canvas.height = this.tileSize;
            const ctx = canvas.getContext('2d');
            
            // Draw building shape
            ctx.fillStyle = building.color;
            ctx.fillRect(4, 4, this.tileSize - 8, this.tileSize - 8);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(4, 4, this.tileSize - 8, this.tileSize - 8);
            
            this.buildingImages.set(building.id, canvas);
        });
        
        console.log('✅ Images preloaded');
    }

    async loadMap(mapData, units = []) {
        try {
            console.log('🗺️ Loading map data...', mapData?.length, 'tiles');
            
            this.mapData = mapData;
            this.units = units;
            
            if (!mapData || mapData.length === 0) {
                console.warn('⚠️ No map data provided');
                this.showNoMapMessage();
                return;
            }

            // Calculate map dimensions
            this.width = Math.max(...mapData.map(tile => tile.x_pos)) + 1;
            this.height = Math.max(...mapData.map(tile => tile.y_pos)) + 1;
            
            console.log(`📐 Map size: ${this.width}x${this.height}`);
            
            // Center the view
            this.centerView();
            
            // Initial render
            await this.render();
            
            console.log('✅ Map loaded and rendered successfully');
            
        } catch (error) {
            console.error('❌ Error loading map:', error);
            this.showErrorMessage('Fehler beim Laden der Karte');
            throw error;
        }
    }

    centerView() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        const mapPixelWidth = this.width * this.tileSize * this.zoom;
        const mapPixelHeight = this.height * this.tileSize * this.zoom;
        
        this.viewX = (canvasWidth - mapPixelWidth) / 2;
        this.viewY = (canvasHeight - mapPixelHeight) / 2;
        
        console.log(`🎯 View centered: ${this.viewX}, ${this.viewY}`);
    }

    async render() {
        try {
            if (!this.ctx) {
                console.error('❌ No rendering context available');
                return;
            }

            // Clear canvas
            const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
            const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
            this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            
            // Save context
            this.ctx.save();
            
            // Apply view transform
            this.ctx.translate(this.viewX, this.viewY);
            this.ctx.scale(this.zoom, this.zoom);
            
            if (this.mapData && this.mapData.length > 0) {
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
            } else {
                // Show loading message
                this.ctx.fillStyle = '#666';
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('Lade Karte...', this.width * this.tileSize / 2, this.height * this.tileSize / 2);
            }
            
            // Restore context
            this.ctx.restore();
            
            // Update coordinate display
            this.updateCoordinateDisplay();
            
        } catch (error) {
            console.error('❌ Error rendering map:', error);
        }
    }

    renderTerrain() {
        this.mapData.forEach(tile => {
            const x = tile.x_pos * this.tileSize;
            const y = tile.y_pos * this.tileSize;
            
            const terrainImage = this.terrainImages.get(tile.terrain_type);
            if (terrainImage) {
                this.ctx.drawImage(terrainImage, x, y, this.tileSize, this.tileSize);
            } else {
                // Fallback color
                this.ctx.fillStyle = this.getTerrainColor(tile.terrain_type);
                this.ctx.fillRect(x, y, this.tileSize, this.tileSize);
            }
        });
    }

    renderBuildings() {
        this.mapData.forEach(tile => {
            if (tile.building_type) {
                const x = tile.x_pos * this.tileSize;
                const y = tile.y_pos * this.tileSize;
                
                const buildingImage = this.buildingImages.get(tile.building_type);
                if (buildingImage) {
                    this.ctx.drawImage(buildingImage, x, y, this.tileSize, this.tileSize);
                }
                
                // Show owner color if owned
                if (tile.owner_id) {
                    this.ctx.strokeStyle = this.getPlayerColor(tile.owner_id);
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
                }
            }
        });
    }

    renderUnits() {
        this.units.forEach(unit => {
            const x = unit.x_pos * this.tileSize;
            const y = unit.y_pos * this.tileSize;
            
            // Draw unit background
            this.ctx.fillStyle = this.getPlayerColor(unit.player_id);
            this.ctx.fillRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
            
            // Draw unit border
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
            
            // Draw unit symbol (placeholder)
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('U', x + this.tileSize / 2, y + this.tileSize / 2 + 4);
            
            // Draw health
            if (unit.current_health !== undefined) {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.font = '8px Arial';
                this.ctx.fillText(unit.current_health, x + this.tileSize - 8, y + 8);
            }
        });
    }

    renderHighlights() {
        // Selected tile
        if (this.selectedTile) {
            const x = this.selectedTile.x_pos * this.tileSize;
            const y = this.selectedTile.y_pos * this.tileSize;
            
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, this.tileSize, this.tileSize);
        }
        
        // Hovered tile
        if (this.hoveredTile && this.hoveredTile !== this.selectedTile) {
            const x = this.hoveredTile.x_pos * this.tileSize;
            const y = this.hoveredTile.y_pos * this.tileSize;
            
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, this.tileSize, this.tileSize);
        }
    }

    renderGrid() {
        this.ctx.strokeStyle = '#00000020';
        this.ctx.lineWidth = 0.5;
        
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

    getPlayerColor(playerId) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FFB74D'];
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
        
        // Adjust view to zoom towards mouse position
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
        setTimeout(() => {
            this.setupCanvas();
            this.render();
        }, 100);
    }

    // Map Control Methods
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

    // Utility Methods
    getTileAtScreenPosition(screenX, screenY) {
        if (!this.mapData) return null;
        
        // Convert screen coordinates to world coordinates
        const worldX = (screenX - this.viewX) / this.zoom;
        const worldY = (screenY - this.viewY) / this.zoom;
        
        // Convert to tile coordinates
        const tileX = Math.floor(worldX / this.tileSize);
        const tileY = Math.floor(worldY / this.tileSize);
        
        // Find tile in map data
        return this.mapData.find(tile => tile.x_pos === tileX && tile.y_pos === tileY);
    }

    selectTile(tile) {
        this.selectedTile = tile;
        this.render();
        
        // Update tile info display
        this.updateTileInfo(tile);
        
        // Emit tile selection event
        if (window.gameController) {
            window.gameController.onTileSelected(tile);
        }
    }

    updateTileInfo(tile) {
        const tileInfoEl = document.getElementById('selected-tile-info');
        if (!tileInfoEl) return;
        
        if (!tile) {
            tileInfoEl.innerHTML = '<p>Wähle ein Feld aus...</p>';
            return;
        }
        
        const unit = this.units.find(u => u.x_pos === tile.x_pos && u.y_pos === tile.y_pos);
        
        tileInfoEl.innerHTML = `
            <div class="tile-details">
                <h4>Feld (${tile.x_pos}, ${tile.y_pos})</h4>
                <p><strong>Terrain:</strong> ${tile.terrain_name || 'Unbekannt'}</p>
                ${tile.building_name ? `<p><strong>Gebäude:</strong> ${tile.building_name}</p>` : ''}
                ${tile.owner_id ? `<p><strong>Besitzer:</strong> Spieler ${tile.owner_id}</p>` : ''}
                ${unit ? `<p><strong>Einheit:</strong> ${unit.unit_name} (❤️ ${unit.current_health})</p>` : ''}
            </div>
        `;
    }

    updateCoordinateDisplay() {
        const coordsEl = document.getElementById('mouse-coords');
        if (!coordsEl) return;
        
        if (this.hoveredTile) {
            coordsEl.textContent = `X: ${this.hoveredTile.x_pos}, Y: ${this.hoveredTile.y_pos}`;
        } else {
            coordsEl.textContent = 'X: -, Y: -';
        }
    }

    showNoMapMessage() {
        if (!this.ctx) return;
        
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        this.ctx.fillStyle = '#666';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Keine Kartendaten verfügbar', canvasWidth / 2, canvasHeight / 2);
    }

    showErrorMessage(message) {
        if (!this.ctx) return;
        
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        this.ctx.fillStyle = '#cc0000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, canvasWidth / 2, canvasHeight / 2);
    }
}