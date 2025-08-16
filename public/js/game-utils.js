// game-utils.js - Utility Functions für das Strategiespiel
console.log('🔧 Lade Game Utils...');

// ========================================
// GAME UTILITIES CLASS
// ========================================

class GameUtils {
    // ========================================
    // MATH UTILITIES
    // ========================================

    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static manhattanDistance(x1, y1, x2, y2) {
        return Math.abs(x2 - x1) + Math.abs(y2 - y1);
    }

    static chebyshevDistance(x1, y1, x2, y2) {
        return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    }

    static randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    // ========================================
    // POSITION UTILITIES
    // ========================================

    static isValidPosition(x, y, mapSize) {
        return x >= 0 && x < mapSize && y >= 0 && y < mapSize;
    }

    static getAdjacentPositions(x, y, mapSize) {
        const positions = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        directions.forEach(([dx, dy]) => {
            const newX = x + dx;
            const newY = y + dy;
            if (this.isValidPosition(newX, newY, mapSize)) {
                positions.push({ x: newX, y: newY });
            }
        });

        return positions;
    }

    static getCardinalPositions(x, y, mapSize) {
        const positions = [];
        const directions = [
            [0, -1], // North
            [1, 0],  // East
            [0, 1],  // South
            [-1, 0]  // West
        ];

        directions.forEach(([dx, dy]) => {
            const newX = x + dx;
            const newY = y + dy;
            if (this.isValidPosition(newX, newY, mapSize)) {
                positions.push({ x: newX, y: newY });
            }
        });

        return positions;
    }

    static getPositionsInRange(centerX, centerY, range, mapSize) {
        const positions = [];
        
        for (let y = centerY - range; y <= centerY + range; y++) {
            for (let x = centerX - range; x <= centerX + range; x++) {
                if (this.isValidPosition(x, y, mapSize)) {
                    const distance = this.manhattanDistance(centerX, centerY, x, y);
                    if (distance <= range) {
                        positions.push({ x, y, distance });
                    }
                }
            }
        }

        return positions.sort((a, b) => a.distance - b.distance);
    }

    // ========================================
    // TERRAIN UTILITIES
    // ========================================

    static getMovementCost(terrainType, movementType) {
        if (!window.TERRAIN_DEFINITIONS) {
            console.warn('⚠️ TERRAIN_DEFINITIONS nicht verfügbar');
            return 1;
        }

        const terrain = window.TERRAIN_DEFINITIONS[terrainType];
        if (!terrain || !terrain.movementCost) {
            return 1;
        }

        const cost = terrain.movementCost[movementType];
        return cost === -1 ? null : (cost || 1); // null = impassable
    }

    static canUnitMoveToTerrain(unit, terrainType) {
        const movementType = unit.definition?.movementType || 'ground';
        const cost = this.getMovementCost(terrainType, movementType);
        return cost !== null && cost > 0;
    }

    static getTerrainDefenseBonus(terrainType) {
        if (!window.TERRAIN_DEFINITIONS) return 0;
        
        const terrain = window.TERRAIN_DEFINITIONS[terrainType];
        return terrain?.defensiveBonus || 0;
    }

    static getTerrainIcon(terrainType) {
        if (!window.TERRAIN_DEFINITIONS) return '?';
        
        const terrain = window.TERRAIN_DEFINITIONS[terrainType];
        return terrain?.symbol || '?';
    }

    static getTerrainColor(terrainType) {
        if (!window.TERRAIN_DEFINITIONS) return '#666666';
        
        const terrain = window.TERRAIN_DEFINITIONS[terrainType];
        return terrain?.color || '#666666';
    }

    // ========================================
    // UNIT UTILITIES
    // ========================================

    static calculateDamage(attacker, defender, terrainType = 'grass') {
        const baseAttack = attacker.currentStats?.attack || attacker.attack || 10;
        const baseDefense = defender.currentStats?.defense || defender.defense || 5;
        const terrainBonus = this.getTerrainDefenseBonus(terrainType);
        
        const totalDefense = baseDefense + terrainBonus;
        const damage = Math.max(1, baseAttack - totalDefense);
        
        return {
            damage: damage,
            terrainBonus: terrainBonus,
            criticalHit: Math.random() < 0.1 // 10% crit chance
        };
    }

    static calculateExperience(unitLevel, defeatedUnitLevel) {
        const baseExp = 10;
        const levelDifference = defeatedUnitLevel - unitLevel;
        const multiplier = Math.max(0.5, 1 + (levelDifference * 0.2));
        
        return Math.floor(baseExp * multiplier);
    }

    static getUpgradeCost(unit) {
        if (!unit || unit.level >= 5) return null;
        
        const baseCost = unit.definition?.upgradeCost || unit.definition?.cost || 50;
        return Math.floor(baseCost * Math.pow(1.5, unit.level - 1));
    }

    static canUnitAct(unit) {
        return unit && !unit.hasActed;
    }

    static canUnitMove(unit) {
        return unit && !unit.hasMoved;
    }

    static getUnitMovementRange(unit) {
        return unit?.currentStats?.movement || unit?.movement || 3;
    }

    static getUnitAttackRange(unit) {
        return unit?.definition?.attackRange || unit?.attackRange || 1;
    }

    // ========================================
    // RACE UTILITIES
    // ========================================

    static getRaceById(raceId) {
        const races = window.LOADED_RACES || window.FALLBACK_RACES || [];
        return races.find(race => race.id === raceId);
    }

    static getUnitFromRace(raceId, unitId) {
        const race = this.getRaceById(raceId);
        if (!race || !race.units) return null;
        
        return race.units.find(unit => unit.id === unitId);
    }

    static getRaceStartingGold(raceId) {
        const race = this.getRaceById(raceId);
        return race?.startingGold || 100;
    }

    static getRaceGoldMultiplier(raceId) {
        const race = this.getRaceById(raceId);
        return race?.goldMultiplier || 1.0;
    }

    static getRaceColor(raceId) {
        const race = this.getRaceById(raceId);
        return race?.color || '#3498db';
    }

    // ========================================
    // PERFORMANCE UTILITIES
    // ========================================

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static requestAnimationFrameThrottled(callback) {
        let ticking = false;
        
        return function(...args) {
            if (!ticking) {
                requestAnimationFrame(() => {
                    callback.apply(this, args);
                    ticking = false;
                });
                ticking = true;
            }
        };
    }

    // ========================================
    // COLOR UTILITIES
    // ========================================

    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    static lightenColor(color, percent) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return color;
        
        const factor = 1 + (percent / 100);
        return this.rgbToHex(
            Math.min(255, Math.floor(rgb.r * factor)),
            Math.min(255, Math.floor(rgb.g * factor)),
            Math.min(255, Math.floor(rgb.b * factor))
        );
    }

    static darkenColor(color, percent) {
        const rgb = this.hexToRgb(color);
        if (!rgb) return color;
        
        const factor = 1 - (percent / 100);
        return this.rgbToHex(
            Math.max(0, Math.floor(rgb.r * factor)),
            Math.max(0, Math.floor(rgb.g * factor)),
            Math.max(0, Math.floor(rgb.b * factor))
        );
    }

    static getContrastColor(hexColor) {
        const rgb = this.hexToRgb(hexColor);
        if (!rgb) return '#000000';
        
        // Calculate relative luminance
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // ========================================
    // STRING UTILITIES
    // ========================================

    static capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    static formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    static formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // ========================================
    // VALIDATION UTILITIES
    // ========================================

    static isValidName(name) {
        if (!name || typeof name !== 'string') return false;
        const trimmed = name.trim();
        return trimmed.length >= 2 && trimmed.length <= 20 && /^[a-zA-Z0-9\s_-]+$/.test(trimmed);
    }

    static isValidGameName(name) {
        if (!name || typeof name !== 'string') return false;
        const trimmed = name.trim();
        return trimmed.length >= 3 && trimmed.length <= 30 && /^[a-zA-Z0-9\s_-]+$/.test(trimmed);
    }

    static isValidMapSize(size) {
        const num = Number(size);
        return Number.isInteger(num) && num >= 20 && num <= 100;
    }

    static isValidPlayerCount(count) {
        const num = Number(count);
        return Number.isInteger(num) && num >= 2 && num <= 8;
    }

    // ========================================
    // ARRAY UTILITIES
    // ========================================

    static removeFromArray(array, item) {
        const index = array.indexOf(item);
        if (index > -1) {
            array.splice(index, 1);
            return true;
        }
        return false;
    }

    static insertIntoSortedArray(array, item, compareFn) {
        const index = this.binarySearchInsertIndex(array, item, compareFn);
        array.splice(index, 0, item);
        return index;
    }

    static binarySearchInsertIndex(array, item, compareFn) {
        let left = 0;
        let right = array.length;
        
        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            if (compareFn(array[mid], item) < 0) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        
        return left;
    }

    static chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    // ========================================
    // OBJECT UTILITIES
    // ========================================

    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }
        return obj;
    }

    static deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        if (obj1 == null || obj2 == null) return obj1 === obj2;
        if (typeof obj1 !== typeof obj2) return false;
        
        if (typeof obj1 === 'object') {
            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);
            
            if (keys1.length !== keys2.length) return false;
            
            for (const key of keys1) {
                if (!keys2.includes(key) || !this.deepEqual(obj1[key], obj2[key])) {
                    return false;
                }
            }
            return true;
        }
        
        return obj1 === obj2;
    }

    static merge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.merge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return this.merge(target, ...sources);
    }

    static isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    // ========================================
    // DOM UTILITIES
    // ========================================

    static createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    }

    static addEventListenerOnce(element, event, handler) {
        const onceHandler = (e) => {
            handler(e);
            element.removeEventListener(event, onceHandler);
        };
        element.addEventListener(event, onceHandler);
    }

    static getElementOffset(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    }

    // ========================================
    // STORAGE UTILITIES (In-Memory Only)
    // ========================================

    static storage = new Map();

    static setItem(key, value) {
        try {
            this.storage.set(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage setItem error:', error);
            return false;
        }
    }

    static getItem(key, defaultValue = null) {
        try {
            const value = this.storage.get(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error('Storage getItem error:', error);
            return defaultValue;
        }
    }

    static removeItem(key) {
        return this.storage.delete(key);
    }

    static clearStorage() {
        this.storage.clear();
    }

    // ========================================
    // PATHFINDING UTILITIES
    // ========================================

    static findPath(start, end, mapSize, isPassable) {
        const openSet = [{ ...start, g: 0, h: this.manhattanDistance(start.x, start.y, end.x, end.y), f: 0 }];
        const closedSet = new Set();
        const cameFrom = new Map();
        
        openSet[0].f = openSet[0].g + openSet[0].h;
        
        while (openSet.length > 0) {
            // Find node with lowest f score
            let current = openSet[0];
            let currentIndex = 0;
            
            for (let i = 1; i < openSet.length; i++) {
                if (openSet[i].f < current.f) {
                    current = openSet[i];
                    currentIndex = i;
                }
            }
            
            // Remove current from open set
            openSet.splice(currentIndex, 1);
            const currentKey = `${current.x},${current.y}`;
            closedSet.add(currentKey);
            
            // Check if we reached the goal
            if (current.x === end.x && current.y === end.y) {
                return this.reconstructPath(cameFrom, current);
            }
            
            // Check neighbors
            const neighbors = this.getCardinalPositions(current.x, current.y, mapSize);
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                
                if (closedSet.has(neighborKey)) continue;
                if (!isPassable(neighbor.x, neighbor.y)) continue;
                
                const tentativeG = current.g + 1; // Assuming movement cost of 1
                
                const existingNode = openSet.find(node => node.x === neighbor.x && node.y === neighbor.y);
                
                if (!existingNode) {
                    const newNode = {
                        x: neighbor.x,
                        y: neighbor.y,
                        g: tentativeG,
                        h: this.manhattanDistance(neighbor.x, neighbor.y, end.x, end.y),
                        f: 0
                    };
                    newNode.f = newNode.g + newNode.h;
                    openSet.push(newNode);
                    cameFrom.set(neighborKey, current);
                } else if (tentativeG < existingNode.g) {
                    existingNode.g = tentativeG;
                    existingNode.f = existingNode.g + existingNode.h;
                    cameFrom.set(neighborKey, current);
                }
            }
        }
        
        return []; // No path found
    }

    static reconstructPath(cameFrom, current) {
        const path = [{ x: current.x, y: current.y }];
        let currentKey = `${current.x},${current.y}`;
        
        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            path.unshift({ x: current.x, y: current.y });
            currentKey = `${current.x},${current.y}`;
        }
        
        return path;
    }

    // ========================================
    // DEBUGGING UTILITIES
    // ========================================

    static log(category, message, data = null) {
        if (!window.GAME_CONFIG?.DEBUG_MODE) return;
        
        const timestamp = new Date().toISOString().substr(11, 8);
        const prefix = `[${timestamp}] [${category.toUpperCase()}]`;
        
        if (data) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    }

    static logError(category, message, error = null) {
        const timestamp = new Date().toISOString().substr(11, 8);
        const prefix = `[${timestamp}] [${category.toUpperCase()}] ERROR:`;
        
        if (error) {
            console.error(prefix, message, error);
        } else {
            console.error(prefix, message);
        }
    }

    static logPerformance(label, fn) {
        if (!window.GAME_CONFIG?.DEBUG_MODE) return fn();
        
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        console.log(`⏱️ [PERF] ${label}: ${(end - start).toFixed(2)}ms`);
        return result;
    }

    static assert(condition, message) {
        if (!condition) {
            const error = new Error(`Assertion failed: ${message}`);
            console.error(error);
            if (window.GAME_CONFIG?.DEBUG_MODE) {
                throw error;
            }
        }
    }

    // ========================================
    // BROWSER COMPATIBILITY
    // ========================================

    static isSupported() {
        const required = [
            'requestAnimationFrame',
            'WebSocket',
            'JSON',
            'localStorage',
            'canvas'
        ];
        
        const missing = required.filter(feature => {
            switch (feature) {
                case 'requestAnimationFrame':
                    return !window.requestAnimationFrame;
                case 'WebSocket':
                    return !window.WebSocket;
                case 'JSON':
                    return !window.JSON;
                case 'localStorage':
                    return !window.localStorage;
                case 'canvas':
                    const canvas = document.createElement('canvas');
                    return !canvas.getContext || !canvas.getContext('2d');
                default:
                    return false;
            }
        });
        
        if (missing.length > 0) {
            console.warn('⚠️ Missing browser features:', missing);
            return false;
        }
        
        return true;
    }

    static showUnsupportedBrowserMessage() {
        const message = `
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                <h2>🚫 Browser nicht unterstützt</h2>
                <p>Ihr Browser unterstützt nicht alle erforderlichen Features für dieses Spiel.</p>
                <p>Bitte verwenden Sie einen modernen Browser wie:</p>
                <ul style="list-style: none; padding: 0;">
                    <li>Chrome 60+</li>
                    <li>Firefox 55+</li>
                    <li>Safari 11+</li>
                    <li>Edge 79+</li>
                </ul>
            </div>
        `;
        document.body.innerHTML = message;
    }
}

// ========================================
// GLOBAL EXPORT FÜR BROWSER
// ========================================

// Mache GameUtils global verfügbar
if (typeof window !== 'undefined') {
    window.GameUtils = GameUtils;
}

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameUtils;
}

console.log('✅ Game Utils vollständig geladen und exportiert');