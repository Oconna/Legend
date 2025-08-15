// game-main.js
// Orchestriert den Spielfluss:
// 1) Spielstart -> Rassenauswahl
// 2) Wenn alle gewählt -> Map generieren
// 3) Zufällige Zugreihenfolge -> Rundenbasiertes Spielen

(() => {
  // ---- Hilfs-Utilities ------------------------------------------------------
  const log = (...a) => console.log("[game-main]", ...a);

  // Robust Socket beziehen
  const socket =
    (window.SocketManager && window.SocketManager.socket) ||
    (window.io && window.io()) ||
    null;

  if (!socket) {
    console.error(
      "[game-main] Kein Socket verfügbar. Stelle sicher, dass socket.io geladen ist oder SocketManager.socket bereit steht."
    );
  }

  // Robust Zugriff auf optionale Module
  const RaceSelection = window.RaceSelection || null; // erwartet API: RaceSelection.open({ races, onSelect })
  const MapSystem = window.MapSystem || null;         // erwartet API: MapSystem.generate(config) -> mapData (und zeichnet/initialisiert)
  const GameState = window.GameState || {
    state: {
      players: {},          // playerId -> { name, raceId, ... }
      localPlayerId: null,  // eigene socket.id
      turnOrder: [],        // Array von playerIds
      currentTurnIndex: 0,  // Index in turnOrder
      phase: "lobby",       // 'lobby' | 'race' | 'generating' | 'playing'
      map: null,            // Mapdaten/-objekt
    },
    setPhase(p) {
      this.state.phase = p;
      log("Phase:", p);
      document.dispatchEvent(new CustomEvent("game:phase", { detail: p }));
    },
    setPlayers(players) {
      this.state.players = players || {};
      document.dispatchEvent(new CustomEvent("game:players", { detail: players }));
    },
    setLocalPlayerId(id) {
      this.state.localPlayerId = id;
    },
    setPlayerRace(playerId, raceId) {
      if (!this.state.players[playerId]) this.state.players[playerId] = {};
      this.state.players[playerId].raceId = raceId;
      document.dispatchEvent(
        new CustomEvent("game:playerRace", { detail: { playerId, raceId } })
      );
    },
    setTurnOrder(order) {
      this.state.turnOrder = order || [];
      this.state.currentTurnIndex = 0;
      document.dispatchEvent(new CustomEvent("game:turnOrder", { detail: order }));
    },
    nextTurn() {
      if (!this.state.turnOrder.length) return;
      this.state.currentTurnIndex =
        (this.state.currentTurnIndex + 1) % this.state.turnOrder.length;
      const current = this.getCurrentPlayerId();
      document.dispatchEvent(new CustomEvent("game:turnChanged", { detail: current }));
    },
    getCurrentPlayerId() {
      if (!this.state.turnOrder.length) return null;
      return this.state.turnOrder[this.state.currentTurnIndex];
    },
    setMap(map) {
      this.state.map = map;
      document.dispatchEvent(new CustomEvent("game:mapReady", { detail: map }));
    },
  };

  // ---- UI/DOM-Minimal-Fallbacks --------------------------------------------
  // Einfache Fallback-UI für Rassenauswahl, falls RaceSelection-Modul fehlt.
  function openRaceSelectionFallback({ races, onSelect }) {
    let overlay = document.getElementById("race-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "race-overlay";
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.6)";
      overlay.style.display = "grid";
      overlay.style.placeItems = "center";
      overlay.style.zIndex = "9999";
      overlay.innerHTML = `
        <div style="background:#111;color:#fff;padding:16px;border-radius:12px;max-width:700px;width:95%;box-shadow:0 10px 30px rgba(0,0,0,0.5)">
          <h2 style="margin:0 0 8px 0;font-family:system-ui">Wähle deine Rasse</h2>
          <div id="race-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-height:60vh;overflow:auto"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    const grid = overlay.querySelector("#race-grid");
    grid.innerHTML = "";
    races.forEach((r, idx) => {
      const btn = document.createElement("button");
      btn.textContent = r.name || `Rasse ${idx + 1}`;
      btn.style.padding = "10px";
      btn.style.border = "1px solid #333";
      btn.style.background = "#222";
      btn.style.color = "#fff";
      btn.style.borderRadius = "8px";
      btn.style.cursor = "pointer";
      btn.addEventListener("click", () => {
        overlay.remove();
        onSelect(r.id ?? idx, r);
      });
      grid.appendChild(btn);
    });
  }

  function openRaceSelection({ races, onSelect }) {
    if (RaceSelection && typeof RaceSelection.open === "function") {
      RaceSelection.open({ races, onSelect });
    } else {
      openRaceSelectionFallback({ races, onSelect });
    }
  }

  // Einfacher Hinweis oben links, wessen Zug ist.
  function ensureTurnBanner() {
    let el = document.getElementById("turn-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "turn-banner";
      el.style.position = "fixed";
      el.style.top = "10px";
      el.style.left = "10px";
      el.style.padding = "8px 12px";
      el.style.background = "#222";
      el.style.color = "#fff";
      el.style.borderRadius = "8px";
      el.style.fontFamily = "system-ui, sans-serif";
      el.style.zIndex = "9998";
      document.body.appendChild(el);
    }
    return el;
  }

  function updateTurnBanner() {
    const el = ensureTurnBanner();
    const current = GameState.getCurrentPlayerId();
    const currentName =
      (current && GameState.state.players[current] && GameState.state.players[current].name) ||
      current ||
      "-";
    el.textContent = `Zug: ${currentName}`;
  }

  // ---- Kernlogik ------------------------------------------------------------

  // Rassenliste laden (falls RaceSelection diese nicht selbst liefert)
  // Versucht races-data.json zu holen; fällt ansonsten auf Dummy-Liste zurück.
  async function loadRaces() {
    try {
      const res = await fetch("races-data.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      // Erwartet Format: [{ id, name, ... }, ...]
      if (Array.isArray(data) && data.length) return data;
    } catch (e) {
      log("Konnte races-data.json nicht laden, nutze Dummy-Liste.", e);
    }
    // Fallback: 15 Dummy-Rassen
    return Array.from({ length: 15 }).map((_, i) => ({
      id: `race-${i + 1}`,
      name: `Rasse ${i + 1}`,
    }));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Startet Rassenauswahl lokal und meldet Auswahl an den Server
  async function startRaceSelection() {
    GameState.setPhase("race");
    const races = await loadRaces();
    openRaceSelection({
      races,
      onSelect: (raceId, raceObj) => {
        const payload = {
          playerId: GameState.state.localPlayerId || (socket && socket.id) || null,
          raceId,
        };
        GameState.setPlayerRace(payload.playerId, raceId);
        if (socket) socket.emit("race:selected", payload);
        log("Rasse gewählt:", payload, raceObj);
      },
    });
  }

  // Wird aufgerufen, wenn alle Rassen gewählt sind
  function onAllRacesSelected(serverPlayersSnapshot) {
    if (serverPlayersSnapshot) {
      GameState.setPlayers(serverPlayersSnapshot);
    }
    GameState.setPhase("generating");

    // Map vom Server generieren lassen, wenn Event unterstützt, sonst lokal Map erzeugen
    if (socket) {
      socket.emit("map:generate", {
        // Hier könnten Settings übergeben werden (z. B. aus game-config.js)
        // Beispiel: size, seed, terrainTypes, playerStarts etc.
      });
    } else {
      generateMapLocallyAndStart();
    }
  }

  function generateMapLocallyAndStart() {
    // Lokale Generierung, falls kein Server-Event existiert
    let mapData = null;
    if (MapSystem && typeof MapSystem.generate === "function") {
      mapData = MapSystem.generate({
        // Minimal-Konfiguration; passt bei Bedarf an eure map-system.js an
        width: 20,
        height: 20,
        players: Object.keys(GameState.state.players || {}),
      });
    } else {
      // Minimaler Platzhalter
      mapData = { width: 20, height: 20, tiles: [] };
    }
    GameState.setMap(mapData);

    // Zufällige Zugreihenfolge erzeugen
    const order = shuffle(Object.keys(GameState.state.players || {}));
    GameState.setTurnOrder(order);
    GameState.setPhase("playing");
    updateTurnBanner();
  }

  // ---- Socket verdrahten ----------------------------------------------------

  if (socket) {
    // Eigene ID merken
    socket.on("connect", () => {
      GameState.setLocalPlayerId(socket.id);
      log("Verbunden als", socket.id);
    });

    // Wenn Lobby signalisiert: alle sind bereit -> Rassenauswahl
    socket.on("lobby:all-ready", () => {
      log("Alle Spieler bereit -> Rassenauswahl beginnt");
      startRaceSelection();
    });

    // Server-Status zu Rassenauswahlen (z. B. wenn andere Spieler wählen)
    socket.on("race:state", (playersSnapshot) => {
      // Erwartet: { playerId: { name, raceId, ... }, ... }
      GameState.setPlayers(playersSnapshot || {});
      // Wenn der lokale Spieler schon gewählt hat, aktualisieren wir seine Anzeige
      updateTurnBanner();
    });

    // Server meldet: alle Rassen wurden gewählt
    socket.on("race:all-selected", (playersSnapshot) => {
      log("Alle Rassen gewählt");
      onAllRacesSelected(playersSnapshot);
    });

    // Server liefert generierte Map
    socket.on("map:generated", (mapData) => {
      log("Map empfangen", mapData);
      GameState.setMap(mapData);

      // Server kann optional auch die Zugreihenfolge vorgeben
      if (mapData && Array.isArray(mapData.turnOrder) && mapData.turnOrder.length) {
        GameState.setTurnOrder(mapData.turnOrder);
      } else {
        const order = shuffle(Object.keys(GameState.state.players || {}));
        GameState.setTurnOrder(order);
      }

      GameState.setPhase("playing");
      updateTurnBanner();
    });

    // Falls Server aktiv eine Reihenfolge verteilt
    socket.on("turn:order", (order) => {
      if (Array.isArray(order) && order.length) {
        GameState.setTurnOrder(order);
        updateTurnBanner();
      }
    });

    // Beispiel: Server ruft zum nächsten Zug auf (optional)
    socket.on("turn:next", () => {
      GameState.nextTurn();
      updateTurnBanner();
    });
  }

  // ---- Lokale Events / Hooks ------------------------------------------------

  // Falls kein Server die Lobby steuert: wir fangen direkt mit Rassenauswahl an,
  // sobald Seite geladen ist. Wenn der Server vorhanden ist, wird "lobby:all-ready"
  // den Start übernehmen.
  window.addEventListener("load", () => {
    if (!socket) {
      // Offline/ohne Server: Demo-Flow
      // Dummy-Spielerliste (2-8)
      const localId = "local-demo";
      GameState.setLocalPlayerId(localId);
      const players = {
        [localId]: { name: "Du" },
        bot1: { name: "Spieler 2" },
      };
      GameState.setPlayers(players);
      startRaceSelection();
    }
  });

  // Wenn Phase auf 'playing' wechselt, stellen wir sicher, dass der Banner sichtbar ist
  document.addEventListener("game:phase", (e) => {
    if (e.detail === "playing") updateTurnBanner();
  });

  // Exponiere minimal API (optional, für Debug/Buttons)
  window.GameMain = {
    startRaceSelection,
    generateMapLocallyAndStart,
    nextTurn: () => {
      GameState.nextTurn();
      updateTurnBanner();
      if (socket) socket.emit("turn:ended", { playerId: GameState.getCurrentPlayerId() });
    },
    getState: () => GameState.state,
  };
})();
