// game-config.js – Globale Spielkonfiguration & Fallback-Daten (safe globals)

(function () {
  // ───────────────────────────────────────────────────────────────────────────
  // Hilfsfunktion: nur setzen, wenn noch nicht vorhanden
  function defineIfMissing(key, valueFactory) {
    if (window[key] === undefined || window[key] === null) {
      window[key] = valueFactory();
    }
    return window[key];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Phasen / Notification-Typen (werden nur gesetzt, wenn fehlen)
  defineIfMissing('GAME_PHASES', () => ({
    LOBBY: 'lobby',
    RACE_SELECTION: 'race_selection',
    PLAYING: 'playing',
    FINISHED: 'finished'
  }));

  defineIfMissing('NOTIFICATION_TYPES', () => ({
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
  }));

  // ───────────────────────────────────────────────────────────────────────────
  // Zentrale Konfiguration
  defineIfMissing('GAME_CONFIG', () => ({
    // Turn System
    TURN_TIME_LIMIT: 120,          // Sekunden pro Zug
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
  }));

  // ───────────────────────────────────────────────────────────────────────────
  // Terrain-Definitionen
  defineIfMissing('TERRAIN_DEFINITIONS', () => ({
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
  }));

  // ───────────────────────────────────────────────────────────────────────────
  // Fallback-Rassen (für UI & Auswahl, falls keine JSON geladen wird)
  // Hinweis: Bei Bedarf kannst du diese Liste erweitern; sie ist absichtlich knapp.
  defineIfMissing('FALLBACK_RACES', () => ([
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
        { id: "druid", name: "Druide", icon: "🌿", cost: 40, baseStats: { hp: 32, attack: 12, defense: 8, movement: 2 } },
        { id: "ranger", name: "Waldläufer", icon: "🏕️", cost: 34, baseStats: { hp: 40, attack: 15, defense: 9, movement: 4 } },
        { id: "unicorn", name: "Einhorn", icon: "🦄", cost: 80, baseStats: { hp: 65, attack: 22, defense: 14, movement: 5 } },
        { id: "treant", name: "Baumriese", icon: "🌳", cost: 95, baseStats: { hp: 110, attack: 26, defense: 22, movement: 2 } }
      ]
    }
  ]));

  // ───────────────────────────────────────────────────────────────────────────
  // Debug-Hinweise
  if (window.GAME_CONFIG?.DEBUG_MODE) {
    console.log('📋 GAME_CONFIG geladen:', window.GAME_CONFIG);
    console.log('🌍 TERRAIN_DEFINITIONS:', Object.keys(window.TERRAIN_DEFINITIONS));
    console.log('🏛️ FALLBACK_RACES:', window.FALLBACK_RACES.length);
  }
})();
