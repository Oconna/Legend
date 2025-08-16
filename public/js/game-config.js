// game-config.js - Zentrale Spielkonfiguration

console.log('⚙️ Lade Spiel-Konfiguration...');

// ========================================
// HAUPTKONFIGURATION
// ========================================

window.GAME_CONFIG = {
    // Version und Build-Info
    VERSION: '1.0.0',
    BUILD_DATE: '2024-12-20',
    DEBUG_MODE: true,

    // Server-Konfiguration
    SERVER: {
        HOST: window.location.hostname,
        PORT: window.location.port || (window.location.protocol === 'https:' ? 443 : 80),
        RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 2000,
        PING_INTERVAL: 30000,
        TIMEOUT: 10000
    },

    // Spiel-Grundeinstellungen
    GAME: {
        MIN_PLAYERS: 2,
        MAX_PLAYERS: 8,
        DEFAULT_MAP_SIZE: 20,
        MIN_MAP_SIZE: 10,
        MAX_MAP_SIZE: 50,
        TURN_TIME_LIMIT: 120, // Sekunden
        MAX_GAME_DURATION: 3600, // Sekunden (1 Stunde)
        AUTO_SAVE_INTERVAL: 60 // Sekunden
    },

    // Spieler-Einstellungen
    PLAYER: {
        DEFAULT_STARTING_GOLD: 100,
        MAX_UNITS_PER_PLAYER: 50,
        MAX_BUILDINGS_PER_PLAYER: 20,
        GOLD_INCOME_MULTIPLIER: 1.0,
        EXPERIENCE_MULTIPLIER: 1.0
    },

    // Karten-Konfiguration
    MAP: {
        TILE_SIZE: 32,
        MIN_ZOOM: 0.5,
        MAX_ZOOM: 3.0,
        DEFAULT_ZOOM: 1.0,
        PAN_SPEED: 20,
        ZOOM_SENSITIVITY: 0.1,
        BUILDING_DENSITY: 0.02, // 2% der Felder haben Gebäude
        RESOURCE_DENSITY: 0.05  // 5% der Felder haben Ressourcen
    },

    // UI-Konfiguration
    UI: {
        ANIMATION_DURATION: 300,
        FADE_DURATION: 200,
        NOTIFICATION_DURATION: 3000,
        TOOLTIP_DELAY: 500,
        SCROLL_SPEED: 3,
        DOUBLE_CLICK_TIME: 300
    },

    // Kampf-System
    COMBAT: {
        BASE_DAMAGE: 10,
        CRITICAL_HIT_CHANCE: 0.1,
        CRITICAL_HIT_MULTIPLIER: 1.5,
        TERRAIN_DEFENSE_MULTIPLIER: 1.0,
        EXPERIENCE_PER_KILL: 10,
        HEALING_PER_TURN: 5
    },

    // Einheiten-Konfiguration
    UNITS: {
        MAX_LEVEL: 10,
        UPGRADE_COST_MULTIPLIER: 1.5,
        MOVEMENT_COST_MULTIPLIER: 1.0,
        ATTACK_RANGE_MULTIPLIER: 1.0,
        HEALTH_REGENERATION: 5 // HP pro Runde
    },

    // Gebäude-Konfiguration
    BUILDINGS: {
        REPAIR_COST_MULTIPLIER: 0.5,
        PRODUCTION_MULTIPLIER: 1.0,
        DEFENSE_BONUS_MULTIPLIER: 1.0,
        BUILD_TIME_MULTIPLIER: 1.0
    },

    // Audio-Konfiguration
    AUDIO: {
        MASTER_VOLUME: 0.7,
        MUSIC_VOLUME: 0.5,
        EFFECTS_VOLUME: 0.8,
        UI_VOLUME: 0.6,
        MUTE_ON_FOCUS_LOSS: true
    },

    // Grafik-Einstellungen
    GRAPHICS: {
        SHOW_GRID: true,
        SHOW_COORDINATES: false,
        SHOW_FPS: false,
        SHOW_TERRAIN_NAMES: true,
        PARTICLE_EFFECTS: true,
        SHADOW_QUALITY: 'medium', // 'low', 'medium', 'high'
        TEXTURE_QUALITY: 'high'
    },

    // Performance-Einstellungen
    PERFORMANCE: {
        MAX_FPS: 60,
        VSYNC: true,
        CULL_DISTANCE: 100,
        LOD_DISTANCE: 50,
        PARTICLE_LIMIT: 1000,
        EFFECT_QUALITY: 'high'
    },

    // Netzwerk-Einstellungen
    NETWORK: {
        MAX_PACKET_SIZE: 1024,
        COMPRESSION: true,
        BANDWIDTH_LIMIT: 1000, // KB/s
        LATENCY_COMPENSATION: true,
        PREDICTION: true
    },

    // Balancing-Parameter
    BALANCE: {
        ECONOMY_MULTIPLIER: 1.0,
        COMBAT_MULTIPLIER: 1.0,
        MOVEMENT_MULTIPLIER: 1.0,
        BUILDING_MULTIPLIER: 1.0,
        RESEARCH_MULTIPLIER: 1.0
    }
};

// ========================================
// RASSEN-SPEZIFISCHE KONFIGURATION
// ========================================

window.RACE_CONFIG = {
    // Bonus-Typen
    BONUS_TYPES: {
        ATTACK_POWER: 'attackPower',
        DEFENSE_POWER: 'defensePower',
        MOVEMENT_SPEED: 'movementSpeed',
        GOLD_INCOME: 'goldIncome',
        UNIT_COST: 'unitCost',
        BUILD_SPEED: 'buildSpeed',
        MAGIC_POWER: 'magicPower',
        RANGE_BONUS: 'rangeBonus',
        TERRAIN_BONUS: 'terrainBonus'
    },

    // Standard-Boni (falls nicht definiert)
    DEFAULT_BONUSES: {
        attackPower: 1.0,
        defensePower: 1.0,
        movementSpeed: 1.0,
        goldIncome: 1.0,
        unitCost: 1.0,
        buildSpeed: 1.0
    },

    // Maximale Boni (Balancing)
    MAX_BONUSES: {
        attackPower: 2.0,
        defensePower: 2.0,
        movementSpeed: 2.0,
        goldIncome: 2.0,
        unitCost: 0.5, // Minimum 50% Kosten
        buildSpeed: 2.0
    }
};

// ========================================
// TERRAIN-KONFIGURATION
// ========================================

window.TERRAIN_CONFIG = {
    // Standard-Terrain-Eigenschaften
    DEFAULT_PROPERTIES: {
        movementCost: 1,
        defenseBonus: 0,
        goldBonus: 0,
        buildable: true,
        passable: true
    },

    // Bewegungskosten-Modifikatoren
    MOVEMENT_MODIFIERS: {
        infantry: 1.0,
        cavalry: 1.2,
        flying: 0.5,
        naval: 2.0,
        siege: 1.5
    },

    // Sichtweiten-Modifikatoren
    VISION_MODIFIERS: {
        forest: 0.5,
        mountains: 1.5,
        hills: 1.2,
        plains: 1.0,
        water: 0.8
    }
};

// ========================================
// EINHEITEN-TYPEN KONFIGURATION
// ========================================

window.UNIT_CONFIG = {
    // Basis-Einheitentypen
    UNIT_TYPES: {
        INFANTRY: 'infantry',
        CAVALRY: 'cavalry',
        ARCHER: 'archer',
        SIEGE: 'siege',
        FLYING: 'flying',
        NAVAL: 'naval',
        MAGIC: 'magic',
        HERO: 'hero'
    },

    // Standard-Eigenschaften nach Typ
    TYPE_DEFAULTS: {
        infantry: {
            movement: 2,
            range: 1,
            hp: 30,
            cost: 25
        },
        cavalry: {
            movement: 4,
            range: 1,
            hp: 35,
            cost: 45
        },
        archer: {
            movement: 2,
            range: 3,
            hp: 20,
            cost: 30
        },
        siege: {
            movement: 1,
            range: 4,
            hp: 40,
            cost: 80
        },
        flying: {
            movement: 6,
            range: 2,
            hp: 25,
            cost: 60
        }
    },

    // Upgrade-Kosten pro Level
    UPGRADE_COSTS: [0, 25, 50, 100, 200, 400, 800, 1600, 3200, 6400],

    // Erfahrungs-Schwellen
    EXPERIENCE_THRESHOLDS: [0, 10, 25, 50, 100, 200, 400, 800, 1600, 3200]
};

// ========================================
// GEBÄUDE-KONFIGURATION
// ========================================

window.BUILDING_CONFIG = {
    // Gebäude-Kategorien
    CATEGORIES: {
        ECONOMIC: 'economic',
        MILITARY: 'military',
        DEFENSIVE: 'defensive',
        SPECIAL: 'special'
    },

    // Standard-Eigenschaften
    DEFAULT_PROPERTIES: {
        hp: 100,
        goldIncome: 0,
        canTrain: false,
        defensiveBonus: 0,
        buildCost: 50,
        buildTime: 3,
        repairCost: 25
    },

    // Upgrade-Kosten für Gebäude
    UPGRADE_COSTS: {
        level1: 100,
        level2: 200,
        level3: 400,
        level4: 800,
        level5: 1600
    }
};

// ========================================
// SPIEL-PHASEN KONFIGURATION
// ========================================

window.PHASE_CONFIG = {
    // Verfügbare Spielphasen
    PHASES: {
        LOBBY: 'lobby',
        PREPARATION: 'preparation',
        RACE_SELECTION: 'race_selection',
        MAP_GENERATION: 'map_generation',
        DEPLOYMENT: 'deployment',
        PLAYING: 'playing',
        PAUSED: 'paused',
        FINISHED: 'finished'
    },

    // Phase-spezifische Timeouts
    TIMEOUTS: {
        preparation: 60,
        race_selection: 120,
        deployment: 180,
        turn: 120
    },

    // Erlaubte Übergänge zwischen Phasen
    TRANSITIONS: {
        lobby: ['preparation', 'race_selection'],
        preparation: ['race_selection', 'lobby'],
        race_selection: ['map_generation', 'lobby'],
        map_generation: ['deployment'],
        deployment: ['playing'],
        playing: ['paused', 'finished'],
        paused: ['playing', 'finished'],
        finished: []
    }
};

// ========================================
// TURN-SYSTEM KONFIGURATION
// ========================================

window.TURN_CONFIG = {
    // Turn-Modi
    TURN_MODES: {
        SEQUENTIAL: 'sequential',
        SIMULTANEOUS: 'simultaneous',
        REAL_TIME: 'real_time'
    },

    // Standard Turn-Einstellungen
    DEFAULT_SETTINGS: {
        mode: 'sequential',
        timeLimit: 120,
        autoEnd: true,
        skipInactive: true,
        allowUndo: false
    },

    // Turn-Aktionen
    ACTIONS: {
        MOVE_UNIT: 'move_unit',
        ATTACK_UNIT: 'attack_unit',
        BUILD_UNIT: 'build_unit',
        BUILD_BUILDING: 'build_building',
        UPGRADE_UNIT: 'upgrade_unit',
        UPGRADE_BUILDING: 'upgrade_building',
        END_TURN: 'end_turn'
    },

    // Aktions-Kosten (Action Points)
    ACTION_COSTS: {
        move_unit: 1,
        attack_unit: 2,
        build_unit: 1,
        build_building: 3,
        upgrade_unit: 2,
        upgrade_building: 3
    }
};

// ========================================
// EVENT-SYSTEM KONFIGURATION
// ========================================

window.EVENT_CONFIG = {
    // Event-Typen
    TYPES: {
        GAME_START: 'game_start',
        GAME_END: 'game_end',
        TURN_START: 'turn_start',
        TURN_END: 'turn_end',
        UNIT_MOVED: 'unit_moved',
        UNIT_ATTACKED: 'unit_attacked',
        UNIT_KILLED: 'unit_killed',
        BUILDING_BUILT: 'building_built',
        BUILDING_DESTROYED: 'building_destroyed',
        PLAYER_ELIMINATED: 'player_eliminated',
        VICTORY: 'victory'
    },

    // Event-Prioritäten
    PRIORITIES: {
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1
    },

    // Event-Handler Timeouts
    TIMEOUTS: {
        immediate: 0,
        short: 100,
        medium: 500,
        long: 1000
    }
};

// ========================================
// VALIDATION-REGELN
// ========================================

window.VALIDATION_CONFIG = {
    // Spielername-Validation
    PLAYER_NAME: {
        minLength: 2,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9\s_-]+$/,
        forbiddenWords: ['admin', 'moderator', 'system', 'bot']
    },

    // Spielname-Validation
    GAME_NAME: {
        minLength: 3,
        maxLength: 30,
        pattern: /^[a-zA-Z0-9\s_-]+$/,
        forbiddenWords: ['test', 'debug', 'admin']
    },

    // Chat-Nachrichten
    CHAT_MESSAGE: {
        minLength: 1,
        maxLength: 200,
        cooldown: 1000, // ms zwischen Nachrichten
        maxPerMinute: 20
    }
};

// ========================================
// ACHIEVEMENTS/ERFOLGE KONFIGURATION
// ========================================

window.ACHIEVEMENT_CONFIG = {
    // Achievement-Kategorien
    CATEGORIES: {
        COMBAT: 'combat',
        ECONOMY: 'economy',
        EXPLORATION: 'exploration',
        STRATEGY: 'strategy',
        SOCIAL: 'social'
    },

    // Achievement-Schwierigkeitsgrade
    DIFFICULTIES: {
        BRONZE: { points: 10, color: '#CD7F32' },
        SILVER: { points: 25, color: '#C0C0C0' },
        GOLD: { points: 50, color: '#FFD700' },
        PLATINUM: { points: 100, color: '#E5E4E2' }
    }
};

// ========================================
// LOKALISIERUNG/I18N KONFIGURATION
// ========================================

window.I18N_CONFIG = {
    // Verfügbare Sprachen
    LANGUAGES: {
        'de': 'Deutsch',
        'en': 'English',
        'fr': 'Français',
        'es': 'Español',
        'it': 'Italiano'
    },

    // Standard-Sprache
    DEFAULT_LANGUAGE: 'de',

    // Fallback-Sprache
    FALLBACK_LANGUAGE: 'en',

    // Datumsformate
    DATE_FORMATS: {
        'de': 'DD.MM.YYYY HH:mm',
        'en': 'MM/DD/YYYY HH:mm',
        'fr': 'DD/MM/YYYY HH:mm'
    }
};

// ========================================
// ANALYTICS/TRACKING KONFIGURATION
// ========================================

window.ANALYTICS_CONFIG = {
    // Tracking aktiviert
    ENABLED: false,

    // Events die getrackt werden sollen
    TRACK_EVENTS: {
        GAME_START: true,
        GAME_END: true,
        PLAYER_ACTION: false,
        ERROR: true,
        PERFORMANCE: false
    },

    // Session-Tracking
    SESSION: {
        timeout: 1800000, // 30 Minuten
        trackDuration: true,
        trackActions: true
    }
};

// ========================================
// SICHERHEITS-KONFIGURATION
// ========================================

window.SECURITY_CONFIG = {
    // Rate Limiting
    RATE_LIMITS: {
        ACTIONS_PER_SECOND: 10,
        MESSAGES_PER_MINUTE: 20,
        GAMES_PER_HOUR: 5
    },

    // Anti-Cheat
    ANTI_CHEAT: {
        VALIDATE_MOVES: true,
        CHECK_TIMING: true,
        LOG_SUSPICIOUS: true,
        AUTO_BAN: false
    },

    // Input Sanitization
    SANITIZATION: {
        STRIP_HTML: true,
        FILTER_PROFANITY: false,
        MAX_INPUT_LENGTH: 1000
    }
};

// ========================================
// HILFSFUNKTIONEN FÜR KONFIGURATION
// ========================================

const ConfigUtils = {
    // Hole Konfigurationswert mit Fallback
    get(path, fallback = null) {
        const keys = path.split('.');
        let current = window.GAME_CONFIG;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return fallback;
            }
        }
        
        return current;
    },

    // Setze Konfigurationswert
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = window.GAME_CONFIG;
        
        for (const key of keys) {
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    },

    // Validiere Konfiguration
    validate() {
        const errors = [];
        
        // Überprüfe kritische Werte
        if (!this.get('GAME.MIN_PLAYERS') || this.get('GAME.MIN_PLAYERS') < 2) {
            errors.push('MIN_PLAYERS muss mindestens 2 sein');
        }
        
        if (!this.get('GAME.MAX_PLAYERS') || this.get('GAME.MAX_PLAYERS') > 8) {
            errors.push('MAX_PLAYERS darf maximal 8 sein');
        }
        
        if (this.get('GAME.MIN_PLAYERS') > this.get('GAME.MAX_PLAYERS')) {
            errors.push('MIN_PLAYERS darf nicht größer als MAX_PLAYERS sein');
        }
        
        return errors;
    },

    // Debug-Ausgabe der Konfiguration
    debug() {
        console.group('🔧 Spiel-Konfiguration');
        console.log('Version:', this.get('VERSION'));
        console.log('Debug Mode:', this.get('DEBUG_MODE'));
        console.log('Server Config:', this.get('SERVER'));
        console.log('Game Config:', this.get('GAME'));
        console.log('Map Config:', this.get('MAP'));
        console.groupEnd();
    },

    // Exportiere Konfiguration als JSON
    export() {
        return JSON.stringify(window.GAME_CONFIG, null, 2);
    },

    // Importiere Konfiguration aus JSON
    import(jsonString) {
        try {
            const config = JSON.parse(jsonString);
            Object.assign(window.GAME_CONFIG, config);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Importieren der Konfiguration:', error);
            return false;
        }
    }
};

// ========================================
// UMGEBUNGS-SPEZIFISCHE KONFIGURATION
// ========================================

// Entwicklungsumgebung
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.GAME_CONFIG.DEBUG_MODE = true;
    window.GAME_CONFIG.GRAPHICS.SHOW_FPS = true;
    window.GAME_CONFIG.GRAPHICS.SHOW_COORDINATES = true;
    window.GAME_CONFIG.ANALYTICS_CONFIG.ENABLED = false;
    console.log('🔧 Entwicklungsmodus aktiviert');
}

// Produktionsumgebung
if (window.location.protocol === 'https:') {
    window.GAME_CONFIG.DEBUG_MODE = false;
    window.GAME_CONFIG.GRAPHICS.SHOW_FPS = false;
    window.GAME_CONFIG.GRAPHICS.SHOW_COORDINATES = false;
    window.GAME_CONFIG.ANALYTICS_CONFIG.ENABLED = true;
}

// Mobile Geräte
if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    window.GAME_CONFIG.GRAPHICS.PARTICLE_EFFECTS = false;
    window.GAME_CONFIG.GRAPHICS.SHADOW_QUALITY = 'low';
    window.GAME_CONFIG.PERFORMANCE.MAX_FPS = 30;
    window.GAME_CONFIG.UI.TOUCH_CONTROLS = true;
    console.log('📱 Mobile Optimierungen aktiviert');
}

// ========================================
// GLOBAL EXPORTS
// ========================================

// Mache ConfigUtils global verfügbar
window.ConfigUtils = ConfigUtils;

// Validiere Konfiguration beim Laden
const configErrors = ConfigUtils.validate();
if (configErrors.length > 0) {
    console.error('❌ Konfigurationsfehler:', configErrors);
} else {
    console.log('✅ Konfiguration erfolgreich validiert');
}

// Debug-Ausgabe in Entwicklungsumgebung
if (window.GAME_CONFIG.DEBUG_MODE) {
    ConfigUtils.debug();
}

console.log('✅ Spiel-Konfiguration geladen');
console.log('🔧 Verwende ConfigUtils.get("path") zum Abrufen von Werten');
console.log('🔧 Verwende ConfigUtils.debug() für Debug-Informationen');