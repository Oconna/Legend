Du sollst ein Online Strategiespiel programmieren. Das Strategiespiel soll folgende Inhalte haben:

- Online Multiplayer
- Browserbasiert
- Rundenbasiert
- 2 bis 8 Spieler
- Serverseitige Synchronisation
- MySQL-Datenbank

Startseite (index.html)
- Spielerstellung: Ein neues Spiel soll erstellt werden können (für 2 bis 8 Spieler), Kartengröße muss ausgewählt werden (z. B. 20x20, 30x30, 50x50, 100x100), Spielername muss vorher angegeben werden -> Spiellobby wird erstellt, das Spiel wird dann auf die Datenbank geschrieben
- Spiellobby: In der Spiellobby werden alle Spieler angezeigt, die dem Spiel beigetreten sind. Hier müssen alle Spieler bestätigen, ob sie bereit sind. Wenn alle Spieler bereit sind, kann der Host das Spiel starten -> Sprung zur Rassenauswahl (race-selection.html)
- Spieler können einem verfügbaren Spiel beitreten, sofern dieses noch nicht voll ist
- Die Anzeige der Anzahl der Spieler muss serverseitig synchronisiert werden (auch der Spieler, die ausgewählt haben, dass sie bereit sind)
- In der Spiellobby soll ein Chatbereich sein, wo Spieler miteinander Chatten können. Dieser Chat soll auch auf späteren Seiten verwendet werden (race-selection.html und game.html)
- Spieler sollen eine Spiellobby verlassen können. Dann soll die Spieleranzahl entsprechend aktualisiert werden
- Spiele werden auf die Tabelle "games" geschrieben
- Spieler werden auf die Tabelle "game_players" geschrieben

Rassenauswahl (race-selection.html)
- nach dem Spielstart durch den Host, startet die Rassenauswahl
- hier sind 15 Rassen (oder mehr) zur Auswahl (diese kommen von der Datenbank - Tabelle "races")
- Jede Rasse hat 10 Einheiten (oder mehr), diese sollen über einen Button (Details) in einem Modal einsehbar sein (die Einheiten kommen von der Datenbank - Tabelle "units")
- Jede Einheit hat einen Namen, Bewegungspunkte, Angriffsstärke, Preis (Gold), Angriffsreichweite, Lebenspunkt, Kennzeichen ob sie fliegen kann (wichtig für die Bewegung über Berge und Wasser)
- Jede Rasse hat 3 Stufen, die im Spielverlauf mit Gold erkauft werde können, durch einen Stufenaufstieg wird jede neu gekaufte Einheit stärker (z. B. prozentual, Stufe 2 = 20%, Stufe 3 = 40%)
- Jede Rasse erhält eine Grafik (Dateiname wird auf der Datenbanktabelle gespeichert)
- Jede Einheit erhält eine Grafik (Dateiname wird auf der Datenbanktabelle gespeichert)
- Spieler sollen nicht sehen können, welche Rasse ein anderer Spieler ausgewählt hat, eine Rasse soll von mehreren Spielern ausgewählt werden können.
- Nach der Auswahl der Rasse muss jeder Spieler die Auswahl bestätigen. Wenn alle Spieler die Auswahl bestätigt haben -> Starte Kartengenerierung, dann Sprung zur "game.html"
- Der Chatbereich soll hier auch sichtbar sein

Kartengenerierung
- Raster (canvas), Größe wie zuvor bei der Spielerstellung angegeben
- 7 Terraintypen (Gras, Berg, Sumpf, Wasser, Wald, Wüste, Schnee), kommt von der Tabelle "terrain_types"
- Jeder Terrain benötigt verschiedene Bewegungspunkte (Gras = 1, Sumpf = 2, Berg = 3 usw., Wasser nur von fliegenden Einheiten passierbar)
- Zusätzlich gibt es Gebäude (Dorf, Burg), kommt von der Tabelle "building_types"
- Je Spieler werden 5 Dörfer und 2 Burgen auf der Karte gleichmäßig verteilt
- Jeder Spieler besitzt zum Spielbeginn ein Dorf
- Der Terrain soll prozentual auf der Karte verteilt werden (z. b. Gras 40-50%, Berg 10-15% usw.)
- Der Terrain soll natürlich aussehen, z. B. Wälder zusammenhängend, kein Schnee neben Wüste usw.
- Jeder Terraintyp erhält eine Graftik (Dateiname wird auf der Datenbanktabelle gespeichert)
- Nachdem die Karte erstellt ist -> Sprung zum Spiel (game.html)

Spiel (game.html)
- Gold zum Zugbeginn: Der Spieler welcher am Zug ist, erhält zu Beginn des Zuges Gold (abhängig davon wie viele Städte/Burgen er hat)
- Kaufaktionen: Einheiten (units) in einer eigenen Stadt/Burg kaufen (Stadt/Burg muss aktiviert sein) (bis das vorhandene Gold aufgebraucht ist), Kosten beachte hier die units von der MySQL-Datenbank, Einheiten können nur gekauft werden, wenn auf dem Tile der Stadt/Burg keine Einheit steht
- Bewegungsaktionen: Einheiten (units) auf dem Spielfeld bewegen, eine Einheit (unit) kann sich nur über Felder bewegen, auf denen keine andere Einheit befindet. Das Tile auf dem sich die Einheit befindet muss aktiv sein, um die Einheit zu bewegen. Danach kann ein zweites Tile ausgewählt werden, zu dem sich die Einheit bewegen soll. Die Bewegungsaktiion muss bestätigt werden. Die Bewegungsaktion kann nur durchgeführt werden, wenn ausreichend Bewegungspunkt vorhanden sind. Fliegende Einheiten benötigen für Felder mit Bergen oder Wasser nur einen Bewegungspunkt. Nach Auswahl eines zweiten Tiles (Feld zu dem sich die Einheit bewegen soll), soll ein Pfad vom ersten Tile zum zweiten Tile berechnet und als Pfeil über den Tiles eingeblendet werden (immer der Weg, welcher am wenigsten Bewegungspunkte verbraucht und die folgenden Bedingungen prüft: nur fliegende Einheiten können über Wasser, keine Einheiten auf dem Pfad, ansonten drum herum bewegen, grüner Pfeil wenn Bewegungsaktion möglich, rot wenn nicht möglich) 
- Angriffsaktionen: feindliche Einheiten (units) mit den eigenen Einheiten angreifen (die gegnerischen Einheiten müssen in Reichweite sein), die Reichweite soll auf den Tiles farblich dargestellt werden, die Reichtweite soll in Richtung die Tileanzahl betragen, die die Einheit als Reichweite hat. Fernkampeinheiten haben eine Reichweite +1, wenn sie auf einem Bergtile sind. Bei einem Angriff wird der gegnerischen Einheit Lebenspunkte in Höhe der Angriffsstärke der angreifenden Einheit abgezogen. Wenn die Lebenspunkte auf 0 oder niedriger fallen, verschwindet die angegriffene Einheit vom Spielfeld.  
- Stufenaufstieg: Ein Spieler kann bis zu 2 Stufen in dem gesamten Spiel aufsteigen. Jeder Stufenanstieg kostet Gold in einer bestimmten Höhe (dies soll über die SQL-Tabelle races gesteuert werden stufe_2 z. B. 500 Gold, stufe_3 z. B. 1000 Gold). Die Lebenspunkte, Angriffsstärke und Reichweite von Einheiten (nur neu gekaufte) erhöht sich durch einen Stufenaufstieg prozentual (z. B. Stufe 2 20%, Stufe 3 30%). 
- Spielende: Wenn ein Spieler keine Einheiten und keine Stadt/Burg mehr hat, scheidet er aus dem Spiel aus. Wenn nur noch ein Spieler übrig ist, hat dieser das Spiel gewonnen.
- Zug beenden: Beim Klick auf Zug beenden, beendet der Spieler seinen Zug und der nächste Spieler ist an der Reihe.
- Einheiten sollen als Grafiken über den Tiles dargestellt werden und farblich markiert sein (Rassen-/Spielerfarbe). Lebenspunkte sollen ebenfalls in dem Tile dargestellt werden (Herz Icon und Lebenspunkte als Zahl)
- Der Chatbereich soll hier auch sichtbar sein

Sehr wichtig:
- Informationen müssen serverseitig gespeichert werden, damit diese für alle Spieler synchron sind (Karte, Einheiten, Rassenauswahl, Zugreihenfolge usw.)
- Versuche den Code in den einzelnen Dateien kurz zu halten, teile den Code an sinnvollen Stellen in mehrere Dateien auf (nach Thema)
- css immer in separaten Dateien




strategy-game-server/
├── package.json                 # Bereits vorhanden
├── Procfile                     # Bereits vorhanden  
├── .env                        # Bereits vorhanden
├── .gitignore                  # Zu erstellen
├── README.md                   # Optional
│
├── server/                     # Backend-Code
│   ├── app.js                 # Hauptserver (bereits erstellt)
│   ├── database.js            # Datenbankverbindung (bereits erstellt)
│   │
│   ├── controllers/           # Controller für verschiedene Bereiche
│   │   ├── gameController.js  # Game API Routes (bereits erstellt)
│   │   └── socketController.js # Socket.io Events (bereits erstellt)
│   │
│   ├── models/               # Datenbankmodelle (optional, für bessere Organisation)
│   │   ├── Game.js
│   │   ├── Player.js
│   │   ├── Race.js
│   │   └── Unit.js
│   │
│   ├── utils/                # Server-Utilities
│   │   ├── mapGenerator.js   # Kartengenerierung (bereits erstellt)
│   │   ├── gameLogic.js      # Spiellogik (Bewegung, Kampf)
│   │   └── pathfinding.js    # Pfadfindung für Einheitenbewegung
│   │
│   └── middleware/           # Custom Middleware
│       ├── auth.js          # Authentifizierung (falls nötig)
│       └── validation.js     # Request Validation
│
├── public/                   # Frontend-Code (statische Dateien)
│   ├── index.html           # Startseite (bereits erstellt)
│   ├── lobby.html           # Lobby-Seite (bereits erstellt)
│   ├── race-selection.html  # Rassenauswahl (zu erstellen)
│   └── game.html            # Haupt-Spielseite (zu erstellen)
│   │
│   ├── css/                 # Stylesheets
│   │   ├── main.css         # Hauptstyles (bereits erstellt)
│   │   ├── index.css        # Index-spezifisch (bereits erstellt)
│   │   ├── lobby.css        # Lobby-spezifisch (bereits erstellt)
│   │   ├── race-selection.css # Rassenauswahl-spezifisch
│   │   └── game.css         # Spiel-spezifisch
│   │
│   ├── js/                  # JavaScript-Dateien
│   │   ├── utils.js         # Allgemeine Utilities (bereits erstellt)
│   │   ├── index.js         # Index-Logik (bereits erstellt)
│   │   ├── lobby.js         # Lobby-Logik (bereits erstellt)
│   │   ├── race-selection.js # Rassenauswahl-Logik
│   │   ├── game.js          # Haupt-Spiellogik
│   │   ├── gameMap.js       # Karten-Rendering und Interaction
│   │   ├── gameUnits.js     # Einheiten-Management
│   │   └── gameChat.js      # Chat-System (wiederverwendbar)
│   │
│   ├── images/              # Spielgrafiken
│   │   ├── races/           # Rassengrafiken
│   │   │   ├── humans.png
│   │   │   ├── elves.png
│   │   │   ├── dwarves.png
│   │   │   ├── orcs.png
│   │   │   └── undead.png
│   │   │
│   │   ├── units/           # Einheitengrafiken
│   │   │   ├── human/
│   │   │   │   ├── human_warrior.png
│   │   │   │   ├── human_archer.png
│   │   │   │   └── ...
│   │   │   ├── elves/
│   │   │   ├── dwarves/
│   │   │   ├── orcs/
│   │   │   └── undead/
│   │   │
│   │   ├── terrain/         # Terrain-Grafiken
│   │   │   ├── grass.png
│   │   │   ├── mountain.png
│   │   │   ├── swamp.png
│   │   │   ├── water.png
│   │   │   ├── forest.png
│   │   │   ├── desert.png
│   │   │   └── snow.png
│   │   │
│   │   ├── buildings/       # Gebäude-Grafiken
│   │   │   ├── village.png
│   │   │   └── castle.png
│   │   │
│   │   └── ui/              # UI-Icons und Grafiken
│   │       ├── heart.png    # Lebenspunkte-Icon
│   │       ├── gold.png     # Gold-Icon
│   │       ├── move.png     # Bewegung-Icon
│   │       └── attack.png   # Angriff-Icon
│   │
│   └── sounds/              # Sound-Dateien (optional)
│       ├── click.mp3
│       ├── move.mp3
│       ├── attack.mp3
│       └── background.mp3
│
├── database/                # Datenbank-Scripts
│   ├── schema.sql          # Vollständiges DB-Schema (bereits erstellt)
│   ├── seed_data.sql       # Beispieldaten für Rassen/Einheiten
│   └── migrations/         # DB-Änderungen für Updates
│       └── 001_initial.sql
│
├── docs/                   # Dokumentation
│   ├── api.md             # API-Dokumentation
│   ├── game_rules.md      # Spielregeln
│   └── deployment.md      # Deployment-Anleitung
│
└── tests/                  # Tests (optional)
    ├── server/
    │   ├── gameController.test.js
    │   └── socketController.test.js
    └── public/
        └── utils.test.js