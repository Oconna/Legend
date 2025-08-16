// races.js - Rassen- und Einheitendefinitionen für das Strategiespiel

// ========================================
// BEWEGUNGSTYPEN DEFINITION
// ========================================
const MOVEMENT_TYPES = {
    ground: 'ground',      // Boden-Einheiten
    flying: 'flying',      // Fliegende Einheiten
    amphibious: 'amphibious' // Amphibische Einheiten (Land + Wasser)
};

// ========================================
// TERRAIN BEWEGUNGSKOSTEN
// ========================================
const TERRAIN_MOVEMENT_COSTS = {
    grass: { ground: 1, flying: 1, amphibious: 1 },
    forest: { ground: 2, flying: 1, amphibious: 2 },
    mountain: { ground: 3, flying: 1, amphibious: 4 },
    swamp: { ground: 2, flying: 1, amphibious: 1 },
    water: { ground: -1, flying: 1, amphibious: 1 }, // -1 = nicht passierbar
    city: { ground: 1, flying: 1, amphibious: 1 },
    castle: { ground: 1, flying: 1, amphibious: 1 }
};

// ========================================
// EINHEITEN-DEFINITIONEN
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
        this.baseStats = baseStats; // { hp, attack, defense, movement }
        this.movementType = movementType;
        this.attackRange = attackRange;
        this.cost = cost;
        this.upgradeCost = upgradeCost;
        this.maxLevel = maxLevel;
        this.abilities = abilities;
    }

    // Berechne Stats für ein bestimmtes Level
    getStatsForLevel(level) {
        const multiplier = 1 + ((level - 1) * 0.2); // 20% Steigerung pro Level
        return {
            hp: Math.floor(this.baseStats.hp * multiplier),
            attack: Math.floor(this.baseStats.attack * multiplier),
            defense: Math.floor(this.baseStats.defense * multiplier),
            movement: this.baseStats.movement // Bewegung bleibt gleich
        };
    }

    // Berechne Upgrade-Kosten für ein Level
    getUpgradeCostForLevel(level) {
        if (level >= this.maxLevel) return null;
        return Math.floor(this.upgradeCost * Math.pow(1.5, level - 1));
    }
}

// ========================================
// RASSEN-DEFINITIONEN
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
        this.units = units; // Array von UnitDefinition
        this.startingGold = startingGold;
        this.goldMultiplier = goldMultiplier;
    }

    getUnit(unitId) {
        return this.units.find(unit => unit.id === unitId);
    }
}

// ========================================
// KONKRETE RASSEN-IMPLEMENTIERUNGEN
// ========================================

// MENSCHEN - Ausgewogene Rasse
const HUMANS = new RaceDefinition({
    id: 'humans',
    name: 'Menschen',
    icon: '👑',
    description: 'Vielseitige und anpassungsfähige Rasse mit ausgewogenen Einheiten',
    color: '#3498db',
    specialAbility: 'Zusätzliches Gold aus Städten (+1 Gold pro Stadt)',
    goldMultiplier: 1.2,
    units: [
        new UnitDefinition({
            id: 'peasant',
            name: 'Bauer',
            icon: '👨‍🌾',
            description: 'Billige Grundeinheit',
            baseStats: { hp: 30, attack: 8, defense: 5, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 15,
            upgradeCost: 10
        }),
        new UnitDefinition({
            id: 'swordsman',
            name: 'Schwertkämpfer',
            icon: '⚔️',
            description: 'Nahkampf-Spezialist',
            baseStats: { hp: 50, attack: 15, defense: 12, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 30,
            upgradeCost: 20
        }),
        new UnitDefinition({
            id: 'archer',
            name: 'Bogenschütze',
            icon: '🏹',
            description: 'Fernkampf-Einheit',
            baseStats: { hp: 35, attack: 12, defense: 6, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 3,
            cost: 25,
            upgradeCost: 18
        }),
        new UnitDefinition({
            id: 'knight',
            name: 'Ritter',
            icon: '🐎',
            description: 'Schwere Kavallerie',
            baseStats: { hp: 70, attack: 20, defense: 18, movement: 4 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 50,
            upgradeCost: 35
        }),
        new UnitDefinition({
            id: 'mage',
            name: 'Magier',
            icon: '🧙‍♂️',
            description: 'Magische Fernkampf-Einheit',
            baseStats: { hp: 30, attack: 18, defense: 4, movement: 2 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 2,
            cost: 40,
            upgradeCost: 30,
            abilities: ['magic_damage']
        }),
        new UnitDefinition({
            id: 'paladin',
            name: 'Paladin',
            icon: '⚡',
            description: 'Elite-Krieger mit Heilfähigkeiten',
            baseStats: { hp: 80, attack: 22, defense: 20, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 70,
            upgradeCost: 50,
            abilities: ['heal']
        }),
        new UnitDefinition({
            id: 'crossbowman',
            name: 'Armbrustschütze',
            icon: '🎯',
            description: 'Verbesserte Fernkampf-Einheit',
            baseStats: { hp: 45, attack: 16, defense: 8, movement: 2 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 4,
            cost: 35,
            upgradeCost: 25
        }),
        new UnitDefinition({
            id: 'catapult',
            name: 'Katapult',
            icon: '🏗️',
            description: 'Belagerungswaffe',
            baseStats: { hp: 40, attack: 30, defense: 10, movement: 1 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 5,
            cost: 60,
            upgradeCost: 40,
            abilities: ['siege']
        }),
        new UnitDefinition({
            id: 'priest',
            name: 'Priester',
            icon: '⛪',
            description: 'Unterstützungseinheit',
            baseStats: { hp: 40, attack: 8, defense: 12, movement: 2 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 45,
            upgradeCost: 30,
            abilities: ['heal', 'buff']
        }),
        new UnitDefinition({
            id: 'angel',
            name: 'Engel',
            icon: '👼',
            description: 'Fliegende Elite-Einheit',
            baseStats: { hp: 60, attack: 25, defense: 15, movement: 5 },
            movementType: MOVEMENT_TYPES.flying,
            attackRange: 1,
            cost: 100,
            upgradeCost: 70,
            abilities: ['flying', 'divine']
        })
    ]
});

// ORKS - Aggressive Kämpfer
const ORCS = new RaceDefinition({
    id: 'orcs',
    name: 'Orks',
    icon: '👹',
    description: 'Brutale Krieger mit starken Nahkampf-Einheiten',
    color: '#e74c3c',
    specialAbility: 'Bonus-Angriff nach einem Sieg (+2 Angriff für 1 Runde)',
    units: [
        new UnitDefinition({
            id: 'goblin',
            name: 'Goblin',
            icon: '👺',
            description: 'Schwache aber billige Einheit',
            baseStats: { hp: 25, attack: 10, defense: 3, movement: 4 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 12,
            upgradeCost: 8
        }),
        new UnitDefinition({
            id: 'orc_warrior',
            name: 'Ork-Krieger',
            icon: '⚔️',
            description: 'Starker Nahkämpfer',
            baseStats: { hp: 60, attack: 18, defense: 10, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 28,
            upgradeCost: 20
        }),
        new UnitDefinition({
            id: 'orc_berserker',
            name: 'Berserker',
            icon: '🪓',
            description: 'Rasender Kämpfer',
            baseStats: { hp: 55, attack: 22, defense: 6, movement: 4 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 35,
            upgradeCost: 25,
            abilities: ['berserker_rage']
        }),
        new UnitDefinition({
            id: 'orc_shaman',
            name: 'Schamane',
            icon: '🔮',
            description: 'Orkischer Magier',
            baseStats: { hp: 35, attack: 16, defense: 5, movement: 2 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 2,
            cost: 38,
            upgradeCost: 28,
            abilities: ['dark_magic']
        }),
        new UnitDefinition({
            id: 'troll',
            name: 'Troll',
            icon: '🧌',
            description: 'Riesige Kreatur mit Regeneration',
            baseStats: { hp: 100, attack: 25, defense: 15, movement: 2 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 65,
            upgradeCost: 45,
            abilities: ['regeneration']
        }),
        new UnitDefinition({
            id: 'wolf_rider',
            name: 'Wolfsreiter',
            icon: '🐺',
            description: 'Schnelle Kavallerie',
            baseStats: { hp: 45, attack: 16, defense: 8, movement: 5 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 42,
            upgradeCost: 30
        }),
        new UnitDefinition({
            id: 'orc_archer',
            name: 'Ork-Bogenschütze',
            icon: '🏹',
            description: 'Grober Fernkämpfer',
            baseStats: { hp: 40, attack: 14, defense: 6, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 3,
            cost: 26,
            upgradeCost: 18
        }),
        new UnitDefinition({
            id: 'war_chief',
            name: 'Kriegshäuptling',
            icon: '👑',
            description: 'Anführer der Ork-Horde',
            baseStats: { hp: 90, attack: 28, defense: 20, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 80,
            upgradeCost: 55,
            abilities: ['leadership', 'intimidate']
        }),
        new UnitDefinition({
            id: 'catapult_orc',
            name: 'Ork-Katapult',
            icon: '💥',
            description: 'Zerstörerische Belagerungswaffe',
            baseStats: { hp: 35, attack: 35, defense: 8, movement: 1 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 4,
            cost: 55,
            upgradeCost: 38,
            abilities: ['siege', 'splash_damage']
        }),
        new UnitDefinition({
            id: 'wyvern',
            name: 'Wyvern',
            icon: '🐉',
            description: 'Fliegender Drache',
            baseStats: { hp: 75, attack: 30, defense: 12, movement: 6 },
            movementType: MOVEMENT_TYPES.flying,
            attackRange: 1,
            cost: 120,
            upgradeCost: 80,
            abilities: ['flying', 'fire_breath']
        })
    ]
});

// ELFEN - Geschickte Fernkämpfer
const ELVES = new RaceDefinition({
    id: 'elves',
    name: 'Elfen',
    icon: '🧝‍♀️',
    description: 'Geschickte Bogenschützen und Naturmagier',
    color: '#27ae60',
    specialAbility: 'Bewegungsbonus in Wäldern (+1 Bewegung)',
    units: [
        new UnitDefinition({
            id: 'elf_scout',
            name: 'Elf-Späher',
            icon: '🕵️‍♀️',
            description: 'Schnelle Aufklärer',
            baseStats: { hp: 30, attack: 10, defense: 8, movement: 4 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 18,
            upgradeCost: 12,
            abilities: ['stealth']
        }),
        new UnitDefinition({
            id: 'elf_archer',
            name: 'Elf-Bogenschütze',
            icon: '🏹',
            description: 'Präzise Fernkämpfer',
            baseStats: { hp: 35, attack: 16, defense: 6, movement: 3 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 4,
            cost: 28,
            upgradeCost: 20,
            abilities: ['precision']
        }),
        new UnitDefinition({
            id: 'druid',
            name: 'Druide',
            icon: '🌿',
            description: 'Naturmagier',
            baseStats: { hp: 40, attack: 14, defense: 8, movement: 2 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 2,
            cost: 35,
            upgradeCost: 25,
            abilities: ['nature_magic', 'heal']
        }),
        new UnitDefinition({
            id: 'tree_ent',
            name: 'Baumhirte',
            icon: '🌳',
            description: 'Lebender Baum',
            baseStats: { hp: 120, attack: 20, defense: 25, movement: 1 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 70,
            upgradeCost: 50,
            abilities: ['rooted', 'nature_resistance']
        }),
        new UnitDefinition({
            id: 'unicorn',
            name: 'Einhorn',
            icon: '🦄',
            description: 'Magisches Reittier',
            baseStats: { hp: 50, attack: 18, defense: 12, movement: 5 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 55,
            upgradeCost: 40,
            abilities: ['magic_immunity', 'heal']
        }),
        new UnitDefinition({
            id: 'eagle_rider',
            name: 'Adlerreiter',
            icon: '🦅',
            description: 'Fliegende Späher',
            baseStats: { hp: 40, attack: 14, defense: 8, movement: 6 },
            movementType: MOVEMENT_TYPES.flying,
            attackRange: 1,
            cost: 45,
            upgradeCost: 32,
            abilities: ['flying', 'reconnaissance']
        }),
        new UnitDefinition({
            id: 'elf_mage',
            name: 'Elf-Magier',
            icon: '🧙‍♀️',
            description: 'Mächtiger Zauberer',
            baseStats: { hp: 35, attack: 20, defense: 6, movement: 2 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 3,
            cost: 48,
            upgradeCost: 35,
            abilities: ['elemental_magic']
        }),
        new UnitDefinition({
            id: 'ranger',
            name: 'Waldläufer',
            icon: '🏹',
            description: 'Elite-Bogenschütze',
            baseStats: { hp: 45, attack: 22, defense: 10, movement: 4 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 5,
            cost: 50,
            upgradeCost: 38,
            abilities: ['multishot', 'forest_mastery']
        }),
        new UnitDefinition({
            id: 'phoenix',
            name: 'Phönix',
            icon: '🔥',
            description: 'Wiedergeborener Feuervogel',
            baseStats: { hp: 60, attack: 28, defense: 10, movement: 7 },
            movementType: MOVEMENT_TYPES.flying,
            attackRange: 2,
            cost: 90,
            upgradeCost: 65,
            abilities: ['flying', 'rebirth', 'fire_damage']
        }),
        new UnitDefinition({
            id: 'ancient_guardian',
            name: 'Uralter Wächter',
            icon: '🗿',
            description: 'Steinerner Beschützer',
            baseStats: { hp: 150, attack: 25, defense: 30, movement: 1 },
            movementType: MOVEMENT_TYPES.ground,
            attackRange: 1,
            cost: 100,
            upgradeCost: 70,
            abilities: ['ancient_power', 'stone_skin']
        })
    ]
});

// ========================================
// RASSEN-REGISTRY
// ========================================
const ALL_RACES = [
    HUMANS,
    ORCS,
    ELVES
    // Hier können weitere 12 Rassen hinzugefügt werden
];

// ========================================
// HILFSFUNKTIONEN
// ========================================

function getRaceById(raceId) {
    return ALL_RACES.find(race => race.id === raceId);
}

function getAllRaces() {
    return ALL_RACES;
}

function getMovementCost(terrainType, movementType) {
    const costs = TERRAIN_MOVEMENT_COSTS[terrainType];
    if (!costs) return 1;
    
    const cost = costs[movementType];
    return cost === -1 ? null : cost; // null = nicht passierbar
}

// ========================================
// UNIT INSTANCE CLASS
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

    // Upgrade die Einheit
    upgrade() {
        if (this.level >= this.definition.maxLevel) return false;
        
        this.level++;
        const oldHpRatio = this.currentHp / this.currentStats.hp;
        this.currentStats = this.definition.getStatsForLevel(this.level);
        this.currentHp = Math.floor(this.currentStats.hp * oldHpRatio);
        
        return true;
    }

    // Heile die Einheit
    heal(amount) {
        this.currentHp = Math.min(this.currentStats.hp, this.currentHp + amount);
    }

    // Verletze die Einheit
    takeDamage(damage) {
        this.currentHp = Math.max(0, this.currentHp - damage);
        return this.currentHp <= 0; // true wenn tot
    }

    // Ist die Einheit tot?
    isDead() {
        return this.currentHp <= 0;
    }

    // Bewegungskosten für ein Terrain berechnen
    getMovementCostForTerrain(terrainType) {
        return getMovementCost(terrainType, this.definition.movementType);
    }

    // Reset für neue Runde
    resetForNewTurn() {
        this.hasMoved = false;
        this.hasActed = false;
        
        // Status-Effekte verarbeiten
        this.statusEffects = this.statusEffects.filter(effect => {
            effect.duration--;
            return effect.duration > 0;
        });
    }

    // Kann die Einheit ein Ziel angreifen?
    canAttack(targetX, targetY) {
        if (this.hasActed) return false;
        
        const distance = Math.abs(this.x - targetX) + Math.abs(this.y - targetY);
        return distance <= this.definition.attackRange;
    }

    // Serialisierung für Netzwerk
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
// FALLBACK RACES (für den Fall, dass races-data.json nicht geladen werden kann)
// ========================================

const FALLBACK_RACES = [
    {
        id: "humans",
        name: "Menschen",
        icon: "👑",
        description: "Vielseitige und anpassungsfähige Rasse mit ausgewogenen Einheiten",
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
                upgradeCost: 10,
                maxLevel: 5,
                abilities: []
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
                upgradeCost: 20,
                maxLevel: 5,
                abilities: []
            }
        ]
    },
    {
        id: "elves",
        name: "Elfen",
        icon: "🧝‍♀️",
        description: "Magische Rasse mit hoher Intelligenz und Fernkampf-Fähigkeiten",
        color: "#27ae60",
        specialAbility: "Einheiten regenerieren HP außerhalb des Kampfes",
        startingGold: 100,
        goldMultiplier: 1.0,
        units: [
            {
                id: "archer",
                name: "Bogenschütze",
                icon: "🏹",
                description: "Fernkampf-Einheit",
                baseStats: { hp: 35, attack: 12, defense: 6, movement: 3 },
                movementType: "ground",
                attackRange: 3,
                cost: 25,
                upgradeCost: 18,
                maxLevel: 5,
                abilities: []
            },
            {
                id: "mage",
                name: "Magier",
                icon: "🧙‍♂️",
                description: "Magische Fernkampf-Einheit",
                baseStats: { hp: 30, attack: 18, defense: 4, movement: 2 },
                movementType: "ground",
                attackRange: 2,
                cost: 40,
                upgradeCost: 30,
                maxLevel: 5,
                abilities: []
            }
        ]
    },
    {
        id: "orcs",
        name: "Orks",
        icon: "👹",
        description: "Kriegerische Rasse mit starken Nahkampf-Einheiten",
        color: "#e74c3c",
        specialAbility: "Einheiten erhalten +2 Attack beim ersten Angriff",
        startingGold: 80,
        goldMultiplier: 0.8,
        units: [
            {
                id: "warrior",
                name: "Krieger",
                icon: "⚔️",
                description: "Starke Nahkampf-Einheit",
                baseStats: { hp: 60, attack: 18, defense: 10, movement: 3 },
                movementType: "ground",
                attackRange: 1,
                cost: 35,
                upgradeCost: 25,
                maxLevel: 5,
                abilities: []
            },
            {
                id: "berserker",
                name: "Berserker",
                icon: "😤",
                description: "Wilde Kampfmaschine",
                baseStats: { hp: 45, attack: 25, defense: 8, movement: 4 },
                movementType: "ground",
                attackRange: 1,
                cost: 45,
                upgradeCost: 35,
                maxLevel: 5,
                abilities: []
            }
        ]
    }
];

// ========================================
// GLOBAL EXPORTS
// ========================================

if (typeof window !== 'undefined') {
    window.FALLBACK_RACES = FALLBACK_RACES;
    window.MOVEMENT_TYPES = MOVEMENT_TYPES;
    window.TERRAIN_MOVEMENT_COSTS = TERRAIN_MOVEMENT_COSTS;
    window.UnitDefinition = UnitDefinition;
    window.RaceDefinition = RaceDefinition;
}

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FALLBACK_RACES,
        MOVEMENT_TYPES,
        TERRAIN_MOVEMENT_COSTS,
        UnitDefinition,
        RaceDefinition
    };
}

console.log('🏛️ Rassen-System geladen:', FALLBACK_RACES.length, 'Fallback-Rassen verfügbar');