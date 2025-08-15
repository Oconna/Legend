// game-config.js - Zentrale Konfiguration und Konstanten

console.log('📋 Lade Spiel-Konfiguration...');

// ========================================
// GAME CONFIGURATION
// ========================================

const GAME_CONFIG = {
    // Turn System
    TURN_TIME_LIMIT: 120, // Sekunden pro Zug
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 8,
    
    // Map Settings
    DEFAULT_MAP_SIZE: 30,
    MIN_MAP_SIZE: 20,
    MAX_MAP_SIZE: 100,
    TILE_SIZE: 32,
    
    // Camera Settings
    DEFAULT_ZOOM: 1.0,
    MIN_ZOOM: 0.3,
    MAX_ZOOM: 3.0,
    ZOOM_FACTOR: 1.2,
    PAN_SPEED: 50,
    
    // UI Settings
    NOTIFICATION_DURATION: 4000,
    DEBUG_MODE: true,
    AUTO_SAVE_INTERVAL: 30000,
    
    // Performance
    TARGET_FPS: 60,
    RENDER_THROTTLE: 16, // ~60fps
    
    // Network
    PING_INTERVAL: 30000,
    RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 2000
};

// ========================================
// TERRAIN DEFINITIONS
// ========================================

const TERRAIN_DEFINITIONS = {
    grass: { 
        name: 'Wiese', 
        color: '#27ae60', 
        symbol: '🌱',
        movementCost: { ground: 1, flying: 1, amphibious: 1 }
    },
    forest: { 
        name: 'Wald', 
        color: '#229954', 
        symbol: '🌲',
        movementCost: { ground: 2, flying: 1, amphibious: 2 }
    },
    mountain: { 
        name: 'Berge', 
        color: '#95a5a6', 
        symbol: '⛰️',
        movementCost: { ground: 3, flying: 1, amphibious: 4 }
    },
    swamp: { 
        name: 'Sumpf', 
        color: '#8b4513', 
        symbol: '🐸',
        movementCost: { ground: 2, flying: 1, amphibious: 1 }
    },
    water: { 
        name: 'Wasser', 
        color: '#3498db', 
        symbol: '💧',
        movementCost: { ground: -1, flying: 1, amphibious: 1 } // -1 = nicht passierbar
    },
    city: { 
        name: 'Stadt', 
        color: '#e67e22', 
        symbol: '🏘️',
        movementCost: { ground: 1, flying: 1, amphibious: 1 },
        goldIncome: 2
    },
    castle: { 
        name: 'Burg', 
        color: '#9b59b6', 
        symbol: '🏰',
        movementCost: { ground: 1, flying: 1, amphibious: 1 },
        goldIncome: 5
    }
};

// ========================================
// FALLBACK RACE DATA
// ========================================

const FALLBACK_RACES = [
    {
        id: "humans",
        name: "Menschen",
        icon: "👑",
        description: "Vielseitige und anpassungsfähige Rasse",
        color: "#3498db",
        specialAbility: "Zusätzliches Gold aus Städten (+1 Gold pro Stadt)",
        startingGold: 120,
        goldMultiplier: 1.2,
        units: [
            { id: "peasant", name: "Bauer", icon: "👨‍🌾", cost: 15, baseStats: { hp: 30, attack: 8, defense: 5, movement: 3 } },
            { id: "swordsman", name: "Schwertkämpfer", icon: "⚔️", cost: 30, baseStats: { hp: 50, attack: 15, defense: 12, movement: 3 } },
            { id: "archer", name: "Bogenschütze", icon: "🏹", cost: 25, baseStats: { hp: 35, attack: 12, defense: 6, movement: 3 } },
            { id: "knight", name: "Ritter", icon: "🐎", cost: 50, baseStats: { hp: 70, attack: 20, defense: 18, movement: 4 } },
            { id: "mage", name: "Magier", icon: "🧙‍♂️", cost: 40, baseStats: { hp: 30, attack: 18, defense: 4, movement: 2 } },
            { id: "paladin", name: "Paladin", icon: "⚡", cost: 70, baseStats: { hp: 80, attack: 22, defense: 20, movement: 3 } }
        ]
    },
    {
        id: "orcs",
        name: "Orks",
        icon: "👹",
        description: "Brutale Krieger mit starken Nahkampf-Einheiten",
        color: "#e74c3c",
        specialAbility: "Bonus-Angriff nach einem Sieg (+2 Angriff für 1 Runde)",
        startingGold: 100,
        goldMultiplier: 1.0,
        units: [
            { id: "goblin", name: "Goblin", icon: "👺", cost: 12, baseStats: { hp: 25, attack: 10, defense: 3, movement: 4 } },
            { id: "orc_warrior", name: "Ork-Krieger", icon: "⚔️", cost: 28, baseStats: { hp: 60, attack: 18, defense: 10, movement: 3 } },
            { id: "berserker", name: "Berserker", icon: "🪓", cost: 35, baseStats: { hp: 55, attack: 22, defense: 6, movement: 4 } },
            { id: "troll", name: "Troll", icon: "🧌", cost: 65, baseStats: { hp: 100, attack: 25, defense: 15, movement: 2 } },
            { id: "shaman", name: "Schamane", icon: "🔮", cost: 38, baseStats: { hp: 35, attack: 16, defense: 5, movement: 2 } },
            { id: "wyvern", name: "Wyvern", icon: "🐉", cost: 120, baseStats: { hp: 75, attack: 30, defense: 12, movement: 6 } }
        ]
    },
    {
        id: "elves",
        name: "Elfen",
        icon: "🧝‍♀️",
        description: "Geschickte Bogenschützen und Naturmagier",
        color: "#27ae60",
        specialAbility: "Bewegungsbonus in Wäldern (+1 Bewegung)",
        startingGold: 110,
        goldMultiplier: 1.1,
        units: [
            { id: "elf_scout", name: "Elf-Späher", icon: "🕵️‍♀️", cost: 18, baseStats: { hp: 30, attack: 10, defense: 8, movement: 4 } },
            { id: "elf_archer", name: "Elf-Bogenschütze", icon: "🏹", cost: 28, baseStats: { hp: 35, attack: 16, defense: 6, movement: 3 } },
            { id: "druid", name: "Druide", icon: "🌿", cost: 35, baseStats: { hp: 40, attack: 14, defense: 8, movement: 2 } },
            { id: "unicorn", name: "Einhorn", icon: "🦄", cost: 55, baseStats: { hp: 50, attack: 18, defense: 12, movement: 5 } },
            { id: "eagle_rider", name: "Adlerreiter", icon: "🦅", cost: 45, baseStats: { hp: 40, attack: 14, defense: 8, movement: 6 } },
            { id: "phoenix", name: "Phönix", icon: "🔥", cost: 90, baseStats: { hp: 60, attack: 28, defense: 10, movement: 7 } }
        ]
    }
];

// ========================================
// UNIT ABILITIES
// ========================================

const UNIT_ABILITIES = {
    magic_damage: {
        name: "Magischer Schaden",
        description: "Ignoriert Rüstung teilweise",
        effect: "defense_penetration"
    },
    heal: {
        name: "Heilung",
        description: "Kann andere Einheiten heilen",
        effect: "heal_others"
    },
    flying: {
        name: "Fliegend",
        description: "Kann über Hindernisse fliegen",
        effect: "ignore_terrain"
    },
    siege: {
        name: "Belagerung",
        description: "Bonus-Schaden gegen Gebäude",
        effect: "building_damage"
    },
    stealth: {
        name: "Tarnung",
        description: "Schwerer zu entdecken",
        effect: "vision_reduction"
    },
    regeneration: {
        name: "Regeneration",
        description: "Heilt sich selbst jede Runde",
        effect: "self_heal"
    },
    berserker_rage: {
        name: "Berserker-Wut",
        description: "Mehr Angriff bei weniger Leben",
        effect: "damage_when_wounded"
    },
    leadership: {
        name: "Führung",
        description: "Verstärkt umliegende Einheiten",
        effect: "buff_nearby"
    },
    divine: {
        name: "Göttlich",
        description: "Immun gegen negative Effekte",
        effect: "status_immunity"
    }
};

// ========================================
// GAME PHASE CONSTANTS
// ========================================

const GAME_PHASES = {
    LOBBY: 'lobby',
    RACE_SELECTION: 'race_selection',
    PLAYING: 'playing',
    FINISHED: 'finished'
};

// ========================================
// NOTIFICATION TYPES
// ========================================

const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    INFO: 'info'
};

// ========================================
// MOVEMENT TYPES
// ========================================

const MOVEMENT_TYPES = {
    GROUND: 'ground',
    FLYING: 'flying',
    AMPHIBIOUS: 'amphibious'
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

const GameUtils = {
    // Berechne Bewegungskosten für Terrain und Einheitentyp
    getMovementCost(terrainType, movementType) {
        const terrain = TERRAIN_DEFINITIONS[terrainType];
        if (!terrain || !terrain.movementCost) return 1;
        
        const cost = terrain.movementCost[movementType];
        return cost === -1 ? null : cost; // null = nicht passierbar
    },
    
    // Berechne Distanz zwischen zwei Punkten (Manhattan Distance)
    getDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    },
    
    // Prüfe ob Position gültig ist
    isValidPosition(x, y, mapSize) {
        return x >= 0 && x < mapSize && y >= 0 && y < mapSize;
    },
    
    // Berechne Level-basierte Stats
    calculateStatsForLevel(baseStats, level) {
        const multiplier = 1 + ((level - 1) * 0.2); // 20% Steigerung pro Level
        return {
            hp: Math.floor(baseStats.hp * multiplier),
            attack: Math.floor(baseStats.attack * multiplier),
            defense: Math.floor(baseStats.defense * multiplier),
            movement: baseStats.movement // Bewegung bleibt gleich
        };
    },
    
    // Berechne Upgrade-Kosten
    calculateUpgradeCost(baseCost, currentLevel) {
        return Math.floor(baseCost * Math.pow(1.5, currentLevel - 1));
    },
    
    // Formatiere Zahlen für Anzeige
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    },
    
    // Generiere zufällige ID
    generateId(prefix = 'id') {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // Debounce Funktion für Performance
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle Funktion für Performance
    throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function() {
            const context = this;
            const args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function() {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    },
    
    // Zufällige Auswahl aus Array
    randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    },
    
    // Mische Array (Fisher-Yates Shuffle)
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },
    
    // Clamp Wert zwischen Min und Max
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    // Interpolation zwischen zwei Werten
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },
    
    // Konvertiere RGB zu Hex
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    },
    
    // Parse Hex zu RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
};

// ========================================
// VALIDATION FUNCTIONS
// ========================================

const GameValidation = {
    // Validiere Spielername
    validatePlayerName(name) {
        const errors = [];
        if (!name || name.trim().length === 0) {
            errors.push('Name darf nicht leer sein');
        }
        if (name.length < 2) {
            errors.push('Name muss mindestens 2 Zeichen haben');
        }
        if (name.length > 20) {
            errors.push('Name darf maximal 20 Zeichen haben');
        }
        if (!/^[a-zA-Z0-9äöüÄÖÜß_-]+$/.test(name)) {
            errors.push('Name enthält ungültige Zeichen');
        }
        return errors;
    },
    
    // Validiere Spieleinstellungen
    validateGameSettings(settings) {
        const errors = [];
        
        if (!settings.name || settings.name.trim().length === 0) {
            errors.push('Spielname erforderlich');
        }
        
        if (settings.maxPlayers < GAME_CONFIG.MIN_PLAYERS || settings.maxPlayers > GAME_CONFIG.MAX_PLAYERS) {
            errors.push(`Spieleranzahl muss zwischen ${GAME_CONFIG.MIN_PLAYERS} und ${GAME_CONFIG.MAX_PLAYERS} liegen`);
        }
        
        if (settings.mapSize < GAME_CONFIG.MIN_MAP_SIZE || settings.mapSize > GAME_CONFIG.MAX_MAP_SIZE) {
            errors.push(`Kartengröße muss zwischen ${GAME_CONFIG.MIN_MAP_SIZE} und ${GAME_CONFIG.MAX_MAP_SIZE} liegen`);
        }
        
        return errors;
    },
    
    // Validiere Rassen-ID
    validateRaceId(raceId) {
        return FALLBACK_RACES.some(race => race.id === raceId);
    },
    
    // Validiere Position auf Karte
    validatePosition(x, y, mapSize) {
        return Number.isInteger(x) && Number.isInteger(y) && 
               x >= 0 && x < mapSize && y >= 0 && y < mapSize;
    }
};

// ========================================
// EVENT CONSTANTS
// ========================================

const GAME_EVENTS = {
    // Socket Events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    GAME_STARTED: 'game-started',
    RACE_SELECTED: 'race-selected',
    ALL_RACES_SELECTED: 'all-races-selected',
    TURN_ENDED: 'turn-ended',
    TURN_FORCED: 'turn-forced',
    
    // Custom Events
    PLAYER_READY: 'player-ready',
    UNIT_MOVED: 'unit-moved',
    UNIT_ATTACKED: 'unit-attacked',
    BUILDING_CAPTURED: 'building-captured',
    GAME_WON: 'game-won',
    
    // UI Events
    NOTIFICATION_SHOWN: 'notification-shown',
    MODAL_OPENED: 'modal-opened',
    MODAL_CLOSED: 'modal-closed'
};

// ========================================
// EXPORT CONFIGURATION
// ========================================

// Global verfügbar machen für Browser
if (typeof window !== 'undefined') {
    window.GAME_CONFIG = GAME_CONFIG;
    window.TERRAIN_DEFINITIONS = TERRAIN_DEFINITIONS;
    window.FALLBACK_RACES = FALLBACK_RACES;
    window.UNIT_ABILITIES = UNIT_ABILITIES;
    window.GAME_PHASES = GAME_PHASES;
    window.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
    window.MOVEMENT_TYPES = MOVEMENT_TYPES;
    window.GAME_EVENTS = GAME_EVENTS;
    window.GameUtils = GameUtils;
    window.GameValidation = GameValidation;
}

console.log('✅ Spiel-Konfiguration geladen');
console.log(`📊 ${FALLBACK_RACES.length} Rassen, ${Object.keys(TERRAIN_DEFINITIONS).length} Terrain-Typen, ${Object.keys(UNIT_ABILITIES).length} Fähigkeiten verfügbar`);