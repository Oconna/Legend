// public/js/races-complete.js - Vollständiges Rassen & Einheiten System

// ========================================
// TERRAIN DEFINITIONS
// ========================================

window.TERRAIN_DEFINITIONS = {
    grass: {
        name: 'Grasland',
        symbol: '🌿',
        color: '#4CAF50',
        movementCost: 1,
        defenseBonus: 0,
        goldMultiplier: 1.0,
        buildable: true
    },
    forest: {
        name: 'Wald',
        symbol: '🌲',
        color: '#2E7D32',
        movementCost: 2,
        defenseBonus: 1,
        goldMultiplier: 0.8,
        buildable: false
    },
    mountain: {
        name: 'Gebirge',
        symbol: '⛰️',
        color: '#795548',
        movementCost: 3,
        defenseBonus: 2,
        goldMultiplier: 1.5,
        buildable: false
    },
    water: {
        name: 'Wasser',
        symbol: '🌊',
        color: '#2196F3',
        movementCost: 999, // Nicht passierbar für normale Einheiten
        defenseBonus: 0,
        goldMultiplier: 0,
        buildable: false
    },
    desert: {
        name: 'Wüste',
        symbol: '🏜️',
        color: '#FF9800',
        movementCost: 2,
        defenseBonus: 0,
        goldMultiplier: 0.5,
        buildable: true
    },
    swamp: {
        name: 'Sumpf',
        symbol: '🌾',
        color: '#388E3C',
        movementCost: 3,
        defenseBonus: 1,
        goldMultiplier: 0.7,
        buildable: false
    },
    snow: {
        name: 'Schnee',
        symbol: '❄️',
        color: '#E3F2FD',
        movementCost: 2,
        defenseBonus: 0,
        goldMultiplier: 0.8,
        buildable: true
    },
    city: {
        name: 'Stadt',
        symbol: '🏰',
        color: '#9C27B0',
        movementCost: 1,
        defenseBonus: 2,
        goldMultiplier: 2.0,
        buildable: true,
        isBuilding: true,
        goldIncome: 50
    }
};

// ========================================
// UNIT TYPES & STATS
// ========================================

const UNIT_TYPES = {
    // Melee Units
    WARRIOR: {
        id: 'warrior',
        name: 'Krieger',
        icon: '⚔️',
        cost: 50,
        attack: 12,
        defense: 8,
        health: 100,
        movement: 3,
        attackRange: 1,
        unitType: 'melee',
        canCapture: true,
        upgradeCost: 75
    },
    KNIGHT: {
        id: 'knight',
        name: 'Ritter',
        icon: '🛡️',
        cost: 120,
        attack: 18,
        defense: 15,
        health: 150,
        movement: 4,
        attackRange: 1,
        unitType: 'cavalry',
        canCapture: true,
        upgradeCost: 180
    },
    BERSERKER: {
        id: 'berserker',
        name: 'Berserker',
        icon: '🪓',
        cost: 80,
        attack: 20,
        defense: 5,
        health: 120,
        movement: 3,
        attackRange: 1,
        unitType: 'melee',
        specialAbility: 'fury',
        upgradeCost: 120
    },

    // Ranged Units
    ARCHER: {
        id: 'archer',
        name: 'Bogenschütze',
        icon: '🏹',
        cost: 60,
        attack: 10,
        defense: 5,
        health: 80,
        movement: 2,
        attackRange: 3,
        unitType: 'ranged',
        upgradeCost: 90
    },
    CROSSBOW: {
        id: 'crossbow',
        name: 'Armbrustschütze',
        icon: '🎯',
        cost: 90,
        attack: 15,
        defense: 7,
        health: 90,
        movement: 2,
        attackRange: 4,
        unitType: 'ranged',
        upgradeCost: 135
    },
    MAGE: {
        id: 'mage',
        name: 'Magier',
        icon: '🔮',
        cost: 150,
        attack: 25,
        defense: 3,
        health: 70,
        movement: 2,
        attackRange: 5,
        unitType: 'magic',
        specialAbility: 'magic_damage',
        upgradeCost: 225
    },

    // Cavalry Units
    SCOUT: {
        id: 'scout',
        name: 'Späher',
        icon: '🐎',
        cost: 40,
        attack: 8,
        defense: 6,
        health: 70,
        movement: 5,
        attackRange: 1,
        unitType: 'cavalry',
        specialAbility: 'stealth',
        upgradeCost: 60
    },
    CAVALRY: {
        id: 'cavalry',
        name: 'Kavallerie',
        icon: '🏇',
        cost: 100,
        attack: 16,
        defense: 10,
        health: 120,
        movement: 5,
        attackRange: 1,
        unitType: 'cavalry',
        specialAbility: 'charge',
        upgradeCost: 150
    },

    // Flying Units
    GRIFFIN: {
        id: 'griffin',
        name: 'Greif',
        icon: '🦅',
        cost: 200,
        attack: 20,
        defense: 12,
        health: 140,
        movement: 6,
        attackRange: 1,
        unitType: 'flying',
        specialAbility: 'flying',
        upgradeCost: 300
    },
    DRAGON: {
        id: 'dragon',
        name: 'Drache',
        icon: '🐉',
        cost: 500,
        attack: 35,
        defense: 25,
        health: 300,
        movement: 4,
        attackRange: 2,
        unitType: 'flying',
        specialAbility: 'fire_breath',
        upgradeCost: 750
    }
};

// ========================================
// COMPLETE RACE DEFINITIONS
// ========================================

window.COMPLETE_RACES = [
    {
        id: 'humans',
        name: 'Menschen',
        icon: '👑',
        color: '#3F51B5',
        description: 'Vielseitige und anpassungsfähige Rasse mit ausgewogenen Fähigkeiten.',
        startingGold: 100,
        goldMultiplier: 1.0,
        specialAbility: 'Diplomatie',
        units: [
            { ...UNIT_TYPES.WARRIOR, raceBonus: { cost: -5 } },
            { ...UNIT_TYPES.ARCHER, raceBonus: { attackRange: +1 } },
            { ...UNIT_TYPES.KNIGHT, raceBonus: { defense: +2 } },
            { ...UNIT_TYPES.SCOUT, raceBonus: { movement: +1 } },
            { ...UNIT_TYPES.CROSSBOW, raceBonus: { attack: +2 } },
            { ...UNIT_TYPES.CAVALRY, raceBonus: { health: +20 } },
            { ...UNIT_TYPES.MAGE, raceBonus: { cost: -20 } },
            { ...UNIT_TYPES.BERSERKER, raceBonus: { attack: +3, defense: -2 } },
            { ...UNIT_TYPES.GRIFFIN, raceBonus: { movement: +1 } },
            { ...UNIT_TYPES.DRAGON, raceBonus: { cost: -50 } }
        ],
        startingUnits: [
            { unitType: 'warrior', count: 2 },
            { unitType: 'archer', count: 1 }
        ]
    },

    {
        id: 'elves',
        name: 'Elfen',
        icon: '🧝',
        color: '#4CAF50',
        description: 'Waldbewohner mit überlegenen Fernkampf- und Magiefähigkeiten.',
        startingGold: 80,
        goldMultiplier: 0.9,
        specialAbility: 'Waldläufer',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Elfenkrieger', raceBonus: { movement: +1 } },
            { ...UNIT_TYPES.ARCHER, name: 'Elfenbogen', raceBonus: { attack: +3, attackRange: +1 } },
            { ...UNIT_TYPES.SCOUT, name: 'Waldläufer', raceBonus: { movement: +2, stealth: true } },
            { ...UNIT_TYPES.MAGE, name: 'Naturmagier', raceBonus: { attack: +5, health: +10 } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Präzisionsschütze', raceBonus: { attack: +4 } },
            { ...UNIT_TYPES.CAVALRY, name: 'Hirschreiter', icon: '🦌', raceBonus: { movement: +1 } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Riesenadler', raceBonus: { attack: +3 } },
            { ...UNIT_TYPES.BERSERKER, name: 'Wildkämpfer', raceBonus: { movement: +2 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Elfenritter', raceBonus: { health: +30 } },
            { ...UNIT_TYPES.DRAGON, name: 'Walddrache', icon: '🌿🐉', raceBonus: { defense: +5 } }
        ],
        terrainBonus: { forest: { movement: -1, defense: +2 } },
        startingUnits: [
            { unitType: 'archer', count: 2 },
            { unitType: 'scout', count: 1 }
        ]
    },

    {
        id: 'dwarves',
        name: 'Zwerge',
        icon: '⛏️',
        color: '#795548',
        description: 'Bergbewohner mit starken Verteidigungsfähigkeiten und Metallverarbeitung.',
        startingGold: 120,
        goldMultiplier: 1.2,
        specialAbility: 'Bergbau',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Zwergenkämpfer', raceBonus: { defense: +4, health: +20 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Eisenritter', raceBonus: { defense: +8, attack: +3 } },
            { ...UNIT_TYPES.BERSERKER, name: 'Axtkämpfer', raceBonus: { attack: +5 } },
            { ...UNIT_TYPES.ARCHER, name: 'Zwergenarmbruster', raceBonus: { defense: +3 } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Belagerungsarmbrust', raceBonus: { attack: +6, attackRange: +1 } },
            { ...UNIT_TYPES.SCOUT, name: 'Tunnelgräber', raceBonus: { specialAbility: 'tunnel' } },
            { ...UNIT_TYPES.MAGE, name: 'Runenmeister', raceBonus: { defense: +5 } },
            { ...UNIT_TYPES.CAVALRY, name: 'Ziegenreiter', icon: '🐐', raceBonus: { mountainMovement: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Steinadler', raceBonus: { defense: +5 } },
            { ...UNIT_TYPES.DRAGON, name: 'Erddrache', icon: '⛰️🐉', raceBonus: { health: +100 } }
        ],
        terrainBonus: { mountain: { movement: -1, defense: +3, goldMultiplier: +0.5 } },
        startingUnits: [
            { unitType: 'warrior', count: 2 },
            { unitType: 'berserker', count: 1 }
        ]
    },

    {
        id: 'orcs',
        name: 'Orks',
        icon: '🗡️',
        color: '#E91E63',
        description: 'Aggressive Kriegerrasse mit starken Angriffsfähigkeiten.',
        startingGold: 90,
        goldMultiplier: 1.1,
        specialAbility: 'Blutdurst',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Ork-Krieger', raceBonus: { attack: +4, cost: -10 } },
            { ...UNIT_TYPES.BERSERKER, name: 'Ork-Berserker', raceBonus: { attack: +8, health: +30 } },
            { ...UNIT_TYPES.SCOUT, name: 'Wolfsjäger', icon: '🐺', raceBonus: { attack: +3 } },
            { ...UNIT_TYPES.ARCHER, name: 'Speerschleuderer', raceBonus: { attack: +2, cost: -15 } },
            { ...UNIT_TYPES.CAVALRY, name: 'Wargfahrer', icon: '🐺', raceBonus: { attack: +5 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Ork-Warlord', raceBonus: { attack: +6, health: +40 } },
            { ...UNIT_TYPES.MAGE, name: 'Schamane', raceBonus: { specialAbility: 'poison' } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Ork-Armbruster', raceBonus: { attack: +3 } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Riesenbat', icon: '🦇', raceBonus: { attack: +4 } },
            { ...UNIT_TYPES.DRAGON, name: 'Schwarzdrache', raceBonus: { attack: +10, cost: +100 } }
        ],
        startingUnits: [
            { unitType: 'warrior', count: 3 },
            { unitType: 'berserker', count: 1 }
        ]
    },

    {
        id: 'undead',
        name: 'Untote',
        icon: '💀',
        color: '#424242',
        description: 'Unheimliche Wesen mit Regeneration und Totenbeschwörung.',
        startingGold: 70,
        goldMultiplier: 0.8,
        specialAbility: 'Nekromantie',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Skelettkrieger', icon: '💀', raceBonus: { cost: -20, regeneration: 5 } },
            { ...UNIT_TYPES.ARCHER, name: 'Skelettbogen', raceBonus: { cost: -15 } },
            { ...UNIT_TYPES.MAGE, name: 'Nekromant', raceBonus: { specialAbility: 'summon_skeleton' } },
            { ...UNIT_TYPES.KNIGHT, name: 'Todesritter', icon: '☠️', raceBonus: { attack: +8, undead: true } },
            { ...UNIT_TYPES.SCOUT, name: 'Schatten', raceBonus: { stealth: true, movement: +2 } },
            { ...UNIT_TYPES.BERSERKER, name: 'Zombie', icon: '🧟', raceBonus: { health: +50, movement: -1 } },
            { ...UNIT_TYPES.CAVALRY, name: 'Skelettreiter', raceBonus: { cost: -30 } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Gruftschütze', raceBonus: { attack: +1 } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Knochendrache', icon: '💀🐉', raceBonus: { undead: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Lich-Drache', raceBonus: { attack: +15, specialAbility: 'death_aura' } }
        ],
        specialMechanics: {
            resurrection: true,
            immuneToPoison: true,
            fearAura: true
        },
        startingUnits: [
            { unitType: 'warrior', count: 3 },
            { unitType: 'mage', count: 1 }
        ]
    },

    {
        id: 'demons',
        name: 'Dämonen',
        icon: '👹',
        color: '#D32F2F',
        description: 'Feurige Kreaturen mit mächtigen magischen Fähigkeiten.',
        startingGold: 60,
        goldMultiplier: 0.7,
        specialAbility: 'Höllenflammen',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Dämonenwächter', raceBonus: { attack: +6, fireResistance: true } },
            { ...UNIT_TYPES.MAGE, name: 'Feuerdämon', raceBonus: { attack: +10, specialAbility: 'fire_blast' } },
            { ...UNIT_TYPES.BERSERKER, name: 'Höllenhund', icon: '🔥🐕', raceBonus: { movement: +3, attack: +7 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Dämonenlord', raceBonus: { attack: +10, intimidation: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Flammenwerfer', raceBonus: { specialAbility: 'burn_damage' } },
            { ...UNIT_TYPES.SCOUT, name: 'Imp', icon: '👺', raceBonus: { flying: true, cost: -20 } },
            { ...UNIT_TYPES.CAVALRY, name: 'Höllenpferdreiter', raceBonus: { fireTrail: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Seelensammler', raceBonus: { soulSteal: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Balrog', icon: '🔥👹', raceBonus: { attack: +8, fireAura: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Höllenfürst', raceBonus: { attack: +20, cost: +200, demonLord: true } }
        ],
        terrainBonus: { desert: { movement: -1, attack: +2 } },
        startingUnits: [
            { unitType: 'warrior', count: 2 },
            { unitType: 'mage', count: 1 },
            { unitType: 'berserker', count: 1 }
        ]
    },

    {
        id: 'angels',
        name: 'Engel',
        icon: '😇',
        color: '#FFD700',
        description: 'Himmlische Wesen mit Heilung und göttlichen Kräften.',
        startingGold: 110,
        goldMultiplier: 0.9,
        specialAbility: 'Göttlicher Schutz',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Himmelskrieger', raceBonus: { defense: +5, healing: 10 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Paladin', raceBonus: { attack: +4, defense: +6, holyDamage: true } },
            { ...UNIT_TYPES.MAGE, name: 'Erzengel', icon: '👼', raceBonus: { healing: 25, flight: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Seraphin', raceBonus: { holyArrows: true, flying: true } },
            { ...UNIT_TYPES.SCOUT, name: 'Cherub', raceBonus: { flying: true, blessing: true } },
            { ...UNIT_TYPES.CAVALRY, name: 'Einhorn-Reiter', icon: '🦄', raceBonus: { purification: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Rächender Engel', raceBonus: { holyFury: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Lichtbringer', raceBonus: { lightBeam: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Phoenix', icon: '🔥🦅', raceBonus: { resurrection: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Himmelswächter', raceBonus: { divineShield: true, massHealing: true } }
        ],
        specialMechanics: {
            healing: true,
            immuneToFear: true,
            blessedGround: true
        },
        startingUnits: [
            { unitType: 'warrior', count: 2 },
            { unitType: 'knight', count: 1 }
        ]
    },

    {
        id: 'dragons',
        name: 'Drachen',
        icon: '🐲',
        color: '#FF5722',
        description: 'Uralte Drachenrasse mit verheerenden Fähigkeiten.',
        startingGold: 200,
        goldMultiplier: 1.5,
        specialAbility: 'Drachenherrschaft',
        units: [
            { ...UNIT_TYPES.SCOUT, name: 'Jungdrache', icon: '🐉', raceBonus: { flying: true, fireBreath: true } },
            { ...UNIT_TYPES.WARRIOR, name: 'Drachenritter', raceBonus: { dragonScale: true, fireResistance: true } },
            { ...UNIT_TYPES.MAGE, name: 'Ältester Drache', raceBonus: { ancientMagic: true, wisdom: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Drachenodem', raceBonus: { fireBreath: true, area_damage: true } },
            { ...UNIT_TYPES.KNIGHT, name: 'Drachenlord', raceBonus: { dragonMount: true, intimidation: +5 } },
            { ...UNIT_TYPES.CAVALRY, name: 'Salamander-Reiter', icon: '🦎', raceBonus: { fireTrail: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Feuerwyrm', raceBonus: { meltingAttack: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Feuerspucker', raceBonus: { burnDamage: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Wyvern', raceBonus: { poisonStinger: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Uralter Drache', raceBonus: { massDestruction: true, goldHoard: +100 } }
        ],
        specialMechanics: {
            fireImmunity: true,
            goldBonus: 2.0,
            dragonFear: true
        },
        startingUnits: [
            { unitType: 'scout', count: 1 },
            { unitType: 'warrior', count: 1 },
            { unitType: 'mage', count: 1 }
        ]
    },

    {
        id: 'beasts',
        name: 'Bestien',
        icon: '🦁',
        color: '#8BC34A',
        description: 'Wilde Tierrasse mit Pack-Taktiken und natürlichen Fähigkeiten.',
        startingGold: 75,
        goldMultiplier: 0.8,
        specialAbility: 'Rudeljagd',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Alpha-Wolf', icon: '🐺', raceBonus: { packLeader: true, howl: true } },
            { ...UNIT_TYPES.SCOUT, name: 'Schakal', icon: '🦊', raceBonus: { movement: +2, scavenger: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Bär', icon: '🐻', raceBonus: { health: +80, claws: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Adler', icon: '🦅', raceBonus: { flying: true, keenSight: true } },
            { ...UNIT_TYPES.CAVALRY, name: 'Leopard', icon: '🐆', raceBonus: { stealth: true, pounce: true } },
            { ...UNIT_TYPES.KNIGHT, name: 'Rhinozeros', icon: '🦏', raceBonus: { charge: +10, armor: +5 } },
            { ...UNIT_TYPES.MAGE, name: 'Eulen-Schamane', icon: '🦉', raceBonus: { nightVision: true, wisdom: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Stachelschwein', icon: '🦔', raceBonus: { spikeShot: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Roc', icon: '🦅', raceBonus: { giantSize: true, windControl: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Hydra', icon: '🐉', raceBonus: { multipleHeads: 3, regeneration: 15 } }
        ],
        specialMechanics: {
            packBonus: true,
            naturalHealing: true,
            territorialAdvantage: true
        },
        startingUnits: [
            { unitType: 'warrior', count: 1 },
            { unitType: 'scout', count: 2 },
            { unitType: 'berserker', count: 1 }
        ]
    },

    {
        id: 'machines',
        name: 'Maschinen',
        icon: '🤖',
        color: '#607D8B',
        description: 'Mechanische Rasse mit Upgrades und Technologie.',
        startingGold: 150,
        goldMultiplier: 1.3,
        specialAbility: 'Technologie',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Kampfroboter', raceBonus: { repair: true, immuneToPoison: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Laser-Drohe', icon: '🔫', raceBonus: { energyWeapon: true, precision: +3 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Mech-Krieger', raceBonus: { armor: +10, selfRepair: true } },
            { ...UNIT_TYPES.SCOUT, name: 'Aufklärungs-Bot', raceBonus: { sensors: true, hacking: true } },
            { ...UNIT_TYPES.MAGE, name: 'KI-Kern', raceBonus: { dataAnalysis: true, systemControl: true } },
            { ...UNIT_TYPES.CAVALRY, name: 'Hover-Tank', icon: '🛸', raceBonus: { hovering: true, energyShield: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Destruktor-Bot', raceBonus: { overload: true, explosion: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Railgun-Einheit', raceBonus: { piercing: true, longRange: +2 } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Kampf-Drohne', raceBonus: { autonomousFlight: true, targeting: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Titan-Mech', raceBonus: { massiveSize: true, multiWeapon: true } }
        ],
        specialMechanics: {
            selfRepair: true,
            upgradeableInField: true,
            energyWeapons: true,
            immuneToMagic: true
        },
        startingUnits: [
            { unitType: 'warrior', count: 2 },
            { unitType: 'archer', count: 1 }
        ]
    },

    {
        id: 'elementals',
        name: 'Elementare',
        icon: '🌀',
        color: '#00BCD4',
        description: 'Wesen der Elemente mit mächtigen Naturkräften.',
        startingGold: 90,
        goldMultiplier: 1.1,
        specialAbility: 'Elementarkontrolle',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Erd-Elementar', icon: '🗿', raceBonus: { earthQuake: true, stoneArmor: true } },
            { ...UNIT_TYPES.MAGE, name: 'Feuer-Elementar', icon: '🔥', raceBonus: { burnAura: true, fireImmunity: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Luft-Elementar', icon: '💨', raceBonus: { windArrows: true, flying: true } },
            { ...UNIT_TYPES.KNIGHT, name: 'Wasser-Elementar', icon: '🌊', raceBonus: { floodAttack: true, healing: 10 } },
            { ...UNIT_TYPES.SCOUT, name: 'Blitz-Elementar', icon: '⚡', raceBonus: { lightning: true, movement: +3 } },
            { ...UNIT_TYPES.CAVALRY, name: 'Sturm-Elementar', raceBonus: { weatherControl: true, chainLightning: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Magma-Elementar', raceBonus: { meltingTouch: true, fireTrail: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Eis-Elementar', icon: '❄️', raceBonus: { freeze: true, iceSpikes: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Wirbelsturm', raceBonus: { massDisplacement: true, windShield: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Ur-Elementar', raceBonus: { allElements: true, shapeShift: true } }
        ],
        terrainBonus: {
            grass: { goldMultiplier: +0.2 },
            water: { movement: -2, attack: +5 },
            mountain: { defense: +3 },
            forest: { healing: +5 }
        },
        startingUnits: [
            { unitType: 'warrior', count: 1 },
            { unitType: 'mage', count: 2 }
        ]
    },

    {
        id: 'spirits',
        name: 'Geister',
        icon: '👻',
        color: '#9C27B0',
        description: 'Ätherische Wesen mit Unsichtbarkeit und Phasenfähigkeiten.',
        startingGold: 85,
        goldMultiplier: 0.9,
        specialAbility: 'Phasing',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Schattenkrieger', raceBonus: { phasing: true, stealth: true } },
            { ...UNIT_TYPES.SCOUT, name: 'Wisp', icon: '✨', raceBonus: { invisible: true, movement: +4 } },
            { ...UNIT_TYPES.MAGE, name: 'Banshee', raceBonus: { fearScream: true, soulDrain: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Phantom-Bogenschütze', raceBonus: { spectralArrows: true, wallPiercing: true } },
            { ...UNIT_TYPES.KNIGHT, name: 'Geisterritter', raceBonus: { incorporeal: true, terrorAura: true } },
            { ...UNIT_TYPES.CAVALRY, name: 'Schattenpferd', raceBonus: { nightmareRide: true, phaseMovement: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Poltergeist', raceBonus: { possession: true, objectThrow: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Seelensammler', raceBonus: { soulBind: true, lifeDrain: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Spektralgreif', raceBonus: { astralFlight: true, dimensionShift: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Geisterdrache', raceBonus: { soulBreath: true, hauntingPresence: true } }
        ],
        specialMechanics: {
            phasing: true,
            immuneToPhysical: 0.5,
            nightBonus: true,
            fearImmunity: true
        },
        startingUnits: [
            { unitType: 'scout', count: 2 },
            { unitType: 'warrior', count: 1 },
            { unitType: 'mage', count: 1 }
        ]
    },

    {
        id: 'insects',
        name: 'Insekten',
        icon: '🐛',
        color: '#689F38',
        description: 'Schwarm-Intelligenz mit schneller Reproduktion und Gift.',
        startingGold: 60,
        goldMultiplier: 0.7,
        specialAbility: 'Schwarm',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Soldaten-Ameise', icon: '🐜', raceBonus: { swarmBonus: true, acidBite: true } },
            { ...UNIT_TYPES.SCOUT, name: 'Späher-Käfer', icon: '🪲', raceBonus: { burrowing: true, pheromones: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Giftspinne', icon: '🕷️', raceBonus: { webTrap: true, poisonBite: true } },
            { ...UNIT_TYPES.CAVALRY, name: 'Käfer-Reiter', raceBonus: { fastBreeding: true, armor: +3 } },
            { ...UNIT_TYPES.MAGE, name: 'Bienenkönigin', icon: '🐝', raceBonus: { swarmCommand: true, healing: 15 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Riesen-Mantis', raceBonus: { scytheArms: true, precisionStrike: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Hornisse', raceBonus: { stinger: true, aggressive: +5 } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Bombardier-Käfer', raceBonus: { acidSpray: true, explosive: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Riesen-Libelle', icon: '🦋', raceBonus: { agileFlying: true, compoundEyes: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Schwarmkönig', raceBonus: { massSpawn: true, hiveControl: true } }
        ],
        specialMechanics: {
            swarmBonus: true,
            poisonResistance: true,
            fastReproduction: true,
            hiveStructure: true
        },
        startingUnits: [
            { unitType: 'warrior', count: 4 },
            { unitType: 'scout', count: 2 }
        ]
    },

    {
        id: 'crystals',
        name: 'Kristall-Wesen',
        icon: '💎',
        color: '#E1BEE7',
        description: 'Kristalline Lebensformen mit Energiemanipulation und Reflexion.',
        startingGold: 120,
        goldMultiplier: 1.4,
        specialAbility: 'Kristallresonanz',
        units: [
            { ...UNIT_TYPES.WARRIOR, name: 'Kristall-Wächter', raceBonus: { reflection: true, energyAbsorb: true } },
            { ...UNIT_TYPES.MAGE, name: 'Prisma-Magier', raceBonus: { lightBeam: true, energyAmplify: true } },
            { ...UNIT_TYPES.ARCHER, name: 'Energieschütze', raceBonus: { energyBolt: true, piercing: +2 } },
            { ...UNIT_TYPES.KNIGHT, name: 'Diamant-Ritter', raceBonus: { hardness: +8, brilliance: true } },
            { ...UNIT_TYPES.SCOUT, name: 'Quarzsplitter', raceBonus: { lightSpeed: true, transparency: true } },
            { ...UNIT_TYPES.CAVALRY, name: 'Kristall-Reiter', raceBonus: { energyTrail: true, resonance: true } },
            { ...UNIT_TYPES.BERSERKER, name: 'Obsidian-Krieger', raceBonus: { sharpEdges: true, volcanic: true } },
            { ...UNIT_TYPES.CROSSBOW, name: 'Laser-Kristall', raceBonus: { focusedBeam: true, continuousBeam: true } },
            { ...UNIT_TYPES.GRIFFIN, name: 'Saphir-Phönix', raceBonus: { energyWings: true, prismFlight: true } },
            { ...UNIT_TYPES.DRAGON, name: 'Ur-Kristall', raceBonus: { massReflection: true, energyNova: true } }
        ],
        specialMechanics: {
            energyReflection: true,
            crystallineGrowth: true,
            lightManipulation: true,
            goldMultiplierBonus: 1.5
        },
        startingUnits: [
            { unitType: 'warrior', count: 1 },
            { unitType: 'mage', count: 1 },
            { unitType: 'archer', count: 1 }
        ]
    }
];

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Apply race bonuses to unit stats
function applyRaceBonus(baseUnit, raceBonus) {
    if (!raceBonus) return { ...baseUnit };
    
    const enhancedUnit = { ...baseUnit };
    
    // Apply numeric bonuses
    Object.keys(raceBonus).forEach(key => {
        if (typeof raceBonus[key] === 'number') {
            if (enhancedUnit[key]) {
                enhancedUnit[key] += raceBonus[key];
            } else {
                enhancedUnit[key] = raceBonus[key];
            }
        } else {
            // Apply special abilities or boolean flags
            enhancedUnit[key] = raceBonus[key];
        }
    });
    
    return enhancedUnit;
}

// Get all units for a race with bonuses applied
function getRaceUnits(raceId) {
    const race = window.COMPLETE_RACES.find(r => r.id === raceId);
    if (!race) return [];
    
    return race.units.map(unit => {
        const enhancedUnit = applyRaceBonus(unit, unit.raceBonus);
        enhancedUnit.raceId = raceId;
        return enhancedUnit;
    });
}

// Calculate movement cost for unit on terrain
function calculateMovementCost(unit, terrainType, raceId) {
    const terrain = window.TERRAIN_DEFINITIONS[terrainType];
    if (!terrain) return 999;
    
    let cost = terrain.movementCost;
    
    // Apply unit type modifiers
    if (unit.unitType === 'flying' || unit.flying) {
        cost = 1; // Flying units ignore terrain
    }
    
    // Apply race terrain bonuses
    const race = window.COMPLETE_RACES.find(r => r.id === raceId);
    if (race && race.terrainBonus && race.terrainBonus[terrainType]) {
        const bonus = race.terrainBonus[terrainType];
        if (bonus.movement) {
            cost += bonus.movement;
        }
    }
    
    return Math.max(1, cost);
}

// Calculate combat damage with all modifiers
function calculateCombatDamage(attacker, defender, terrainType, attackerRaceId, defenderRaceId) {
    let damage = attacker.attack || 10;
    let defense = defender.defense || 5;
    
    // Apply terrain defense bonus
    const terrain = window.TERRAIN_DEFINITIONS[terrainType];
    if (terrain && terrain.defenseBonus) {
        defense += terrain.defenseBonus;
    }
    
    // Apply race-specific terrain bonuses for defender
    const defenderRace = window.COMPLETE_RACES.find(r => r.id === defenderRaceId);
    if (defenderRace && defenderRace.terrainBonus && defenderRace.terrainBonus[terrainType]) {
        const bonus = defenderRace.terrainBonus[terrainType];
        if (bonus.defense) {
            defense += bonus.defense;
        }
    }
    
    // Calculate final damage
    const finalDamage = Math.max(1, damage - defense);
    
    // Apply special abilities
    let modifiers = {
        criticalHit: Math.random() < 0.1,
        resistance: false,
        weakness: false
    };
    
    // Check for special resistances/weaknesses
    if (attacker.fireBreath && defender.fireResistance) {
        modifiers.resistance = true;
        finalDamage *= 0.5;
    }
    
    if (attacker.holyDamage && defender.undead) {
        modifiers.weakness = true;
        finalDamage *= 2;
    }
    
    return {
        damage: Math.floor(finalDamage),
        modifiers: modifiers,
        terrainBonus: terrain?.defenseBonus || 0
    };
}

// Generate starting position for race
function generateRaceStartingPosition(raceId, mapSize, playerIndex, totalPlayers) {
    const race = window.COMPLETE_RACES.find(r => r.id === raceId);
    if (!race) return { x: 5, y: 5 };
    
    // Calculate position based on player index
    const angle = (playerIndex / totalPlayers) * 2 * Math.PI;
    const radius = mapSize * 0.3;
    const centerX = mapSize / 2;
    const centerY = mapSize / 2;
    
    const x = Math.floor(centerX + radius * Math.cos(angle));
    const y = Math.floor(centerY + radius * Math.sin(angle));
    
    return {
        x: Math.max(2, Math.min(mapSize - 3, x)),
        y: Math.max(2, Math.min(mapSize - 3, y))
    };
}

// ========================================
// EXPORT FUNCTIONS
// ========================================

// Make available globally
window.LOADED_RACES = window.COMPLETE_RACES;
window.FALLBACK_RACES = window.COMPLETE_RACES; // Backup for race selection

// Export utility functions
window.RaceUtils = {
    applyRaceBonus,
    getRaceUnits,
    calculateMovementCost,
    calculateCombatDamage,
    generateRaceStartingPosition
};

console.log('✅ Vollständiges Race System geladen');
console.log(`📊 ${window.COMPLETE_RACES.length} Rassen mit insgesamt ${window.COMPLETE_RACES.reduce((sum, race) => sum + race.units.length, 0)} Einheiten verfügbar`);

// Validate all races have required properties
window.COMPLETE_RACES.forEach(race => {
    if (race.units.length !== 10) {
        console.warn(`⚠️ Rasse ${race.name} hat ${race.units.length} Einheiten statt 10`);
    }
});