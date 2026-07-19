# NAVAL COMMAND

Ein browserbasiertes Schiffeversenken-Spiel mit Solo-Modus, Kommandantenfähigkeiten und privaten Online-Lobbys.

## Start

Für Solo-Gefechte kann `index.html` weiterhin direkt geöffnet werden. Für private Multiplayer-Lobbys wird der integrierte Server gestartet:

```powershell
npm start
```

Danach `http://localhost:8080` öffnen. Für Spiele über das Internet wird das Projekt einmal auf einem Node.js-Host bereitgestellt. Beide Spieler öffnen dieselbe öffentliche Spieladresse; im Spiel selbst muss nur der sechsstellige Lobby-Code geteilt und eingegeben werden. Es sind keine externen Pakete oder Multiplayer-Zugangsdaten nötig.

## Private Lobby

- Im Hauptmenü **Private Lobby** wählen.
- Ein Spieler erzeugt einen sechsstelligen Einsatzcode.
- Der zweite Spieler gibt diesen Code ein. Beide gelangen automatisch zur Kommandantenauswahl.
- Kapitän wählen, Flotte platzieren und freigeben. Das Gefecht startet, sobald beide Spieler bereit sind.

Flottenpositionen, Punkte, Fähigkeiten, Zugwechsel und Sieg werden serverseitig geprüft. Gegnerische Schiffspositionen werden nicht an den anderen Browser übertragen.

## Steuerung

- In der Aufstellungsphase ein Schiff im Flottenregister wählen und im Raster platzieren.
- Mit **R** oder „Schiff drehen“ die Ausrichtung ändern.
- Bereits platzierte Schiffe im Flottenregister anklicken, um sie neu zu setzen.
- Im Gefecht ein freies Feld im feindlichen Raster anklicken.
- Nach „Neues Gefecht“ zwischen klassischem und Kommandantenmodus wählen.
- Im Kommandantenmodus bringt ein normaler eigener Fehlschuss einen Kommandopunkt. Fehlschüsse während einer Fähigkeit geben keine Punkte, sofern die jeweilige Fähigkeit dies nicht ausdrücklich erlaubt.
- Audio lässt sich jederzeit oben rechts ein- und ausschalten.

## Struktur

- `js/config.js` – zentrale Flotten- und Spielfeldkonfiguration
- `js/game.js` – unabhängige Spiellogik und Zustandsmodell
- `js/ai.js` – austauschbare Computerstrategie
- `js/audio.js` – im Browser erzeugte Soundeffekte
- `js/ui.js` – Darstellung, Eingaben und Animationen
- `js/multiplayer.js` – Lobby-Verbindung und Echtzeit-Synchronisierung
- `server.js` – statischer Webserver und Multiplayer-API
- `server/` – autoritative Lobby- und Matchlogik
- `css/styles.css` – responsives Marine-Interface und Wasserdarstellung
- `tests/game.test.js` – Logiktests ohne Browserabhängigkeit

## Tests

Mit installiertem Node.js:

```powershell
npm test
```
