// File: game-main.js
// Zweck: Orchestriert den Spielfluss (Lobby → Rassenauswahl → Match → Rundenablauf)
// Sprache: Deutsch (Kommentare & UI-Texte)

// ─────────────────────────────────────────────────────────────────────────────
// Annahmen zu vorhandenen Modulen (bitte bei Bedarf anpassen):
// socket-manager.js:
//   export function connect(opts?): Socket
//   export function on(event, handler): void
//   export function emit(event, payload?): void
//   export function id(): string
//
// game-state.js:
//   export function createInitialState({ map, players, config, races }): GameState
//   export function currentPlayer(state): Player
//   export function endTurn(state): GameState
//   export function addStartOfTurnIncome(state): GameState
//   export function canMove(state, from, to): boolean
//   export function moveUnit(state, from, to): GameState
//   export function canAttack(state, from, to): boolean
//   export function attack(state, from, to): GameState
//   export function validMoves(state, from): Array<TilePos>
//   export function isDefeated(state, playerId): boolean
//   export function selectRace(state, playerId, raceId): GameState
//
// map-system.js:
//   export function generateMap({width, height, terrainSeed?, terrainDefs?}): MapData
//   export function mount(containerEl): MapRenderer
//   // MapRenderer API:
//   //   render(state): void
//   //   highlight(tiles: TilePos[], style?): void
//   //   clearHighlights(): void
//   //   onTileClick(cb: (pos: {q,r}) => void): void
//
// race-selection.js:
//   export function openRaceSelection({ races, onSelect, onReadyToggle }): void
//   export function closeRaceSelection(): void
//   export function renderLobbyReady({ players, onReadyToggle }): void
//
// game-config.js:
//   export const CONFIG = { MAP_WIDTH, MAP_HEIGHT, GOLD_PER_CITY, MAX_PLAYERS, MIN_PLAYERS, TURN_SECONDS, ... }
//
// races.js oder races-data.json:
//   export const RACES = [{ id: 'humans', name: 'Menschen', units: [...] }, ...]  // 15+ Rassen
// ─────────────────────────────────────────────────────────────────────────────

import * as Socket from './socket-manager.js';
import * as GameState from './game-state.js';
import * as MapSystem from './map-system.js';
import { openRaceSelection, closeRaceSelection, renderLobbyReady } from './race-selection.js';
import { CONFIG } from './game-config.js';
import { RACES } from './races.js'; // oder: import racesData from './races-data.json' assert { type: 'json' };

(function main() {
  // ───────────────────────────────────────────────────────────────────────────
  // DOM-Referenzen (passe IDs/Klassen an deine index.html/game.html an)
  const els = {
    screenLobby: byId('screen-lobby'),
    screenGame: byId('screen-game'),
    listPlayers: byId('lobby-players'),
    btnInvite: byId('btn-invite'),
    btnReady: byId('btn-ready'),
    btnStart: byId('btn-start'),
    statusText: byId('status-text'),
    mapContainer: byId('map-root'),
    turnInfo: byId('turn-info'),
    btnEndTurn: byId('btn-end-turn'),
    sidebar: byId('sidebar'),
    toast: byId('toast'),
    timer: byId('turn-timer'),
  };

  // State im Frontend
  const client = {
    socketConnected: false,
    playerId: null,
    lobby: {
      gameId: null,
      players: [], // { id, name, ready: bool, raceId?: string }
      hostId: null,
      allReady: false,
      min: CONFIG.MIN_PLAYERS ?? 2,
      max: CONFIG.MAX_PLAYERS ?? 8,
    },
    ui: {
      selectedTile: null,
      highlighted: [],
      actionMode: 'select', // 'move' | 'attack' | 'select'
      turnEndsAt: null, // Date
      timerInterval: null,
    },
    game: {
      running: false,
      state: null,  // authoritative (vom Server gespiegelt)
      races: RACES,
      config: CONFIG,
      mapRenderer: null,
    },
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Socket-Verbindung & Events
  const socket = Socket.connect?.() ?? null;
  if (!socket) {
    console.error('[game-main] Konnte Socket nicht verbinden. Prüfe socket-manager.js');
  }

  client.playerId = Socket.id?.() ?? null;

  Socket.on('connect', () => {
    client.socketConnected = true;
    client.playerId = Socket.id?.();
    logUI('Verbunden. Spieler-ID: ' + client.playerId);
    // Tritt automatisch der Lobby bei oder fordere Spielbeitritt an
    Socket.emit('lobby:join', {});
  });

  Socket.on('disconnect', () => {
    client.socketConnected = false;
    warnUI('Verbindung getrennt. Versuche, erneut zu verbinden …');
  });

  // Lobby-Updates
  Socket.on('lobby:update', (payload) => {
    // payload: { gameId, players, hostId }
    client.lobby.gameId = payload.gameId;
    client.lobby.players = payload.players;
    client.lobby.hostId = payload.hostId;
    client.lobby.allReady = payload.players.length >= client.lobby.min && payload.players.every(p => p.ready);
    renderLobby();
  });

  // Server bestätigt Start → erzeuge Map & Initialzustand (oder empfange Seed/Zustand)
  Socket.on('game:start', (payload) => {
    // payload: { mapSeed?, map?, players, config, playerOrder?, initialState? }
    showScreen('game');
    client.game.running = true;

    const mapData = payload.map ?? MapSystem.generateMap({
      width: payload.config?.MAP_WIDTH ?? CONFIG.MAP_WIDTH ?? 20,
      height: payload.config?.MAP_HEIGHT ?? CONFIG.MAP_HEIGHT ?? 20,
      terrainSeed: payload.mapSeed ?? undefined,
      terrainDefs: payload.terrainDefs ?? undefined,
    });

    const initialState = payload.initialState ?? GameState.createInitialState({
      map: mapData,
      players: payload.players,
      races: client.game.races,
      config: { ...CONFIG, ...payload.config },
    });

    // Map Renderer initialisieren
    client.game.mapRenderer = MapSystem.mount(els.mapContainer);
    client.game.state = initialState;

    wireMapInteractions();
    fullRender();

    // Rundenstart (Timer, Einkommen, etc.)
    handleStartOfTurn();
  });

  // Autoritative Zustands-Updates (Server → Client)
  Socket.on('state:update', (newState) => {
    client.game.state = newState;
    fullRender();
  });

  // Timer Sync (optional, falls Server Takt vorgibt)
  Socket.on('turn:sync', ({ endsAt }) => {
    client.ui.turnEndsAt = endsAt ? new Date(endsAt) : null;
    startTurnTimer();
  });

  // Fehler/Toast aus dem Server
  Socket.on('notify', ({ type = 'info', message = '' }) => {
    toast(message, type);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Lobby-UI & Rassenauswahl

  function renderLobby() {
    if (!els.screenLobby) return;
    showScreen('lobby');

    const isHost = client.lobby.hostId === client.playerId;
    const { players, min, max, allReady } = client.lobby;

    // Liste rendern
    if (els.listPlayers) {
      els.listPlayers.innerHTML = players.map(p => `
        <li class="player ${p.ready ? 'ready' : ''}">
          <span>${escapeHtml(p.name ?? ('Spieler ' + shortId(p.id)))}</span>
          <span>${p.ready ? 'Bereit' : 'Nicht bereit'}</span>
          <span>${p.raceId ? `Rasse: ${escapeHtml(p.raceId)}` : ''}</span>
        </li>
      `).join('');
    }

    // Ready/Lobby-Steuerung
    if (els.btnReady) {
      els.btnReady.disabled = false;
      els.btnReady.onclick = () => {
        const me = players.find(p => p.id === client.playerId);
        const newReady = !me?.ready;
        Socket.emit('lobby:ready', { ready: newReady });

        // Rassenauswahl aufklappen, wenn auf "bereit" schalten und noch keine Rasse
        const hasRace = !!me?.raceId;
        if (newReady && !hasRace) {
          openRaceSelection({
            races: client.game.races,
            onSelect: (raceId) => {
              Socket.emit('race:select', { raceId });
              // Frontend kann optional gleich darstellen:
              // client.game.state = GameState.selectRace(client.game.state, client.playerId, raceId);
              closeRaceSelection();
            },
            onReadyToggle: (ready) => Socket.emit('lobby:ready', { ready }),
          });
        }
      };
    }

    if (els.btnStart) {
      els.btnStart.disabled = !(isHost && allReady && players.length >= min && players.length <= max);
      els.btnStart.onclick = () => {
        // Host initiiert Start (Server prüft nochmals)
        Socket.emit('game:request-start', {
          config: client.game.config,
        });
      };
    }

    // Zeige „Bereit“-Panel erneut, wenn nötig (z. B. Rasse ändern)
    renderLobbyReady({
      players,
      onReadyToggle: (ready) => Socket.emit('lobby:ready', { ready }),
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Map-Interaktion & Aktionen

  function wireMapInteractions() {
    const renderer = client.game.mapRenderer;
    if (!renderer) return;

    renderer.onTileClick((pos) => {
      const state = client.game.state;
      const myId = client.playerId;
      const current = GameState.currentPlayer(state);

      // Nur in meinem Zug interagieren
      if (!current || current.id !== myId) {
        infoUI('Nicht dein Zug.');
        return;
      }

      // Auswahl-/Aktion-Logik
      const selected = client.ui.selectedTile;

      // Falls noch nichts ausgewählt → wähle Startfeld
      if (!selected) {
        client.ui.selectedTile = pos;
        const moves = safe(() => GameState.validMoves(state, pos), []);
        renderer.clearHighlights();
        renderer.highlight(moves, { type: 'moves' });
        return;
      }

      // Wenn bereits ausgewählt → versuche Move/Attack
      if (client.ui.actionMode === 'select') {
        // Heuristik: Wenn Zielfeld gegnerische Einheit → Attack, sonst Move
        tryAction(selected, pos);
      } else if (client.ui.actionMode === 'move') {
        tryMove(selected, pos);
      } else if (client.ui.actionMode === 'attack') {
        tryAttack(selected, pos);
      }
    });
  }

  function tryAction(from, to) {
    // Diese Routine versucht Move → wenn nicht möglich, Attack
    if (GameState.canMove(client.game.state, from, to)) {
      tryMove(from, to);
    } else if (GameState.canAttack(client.game.state, from, to)) {
      tryAttack(from, to);
    } else {
      infoUI('Ungültige Aktion.');
    }
  }

  function tryMove(from, to) {
    if (!GameState.canMove(client.game.state, from, to)) {
      infoUI('Bewegung nicht möglich.');
      return;
    }
    // Lokal optimistisch anwenden (optional) …
    const optimistic = GameState.moveUnit(client.game.state, from, to);
    client.game.state = optimistic;
    fullRender();
    // … und an Server senden
    Socket.emit('action:move', { from, to });
    // Server antwortet per state:update autoritativ
    client.ui.selectedTile = to;
  }

  function tryAttack(from, to) {
    if (!GameState.canAttack(client.game.state, from, to)) {
      infoUI('Angriff nicht möglich.');
      return;
    }
    const optimistic = GameState.attack(client.game.state, from, to);
    client.game.state = optimistic;
    fullRender();
    Socket.emit('action:attack', { from, to });
    client.ui.selectedTile = to; // ggf. Einheit steht nach Kampf dort (falls Gegner besiegt)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rundenlogik

  function handleStartOfTurn() {
    // Einkommen
    client.game.state = GameState.addStartOfTurnIncome(client.game.state);

    // Turn-Timer
    if (CONFIG.TURN_SECONDS) {
      const endsAt = new Date(Date.now() + CONFIG.TURN_SECONDS * 1000);
      client.ui.turnEndsAt = endsAt;
      Socket.emit('turn:local-started', { endsAt }); // optional
      startTurnTimer();
    }

    // Sieg/Niederlage prüfen
    const me = client.playerId;
    if (GameState.isDefeated(client.game.state, me)) {
      toast('Du hast keine Städte/Burgen mehr. Du bist ausgeschieden.', 'warn');
      Socket.emit('player:defeated', { playerId: me });
    }

    fullRender();
  }

  function endMyTurn() {
    const current = GameState.currentPlayer(client.game.state);
    if (!current || current.id !== client.playerId) {
      infoUI('Nicht dein Zug.');
      return;
    }
    // Lokal vorwegnehmen (optional)
    client.game.state = GameState.endTurn(client.game.state);
    fullRender();
    stopTurnTimer();

    // Server informieren (server validiert Reihenfolge)
    Socket.emit('turn:end', {});
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rendering

  function fullRender() {
    renderHud();
    if (client.game.mapRenderer) {
      client.game.mapRenderer.render(client.game.state);
    }
  }

  function renderHud() {
    const state = client.game.state;
    if (!state) return;

    const current = GameState.currentPlayer(state);
    const myTurn = current && current.id === client.playerId;

    if (els.turnInfo) {
      els.turnInfo.textContent = myTurn
        ? `Dein Zug – Spieler: ${displayPlayer(current)}`
        : `Am Zug: ${displayPlayer(current)}`;
    }

    if (els.btnEndTurn) {
      els.btnEndTurn.disabled = !myTurn;
      els.btnEndTurn.onclick = () => endMyTurn();
    }

    if (els.sidebar) {
      // Beispiel: zeige Gold, Städte, Rundenanzahl, etc. – passe an deine State-Struktur an
      const me = (state.players ?? []).find(p => p.id === client.playerId);
      const gold = me?.gold ?? 0;
      const cities = me?.cities?.length ?? 0;
      els.sidebar.innerHTML = `
        <div class="panel">
          <div class="row"><strong>Gold:</strong> ${gold}</div>
          <div class="row"><strong>Städte/Burgen:</strong> ${cities}</div>
          <div class="row"><strong>Rasse:</strong> ${escapeHtml(me?.raceId ?? '—')}</div>
        </div>
      `;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Turn-Timer (optional)

  function startTurnTimer() {
    stopTurnTimer();
    if (!els.timer || !client.ui.turnEndsAt) return;

    const tick = () => {
      const ms = client.ui.turnEndsAt - Date.now();
      if (ms <= 0) {
        els.timer.textContent = '00:00';
        stopTurnTimer();
        if (GameState.currentPlayer(client.game.state)?.id === client.playerId) {
          // Auto-Ende, wenn mein Zug abläuft
          endMyTurn();
        }
        return;
      }
      const s = Math.ceil(ms / 1000);
      els.timer.textContent = formatClock(s);
    };
    tick();
    client.ui.timerInterval = setInterval(tick, 250);
  }

  function stopTurnTimer() {
    if (client.ui.timerInterval) {
      clearInterval(client.ui.timerInterval);
      client.ui.timerInterval = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UI-Helfer

  function showScreen(which) {
    if (els.screenLobby) els.screenLobby.style.display = which === 'lobby' ? 'block' : 'none';
    if (els.screenGame) els.screenGame.style.display = which === 'game' ? 'block' : 'none';
  }

  function logUI(msg) {
    if (els.statusText) {
      els.statusText.textContent = msg;
    }
    console.log('[UI]', msg);
  }

  function infoUI(msg) {
    console.info(msg);
    toast(msg, 'info');
  }

  function warnUI(msg) {
    console.warn(msg);
    toast(msg, 'warn');
  }

  function toast(message, type = 'info', ms = 2500) {
    if (!els.toast) {
      console[type === 'warn' ? 'warn' : 'log']('[Toast]', message);
      return;
    }
    els.toast.textContent = message;
    els.toast.className = `toast ${type}`;
    els.toast.style.opacity = '1';
    setTimeout(() => {
      els.toast.style.opacity = '0';
    }, ms);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Events aus Buttons / UI

  if (els.btnInvite) {
    els.btnInvite.onclick = () => {
      // Einfache Invite-UX: Link zur aktuellen Lobby in Zwischenablage kopieren
      const url = new URL(window.location.href);
      if (client.lobby.gameId) url.searchParams.set('game', client.lobby.gameId);
      navigator.clipboard?.writeText(url.toString());
      toast('Lobby-Link kopiert! Sende ihn deinen Freunden.');
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Utilities

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function shortId(id) {
    if (!id) return '—';
    return String(id).slice(0, 4);
  }

  function displayPlayer(p) {
    if (!p) return '—';
    return escapeHtml(p.name ?? ('Spieler ' + shortId(p.id)));
  }

  function formatClock(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function safe(fn, fallback) {
    try { return fn(); } catch { return fallback; }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Debug-Hooks (optional, entferne in Produktion)

  window.__GAME_DEBUG__ = {
    get state() { return client.game.state; },
    forceRender: fullRender,
    endTurn: endMyTurn,
  };
})();
