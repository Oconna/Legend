<script>
// races.js – Zentrale Race-/Unit-Verwaltung (browser-global, ohne Doppelkonstanten)
console.log('🏛️ Race System Loading...');

// Erwartet: game-config.js wurde vorher geladen und stellt global bereit:
//   - GAME_CONFIG
//   - FALLBACK_RACES
//   - GAME_PHASES
//   - GameUtils, TERRAIN_DEFINITIONS

(function () {
  // -------- UnitDefinition --------
  class UnitDefinition {
    constructor({
      id, name, icon, description, baseStats,
      movementType = 'ground',
      attackRange = 1,
      cost = 10,
      upgradeCost = 10,
      maxLevel = 5,
      abilities = []
    }) {
      this.id = id;
      this.name = name;
      this.icon = icon;
      this.description = description;
      this.baseStats = baseStats;
      this.movementType = movementType; // 'ground' | 'flying' | 'amphibious'
      this.attackRange = attackRange;
      this.cost = cost;
      this.upgradeCost = upgradeCost;
      this.maxLevel = maxLevel;
      this.abilities = abilities;
    }

    getStatsForLevel(level) {
      const m = 1 + ((level - 1) * 0.2);
      return {
        hp: Math.floor(this.baseStats.hp * m),
        attack: Math.floor(this.baseStats.attack * m),
        defense: Math.floor(this.baseStats.defense * m),
        movement: this.baseStats.movement
      };
    }

    getUpgradeCostForLevel(level) {
      if (level >= this.maxLevel) return null;
      return Math.floor(this.upgradeCost * Math.pow(1.5, level - 1));
    }
  }

  // -------- RaceDefinition --------
  class RaceDefinition {
    constructor({
      id, name, icon, description, color,
      specialAbility, units = [],
      startingGold = 100, goldMultiplier = 1.0
    }) {
      this.id = id;
      this.name = name;
      this.icon = icon;
      this.description = description;
      this.color = color;
      this.specialAbility = specialAbility;
      this.units = units; // UnitDefinition[]
      this.startingGold = startingGold;
      this.goldMultiplier = goldMultiplier;
    }

    getUnit(unitId) {
      return this.units.find(u => u.id === unitId);
    }
  }

  // -------- Unit (Instanz zur Laufzeit) --------
  class Unit {
    constructor(definition, ownerId, x, y, level = 1) {
      this.id = 'unit_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
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
      this.level += 1;
      const ratio = this.currentHp / this.currentStats.hp;
      this.currentStats = this.definition.getStatsForLevel(this.level);
      this.currentHp = Math.floor(this.currentStats.hp * ratio);
      return true;
    }

    heal(amount) {
      this.currentHp = Math.min(this.currentStats.hp, this.currentHp + amount);
    }

    takeDamage(dmg) {
      this.currentHp = Math.max(0, this.currentHp - dmg);
      return this.currentHp <= 0;
    }

    isDead() { return this.currentHp <= 0; }

    getMovementCostForTerrain(terrainType) {
      // nutzt GameUtils.getMovementCost aus game-config.js
      return (window.GameUtils?.getMovementCost || (() => 1))(terrainType, this.definition.movementType);
    }

    canAttack(targetX, targetY) {
      if (this.hasActed) return false;
      const d = Math.abs(this.x - targetX) + Math.abs(this.y - targetY);
      return d <= (this.definition.attackRange || 1);
    }

    resetForNewTurn() {
      this.hasMoved = false;
      this.hasActed = false;
      // Status-Effekte ticken
      this.statusEffects = this.statusEffects
        .map(e => ({ ...e, duration: e.duration - 1 }))
        .filter(e => e.duration > 0);
    }
  }

  // -------- RaceDataManager --------
  class RaceDataManager {
    constructor() {
      this.races = new Map();      // id -> RaceDefinition
      this.abilities = new Map();  // optional
      this.isLoaded = false;
      this.loadPromise = null;
      this.dataSource = 'local';
    }

    async load() {
      if (this.loadPromise) return this.loadPromise;
      this.loadPromise = this._load();
      return this.loadPromise;
    }

    async _load() {
      console.log('📂 Lade Rassen...');
      // 1) Externe JSON versuchen
      try {
        const res = await fetch('/races-data.json', { cache: 'no-cache' });
        if (res.ok) {
          const data = await res.json();
          this._process(data);
          this.dataSource = 'json';
          console.log('✅ Rassen aus JSON geladen');
          return;
        }
      } catch (e) {
        console.log('ℹ️ Keine races-data.json gefunden, fallback auf lokale Daten.');
      }

      // 2) Fallback auf in game-config.js definierte FALLBACK_RACES
      if (Array.isArray(window.FALLBACK_RACES)) {
        this._process({ races: window.FALLBACK_RACES });
        this.dataSource = 'fallback';
        console.log('✅ Rassen aus FALLBACK_RACES geladen');
        return;
      }

      // 3) Minimaler Notfall-Fallback
      console.warn('⚠️ Keine Rassendaten verfügbar. Erzeuge Minimal-Fallback.');
      this._process({
        races: [
          {
            id: 'humans',
            name: 'Menschen',
            icon: '👑',
            description: 'Fallback-Rasse',
            color: '#3498db',
            units: [
              { id: 'peasant', name: 'Bauer', icon: '👨‍🌾', baseStats: { hp: 25, attack: 7, defense: 4, movement: 3 }, movementType: 'ground', attackRange: 1, cost: 10, upgradeCost: 8 }
            ],
            startingGold: 100,
            goldMultiplier: 1.0
          }
        ]
      });
      this.dataSource = 'hardcoded-min';
    }

    _process(data) {
      this.races.clear();
      this.abilities.clear();

      if (data.abilities) {
        Object.entries(data.abilities).forEach(([k, v]) => this.abilities.set(k, v));
      }

      (data.races || []).forEach(r => {
        const units = (r.units || []).map(u => new UnitDefinition(u));
        const race = new RaceDefinition({ ...r, units });
        this.races.set(race.id, race);
      });

      this.isLoaded = true;
      console.log(`🏛️ Rassen verarbeitet: ${this.races.size}`);
    }

    getAllRaces() {
      if (!this.isLoaded) return [];
      return Array.from(this.races.values());
    }

    getRace(id) {
      if (!this.isLoaded) return null;
      return this.races.get(id) || null;
    }

    createUnitInstance(raceId, unitId, ownerId, x, y, level = 1) {
      const race = this.getRace(raceId);
      if (!race) return null;
      const def = race.getUnit(unitId);
      if (!def) return null;
      return new Unit(def, ownerId, x, y, level);
    }

    async reload() {
      this.isLoaded = false;
      this.loadPromise = null;
      await this.load();
      if (typeof window !== 'undefined' && window.RaceSystem?.onRaceDataReloaded) {
        window.RaceSystem.onRaceDataReloaded();
      }
    }
  }

  // -------- Singleton & Bootstrap --------
  const manager = new RaceDataManager();

  window.RaceSystem = {
    // Lifecycle
    load: () => manager.load(),
    reload: () => manager.reload(),
    // Query
    getAllRaces: () => manager.getAllRaces(),
    getRace: (id) => manager.getRace(id),
    getAbility: (id) => manager.abilities.get(id),
    createUnitInstance: (...args) => manager.createUnitInstance(...args),
    // Hook für UI
    onRaceDataReloaded: null
  };

  // Automatisch laden (non-blocking)
  manager.load().catch(err => console.error('❌ Fehler beim Laden der Rassen:', err));
})();
</script>
