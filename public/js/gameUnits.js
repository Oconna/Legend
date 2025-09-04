// Game Units Management
class GameUnits {
    constructor(gameController) {
        this.game = gameController;
        this.units = [];
        this.availableUnits = []; // Units that can be purchased
        this.selectedUnit = null;
        this.moveableTiles = [];
        this.attackableTiles = [];
        this.currentPath = [];
    }

    // Load unit data
    async loadUnits(units) {
        this.units = units;
        console.log(`Loaded ${units.length} units`);
    }

    async loadAvailableUnits(playerRaceId) {
        try {
            const units = await Utils.get(`/api/games/${this.game.gameId}/races/${playerRaceId}/units`);
            this.availableUnits = units;
            console.log(`Loaded ${units.length} available units for race ${playerRaceId}`);
        } catch (error) {
            console.error('Error loading available units:', error);
        }
    }

    // Unit selection
    selectUnit(x, y) {
        const unit = this.getUnitAt(x, y);
        
        if (unit && unit.player_id === this.game.currentPlayerId) {
            this.selectedUnit = unit;
            this.calculateMoveableTiles();
            this.calculateAttackableTiles();
            return unit;
        } else {
            this.clearSelection();
            return null;
        }
    }

    clearSelection() {
        this.selectedUnit = null;
        this.moveableTiles = [];
        this.attackableTiles = [];
        this.currentPath = [];
        
        if (this.game.map) {
            this.game.map.clearHighlights();
        }
    }

    // Movement calculation
    calculateMoveableTiles() {
        if (!this.selectedUnit) return;

        this.moveableTiles = [];
        const visited = new Set();
        const queue = [{
            x: this.selectedUnit.x_pos,
            y: this.selectedUnit.y_pos,
            movementLeft: this.selectedUnit.movement_left || this.selectedUnit.movement_points
        }];

        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (current.movementLeft > 0 && 
                !(current.x === this.selectedUnit.x_pos && current.y === this.selectedUnit.y_pos)) {
                this.moveableTiles.push({ x: current.x, y: current.y });
            }

            // Check adjacent tiles
            const directions = [
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
            ];

            directions.forEach(dir => {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                const newKey = `${newX},${newY}`;

                if (visited.has(newKey)) return;

                const tile = this.game.map.getTileData(newX, newY);
                if (!tile) return;

                // Check if tile is passable
                if (!this.canUnitPassTile(this.selectedUnit, tile)) return;

                // Check if another unit is on this tile
                const unitOnTile = this.getUnitAt(newX, newY);
                if (unitOnTile && unitOnTile.id !== this.selectedUnit.id) return;

                const movementCost = this.getMovementCost(this.selectedUnit, tile);
                const newMovementLeft = current.movementLeft - movementCost;

                if (newMovementLeft >= 0) {
                    queue.push({
                        x: newX,
                        y: newY,
                        movementLeft: newMovementLeft
                    });
                }
            });
        }

        // Update map highlights
        if (this.game.map) {
            this.game.map.setMoveableTiles(this.moveableTiles);
        }
    }

    calculateAttackableTiles() {
        if (!this.selectedUnit) return;

        this.attackableTiles = [];
        const range = this.selectedUnit.range || 1;
        const unitX = this.selectedUnit.x_pos;
        const unitY = this.selectedUnit.y_pos;

        // Check all tiles within range
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0) continue; // Skip own position
                
                const targetX = unitX + dx;
                const targetY = unitY + dy;
                
                // Check if target is in map bounds
                const tile = this.game.map.getTileData(targetX, targetY);
                if (!tile) continue;
                
                // Check if there's an enemy unit on this tile
                const targetUnit = this.getUnitAt(targetX, targetY);
                if (targetUnit && targetUnit.player_id !== this.selectedUnit.player_id) {
                    // Check if unit is on mountain for range bonus
                    const currentTile = this.game.map.getTileData(unitX, unitY);
                    const actualRange = this.getActualRange(this.selectedUnit, currentTile);
                    
                    // Calculate actual distance
                    const distance = Math.max(Math.abs(dx), Math.abs(dy));
                    
                    if (distance <= actualRange) {
                        this.attackableTiles.push({ x: targetX, y: targetY, unit: targetUnit });
                    }
                }
            }
        }

        // Update map highlights
        if (this.game.map) {
            this.game.map.setAttackableTiles(this.attackableTiles);
        }
    }

    getActualRange(unit, currentTile) {
        let range = unit.range || 1;
        
        // Range bonus for units on mountain tiles
        if (currentTile && currentTile.terrain_type_id === 2 && range > 1) {
            range += 1;
        }
        
        return range;
    }

    // Movement helpers
    canUnitPassTile(unit, tile) {
        // Water can only be passed by flying units
        if (tile.terrain_type_id === 4 && !unit.can_fly) {
            return false;
        }
        
        return true;
    }

    getMovementCost(unit, tile) {
        // Flying units have reduced movement cost on difficult terrain
        if (unit.can_fly) {
            if (tile.terrain_type_id === 2 || tile.terrain_type_id === 4) { // Mountain or Water
                return 1;
            }
        }
        
        // Standard movement costs based on terrain
        const movementCosts = {
            1: 1, // Grass
            2: 3, // Mountain
            3: 2, // Swamp
            4: 99, // Water (impassable for non-flying)
            5: 2, // Forest
            6: 2, // Desert
            7: 2  // Snow
        };
        
        return movementCosts[tile.terrain_type_id] || 1;
    }

    // Pathfinding
    calculatePath(startX, startY, endX, endY, unit = null) {
        const unitToUse = unit || this.selectedUnit;
        if (!unitToUse) return [];

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${startX},${startY}`;
        const endKey = `${endX},${endY}`;

        openSet.push({ x: startX, y: startY, f: 0 });
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, endX, endY));

        while (openSet.length > 0) {
            // Find node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentKey = `${current.x},${current.y}`;

            if (current.x === endX && current.y === endY) {
                // Reconstruct path
                return this.reconstructPath(cameFrom, currentKey);
            }

            closedSet.add(currentKey);

            // Check neighbors
            const directions = [
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
            ];

            directions.forEach(dir => {
                const neighborX = current.x + dir.dx;
                const neighborY = current.y + dir.dy;
                const neighborKey = `${neighborX},${neighborY}`;

                if (closedSet.has(neighborKey)) return;

                const tile = this.game.map.getTileData(neighborX, neighborY);
                if (!tile || !this.canUnitPassTile(unitToUse, tile)) return;

                // Check for other units (except destination)
                if (neighborX !== endX || neighborY !== endY) {
                    const unitOnTile = this.getUnitAt(neighborX, neighborY);
                    if (unitOnTile && unitOnTile.id !== unitToUse.id) return;
                }

                const movementCost = this.getMovementCost(unitToUse, tile);
                const tentativeGScore = gScore.get(currentKey) + movementCost;

                const existingInOpen = openSet.find(node => node.x === neighborX && node.y === neighborY);
                
                if (!existingInOpen) {
                    openSet.push({ 
                        x: neighborX, 
                        y: neighborY, 
                        f: tentativeGScore + this.heuristic(neighborX, neighborY, endX, endY) 
                    });
                } else if (tentativeGScore >= gScore.get(neighborKey)) {
                    return; // Not a better path
                }

                cameFrom.set(neighborKey, currentKey);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighborX, neighborY, endX, endY));
                
                if (existingInOpen) {
                    existingInOpen.f = fScore.get(neighborKey);
                }
            });
        }

        return []; // No path found
    }

    heuristic(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    reconstructPath(cameFrom, currentKey) {
        const path = [];
        let current = currentKey;

        while (cameFrom.has(current)) {
            const [x, y] = current.split(',').map(Number);
            path.unshift({ x, y });
            current = cameFrom.get(current);
        }

        return path;
    }

    // Unit actions
    async moveUnit(unit, targetX, targetY) {
        if (!unit || unit.player_id !== this.game.currentPlayerId) {
            throw new Error('Cannot move this unit');
        }

        // Calculate path
        const path = this.calculatePath(unit.x_pos, unit.y_pos, targetX, targetY, unit);
        if (path.length === 0) {
            throw new Error('No valid path to target');
        }

        // Calculate movement cost
        let totalCost = 0;
        for (const tile of path) {
            const tileData = this.game.map.getTileData(tile.x, tile.y);
            totalCost += this.getMovementCost(unit, tileData);
        }

        const movementLeft = unit.movement_left || unit.movement_points;
        if (totalCost > movementLeft) {
            throw new Error('Not enough movement points');
        }

        // Send move command to server
        return new Promise((resolve, reject) => {
            this.game.socket.emit('move-unit', {
                gameId: this.game.gameId,
                unitId: unit.id,
                targetX: targetX,
                targetY: targetY,
                path: path
            }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    async attackUnit(attackerUnit, targetX, targetY) {
        if (!attackerUnit || attackerUnit.player_id !== this.game.currentPlayerId) {
            throw new Error('Cannot attack with this unit');
        }

        const targetUnit = this.getUnitAt(targetX, targetY);
        if (!targetUnit || targetUnit.player_id === attackerUnit.player_id) {
            throw new Error('No valid target');
        }

        // Check if target is in range
        const isInRange = this.attackableTiles.some(tile => 
            tile.x === targetX && tile.y === targetY
        );

        if (!isInRange) {
            throw new Error('Target is not in range');
        }

        // Send attack command to server
        return new Promise((resolve, reject) => {
            this.game.socket.emit('attack-unit', {
                gameId: this.game.gameId,
                attackerUnitId: attackerUnit.id,
                targetX: targetX,
                targetY: targetY
            }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    async purchaseUnit(unitTypeId, buildingX, buildingY) {
        // Check if building belongs to current player
        const tile = this.game.map.getTileData(buildingX, buildingY);
        if (!tile || !tile.building_type_id || tile.building_owner_id !== this.game.currentPlayerId) {
            throw new Error('Cannot purchase from this building');
        }

        // Check if tile is occupied
        const unitOnTile = this.getUnitAt(buildingX, buildingY);
        if (unitOnTile) {
            throw new Error('Building tile is occupied');
        }

        // Send purchase command to server
        return new Promise((resolve, reject) => {
            this.game.socket.emit('purchase-unit', {
                gameId: this.game.gameId,
                unitTypeId: unitTypeId,
                buildingX: buildingX,
                buildingY: buildingY
            }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error));
                }
            });
        });
    }

    // Unit queries
    getUnitAt(x, y) {
        return this.units.find(unit => unit.x_pos === x && unit.y_pos === y);
    }

    getPlayerUnits(playerId) {
        return this.units.filter(unit => unit.player_id === playerId);
    }

    getCurrentPlayerUnits() {
        return this.getPlayerUnits(this.game.currentPlayerId);
    }

    // Unit updates
    updateUnit(unitData) {
        const index = this.units.findIndex(unit => unit.id === unitData.id);
        if (index !== -1) {
            this.units[index] = { ...this.units[index], ...unitData };
        }
    }

    addUnit(unitData) {
        this.units.push(unitData);
    }

    removeUnit(unitId) {
        const index = this.units.findIndex(unit => unit.id === unitId);
        if (index !== -1) {
            this.units.splice(index, 1);
        }
    }

    // UI Helpers
    getUnitDisplayInfo(unit) {
        if (!unit) return null;

        const maxHealth = this.getUnitMaxHealth(unit);
        const healthPercent = (unit.current_health / maxHealth) * 100;
        const movementLeft = unit.movement_left || unit.movement_points;
        const maxMovement = unit.movement_points;

        return {
            name: unit.name,
            health: unit.current_health,
            maxHealth: maxHealth,
            healthPercent: healthPercent,
            movement: movementLeft,
            maxMovement: maxMovement,
            attack: unit.attack_power,
            range: unit.range,
            canFly: unit.can_fly,
            playerColor: this.game.map.getPlayerColor(unit.player_id)
        };
    }

    getUnitMaxHealth(unit) {
        // Calculate with tier bonuses
        const player = this.game.getPlayer(unit.player_id);
        const tierBonus = this.getTierBonus(player?.tier_level || 1);
        return Math.round(unit.health_points * (1 + tierBonus));
    }

    getTierBonus(tierLevel) {
        const bonuses = { 1: 0, 2: 0.2, 3: 0.4 };
        return bonuses[tierLevel] || 0;
    }

    // Purchase helpers
    getAffordableUnits(playerGold, tierLevel = 1) {
        const tierBonus = this.getTierBonus(tierLevel);
        
        return this.availableUnits.map(unit => ({
            ...unit,
            enhancedHealth: Math.round(unit.health_points * (1 + tierBonus)),
            enhancedAttack: Math.round(unit.attack_power * (1 + tierBonus)),
            enhancedRange: Math.max(1, Math.round(unit.range * (1 + tierBonus))),
            affordable: unit.cost <= playerGold
        })).sort((a, b) => a.cost - b.cost);
    }

    // Combat calculation
    calculateDamage(attacker, defender) {
        const player = this.game.getPlayer(attacker.player_id);
        const tierBonus = this.getTierBonus(player?.tier_level || 1);
        const enhancedAttack = Math.round(attacker.attack_power * (1 + tierBonus));
        
        return {
            damage: enhancedAttack,
            survivedHealth: Math.max(0, defender.current_health - enhancedAttack),
            willDestroy: (defender.current_health - enhancedAttack) <= 0
        };
    }

    // Path preview
    showPath(startX, startY, endX, endY) {
        if (!this.selectedUnit) return;
        
        const path = this.calculatePath(startX, startY, endX, endY);
        this.currentPath = path;
        
        if (this.game.map) {
            this.game.map.setPathTiles(path);
        }
        
        return path;
    }

    clearPath() {
        this.currentPath = [];
        if (this.game.map) {
            this.game.map.setPathTiles([]);
        }
    }

    // Validation
    canMoveToTile(x, y) {
        return this.moveableTiles.some(tile => tile.x === x && tile.y === y);
    }

    canAttackTile(x, y) {
        return this.attackableTiles.some(tile => tile.x === x && tile.y === y);
    }

    isValidPurchaseLocation(x, y) {
        const tile = this.game.map.getTileData(x, y);
        if (!tile || !tile.building_type_id || tile.building_owner_id !== this.game.currentPlayerId) {
            return false;
        }
        
        const unitOnTile = this.getUnitAt(x, y);
        return !unitOnTile;
    }
}