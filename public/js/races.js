// races.js - Vollständige Rassen-Definitionen für Strategiespiel

console.log('🏛️ Lade Rassen-Definitionen...');

// ========================================
// VOLLSTÄNDIGE RASSEN-DEFINITIONEN (15 Rassen)
// ========================================

window.FALLBACK_RACES = [
    // 1. Menschen - Vielseitig und ausgewogen
    {
        id: "humans",
        name: "Menschen",
        icon: "👑",
        description: "Vielseitige und anpassungsfähige Rasse mit ausgewogenen Fähigkeiten",
        bonuses: {
            goldIncome: 1.2,
            buildSpeed: 1.1,
            unitTraining: 1.0
        },
        startingGold: 120,
        preferredTerrain: ["grassland", "plains"],
        units: [
            { id: "peasant", name: "Bauer", cost: 10, hp: 15, attack: 2, defense: 1, movement: 2, range: 1, icon: "🧑‍🌾" },
            { id: "warrior", name: "Krieger", cost: 25, hp: 30, attack: 8, defense: 4, movement: 2, range: 1, icon: "⚔️" },
            { id: "archer", name: "Bogenschütze", cost: 30, hp: 20, attack: 6, defense: 2, movement: 2, range: 3, icon: "🏹" },
            { id: "knight", name: "Ritter", cost: 60, hp: 50, attack: 12, defense: 8, movement: 3, range: 1, icon: "🛡️" },
            { id: "cavalry", name: "Kavallerie", cost: 45, hp: 35, attack: 10, defense: 5, movement: 4, range: 1, icon: "🐎" },
            { id: "crossbow", name: "Armbrustschütze", cost: 40, hp: 25, attack: 8, defense: 3, movement: 2, range: 3, icon: "🎯" },
            { id: "pikeman", name: "Pikenier", cost: 35, hp: 40, attack: 7, defense: 6, movement: 2, range: 1, icon: "🔱" },
            { id: "catapult", name: "Katapult", cost: 80, hp: 30, attack: 15, defense: 3, movement: 1, range: 4, icon: "🏰" },
            { id: "priest", name: "Priester", cost: 50, hp: 25, attack: 3, defense: 4, movement: 2, range: 2, icon: "⛪" },
            { id: "paladin", name: "Paladin", cost: 100, hp: 70, attack: 15, defense: 12, movement: 3, range: 1, icon: "✨" }
        ]
    },

    // 2. Orks - Stark und aggressiv
    {
        id: "orcs",
        name: "Orks",
        icon: "⚔️",
        description: "Brutale Krieger mit hoher Angriffskraft aber geringerer Verteidigung",
        bonuses: {
            attackPower: 1.3,
            unitCost: 0.9,
            goldIncome: 0.8
        },
        startingGold: 100,
        preferredTerrain: ["mountains", "wasteland"],
        units: [
            { id: "goblin", name: "Goblin", cost: 8, hp: 12, attack: 3, defense: 1, movement: 3, range: 1, icon: "👹" },
            { id: "orc_warrior", name: "Ork Krieger", cost: 20, hp: 35, attack: 10, defense: 3, movement: 2, range: 1, icon: "🗡️" },
            { id: "orc_archer", name: "Ork Bogenschütze", cost: 25, hp: 18, attack: 7, defense: 2, movement: 2, range: 3, icon: "🏹" },
            { id: "berserker", name: "Berserker", cost: 40, hp: 45, attack: 15, defense: 2, movement: 3, range: 1, icon: "🪓" },
            { id: "warg_rider", name: "Wargreiter", cost: 50, hp: 40, attack: 12, defense: 4, movement: 4, range: 1, icon: "🐺" },
            { id: "troll", name: "Troll", cost: 70, hp: 80, attack: 18, defense: 6, movement: 2, range: 1, icon: "👹" },
            { id: "catapult_orc", name: "Ork Katapult", cost: 60, hp: 25, attack: 20, defense: 2, movement: 1, range: 4, icon: "💥" },
            { id: "shaman", name: "Schamane", cost: 45, hp: 30, attack: 5, defense: 3, movement: 2, range: 2, icon: "🔮" },
            { id: "ogre", name: "Oger", cost: 90, hp: 100, attack: 22, defense: 8, movement: 2, range: 1, icon: "👹" },
            { id: "warchief", name: "Kriegsherr", cost: 120, hp: 90, attack: 25, defense: 10, movement: 3, range: 1, icon: "👑" }
        ]
    },

    // 3. Elfen - Schnell und präzise
    {
        id: "elves",
        name: "Elfen",
        icon: "🏹",
        description: "Wendige Waldkrieger mit herausragenden Fernkampffähigkeiten",
        bonuses: {
            rangedAccuracy: 1.4,
            movementSpeed: 1.2,
            forestBonus: 1.5
        },
        startingGold: 110,
        preferredTerrain: ["forest", "grassland"],
        units: [
            { id: "elf_scout", name: "Elfenkundschafter", cost: 15, hp: 18, attack: 4, defense: 2, movement: 4, range: 2, icon: "🏃" },
            { id: "elf_archer", name: "Elfenbogenschütze", cost: 35, hp: 22, attack: 9, defense: 3, movement: 3, range: 4, icon: "🎯" },
            { id: "ranger", name: "Waldläufer", cost: 45, hp: 35, attack: 11, defense: 5, movement: 3, range: 3, icon: "🌲" },
            { id: "elf_warrior", name: "Elfenkrieger", cost: 40, hp: 30, attack: 8, defense: 6, movement: 3, range: 1, icon: "⚔️" },
            { id: "unicorn_rider", name: "Einhornreiter", cost: 80, hp: 45, attack: 12, defense: 8, movement: 5, range: 1, icon: "🦄" },
            { id: "tree_spirit", name: "Baumgeist", cost: 60, hp: 60, attack: 10, defense: 10, movement: 2, range: 1, icon: "🌳" },
            { id: "eagle_rider", name: "Adlerreiter", cost: 70, hp: 40, attack: 14, defense: 4, movement: 6, range: 2, icon: "🦅" },
            { id: "elf_mage", name: "Elfenmagier", cost: 65, hp: 35, attack: 12, defense: 4, movement: 2, range: 3, icon: "🧙‍♀️" },
            { id: "phoenix", name: "Phönix", cost: 100, hp: 70, attack: 18, defense: 8, movement: 5, range: 2, icon: "🔥" },
            { id: "elflord", name: "Elfenfürst", cost: 130, hp: 80, attack: 20, defense: 12, movement: 4, range: 2, icon: "👑" }
        ]
    },

    // 4. Zwerge - Robust und defensiv
    {
        id: "dwarves",
        name: "Zwerge",
        icon: "⛏️",
        description: "Robuste Bergbewohner mit starker Verteidigung und Belagerungswaffen",
        bonuses: {
            defensePower: 1.4,
            siegeWeapons: 1.3,
            mountainBonus: 1.5
        },
        startingGold: 130,
        preferredTerrain: ["mountains", "hills"],
        units: [
            { id: "dwarf_miner", name: "Zwergenbergmann", cost: 12, hp: 25, attack: 3, defense: 4, movement: 1, range: 1, icon: "⛏️" },
            { id: "dwarf_warrior", name: "Zwergenkrieger", cost: 30, hp: 40, attack: 8, defense: 8, movement: 2, range: 1, icon: "🛡️" },
            { id: "crossbow_dwarf", name: "Zwergen-Armbrustschütze", cost: 35, hp: 30, attack: 9, defense: 5, movement: 2, range: 3, icon: "🎯" },
            { id: "axe_thrower", name: "Axtwerfer", cost: 40, hp: 35, attack: 11, defense: 6, movement: 2, range: 2, icon: "🪓" },
            { id: "dwarf_guard", name: "Zwergengarde", cost: 50, hp: 50, attack: 10, defense: 12, movement: 2, range: 1, icon: "🛡️" },
            { id: "cannon", name: "Kanone", cost: 90, hp: 40, attack: 25, defense: 5, movement: 1, range: 5, icon: "💣" },
            { id: "steam_tank", name: "Dampfpanzer", cost: 100, hp: 80, attack: 20, defense: 15, movement: 2, range: 1, icon: "🚂" },
            { id: "engineer", name: "Ingenieur", cost: 55, hp: 35, attack: 6, defense: 6, movement: 2, range: 2, icon: "🔧" },
            { id: "dwarf_lord", name: "Zwergenfürst", cost: 110, hp: 70, attack: 18, defense: 18, movement: 2, range: 1, icon: "👑" },
            { id: "stone_golem", name: "Steingolem", cost: 120, hp: 120, attack: 22, defense: 20, movement: 1, range: 1, icon: "🗿" }
        ]
    },

    // 5. Untote - Schwärmen mit günstigen Einheiten
    {
        id: "undead",
        name: "Untote",
        icon: "💀",
        description: "Unermüdliche Horde der Untoten mit günstigen, aber schwächeren Einheiten",
        bonuses: {
            unitCost: 0.7,
            noMorale: true,
            necromancy: 1.2
        },
        startingGold: 90,
        preferredTerrain: ["swamp", "wasteland"],
        units: [
            { id: "skeleton", name: "Skelett", cost: 8, hp: 15, attack: 4, defense: 2, movement: 2, range: 1, icon: "💀" },
            { id: "zombie", name: "Zombie", cost: 10, hp: 20, attack: 5, defense: 1, movement: 1, range: 1, icon: "🧟" },
            { id: "ghost", name: "Geist", cost: 25, hp: 18, attack: 8, defense: 3, movement: 4, range: 1, icon: "👻" },
            { id: "skeleton_archer", name: "Skelett Bogenschütze", cost: 15, hp: 12, attack: 6, defense: 1, movement: 2, range: 3, icon: "🏹" },
            { id: "wraith", name: "Schemen", cost: 40, hp: 30, attack: 12, defense: 4, movement: 3, range: 1, icon: "🌫️" },
            { id: "bone_dragon", name: "Knochendrache", cost: 80, hp: 60, attack: 18, defense: 8, movement: 5, range: 2, icon: "🐲" },
            { id: "necromancer", name: "Nekromant", cost: 60, hp: 35, attack: 10, defense: 5, movement: 2, range: 3, icon: "🧙‍♂️" },
            { id: "lich", name: "Lich", cost: 90, hp: 50, attack: 20, defense: 8, movement: 2, range: 4, icon: "💀" },
            { id: "death_knight", name: "Todesritter", cost: 70, hp: 55, attack: 16, defense: 10, movement: 3, range: 1, icon: "⚔️" },
            { id: "vampire_lord", name: "Vampirfürst", cost: 100, hp: 70, attack: 22, defense: 12, movement: 4, range: 1, icon: "🧛" }
        ]
    },

    // 6. Drachen - Mächtige fliegende Einheiten
    {
        id: "dragons",
        name: "Drachen",
        icon: "🐲",
        description: "Mächtige geflügelte Wesen mit verheerenden Angriffen",
        bonuses: {
            flyingUnits: 1.5,
            fireAttack: 1.4,
            terrainIgnore: true
        },
        startingGold: 80,
        preferredTerrain: ["mountains", "volcanic"],
        units: [
            { id: "dragonling", name: "Drachenjunges", cost: 40, hp: 35, attack: 10, defense: 6, movement: 4, range: 1, icon: "🐉" },
            { id: "wyvern", name: "Wyvern", cost: 50, hp: 45, attack: 12, defense: 7, movement: 5, range: 1, icon: "🦇" },
            { id: "fire_drake", name: "Feuerdrache", cost: 70, hp: 60, attack: 18, defense: 10, movement: 4, range: 2, icon: "🔥" },
            { id: "ice_dragon", name: "Eisdrache", cost: 75, hp: 65, attack: 16, defense: 12, movement: 4, range: 2, icon: "❄️" },
            { id: "storm_dragon", name: "Sturmdrache", cost: 80, hp: 55, attack: 20, defense: 8, movement: 6, range: 3, icon: "⚡" },
            { id: "earth_dragon", name: "Erddrache", cost: 85, hp: 80, attack: 22, defense: 15, movement: 3, range: 1, icon: "🌍" },
            { id: "shadow_dragon", name: "Schattendrache", cost: 90, hp: 70, attack: 24, defense: 10, movement: 5, range: 2, icon: "🌚" },
            { id: "crystal_dragon", name: "Kristalldrache", cost: 100, hp: 85, attack: 26, defense: 18, movement: 4, range: 3, icon: "💎" },
            { id: "ancient_dragon", name: "Uralter Drache", cost: 150, hp: 120, attack: 35, defense: 25, movement: 5, range: 4, icon: "🐲" },
            { id: "dragon_lord", name: "Drachenfürst", cost: 200, hp: 150, attack: 40, defense: 30, movement: 6, range: 5, icon: "👑" }
        ]
    },

    // 7. Goblins - Schnell und zahlreich
    {
        id: "goblins",
        name: "Goblins",
        icon: "👹",
        description: "Kleine aber wendige Kreaturen die in Schwärmen kämpfen",
        bonuses: {
            unitCost: 0.6,
            movementSpeed: 1.3,
            swarmBonus: 1.2
        },
        startingGold: 80,
        preferredTerrain: ["forest", "hills"],
        units: [
            { id: "goblin_scout", name: "Goblin Späher", cost: 5, hp: 8, attack: 2, defense: 1, movement: 4, range: 1, icon: "👹" },
            { id: "goblin_warrior", name: "Goblin Krieger", cost: 12, hp: 15, attack: 5, defense: 2, movement: 3, range: 1, icon: "⚔️" },
            { id: "goblin_archer", name: "Goblin Bogenschütze", cost: 15, hp: 12, attack: 4, defense: 1, movement: 3, range: 3, icon: "🏹" },
            { id: "wolf_rider", name: "Wolfsreiter", cost: 25, hp: 20, attack: 8, defense: 3, movement: 5, range: 1, icon: "🐺" },
            { id: "goblin_shaman", name: "Goblin Schamane", cost: 30, hp: 18, attack: 6, defense: 3, movement: 2, range: 2, icon: "🔮" },
            { id: "troll_ally", name: "Troll Verbündeter", cost: 50, hp: 60, attack: 15, defense: 6, movement: 2, range: 1, icon: "👹" },
            { id: "spider_rider", name: "Spinnenreiter", cost: 35, hp: 25, attack: 10, defense: 4, movement: 4, range: 1, icon: "🕷️" },
            { id: "goblin_bomber", name: "Goblin Sprengmeister", cost: 40, hp: 20, attack: 18, defense: 2, movement: 2, range: 2, icon: "💣" },
            { id: "giant_spider", name: "Riesenspinne", cost: 60, hp: 45, attack: 16, defense: 8, movement: 3, range: 1, icon: "🕸️" },
            { id: "goblin_king", name: "Goblin König", cost: 80, hp: 50, attack: 20, defense: 10, movement: 3, range: 1, icon: "👑" }
        ]
    },

    // 8. Dämonen - Magisch und zerstörerisch
    {
        id: "demons",
        name: "Dämonen",
        icon: "😈",
        description: "Mächtige Wesen aus anderen Dimensionen mit dunkler Magie",
        bonuses: {
            magicPower: 1.5,
            corruptionSpread: 1.3,
            fearAura: 1.2
        },
        startingGold: 100,
        preferredTerrain: ["volcanic", "wasteland"],
        units: [
            { id: "imp", name: "Kobold", cost: 20, hp: 15, attack: 6, defense: 3, movement: 3, range: 1, icon: "😈" },
            { id: "demon_warrior", name: "Dämonenkrieger", cost: 45, hp: 40, attack: 14, defense: 6, movement: 3, range: 1, icon: "👹" },
            { id: "succubus", name: "Sukkubus", cost: 50, hp: 35, attack: 12, defense: 5, movement: 4, range: 2, icon: "💋" },
            { id: "hellhound", name: "Höllenhund", cost: 35, hp: 30, attack: 11, defense: 4, movement: 5, range: 1, icon: "🐕‍🦺" },
            { id: "demon_lord", name: "Dämonenfürst", cost: 80, hp: 65, attack: 22, defense: 12, movement: 3, range: 2, icon: "👑" },
            { id: "balor", name: "Balor", cost: 100, hp: 80, attack: 28, defense: 15, movement: 4, range: 3, icon: "🔥" },
            { id: "shadow_fiend", name: "Schattenunhold", cost: 60, hp: 45, attack: 18, defense: 8, movement: 4, range: 2, icon: "🌚" },
            { id: "pit_lord", name: "Grubenherr", cost: 120, hp: 100, attack: 30, defense: 18, movement: 2, range: 1, icon: "👹" },
            { id: "archfiend", name: "Erzfiend", cost: 150, hp: 120, attack: 35, defense: 20, movement: 3, range: 3, icon: "😈" },
            { id: "devil_prince", name: "Teufelsprinz", cost: 200, hp: 150, attack: 40, defense: 25, movement: 4, range: 4, icon: "👑" }
        ]
    },

    // 9. Engel - Heilige Krieger
    {
        id: "angels",
        name: "Engel",
        icon: "😇",
        description: "Himmlische Wesen mit heiliger Magie und Heilkräften",
        bonuses: {
            holyPower: 1.4,
            healing: 1.5,
            undeadDamage: 2.0
        },
        startingGold: 110,
        preferredTerrain: ["plains", "grassland"],
        units: [
            { id: "cherub", name: "Cherub", cost: 25, hp: 20, attack: 6, defense: 4, movement: 4, range: 2, icon: "👼" },
            { id: "guardian_angel", name: "Schutzengel", cost: 40, hp: 35, attack: 10, defense: 8, movement: 4, range: 1, icon: "😇" },
            { id: "seraph", name: "Seraph", cost: 60, hp: 45, attack: 16, defense: 10, movement: 5, range: 2, icon: "🔥" },
            { id: "angel_warrior", name: "Engelskrieger", cost: 50, hp: 40, attack: 14, defense: 12, movement: 4, range: 1, icon: "⚔️" },
            { id: "archangel", name: "Erzengel", cost: 80, hp: 60, attack: 20, defense: 15, movement: 5, range: 3, icon: "✨" },
            { id: "throne", name: "Thron", cost: 100, hp: 80, attack: 24, defense: 18, movement: 4, range: 2, icon: "👑" },
            { id: "dominion", name: "Herrschaft", cost: 90, hp: 70, attack: 18, defense: 16, movement: 4, range: 3, icon: "⚖️" },
            { id: "virtue", name: "Tugend", cost: 70, hp: 55, attack: 16, defense: 14, movement: 5, range: 2, icon: "✨" },
            { id: "power", name: "Macht", cost: 110, hp: 85, attack: 26, defense: 20, movement: 4, range: 2, icon: "💫" },
            { id: "seraphim_lord", name: "Seraphimfürst", cost: 180, hp: 130, attack: 35, defense: 28, movement: 6, range: 4, icon: "👑" }
        ]
    },

    // 10. Echsenmenschen - Anpassungsfähig
    {
        id: "lizardmen",
        name: "Echsenmenschen",
        icon: "🦎",
        description: "Reptilienkrieger die sich an verschiedene Umgebungen anpassen können",
        bonuses: {
            swampBonus: 1.4,
            adaptability: 1.2,
            regeneration: 1.1
        },
        startingGold: 105,
        preferredTerrain: ["swamp", "jungle"],
        units: [
            { id: "skink", name: "Skink", cost: 15, hp: 18, attack: 4, defense: 2, movement: 3, range: 2, icon: "🦎" },
            { id: "saurus", name: "Saurus", cost: 35, hp: 40, attack: 12, defense: 8, movement: 2, range: 1, icon: "🦕" },
            { id: "chameleon", name: "Chamäleon Skink", cost: 30, hp: 22, attack: 8, defense: 4, movement: 4, range: 3, icon: "🦎" },
            { id: "kroxigor", name: "Kroxigor", cost: 60, hp: 70, attack: 18, defense: 12, movement: 2, range: 1, icon: "🐊" },
            { id: "terradon", name: "Terradon Reiter", cost: 50, hp: 35, attack: 12, defense: 6, movement: 6, range: 2, icon: "🦅" },
            { id: "stegadon", name: "Stegadon", cost: 90, hp: 100, attack: 22, defense: 16, movement: 2, range: 1, icon: "🦕" },
            { id: "salamander", name: "Salamander", cost: 45, hp: 40, attack: 14, defense: 6, movement: 3, range: 2, icon: "🔥" },
            { id: "slann_priest", name: "Slann Priester", cost: 80, hp: 60, attack: 16, defense: 10, movement: 1, range: 4, icon: "🐸" },
            { id: "carnosaur", name: "Carnosaurus", cost: 120, hp: 120, attack: 30, defense: 15, movement: 4, range: 1, icon: "🦖" },
            { id: "oldblood", name: "Uraltes Blut", cost: 100, hp: 90, attack: 25, defense: 18, movement: 3, range: 1, icon: "👑" }
        ]
    },

    // 11. Zauberer - Magiebasiert
    {
        id: "wizards",
        name: "Zauberer",
        icon: "🧙‍♂️",
        description: "Mächtige Magier mit verheerenden Zaubern aber schwacher Verteidigung",
        bonuses: {
            spellPower: 1.6,
            manaRegeneration: 1.4,
            spellRange: 1.3
        },
        startingGold: 95,
        preferredTerrain: ["tower", "library"],
        units: [
            { id: "apprentice", name: "Lehrling", cost: 20, hp: 15, attack: 3, defense: 2, movement: 2, range: 2, icon: "🧙‍♂️" },
            { id: "fire_mage", name: "Feuermagier", cost: 45, hp: 25, attack: 14, defense: 4, movement: 2, range: 3, icon: "🔥" },
            { id: "ice_mage", name: "Eismagier", cost: 45, hp: 30, attack: 12, defense: 6, movement: 2, range: 3, icon: "❄️" },
            { id: "lightning_mage", name: "Blitzmagier", cost: 50, hp: 22, attack: 16, defense: 3, movement: 3, range: 4, icon: "⚡" },
            { id: "earth_mage", name: "Erdmagier", cost: 40, hp: 35, attack: 10, defense: 8, movement: 2, range: 2, icon: "🌍" },
            { id: "summoner", name: "Beschwörer", cost: 60, hp: 30, attack: 8, defense: 5, movement: 2, range: 3, icon: "👹" },
            { id: "enchanter", name: "Verzauberer", cost: 55, hp: 28, attack: 6, defense: 6, movement: 2, range: 3, icon: "✨" },
            { id: "elementalist", name: "Elementarist", cost: 70, hp: 40, attack: 18, defense: 8, movement: 2, range: 4, icon: "🌪️" },
            { id: "archmage", name: "Erzmagier", cost: 100, hp: 50, attack: 24, defense: 12, movement: 2, range: 5, icon: "🔮" },
            { id: "grand_wizard", name: "Großzauberer", cost: 150, hp: 70, attack: 30, defense: 15, movement: 3, range: 6, icon: "👑" }
        ]
    },

    // 12. Piraten - Seefahrer
    {
        id: "pirates",
        name: "Piraten",
        icon: "🏴‍☠️",
        description: "Seefahrende Räuber mit Vorteilen auf Wasserfeldern",
        bonuses: {
            seaBonus: 1.5,
            goldPlunder: 1.3,
            shipMovement: 1.4
        },
        startingGold: 120,
        preferredTerrain: ["coast", "islands"],
        units: [
            { id: "sailor", name: "Matrose", cost: 15, hp: 20, attack: 5, defense: 3, movement: 2, range: 1, icon: "⚓" },
            { id: "pirate", name: "Pirat", cost: 25, hp: 30, attack: 8, defense: 4, movement: 3, range: 1, icon: "🏴‍☠️" },
            { id: "corsair", name: "Korsar", cost: 35, hp: 28, attack: 10, defense: 5, movement: 3, range: 2, icon: "⚔️" },
            { id: "musketeer", name: "Musketier", cost: 40, hp: 25, attack: 12, defense: 3, movement: 2, range: 4, icon: "🔫" },
            { id: "buccaneer", name: "Bukanier", cost: 45, hp: 35, attack: 14, defense: 6, movement: 3, range: 1, icon: "🗡️" },
            { id: "ship_gunner", name: "Schiffskanoneer", cost: 50, hp: 30, attack: 16, defense: 4, movement: 2, range: 5, icon: "💣" },
            { id: "sea_witch", name: "Seehexe", cost: 60, hp: 40, attack: 18, defense: 8, movement: 3, range: 3, icon: "🧙‍♀️" },
            { id: "kraken_rider", name: "Krakenreiter", cost: 80, hp: 60, attack: 20, defense: 12, movement: 4, range: 2, icon: "🐙" },
            { id: "ghost_ship", name: "Geisterschiff", cost: 100, hp: 80, attack: 24, defense: 10, movement: 5, range: 4, icon: "👻" },
            { id: "pirate_king", name: "Piratenkönig", cost: 120, hp: 90, attack: 28, defense: 15, movement: 4, range: 2, icon: "👑" }
        ]
    },

    // 13. Barbaren - Primitive aber starke Krieger
    {
        id: "barbarians",
        name: "Barbaren",
        icon: "🪓",
        description: "Wilde Krieger mit hoher Angriffskraft und Berserker-Fähigkeiten",
        bonuses: {
            berserkerRage: 1.4,
            wildernessBonus: 1.3,
            frenzyAttack: 1.2
        },
        startingGold: 85,
        preferredTerrain: ["tundra", "mountains"],
        units: [
            { id: "tribal_warrior", name: "Stammkrieger", cost: 18, hp: 25, attack: 7, defense: 3, movement: 3, range: 1, icon: "🪓" },
            { id: "berserker_barb", name: "Berserker", cost: 30, hp: 35, attack: 12, defense: 2, movement: 3, range: 1, icon: "😡" },
            { id: "shaman_barb", name: "Schamane", cost: 35, hp: 30, attack: 8, defense: 5, movement: 2, range: 2, icon: "🔮" },
            { id: "bear_rider", name: "Bärenreiter", cost: 50, hp: 50, attack: 15, defense: 8, movement: 3, range: 1, icon: "🐻" },
            { id: "mammoth_rider", name: "Mammutreiter", cost: 70, hp: 80, attack: 20, defense: 12, movement: 2, range: 1, icon: "🦣" },
            { id: "frost_giant", name: "Frostgigant", cost: 90, hp: 100, attack: 25, defense: 15, movement: 2, range: 1, icon: "❄️" },
            { id: "war_chief", name: "Kriegshäuptling", cost: 60, hp: 60, attack: 18, defense: 10, movement: 3, range: 1, icon: "👑" },
            { id: "tribal_shaman", name: "Stammesschamane", cost: 55, hp: 45, attack: 12, defense: 8, movement: 2, range: 3, icon: "🌟" },
            { id: "ice_dragon_barb", name: "Eisdrache", cost: 120, hp: 90, attack: 30, defense: 18, movement: 4, range: 3, icon: "🐲" },
            { id: "barbarian_king", name: "Barbarenkönig", cost: 110, hp: 85, attack: 28, defense: 16, movement: 3, range: 1, icon: "👑" }
        ]
    },

    // 14. Roboter - Futuristische Maschinen
    {
        id: "robots",
        name: "Roboter",
        icon: "🤖",
        description: "Mechanische Kriegsmaschinen mit hoher Technologie",
        bonuses: {
            noFatigue: true,
            repairability: 1.3,
            techBonus: 1.4
        },
        startingGold: 100,
        preferredTerrain: ["urban", "factory"],
        units: [
            { id: "scout_bot", name: "Aufklärer-Bot", cost: 25, hp: 20, attack: 6, defense: 4, movement: 4, range: 2, icon: "🔍" },
            { id: "soldier_bot", name: "Soldaten-Bot", cost: 40, hp: 35, attack: 10, defense: 8, movement: 2, range: 1, icon: "🤖" },
            { id: "sniper_bot", name: "Scharfschützen-Bot", cost: 50, hp: 25, attack: 14, defense: 4, movement: 2, range: 5, icon: "🎯" },
            { id: "tank_bot", name: "Panzer-Bot", cost: 70, hp: 60, attack: 18, defense: 15, movement: 2, range: 1, icon: "🚗" },
            { id: "flying_bot", name: "Flug-Bot", cost: 60, hp: 30, attack: 12, defense: 6, movement: 6, range: 2, icon: "🚁" },
            { id: "artillery_bot", name: "Artillerie-Bot", cost: 80, hp: 40, attack: 22, defense: 8, movement: 1, range: 6, icon: "💥" },
            { id: "repair_bot", name: "Reparatur-Bot", cost: 45, hp: 35, attack: 4, defense: 6, movement: 2, range: 1, icon: "🔧" },
            { id: "stealth_bot", name: "Tarn-Bot", cost: 65, hp: 25, attack: 16, defense: 4, movement: 4, range: 1, icon: "👤" },
            { id: "mech_warrior", name: "Mech-Krieger", cost: 120, hp: 100, attack: 28, defense: 20, movement: 3, range: 2, icon: "🦾" },
            { id: "ai_commander", name: "KI-Kommandant", cost: 150, hp: 80, attack: 24, defense: 16, movement: 3, range: 4, icon: "🧠" }
        ]
    },

    // 15. Außerirdische - Alien-Technologie
    {
        id: "aliens",
        name: "Außerirdische",
        icon: "👽",
        description: "Fremdartige Wesen mit fortschrittlicher Technologie",
        bonuses: {
            alienTech: 1.5,
            psychicPowers: 1.4,
            energyWeapons: 1.3
        },
        startingGold: 90,
        preferredTerrain: ["crater", "alien"],
        units: [
            { id: "probe", name: "Sonde", cost: 20, hp: 15, attack: 4, defense: 2, movement: 5, range: 3, icon: "🛸" },
            { id: "grey_alien", name: "Grauer", cost: 35, hp: 25, attack: 8, defense: 4, movement: 3, range: 2, icon: "👽" },
            { id: "warrior_alien", name: "Alien-Krieger", cost: 45, hp: 40, attack: 12, defense: 6, movement: 3, range: 2, icon: "⚡" },
            { id: "psychic_alien", name: "Psycho-Alien", cost: 50, hp: 35, attack: 14, defense: 5, movement: 2, range: 4, icon: "🧠" },
            { id: "hover_tank", name: "Schwebe-Panzer", cost: 70, hp: 50, attack: 18, defense: 12, movement: 4, range: 3, icon: "🛸" },
            { id: "energy_being", name: "Energiewesen", cost: 60, hp: 30, attack: 20, defense: 3, movement: 5, range: 4, icon: "⚡" },
            { id: "mind_controller", name: "Gedankenkontrolleur", cost: 80, hp: 45, attack: 16, defense: 8, movement: 2, range: 5, icon: "🌀" },
            { id: "mothership", name: "Mutterschiff", cost: 120, hp: 80, attack: 28, defense: 18, movement: 2, range: 6, icon: "🛸" },
            { id: "hive_mind", name: "Schwarmgeist", cost: 100, hp: 60, attack: 24, defense: 12, movement: 3, range: 5, icon: "🧠" },
            { id: "alien_emperor", name: "Alien-Imperator", cost: 180, hp: 120, attack: 35, defense: 25, movement: 4, range: 6, icon: "👑" }
        ]
    }
];

// ========================================
// TERRAIN DEFINITIONEN
// ========================================

window.TERRAIN_TYPES = [
    { id: "grassland", name: "Grasland", color: "#90EE90", movementCost: 1, defenseBonus: 0, goldBonus: 0, icon: "🌱" },
    { id: "forest", name: "Wald", color: "#228B22", movementCost: 2, defenseBonus: 1, goldBonus: 0, icon: "🌲" },
    { id: "mountains", name: "Berge", color: "#A0522D", movementCost: 3, defenseBonus: 2, goldBonus: 1, icon: "⛰️" },
    { id: "hills", name: "Hügel", color: "#DEB887", movementCost: 2, defenseBonus: 1, goldBonus: 0, icon: "🏔️" },
    { id: "desert", name: "Wüste", color: "#F4A460", movementCost: 2, defenseBonus: 0, goldBonus: 0, icon: "🏜️" },
    { id: "swamp", name: "Sumpf", color: "#556B2F", movementCost: 3, defenseBonus: 0, goldBonus: 0, icon: "🐊" },
    { id: "tundra", name: "Tundra", color: "#E0E0E0", movementCost: 2, defenseBonus: 0, goldBonus: 0, icon: "❄️" },
    { id: "plains", name: "Ebene", color: "#FFFF99", movementCost: 1, defenseBonus: 0, goldBonus: 1, icon: "🌾" },
    { id: "water", name: "Wasser", color: "#4169E1", movementCost: 2, defenseBonus: 0, goldBonus: 0, icon: "🌊" },
    { id: "coast", name: "Küste", color: "#87CEEB", movementCost: 1, defenseBonus: 0, goldBonus: 1, icon: "🏖️" },
    { id: "volcanic", name: "Vulkanisch", color: "#DC143C", movementCost: 3, defenseBonus: 1, goldBonus: 2, icon: "🌋" },
    { id: "wasteland", name: "Ödland", color: "#696969", movementCost: 2, defenseBonus: 0, goldBonus: 0, icon: "💀" },
    { id: "jungle", name: "Dschungel", color: "#006400", movementCost: 3, defenseBonus: 1, goldBonus: 0, icon: "🌴" },
    { id: "ice", name: "Eis", color: "#B0E0E6", movementCost: 2, defenseBonus: 0, goldBonus: 0, icon: "🧊" },
    { id: "crater", name: "Krater", color: "#2F4F4F", movementCost: 3, defenseBonus: 2, goldBonus: 1, icon: "🕳️" }
];

// ========================================
// GEBÄUDE DEFINITIONEN
// ========================================

window.BUILDING_TYPES = [
    { id: "city", name: "Stadt", hp: 100, goldIncome: 20, canTrain: true, icon: "🏘️", color: "#FFD700" },
    { id: "castle", name: "Burg", hp: 150, goldIncome: 15, canTrain: true, defensiveBonus: 3, icon: "🏰", color: "#8B4513" },
    { id: "tower", name: "Turm", hp: 80, goldIncome: 5, attackRange: 3, attack: 10, icon: "🗼", color: "#708090" },
    { id: "village", name: "Dorf", hp: 50, goldIncome: 10, canTrain: false, icon: "🏘️", color: "#DEB887" },
    { id: "mine", name: "Mine", hp: 60, goldIncome: 25, canTrain: false, icon: "⛏️", color: "#A0522D" },
    { id: "farm", name: "Farm", hp: 40, goldIncome: 8, healingBonus: 5, icon: "🚜", color: "#90EE90" },
    { id: "port", name: "Hafen", hp: 80, goldIncome: 15, canTrain: true, navalBonus: true, icon: "⚓", color: "#4169E1" },
    { id: "temple", name: "Tempel", hp: 70, goldIncome: 5, holyBonus: 2, healingBonus: 10, icon: "⛪", color: "#FFD700" }
];

// ========================================
// UTILITY FUNKTIONEN
// ========================================

// Hilfsfunktionen für Rassenboni
function applyRaceBonus(baseValue, bonusType, race) {
    if (!race || !race.bonuses || !race.bonuses[bonusType]) {
        return baseValue;
    }
    return Math.floor(baseValue * race.bonuses[bonusType]);
}

// Hol alle Einheiten einer Rasse
function getRaceUnits(raceId) {
    const race = window.FALLBACK_RACES.find(r => r.id === raceId);
    return race ? race.units : [];
}

// Berechne Bewegungskosten basierend auf Terrain und Einheitentyp
function calculateMovementCost(unit, terrain) {
    let cost = terrain.movementCost || 1;
    
    // Fliegende Einheiten ignorieren Terrain
    if (unit.flying) {
        cost = 1;
    }
    
    // Rassen-spezifische Terrain-Boni
    const race = window.FALLBACK_RACES.find(r => r.units.some(u => u.id === unit.id));
    if (race && race.preferredTerrain && race.preferredTerrain.includes(terrain.id)) {
        cost = Math.max(1, cost - 1);
    }
    
    return cost;
}

// Berechne Kampfschaden
function calculateCombatDamage(attacker, defender, terrain) {
    let damage = attacker.attack;
    
    // Terrain-Verteidigungsbonus
    const defenseBonus = terrain?.defenseBonus || 0;
    const totalDefense = defender.defense + defenseBonus;
    
    // Schaden berechnen (mindestens 1)
    damage = Math.max(1, damage - totalDefense);
    
    return {
        damage: damage,
        terrainBonus: terrain?.defenseBonus || 0
    };
}

// Generiere Startposition für Rasse
function generateRaceStartingPosition(raceId, mapSize, playerIndex, totalPlayers) {
    const race = window.FALLBACK_RACES.find(r => r.id === raceId);
    if (!race) return { x: 5, y: 5 };
    
    // Berechne Position basierend auf Spielerindex
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
// GLOBAL EXPORTS
// ========================================

// Mache Rassen global verfügbar
window.LOADED_RACES = window.FALLBACK_RACES;

// Export utility functions
window.RaceUtils = {
    applyRaceBonus,
    getRaceUnits,
    calculateMovementCost,
    calculateCombatDamage,
    generateRaceStartingPosition
};

console.log('✅ Vollständiges Race System geladen');
console.log(`📊 ${window.FALLBACK_RACES.length} Rassen mit insgesamt ${window.FALLBACK_RACES.reduce((sum, race) => sum + race.units.length, 0)} Einheiten verfügbar`);

// Validiere alle Rassen haben die erforderlichen Eigenschaften
window.FALLBACK_RACES.forEach(race => {
    if (race.units.length !== 10) {
        console.warn(`⚠️ Rasse ${race.name} hat ${race.units.length} Einheiten statt 10`);
    }
});