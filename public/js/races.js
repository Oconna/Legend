// races.js - Hybrides System: JSON + Code mit DB-Vorbereitung
console.log('🏛️ Race System Loading...');

// ========================================
// BEWEGUNGSTYPEN DEFINITION
// ========================================
const MOVEMENT_TYPES = {
    ground: 'ground',
    flying: 'flying',
    amphibious: 'amphibious'
};

// ========================================
// TERRAIN BEWEGUNGSKOSTEN
// ========================================
const TERRAIN_MOVEMENT_COSTS = {
    grass: { ground: 1, flying: 1, amphibious: 1 },
    forest: { ground: 2, flying: 1, amphibious: 2 },
    mountain: { ground: 3, flying: 1, amphibious: 4 },
    swamp: { ground: 2, flying: 1, amphibious: 1 },
    water: { ground: -1, flying: 1, amphibious: 1 },
    city: { ground: 1, flying: 1, amphibious: 1 },
    castle: { ground: 1, flying: 1, amphibious: 1 }
};

// ========================================
// RACE DATA MANAGER
// ========================================
class RaceDataManager {
    constructor() {
        this.races = new Map();
        this.abilities = new Map();
        this.isLoaded = false;
        this.loadPromise = null;
        this.dataSource = 'local'; // 'local', 'json', 'database'
    }

    async loadRaces() {
        if (this.loadPromise) return this.loadPromise;
        
        this.loadPromise = this._loadRacesInternal();
        return this.loadPromise;
    }

    async _loadRacesInternal() {
        console.log('📂 Loading race data...');
        
        try {
            // Try loading from external JSON first
            const jsonData = await this._loadFromJSON();
            if (jsonData) {
                this._processRaceData(jsonData);
                this.dataSource = 'json';
                console.log('✅ Races loaded from JSON');
                return;
            }
        } catch (error) {
            console.warn('⚠️ JSON loading failed, falling back to local data:', error);
        }

        // Fallback to hardcoded data
        const localData = this._getLocalRaceData();
        this._processRaceData(localData);
        this.dataSource = 'local';
        console.log('✅ Races loaded from local data');
    }

    async _loadFromJSON() {
        // Try to load from races-data.json
        try {
            const response = await fetch('/races-data.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            console.log(`📄 Loaded races from JSON (v${data.version})`);
            return data;
        } catch (error) {
            console.log('💿 JSON file not found, using local data');
            return null;
        }
    }

    _processRaceData(data) {
        // Clear existing data
        this.races.clear();
        this.abilities.clear();

        // Load abilities
        if (data.abilities) {
            Object.entries(data.abilities).forEach(([id, ability]) => {
                this.abilities.set(id, ability);
            });
        }

        // Load races
        data.races.forEach(raceData => {
            const race = this._createRaceFromData(raceData);
            this.races.set(race.id, race);
        });

        this.isLoaded = true;
        console.log(`🏛️ Processed ${this.races.size} races and ${this.abilities.size} abilities`);
    }

    _createRaceFromData(raceData) {
        const units = raceData.units.map(unitData => 
            new UnitDefinition({
                id: unitData.id,
                name: unitData.name,
                icon: unitData.icon,
                description: unitData.description,
                baseStats: unitData.baseStats,
                movementType: MOVEMENT_TYPES[unitData.movementType] || MOVEMENT_TYPES.ground,
                attackRange: unitData.attackRange,
                cost: unitData.cost,
                upgradeCost: unitData.upgradeCost,
                maxLevel: unitData.maxLevel || 5,
                abilities: unitData.abilities || []
            })
        );

        return new RaceDefinition({
            id: raceData.id,
            name: raceData.name,
            icon: raceData.icon,
            description: raceData.description,
            color: raceData.color,
            specialAbility: raceData.specialAbility,
            units: units,
            startingGold: raceData.startingGold || 100,
            goldMultiplier: raceData.goldMultiplier || 1.0
        });
    }

    _getLocalRaceData() {
        // Fallback hardcoded data
        return {
            version: "1.0.0-local",
            races: [
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
                        {
                            id: "peasant",
                            name: "Bauer",
                            icon: "👨‍🌾",
                            description: "Billige Grundeinheit",
                            baseStats: { hp: 30, attack: 8, defense: 5, movement: 3 },
                            movementType: "ground",
                            attackRange: 1,
                            cost: 15,
                            upgradeCost: 10
                        },
                        {
                            id: "swordsman",
                            name: "Schwertkämpfer",
                            icon: "⚔️",
                            description: "Nahkampf-Spezialist",
                            baseStats: { hp: 50, attack: 15, defense: 12, movement: 3 },
                            movementType: "ground",
                            attackRange: 1,
                            cost: 30,
                            upgradeCost: 20
                        },
                        {
                            id: "archer",
                            name: "Bogenschütze",
                            icon: "🏹",
                            description: "Fernkampf-Einheit",
                            baseStats: { hp: 35, attack: 12, defense: 6, movement: 3 },
                            movementType: "ground",
                            attackRange: 3,
                            cost: 25,
                            upgradeCost: 18
                        }
                        // Weitere Einheiten...
                    ]
                },
                {
                    id: "orcs",
                    name: "Orks",
                    icon: "👹",
                    description: "Brutale Krieger",
                    color: "#e74c3c",
                    specialAbility: "Bonus-Angriff nach einem Sieg",
                    startingGold: 100,
                    goldMultiplier: 1.0,
                    units: [
                        {
                            id: "goblin",
                            name: "Goblin",
                            icon: "👺",
                            description: "Schwache aber billige Einheit",
                            baseStats: { hp: 25, attack: 10, defense: 3, movement: 4 },
                            movementType: "ground",
                            attackRange: 1,
                            cost: 12,
                            upgradeCost: 8
                        }
                        // Weitere Einheiten...
                    ]
                },
                {
                    id: "elves",
                    name: "Elfen",
                    icon: "🧝‍♀️",
                    description: "Geschickte Bogenschützen",
                    color: "#27ae60",
                    specialAbility: "Bewegungsbonus in Wäldern (+1 Bewegung)",
                    startingGold: 110,
                    goldMultiplier: 1.1,
                    units: [
                        {
                            id: "elf_scout",
                            name: "Elf-Späher",
                            icon: "🕵️‍♀️",
                            description: "Schnelle Aufklärer",
                            baseStats: { hp: 30, attack: 10, defense: 8, movement: 4 },
                            movementType: "ground",
                            attackRange: 1,
                            cost: 18,
                            upgradeCost: 12,
                            abilities: ["stealth"]
                        }
                        // Weitere Einheiten...
                    ]
                }
            ],
            abilities: {
                "magic_damage": {
                    "name": "Magischer Schaden",
                    "description": "Ignoriert Rüstung teilweise"
                },
                "heal": {
                    "name": "Heilung",
                    "description": "Kann andere Einheiten heilen"
                },
                "flying": {
                    "name": "Fliegend",
                    "description": "Kann über Hindernisse fliegen"
                },
                "stealth": {
                    "name": "Tarnung",
                    "description": "Schwerer zu entdecken"
                }
            }
        };
    }

    // Public API
    getRace(raceId) {
        if (!this.isLoaded) {
            console.warn('⚠️ Races not loaded yet!');
            return null;
        }
        return this.races.get(raceId);
    }

    getAllRaces() {
        if (!this.isLoaded) {
            console.warn('⚠️ Races not loaded yet!');
            return [];
        }
        return Array.from(this.races.values());
    }

    getAbility(abilityId) {
        return this.abilities.get(abilityId);
    }

    // Database preparation methods
    async saveRaceToDatabase(race) {
        // TODO: Implement database saving
        console.log('💾 Database saving not implemented yet');
        throw new Error('Database functionality not implemented');
    }

    async loadRaceFromDatabase(raceId) {
        // TODO: Implement database loading
        console.log('💾 Database loading not implemented yet');
        throw new Error('Database functionality not implemented');
    }

    // Hot-reload for development
    async reloadRaces() {
        console.log('🔄 Reloading race data...');
        this.isLoaded = false;
        this.loadPromise = null;
        await this.loadRaces();
        
        // Notify listeners about reload
        if (typeof window !== 'undefined' && window.RaceSystem) {
            window.RaceSystem.onRaceDataReloaded?.();
        }
    }

    // Validation
    validateRaceData(raceData) {
        const errors = [];
        
        if (!raceData.id) errors.push('Race ID missing');
        if (!raceData.name) errors.push('Race name missing');
        if (!raceData.units || !Array.isArray(raceData.units)) {
            errors.push('Units array missing or invalid');
        }
        
        if (raceData.units) {
            raceData.units.forEach((unit, index) => {
                if (!unit.id) errors.push(`Unit ${index}: ID missing`);
                if (!unit.baseStats) errors.push(`Unit ${index}: Base stats missing`);
            });
        }
        
        return errors;
    }
}

// ========================================
// EINHEITEN-DEFINITIONEN (unchanged)
// ========================================
class UnitDefinition {
    constructor({
        id,
        name,
        icon,
        description,
        baseStats,
        movementType,
        attackRange,
        cost,
        upgradeCost,
        maxLevel = 5,
        abilities = []
    }) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.description = description;
        this.baseStats = baseStats;
        this.movementType = movementType;
        this.attackRange = attackRange;
        this.cost = cost;
        this.upgradeCost = upgradeCost;
        this.maxLevel = maxLevel;
        this.abilities = abilities;
    }

    getStatsForLevel(level) {
        const multiplier = 1 + ((level - 1) * 0.2);
        return {
            hp: Math.floor(this.baseStats.hp * multiplier),
            attack: Math.floor(this.baseStats.attack * multiplier),
            defense: Math.floor(this.baseStats.defense * multiplier),
            movement: this.baseStats.movement
        };
    }

    getUpgradeCostForLevel(level) {
        if (level >= this.maxLevel) return null;
        return Math.floor(this.upgradeCost * Math.pow(1.5, level - 1));
    }
}

// ========================================
// RASSEN-DEFINITIONEN (unchanged)
// ========================================
class RaceDefinition {
    constructor({
        id,
        name,
        icon,
        description,
        color,
        specialAbility,
        units,
        startingGold = 100,
        goldMultiplier = 1.0
    }) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.description = description;
        this.color = color;
        this.specialAbility = specialAbility;
        this.units = units;
        this.startingGold = startingGold;
        this.goldMultiplier = goldMultiplier;
    }

    getUnit(unitId) {
        return this.units.find(unit => unit.id === unitId);
    }
}

// ========================================
// UNIT INSTANCE CLASS (unchanged)
// ========================================
class Unit {
    constructor(definition, ownerId, x, y, level = 1) {
        this.id = 'unit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.definition = definition;
        this.ownerId = ownerId;
        this.x = x;
        this.y = y;
        this.level = level;
        this.currentStats = definition.getStatsForLevel(level);
        this.currentHp = this.currentStats.hp;
        this.hasMoved = false;
        this.hasActed = false;
        this.statusEffects = [];
    }

    upgrade() {
        if (this.level >= this.definition.maxLevel) return false;
        
        this.level++;
        const oldHpRatio = this.currentHp / this.currentStats.hp;
        this.currentStats = this.definition.getStatsForLevel(this.level);
        this.currentHp = Math.floor(this.currentStats.hp * oldHpRatio);
        
        return true;
    }

    heal(amount) {
        this.currentHp = Math.min(this.currentStats.hp, this.currentHp + amount);
    }

    takeDamage(damage) {
        this.currentHp = Math.max(0, this.currentHp - damage);
        return this.currentHp <= 0;
    }

    isDead() {
        return this.currentHp <= 0;
    }

    getMovementCostForTerrain(terrainType) {
        return getMovementCost(terrainType, this.definition.movementType);
    }

    resetForNewTurn() {
        this.hasMoved = false;
        this.hasActed = false;
        
        this.statusEffects = this.statusEffects.filter(effect => {
            effect.duration--;
            return effect.duration > 0;
        });
    }

    canAttack(targetX, targetY) {
        if (this.hasActed) return false;
        
        const distance = Math.abs(this.x - targetX) + Math.abs(this.y - targetY);
        return distance <= this.definition.attackRange;
    }

    toJSON() {
        return {
            id: this.id,
            definitionId: this.definition.id,
            ownerId: this.ownerId,
            x: this.x,
            y: this.y,
            level: this.level,
            currentStats: this.currentStats,
            currentHp: this.currentHp,
            hasMoved: this.hasMoved,
            hasActed: this.hasActed,
            statusEffects: this.statusEffects
        };
    }
}

// ========================================
// HILFSFUNKTIONEN
// ========================================

function getMovementCost(terrainType, movementType) {
    const costs = TERRAIN_MOVEMENT_COSTS[terrainType];
    if (!costs) return 1;
    
    const cost = costs[movementType];
    return cost === -1 ? null : cost;
}

// ========================================
// RACE SYSTEM SINGLETON
// ========================================
class RaceSystem {
    constructor() {
        this.dataManager = new RaceDataManager();
        this.isInitialized = false;
        this.onRaceDataReloaded = null; // Callback for hot-reload
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🚀 Initializing Race System...');
        await this.dataManager.loadRaces();
        this.isInitialized = true;
        console.log('✅ Race System initialized');
    }

    // Public API
    async getRaceById(raceId) {
        await this.initialize();
        return this.dataManager.getRace(raceId);
    }

    async getAllRaces() {
        await this.initialize();
        return this.dataManager.getAllRaces();
    }

    async getAbility(abilityId) {
        await this.initialize();
        return this.dataManager.getAbility(abilityId);
    }

    // Development helpers
    async reloadData() {
        await this.dataManager.reloadRaces();
    }

    getDataSource() {
        return this.dataManager.dataSource;
    }

    // Legacy sync API for backwards compatibility
    getRaceByIdSync(raceId) {
        if (!this.isInitialized) {
            console.warn('⚠️ Race System not initialized! Call initialize() first.');
            return null;
        }
        return this.dataManager.getRace(raceId);
    }

    getAllRacesSync() {
        if (!this.isInitialized) {
            console.warn('⚠️ Race System not initialized! Call initialize() first.');
            return [];
        }
        return this.dataManager.getAllRaces();
    }
}

// ========================================
// GLOBAL INSTANCE
// ========================================
const raceSystemInstance = new RaceSystem();

// ========================================
// EXPORT FÜR BROWSER/NODE
// ========================================
if (typeof module !== 'undefined' && module.exports) {
    // Node.js Export
    module.exports = {
        MOVEMENT_TYPES,
        TERRAIN_MOVEMENT_COSTS,
        UnitDefinition,
        RaceDefinition,
        Unit,
        RaceSystem,
        RaceDataManager,
        getMovementCost,
        raceSystem: raceSystemInstance
    };
} else {
    // Browser Global - Rückwärtskompatibilität
    window.RaceSystem = {
        MOVEMENT_TYPES,
        TERRAIN_MOVEMENT_COSTS,
        UnitDefinition,
        RaceDefinition,
        Unit,
        getMovementCost,
        
        // Legacy sync methods (deprecated but working)
        getRaceById: (id) => raceSystemInstance.getRaceByIdSync(id),
        getAllRaces: () => raceSystemInstance.getAllRacesSync(),
        
        // New async methods
        initialize: () => raceSystemInstance.initialize(),
        getRaceByIdAsync: (id) => raceSystemInstance.getRaceById(id),
        getAllRacesAsync: () => raceSystemInstance.getAllRaces(),
        reloadData: () => raceSystemInstance.reloadData(),
        getDataSource: () => raceSystemInstance.getDataSource()
    };
    
    // Auto-initialize for convenience
    raceSystemInstance.initialize().then(() => {
        console.log('🎮 Race System ready for game!');
    }).catch(error => {
        console.error('❌ Race System initialization failed:', error);
    });
}

console.log('✅ Race System Module Loaded');