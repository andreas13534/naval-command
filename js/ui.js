(function (root) {
  'use strict';

  const { CONFIG, BattleshipGame, GameBoard, RandomTargetAI, AudioManager, ShotCinematic, CinematicAnimations, MultiplayerClient } = root.NavalGame;

  class GameUI {
    constructor() {
      this.game = new BattleshipGame(CONFIG);
      this.ai = new RandomTargetAI();
      this.audio = new AudioManager();
      this.clientSettings = this.loadClientSettings();
      this.selectedShipId = CONFIG.ships[0].id;
      this.orientation = 'horizontal';
      this.selectedCommanderId = CONFIG.commanders[0].id;
      this.activeAbilityId = null;
      this.abilityOrientation = 'horizontal';
      this.relocationShipId = null;
      this.actionToken = 0;
      this.toastTimer = null;
      this.cinematic = null;
      this.cinematicActive = false;
      this.mobileBattleBoard = 'enemy';
      this.multiplayer = new MultiplayerClient();
      this.multiplayerPayload = null;
      this.multiplayerLastEventId = 0;
      this.multiplayerBattleVisible = false;
      this.multiplayerOpponentFleet = [];
      this.multiplayerOpponentAfloat = 0;
      this.multiplayerOpponentJet = { launched: false, active: false, destroyed: false };
      this.multiplayerEventQueue = Promise.resolve();
      this.missionStartedAt = Date.now();
      this.elements = {};
    }

    initialize() {
      this.cacheElements();
      this.multiplayer.onState = (payload) => {
        this.multiplayerEventQueue = this.multiplayerEventQueue
          .then(() => this.handleMultiplayerState(payload))
          .catch(() => this.showToast('MULTIPLAYER-SYNCHRONISIERUNG FEHLGESCHLAGEN'));
      };
      this.multiplayer.onConnection = (status) => this.updateMultiplayerConnection(status);
      this.audio.attachMusic(this.elements.backgroundMusic);
      this.cinematic = new ShotCinematic(this.elements.shotCinematic, this.audio, CinematicAnimations);
      this.updateClientSettingsUI();
      this.buildCommanderSelection();
      this.buildShipSelector();
      this.buildBoardShell(this.elements.placementBoard, 'placement');
      this.buildBoardShell(this.elements.playerBoard, 'player');
      this.buildBoardShell(this.elements.enemyBoard, 'enemy');
      this.bindEvents();
      this.updateClock();
      root.setInterval(() => this.updateClock(), 1000);
      this.renderPlacement();
    }

    cacheElements() {
      const byId = (id) => document.getElementById(id);
      this.elements = {
        screens: [...document.querySelectorAll('.screen')],
        menuScreen: byId('menu-screen'),
        lobbyScreen: byId('lobby-screen'),
        modeScreen: byId('mode-screen'),
        commanderScreen: byId('commander-screen'),
        placementScreen: byId('placement-screen'),
        battleScreen: byId('battle-screen'),
        brandButton: byId('brand-button'),
        newBattleButton: byId('new-battle-button'),
        multiplayerButton: byId('multiplayer-button'),
        createLobbyButton: byId('create-lobby-button'),
        joinLobbyForm: byId('join-lobby-form'),
        lobbyCodeInput: byId('lobby-code-input'),
        lobbyActions: byId('lobby-actions'),
        lobbyWaiting: byId('lobby-waiting'),
        lobbyCodeDisplay: byId('lobby-code-display'),
        lobbyStatus: byId('lobby-status'),
        lobbyError: byId('lobby-error'),
        copyLobbyCodeButton: byId('copy-lobby-code-button'),
        lobbyBackButton: byId('lobby-back-button'),
        modeBackButton: byId('mode-back-button'),
        commanderBackButton: byId('commander-back-button'),
        commanderSelectionGrid: byId('commander-selection-grid'),
        soundToggle: byId('sound-toggle'),
        backgroundMusic: byId('background-music'),
        clientSettingsButton: byId('client-settings-button'),
        clientSettingsModal: byId('client-settings-modal'),
        clientSettingsClose: byId('client-settings-close'),
        debugModeToggle: byId('debug-mode-toggle'),
        missionClock: byId('mission-clock'),
        shipSelector: byId('ship-selector'),
        placementBoard: byId('placement-board'),
        playerBoard: byId('player-board'),
        enemyBoard: byId('enemy-board'),
        boardsArea: document.querySelector('.boards-area'),
        playerStation: byId('player-board').closest('.combat-station'),
        enemyStation: byId('enemy-board').closest('.combat-station'),
        selectedShipLabel: byId('selected-ship-label'),
        orientationLabel: byId('orientation-label'),
        placementCount: byId('placement-count'),
        placementHint: byId('placement-hint'),
        readinessPanel: byId('readiness-panel'),
        readinessValue: byId('readiness-value'),
        readinessText: byId('readiness-text'),
        rotateButton: byId('rotate-button'),
        randomizeButton: byId('randomize-button'),
        resetPlacementButton: byId('reset-placement-button'),
        startBattleButton: byId('start-battle-button'),
        restartButton: byId('restart-button'),
        battleTitle: byId('battle-title'),
        turnDisplay: byId('turn-display'),
        turnLabel: byId('turn-label'),
        commanderHud: byId('commander-hud'),
        commandPoints: byId('command-points'),
        abilityControls: byId('ability-controls'),
        abilityOrientationButton: byId('ability-orientation-button'),
        targetCoordinate: byId('target-coordinate'),
        combatLog: byId('combat-log'),
        fireOrderText: byId('fire-order-text'),
        playerFleetList: byId('player-fleet-list'),
        enemyFleetList: byId('enemy-fleet-list'),
        playerAfloat: byId('player-afloat'),
        enemyAfloat: byId('enemy-afloat'),
        sonarPing: byId('sonar-ping'),
        impactFlash: byId('impact-flash'),
        shotCinematic: byId('shot-cinematic'),
        gameoverModal: byId('gameover-modal'),
        resultModal: document.querySelector('.result-modal'),
        resultEmblem: byId('result-emblem'),
        resultKicker: byId('result-kicker'),
        gameoverTitle: byId('gameover-title'),
        gameoverMessage: byId('gameover-message'),
        statShots: byId('stat-shots'),
        statHits: byId('stat-hits'),
        statAccuracy: byId('stat-accuracy'),
        playAgainButton: byId('play-again-button'),
        menuButton: byId('menu-button'),
        toast: byId('toast'),
      };
    }

    bindEvents() {
      this.elements.newBattleButton.addEventListener('click', () => this.beginNewBattle());
      this.elements.multiplayerButton.addEventListener('click', () => this.openMultiplayerLobby());
      this.elements.createLobbyButton.addEventListener('click', () => this.createMultiplayerLobby());
      this.elements.joinLobbyForm.addEventListener('submit', (event) => this.joinMultiplayerLobby(event));
      this.elements.lobbyCodeInput.addEventListener('input', () => {
        this.elements.lobbyCodeInput.value = this.elements.lobbyCodeInput.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
        this.elements.lobbyError.textContent = '';
      });
      this.elements.copyLobbyCodeButton.addEventListener('click', () => this.copyLobbyCode());
      this.elements.lobbyBackButton.addEventListener('click', () => this.returnToMenu());
      this.elements.modeScreen.addEventListener('click', (event) => this.handleModeSelection(event));
      this.elements.modeBackButton.addEventListener('click', () => this.returnToMenu());
      this.elements.commanderBackButton.addEventListener('click', () => this.multiplayer.active ? this.returnToMenu() : this.showModeSelection());
      this.elements.commanderSelectionGrid.addEventListener('click', (event) => this.handleCommanderSelection(event));
      this.elements.brandButton.addEventListener('click', () => this.returnToMenu());
      this.elements.soundToggle.addEventListener('click', () => this.toggleSound());
      this.elements.clientSettingsButton.addEventListener('click', () => this.openClientSettings());
      this.elements.clientSettingsClose.addEventListener('click', () => this.closeClientSettings());
      this.elements.clientSettingsModal.addEventListener('click', (event) => {
        if (event.target === this.elements.clientSettingsModal) this.closeClientSettings();
        const themeButton = event.target.closest('[data-theme]');
        if (themeButton) this.selectClientTheme(themeButton.dataset.theme);
        const debugButton = event.target.closest('[data-debug-mode]');
        if (debugButton) this.toggleDebugMode();
      });
      this.elements.rotateButton.addEventListener('click', () => this.rotateShip());
      this.elements.randomizeButton.addEventListener('click', () => this.randomizePlayerFleet());
      this.elements.resetPlacementButton.addEventListener('click', () => this.resetPlacement());
      this.elements.startBattleButton.addEventListener('click', () => this.startBattle());
      this.elements.restartButton.addEventListener('click', () => this.beginNewBattle());
      this.elements.playAgainButton.addEventListener('click', () => this.beginNewBattle());
      this.elements.menuButton.addEventListener('click', () => this.returnToMenu());
      this.elements.shipSelector.addEventListener('click', (event) => this.handleShipSelection(event));
      this.elements.placementBoard.addEventListener('pointerover', (event) => this.handlePlacementPreview(event));
      this.elements.placementBoard.addEventListener('pointerleave', () => this.clearPlacementPreview());
      this.elements.placementBoard.addEventListener('click', (event) => this.handlePlacementClick(event));
      this.elements.enemyBoard.addEventListener('pointerover', (event) => this.handleTargetHover(event));
      this.elements.enemyBoard.addEventListener('pointerleave', () => {
        this.elements.targetCoordinate.textContent = '— —';
        this.clearAbilityPreview();
      });
      this.elements.enemyBoard.addEventListener('click', (event) => this.handlePlayerShot(event));
      this.elements.playerBoard.addEventListener('pointerover', (event) => this.handleRepairHover(event));
      this.elements.playerBoard.addEventListener('pointerleave', () => this.clearAbilityPreview());
      this.elements.playerBoard.addEventListener('click', (event) => this.handleRepairSelection(event));
      this.elements.boardsArea.addEventListener('click', (event) => this.handleMobileBoardSwitch(event), true);
      this.elements.boardsArea.addEventListener('keydown', (event) => this.handleMobileBoardSwitchKey(event));
      this.elements.abilityControls.addEventListener('click', (event) => this.handleAbilitySelection(event));
      this.elements.abilityOrientationButton.addEventListener('click', () => this.toggleAbilityOrientation());
      root.addEventListener('resize', () => {
        if (this.game.phase === 'battle') {
          this.updateMobileBattleBoardLayout();
          this.setTurnDisplay(this.game.turn);
        }
      }, { passive: true });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !this.elements.clientSettingsModal.hidden) {
          this.closeClientSettings();
          return;
        }
        if (event.key.toLowerCase() === 'r' && this.game.phase === 'placement') {
          event.preventDefault();
          this.rotateShip();
        }
      });
    }

    showScreen(screen) {
      this.elements.screens.forEach((element) => element.classList.toggle('active', element === screen));
      screen.scrollTop = 0;
      root.scrollTo({ top: 0, behavior: 'smooth' });
    }

    loadClientSettings() {
      const themes = ['cyber', 'crimson', 'arctic', 'violet', 'amber'];
      try {
        const stored = JSON.parse(root.localStorage.getItem('naval-command-client-settings') || '{}');
        return {
          theme: themes.includes(stored.theme) ? stored.theme : 'cyber',
          debugMode: stored.debugMode === true,
        };
      } catch (_error) {
        return { theme: 'cyber', debugMode: false };
      }
    }

    saveClientSettings() {
      try {
        root.localStorage.setItem('naval-command-client-settings', JSON.stringify(this.clientSettings));
      } catch (_error) { /* Local storage can be unavailable in private contexts. */ }
    }

    updateClientSettingsUI() {
      root.document.documentElement.dataset.theme = this.clientSettings.theme;
      this.elements.clientSettingsModal.querySelectorAll('[data-theme]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.theme === this.clientSettings.theme));
      });
      this.elements.debugModeToggle.setAttribute('aria-pressed', String(this.clientSettings.debugMode));
      this.elements.debugModeToggle.setAttribute('aria-label', this.clientSettings.debugMode ? 'Debug Mode deaktivieren' : 'Debug Mode aktivieren');
      this.elements.debugModeToggle.querySelector('b').textContent = this.clientSettings.debugMode ? 'ON' : 'OFF';
      root.document.documentElement.classList.toggle('debug-mode', this.clientSettings.debugMode);
      this.refreshAbilityCosts();
    }

    openClientSettings() {
      this.updateClientSettingsUI();
      this.elements.clientSettingsModal.hidden = false;
      this.elements.clientSettingsClose.focus();
    }

    closeClientSettings() {
      this.elements.clientSettingsModal.hidden = true;
      this.elements.clientSettingsButton.focus();
    }

    selectClientTheme(theme) {
      if (!['cyber', 'crimson', 'arctic', 'violet', 'amber'].includes(theme)) return;
      this.clientSettings.theme = theme;
      this.saveClientSettings();
      this.updateClientSettingsUI();
      this.audio.tone(460, 0.1, { type: 'square', volume: 0.06, endFrequency: 680 });
    }

    toggleDebugMode() {
      this.clientSettings.debugMode = !this.clientSettings.debugMode;
      this.saveClientSettings();
      this.updateClientSettingsUI();
      this.audio.tone(this.clientSettings.debugMode ? 720 : 320, 0.12, { type: 'square', volume: 0.07 });
      this.showToast(this.clientSettings.debugMode
        ? 'DEBUG MODE AKTIV · alle Fähigkeiten kosten 0P.'
        : 'DEBUG MODE DEAKTIVIERT · normale Fähigkeitskosten aktiv.');
    }

    getAbilityCost(ability) {
      return !this.multiplayer.active && this.clientSettings.debugMode ? 0 : ability.cost;
    }

    getAbilityForUse(ability) {
      const cost = this.getAbilityCost(ability);
      return cost === ability.cost ? ability : { ...ability, cost };
    }

    refreshAbilityCosts() {
      if (!this.elements.abilityControls) return;
      const commander = this.game.activeCommander;
      this.elements.abilityControls.querySelectorAll('.ability-button').forEach((button) => {
        const ability = commander?.abilities.find((candidate) => candidate.id === button.dataset.abilityId);
        if (ability) button.querySelector('strong').textContent = `${this.getAbilityCost(ability)}P`;
      });
      if (this.game.phase === 'battle') this.renderCommanderHud();
    }

    beginNewBattle() {
      this.multiplayer.close();
      this.resetMultiplayerState();
      this.actionToken += 1;
      this.game.reset();
      this.game.phase = 'mode-selection';
      this.ai.reset();
      this.selectedShipId = CONFIG.ships[0].id;
      this.orientation = 'horizontal';
      this.activeAbilityId = null;
      this.abilityOrientation = 'horizontal';
      this.relocationShipId = null;
      this.missionStartedAt = Date.now();
      this.elements.gameoverModal.hidden = true;
      this.elements.commanderHud.hidden = true;
      this.elements.abilityControls.innerHTML = '';
      this.audio.startAmbient();
      this.showScreen(this.elements.modeScreen);
    }

    resetMultiplayerState() {
      this.multiplayerPayload = null;
      this.multiplayerLastEventId = 0;
      this.multiplayerBattleVisible = false;
      this.multiplayerOpponentFleet = [];
      this.multiplayerOpponentAfloat = 0;
      this.multiplayerOpponentJet = { launched: false, active: false, destroyed: false };
      this.elements?.lobbyWaiting && (this.elements.lobbyWaiting.hidden = true);
      this.elements?.lobbyActions && (this.elements.lobbyActions.hidden = false);
    }

    openMultiplayerLobby() {
      this.actionToken += 1;
      this.multiplayer.close();
      this.resetMultiplayerState();
      this.game.reset();
      this.game.setMode('commander');
      this.game.phase = 'lobby';
      this.elements.lobbyError.textContent = '';
      this.elements.lobbyCodeInput.value = '';
      this.audio.startAmbient();
      this.showScreen(this.elements.lobbyScreen);
    }

    setLobbyBusy(busy) {
      this.elements.createLobbyButton.disabled = busy;
      this.elements.joinLobbyForm.querySelector('button').disabled = busy;
      this.elements.lobbyCodeInput.disabled = busy;
    }

    async createMultiplayerLobby() {
      this.setLobbyBusy(true);
      this.elements.lobbyError.textContent = '';
      try {
        const session = await this.multiplayer.createLobby();
        this.showLobbyWaiting(session.code);
        this.showToast('PRIVATER EINSATZCODE ERSTELLT');
      } catch (_error) {
        this.elements.lobbyError.textContent = 'Lobby-Dienst nicht erreichbar. Starte das Spiel über „npm start“.';
      } finally {
        this.setLobbyBusy(false);
      }
    }

    async joinMultiplayerLobby(event) {
      event.preventDefault();
      const code = this.elements.lobbyCodeInput.value;
      if (code.length !== 6) {
        this.elements.lobbyError.textContent = 'Der Einsatzcode muss sechs Zeichen enthalten.';
        return;
      }
      this.setLobbyBusy(true);
      this.elements.lobbyError.textContent = '';
      try {
        await this.multiplayer.joinLobby(code);
        this.showLobbyWaiting(code);
        this.elements.lobbyStatus.textContent = 'Sichere Verbindung hergestellt …';
      } catch (error) {
        const messages = {
          'lobby-not-found': 'Dieser Einsatzcode existiert nicht oder ist abgelaufen.',
          'lobby-full': 'Diese private Lobby ist bereits vollständig.',
        };
        this.elements.lobbyError.textContent = messages[error.code] || 'Lobby-Dienst nicht erreichbar. Prüfe die Verbindung.';
      } finally {
        this.setLobbyBusy(false);
      }
    }

    showLobbyWaiting(code) {
      const cleanCode = String(code || '').toUpperCase();
      this.elements.lobbyActions.hidden = true;
      this.elements.lobbyWaiting.hidden = false;
      this.elements.lobbyCodeDisplay.textContent = `${cleanCode.slice(0, 3)} ${cleanCode.slice(3)}`;
      this.elements.lobbyStatus.textContent = 'Warte auf zweiten Kommandanten …';
    }

    async copyLobbyCode() {
      if (!this.multiplayer.code) return;
      try {
        await root.navigator.clipboard.writeText(this.multiplayer.code);
        this.showToast(`CODE ${this.multiplayer.code} KOPIERT`);
      } catch (_error) {
        this.showToast(`EINSATZCODE: ${this.multiplayer.code}`);
      }
    }

    updateMultiplayerConnection(status) {
      if (!this.multiplayer.active || !this.elements.lobbyStatus) return;
      if (status === 'reconnecting') {
        this.elements.lobbyStatus.textContent = 'Verbindung wird wiederhergestellt …';
        if (this.game.phase === 'battle') this.showToast('SECURE LINK UNTERBROCHEN // VERBINDE NEU');
      }
    }

    async sendMultiplayerCommand(type, payload = {}) {
      try {
        await this.multiplayer.command(type, payload);
        return true;
      } catch (error) {
        const messages = {
          'not-your-turn': 'Waffensystem gesperrt. Der Gegner ist am Zug.',
          'already-shot': 'Dieses Feld wurde bereits beschossen.',
          'insufficient-points': 'Nicht genügend Kommandopunkte.',
          'invalid-position': 'Diese Position ist nicht verfügbar.',
          'not-damaged': 'Dieses Schiffsteil ist nicht beschädigt.',
          'no-ship': 'An dieser Position befindet sich kein geeignetes Schiff.',
          'last-ship': 'Die letzte aktive Einheit kann nicht geopfert werden.',
          'already-purchased': 'Das zusätzliche Schiff wurde bereits gekauft.',
          'abilities-jammed': 'STÖRSENDER AKTIV // Nur ein normaler Schuss ist möglich.',
          'jet-already-launched': 'Der RAPTOR Jet ist bereits gestartet.',
          'carrier-unavailable': 'Jet Start nicht möglich: Der Flugzeugträger ist nicht einsatzbereit.',
          'no-jet-position': 'Kein freier Startsektor für den RAPTOR Jet.',
          'jet-position': 'Dieses Feld wird vom eigenen RAPTOR Jet belegt.',
        };
        this.showToast(messages[error.code] || 'BEFEHL ABGELEHNT // EINGABE PRÜFEN');
        return false;
      }
    }

    async handleMultiplayerState(payload) {
      if (!this.multiplayer.active || payload.code !== this.multiplayer.code) return;
      this.multiplayerPayload = payload;
      const state = payload.state;

      if (!payload.opponentJoined) {
        this.showLobbyWaiting(payload.code);
        this.elements.lobbyStatus.textContent = 'Warte auf zweiten Kommandanten …';
        return;
      }

      if (state.phase === 'selection' && this.game.phase !== 'commander-selection') {
        this.game.phase = 'commander-selection';
        this.buildCommanderSelection();
        this.elements.commanderBackButton.textContent = 'PRIVATE LOBBY VERLASSEN';
        this.showScreen(this.elements.commanderScreen);
        this.showToast('GEGNER VERBUNDEN // KOMMANDANT WÄHLEN');
        return;
      }

      if (state.phase === 'placement') {
        if (!state.you.commanderId) return;
        if (state.you.ready) {
          this.elements.startBattleButton.disabled = true;
          this.elements.startBattleButton.textContent = 'WARTE AUF GEGNER …';
          this.elements.placementHint.textContent = 'Flotte verschlüsselt übertragen. Gegnerische Freigabe ausstehend.';
        }
        return;
      }

      if (state.phase === 'battle' || state.phase === 'gameover') {
        this.syncMultiplayerGame(state);
        if (!this.multiplayerBattleVisible) this.openMultiplayerBattle();
        const event = state.lastEvent;
        if (event && event.id > this.multiplayerLastEventId) {
          this.multiplayerLastEventId = event.id;
          await this.playMultiplayerEvent(event, state);
        }
        this.renderBattle();
        if (!state.opponent.connected && state.phase === 'battle') {
          this.showToast('GEGNERISCHE VERBINDUNG UNTERBROCHEN // WARTE AUF RECONNECT');
        }
        if (state.phase === 'gameover') root.setTimeout(() => this.showGameOver(), 300);
      }
    }

    syncMultiplayerGame(state) {
      this.game.mode = 'commander';
      if (state.you.commanderId) this.game.setCommander(state.you.commanderId);
      this.game.phase = state.phase === 'selection' ? this.game.phase : state.phase;
      this.game.turn = state.yourTurn ? 'player' : 'enemy';
      this.game.winner = state.winnerSeat === null ? null : state.winnerSeat === state.seat ? 'player' : 'enemy';
      this.game.commandPoints = state.you.commandPoints;
      this.game.freeShotsRemaining = state.you.freeShotsRemaining;
      this.game.lastRevengeActive = state.you.lastRevengeActive;
      this.game.abilityJammedTurns = state.you.abilityJammedTurns || 0;
      this.game.playerJet = { launched: false, active: false, destroyed: false, row: null, col: null, ...(state.you.jet || {}) };
      this.game.submergedShipId = state.you.submergedShipId;
      this.game.purchasedShipIds = new Set(state.you.purchasedShipIds || []);
      this.game.stats = {
        playerShots: state.you.shots,
        playerHits: state.you.hits,
        enemyShots: state.opponent.shots,
        enemyHits: state.opponent.hits,
      };
      this.game.playerBoard = this.restoreMultiplayerBoard(state.you.board);
      this.game.enemyBoard = this.restoreMultiplayerBoard(state.opponent.board);
      this.game.playerMines = new Map((state.you.mines || []).map((mine) => [`${mine.row},${mine.col}`, { ...mine, active: true }]));
      this.game.enemyContactMarkers = new Map((state.you.contactMarkers || []).map((marker) => [
        `${marker.row},${marker.col}`,
        { ...marker },
      ]));
      this.game.blockedAttackMarkers = new Map();
      const lastEvent = state.lastEvent;
      if (lastEvent?.actorSeat !== state.seat) {
        (lastEvent.results || []).filter((result) => result.type === 'blocked').forEach((result) => {
          this.game.blockedAttackMarkers.set(`${result.row},${result.col}`, result);
        });
      }
      this.game.enemyRevealedShipIds = new Set(state.opponent.board.ships.filter((ship) => !ship.isSunk).map((ship) => ship.id));
      this.multiplayerOpponentFleet = (state.opponent.fleetIds?.length
        ? state.opponent.fleetIds
        : (CONFIG.commanders.find((commander) => commander.id === state.opponent.commanderId)?.fleet || []))
        .map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId))
        .filter(Boolean);
      this.multiplayerOpponentAfloat = state.opponent.afloatCount;
      this.multiplayerOpponentJet = { launched: false, active: false, destroyed: false, ...(state.opponent.jet || {}) };
    }

    restoreMultiplayerBoard(snapshot) {
      const board = new GameBoard(snapshot.size || CONFIG.gridSize);
      (snapshot.ships || []).forEach((savedShip) => {
        const definition = CONFIG.ships.find((ship) => ship.id === savedShip.id);
        if (!definition) return;
        const placed = board.placeShip(definition, savedShip.row, savedShip.col, savedShip.orientation);
        if (placed.ok) placed.ship.hits = new Set(savedShip.hits || []);
      });
      (snapshot.shots || []).forEach((shot) => board.shots.set(board.key(shot.row, shot.col), { valid: true, ...shot }));
      return board;
    }

    openMultiplayerBattle() {
      this.multiplayerBattleVisible = true;
      this.actionToken += 1;
      this.mobileBattleBoard = 'enemy';
      this.elements.combatLog.innerHTML = '';
      this.showScreen(this.elements.battleScreen);
      this.activeAbilityId = null;
      this.relocationShipId = null;
      this.elements.restartButton.textContent = 'LOBBY VERLASSEN';
      this.buildAbilityControls();
      this.addLog('Private Verbindung bestätigt. Beide Flotten sind einsatzbereit.', 'system');
      this.renderBattle();
      if (this.game.turn === 'player') this.startPlayerTurn();
      else this.setTurnDisplay('enemy');
    }

    async playMultiplayerEvent(event, state) {
      const results = event.results || [];
      if (!results.length && event.type !== 'ability') return;
      const playerShot = event.actorSeat === state.seat;
      const actorCommanderId = playerShot ? state.you.commanderId : state.opponent.commanderId;
      const actorCommander = CONFIG.commanders.find((commander) => commander.id === actorCommanderId);
      const ability = actorCommander?.abilities.find((candidate) => candidate.id === event.abilityId) || null;
      const baseAnimationResults = results.length ? results : [{
        type: ability?.pattern === 'scan' ? (event.found ? 'scan-found' : 'scan-clear') : (ability?.pattern || 'ability'),
        row: 4,
        col: 4,
        found: ability?.pattern === 'scan' ? event.found : undefined,
      }];
      const animationResults = ability?.pattern === 'scan-shot'
        ? baseAnimationResults.map((result) => ({
          ...result,
          type: 'scan-shot-result',
          shotType: result.type,
          contactsMarked: event.contactsMarked || 0,
          waterMarked: event.waterMarked || 0,
        }))
        : baseAnimationResults;
      const actorBoard = playerShot ? this.game.playerBoard : this.game.enemyBoard;
      const sourceDefinition = CONFIG.ships.find((ship) => ship.id === event.sourceShipId);
      const sourceShip = actorBoard.ships.find((ship) => ship.id === event.sourceShipId)
        || (sourceDefinition ? { ...sourceDefinition, orientation: 'horizontal', hits: new Set(), isSunk: false } : null);
      this.elements.shotCinematic.dataset.sourceShipId = sourceShip?.id || '';
      this.elements.shotCinematic.dataset.sourceShipAsset = sourceShip?.asset || '';
      await this.playShotCinematic(animationResults, playerShot, ability, sourceShip);
      this.renderBattle();
      (results.length ? results : animationResults).forEach((result) => {
        if (!Number.isInteger(result.row) || !Number.isInteger(result.col)) return;
        const board = playerShot ? this.elements.enemyBoard : this.elements.playerBoard;
        this.resolveShotFeedback(board, result, playerShot, { playAudio: false });
      });
      if (ability?.pattern === 'scan-shot') {
        this.showToast(`SCAN-SCHUSS // ${event.contactsMarked || 0} KONTAKTE // ${event.waterMarked || 0}× WASSER`);
      } else if (ability?.pattern === 'jet-launch') {
        this.showToast(playerShot ? 'RAPTOR JET AKTIV // POSITION NUR FÜR DICH SICHTBAR' : 'FEINDLICHER RAPTOR JET GESTARTET');
      } else if (ability?.pattern === 'jammer') {
        this.showToast(playerShot ? 'STÖRSIGNAL ÜBERTRAGEN' : 'STÖRSENDER AKTIV // NUR NORMALER SCHUSS MÖGLICH');
      } else if (!playerShot && results.some((result) => result.jetMoved)) {
        this.showToast('RAPTOR JET // POSITION AUTOMATISCH GEWECHSELT');
      } else if (event.distance !== undefined) this.showToast(`ENTFERNUNGSMESSER // DISTANZ ${event.distance ?? 0} FELDER`);
      else if (event.found === true) this.showToast('SEKTORSCAN // KONTAKT GEFUNDEN');
      else if (event.found === false) this.showToast('SEKTORSCAN // KEIN KONTAKT');
    }

    showModeSelection() {
      this.game.phase = 'mode-selection';
      this.showScreen(this.elements.modeScreen);
    }

    handleModeSelection(event) {
      const button = event.target.closest('[data-mode]');
      if (!button) return;
      const mode = button.dataset.mode;
      if (!this.game.setMode(mode)) return;
      this.audio.tone(260, 0.1, { type: 'square', volume: 0.06, endFrequency: 390 });
      if (mode === 'commander') {
        this.game.phase = 'commander-selection';
        this.buildCommanderSelection();
        this.showScreen(this.elements.commanderScreen);
        return;
      }
      this.enterPlacement();
    }

    enterPlacement() {
      this.game.phase = 'placement';
      const fleet = this.game.playerFleetDefinitions;
      this.selectedShipId = fleet[0].id;
      this.game.playerBoard.clear();
      this.buildShipSelector();
      this.showScreen(this.elements.placementScreen);
      this.renderPlacement();
    }

    returnToMenu() {
      this.actionToken += 1;
      this.multiplayer.close();
      this.resetMultiplayerState();
      this.game.phase = 'menu';
      this.elements.gameoverModal.hidden = true;
      this.showScreen(this.elements.menuScreen);
    }

    toggleSound() {
      const enabled = this.audio.toggle();
      const button = this.elements.soundToggle;
      button.setAttribute('aria-pressed', String(enabled));
      button.querySelector('.sound-label').textContent = enabled ? 'AUDIO AN' : 'AUDIO AUS';
      button.querySelector('.sound-icon').textContent = enabled ? '◖' : '×';
      if (enabled) {
        this.audio.startAmbient();
        this.audio.sonar();
      }
    }

    updateClock() {
      const seconds = Math.max(0, Math.floor((Date.now() - this.missionStartedAt) / 1000));
      const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const remainder = String(seconds % 60).padStart(2, '0');
      this.elements.missionClock.textContent = `${hours}:${minutes}:${remainder}`;
    }

    buildCommanderSelection() {
      this.elements.commanderSelectionGrid.classList.toggle('many-commanders', CONFIG.commanders.length > 6);
      this.elements.commanderSelectionGrid.innerHTML = CONFIG.commanders.map((commander) => {
        const fleet = commander.fleet
          .map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId))
          .filter(Boolean);
        return `
          <article class="commander-card" data-commander-card="${commander.id}">
            <div class="commander-portrait" aria-label="Porträt ${commander.name}, ${commander.rank}">
              ${this.createCommanderPortrait(commander)}
              <span class="portrait-scan"></span>
            </div>
            <div class="commander-identity">
              <span>${commander.rank}</span>
              <h3>${commander.name}</h3>
            </div>
            <button class="commander-info-button" type="button" data-commander-info="${commander.id}" aria-expanded="false" aria-label="Informationen zu ${commander.name}">i</button>
            <div class="commander-details" data-commander-details="${commander.id}" hidden>
              <button class="commander-details-close" type="button" data-commander-details-close="${commander.id}" aria-label="Informationen schließen">×</button>
              <div>
                <strong>FLOTTE</strong>
                <ul>${fleet.map((ship) => `<li>${ship.name}<span>${this.formatShipSize(ship)}</span></li>`).join('')}</ul>
              </div>
              <div>
                <strong>FÄHIGKEITEN</strong>
                <ul>${commander.abilities.map((ability) => `<li>${ability.name}<span>${ability.cost} Punkte</span><small>${ability.description}</small></li>`).join('')}</ul>
              </div>
            </div>
            <button class="primary-button commander-select-button" type="button" data-select-commander="${commander.id}" aria-label="${commander.name}, ${commander.rank} übernehmen">KOMMANDO ÜBERNEHMEN</button>
          </article>`;
      }).join('');
    }

    createCommanderPortrait(commander) {
      if (commander.portraitAsset) {
        return `<img src="${commander.portraitAsset}" alt="${commander.name}, ${commander.rank}" loading="eager" decoding="async">`;
      }
      return `
        <svg viewBox="0 0 320 390" role="img" aria-label="${commander.name}">
          <defs>
            <linearGradient id="portrait-bg-${commander.id}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#0a2518"/><stop offset="1" stop-color="#010704"/>
            </linearGradient>
            <linearGradient id="uniform-${commander.id}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#53655b"/><stop offset="1" stop-color="#18231d"/>
            </linearGradient>
          </defs>
          <rect width="320" height="390" fill="url(#portrait-bg-${commander.id})"/>
          <g opacity=".2" stroke="#40ff76" fill="none"><path d="M0 70H320M0 140H320M0 210H320M0 280H320M64 0V390M128 0V390M192 0V390M256 0V390"/></g>
          <path d="M50 390 Q59 285 113 264 L207 264 Q262 285 272 390Z" fill="url(#uniform-${commander.id})" stroke="#82978a" stroke-width="3"/>
          <path d="M112 264 L160 323 L208 264 L187 248 H133Z" fill="#18211c" stroke="#6e8176" stroke-width="3"/>
          <path d="M126 246 Q104 210 109 151 Q113 88 160 79 Q208 88 212 151 Q217 210 194 246 Q176 266 160 268 Q143 266 126 246Z" fill="#839187" stroke="#b2c0b6" stroke-width="3"/>
          <path d="M109 155 Q108 87 160 76 Q213 88 212 157 L196 126 Q161 111 123 127Z" fill="#27342c"/>
          <path d="M98 121 Q160 76 222 121 L210 91 Q160 55 110 91Z" fill="#34463a" stroke="#8ca095" stroke-width="3"/>
          <path d="M109 91 Q160 59 211 91 L198 67 Q160 43 122 67Z" fill="#18251d"/>
          <circle cx="160" cy="83" r="9" fill="none" stroke="#5dff87" stroke-width="3"/>
          <path d="M132 173 H150 M171 173 H189 M151 203 Q160 209 169 203 M139 225 Q160 237 182 225" stroke="#28352d" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M72 330 H118 M202 330 H248" stroke="#69ff91" stroke-width="5"/>
          <path d="M82 344 H111 M209 344 H238" stroke="#b8ffc9" stroke-width="3"/>
          <text x="18" y="28" fill="#55ff82" font-family="monospace" font-size="11">ID://${commander.id.toUpperCase()}</text>
          <text x="217" y="374" fill="#55ff82" font-family="monospace" font-size="10">VERIFIED</text>
        </svg>`;
    }

    async handleCommanderSelection(event) {
      const closeButton = event.target.closest('[data-commander-details-close]');
      if (closeButton) {
        const commanderId = closeButton.dataset.commanderDetailsClose;
        const details = this.elements.commanderSelectionGrid.querySelector(`[data-commander-details="${commanderId}"]`);
        const infoButton = this.elements.commanderSelectionGrid.querySelector(`[data-commander-info="${commanderId}"]`);
        details.hidden = true;
        infoButton.setAttribute('aria-expanded', 'false');
        return;
      }
      const infoButton = event.target.closest('[data-commander-info]');
      if (infoButton) {
        const commanderId = infoButton.dataset.commanderInfo;
        const details = this.elements.commanderSelectionGrid.querySelector(`[data-commander-details="${commanderId}"]`);
        const willOpen = details.hidden;
        this.elements.commanderSelectionGrid.querySelectorAll('.commander-details').forEach((panel) => { panel.hidden = true; });
        this.elements.commanderSelectionGrid.querySelectorAll('.commander-info-button').forEach((button) => button.setAttribute('aria-expanded', 'false'));
        details.hidden = !willOpen;
        infoButton.setAttribute('aria-expanded', String(willOpen));
        return;
      }
      const selectButton = event.target.closest('[data-select-commander]');
      if (!selectButton) return;
      const commanderId = selectButton.dataset.selectCommander;
      if (!this.game.setCommander(commanderId)) return;
      this.selectedCommanderId = commanderId;
      this.audio.sonar();
      if (this.multiplayer.active) {
        const accepted = await this.sendMultiplayerCommand('select-commander', { commanderId });
        if (!accepted) return;
      }
      this.enterPlacement();
    }

    buildShipSelector() {
      const fleet = this.game.playerFleetDefinitions;
      this.elements.shipSelector.classList.toggle('extended', fleet.length > 5);
      this.elements.shipSelector.innerHTML = fleet.map((ship) => `
        <button class="ship-card" type="button" data-ship-id="${ship.id}" aria-label="${ship.name}, Größe ${this.formatShipSize(ship)}">
          ${this.createShipSvg(ship, 'horizontal', `card-${ship.id}`)}
          <span class="ship-card-name"><strong>${ship.name}</strong><small>${ship.code} // ${this.formatShipSize(ship)}</small></span>
          <span class="ship-card-length">${this.formatShipSize(ship)}</span>
        </button>
      `).join('');
    }

    formatShipSize(ship) {
      const width = ship.gridWidth || ship.length;
      const height = ship.gridHeight || 1;
      return height > 1 ? `${width}×${height}` : `${width}F`;
    }

    buildBoardShell(element, boardType) {
      element.classList.toggle('placement-board', boardType === 'placement');
      element.innerHTML = `
        <div class="column-labels" aria-hidden="true">${CONFIG.columns.map((label) => `<span>${label}</span>`).join('')}</div>
        <div class="row-labels" aria-hidden="true">${Array.from({ length: CONFIG.gridSize }, (_, i) => `<span>${i + 1}</span>`).join('')}</div>
        <div class="water-cells"></div>
      `;
      const cells = element.querySelector('.water-cells');
      const fragment = document.createDocumentFragment();
      for (let row = 0; row < CONFIG.gridSize; row += 1) {
        for (let col = 0; col < CONFIG.gridSize; col += 1) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'grid-cell';
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.style.setProperty('--water-variation', String(1 + ((row * 3 + col * 7) % 4)));
          cell.setAttribute('aria-label', `${CONFIG.columns[col]}${row + 1}`);
          fragment.appendChild(cell);
        }
      }
      cells.appendChild(fragment);
    }

    createShipSvg(ship, orientation = 'horizontal', token = '') {
      if (ship.asset) {
        const gridWidth = ship.gridWidth || ship.length;
        const gridHeight = ship.gridHeight || 1;
        return `
          <span class="ship-sprite ${orientation}" style="--sprite-length: ${ship.length}; --sprite-width-ratio: ${gridWidth / gridHeight}; --sprite-height-ratio: ${gridHeight / gridWidth}" aria-hidden="true">
            <img src="${ship.asset}" alt="" draggable="false">
          </span>`;
      }

      const width = ship.length * 100;
      const unique = `${ship.id}-${orientation}-${token}`.replace(/[^a-zA-Z0-9-]/g, '');
      const transform = orientation === 'vertical' ? 'translate(100 0) rotate(90)' : '';
      const viewBox = orientation === 'vertical' ? `0 0 100 ${width}` : `0 0 ${width} 100`;
      let silhouette = '';

      if (ship.profile === 'carrier') {
        silhouette = `
          <path d="M14 16 L${width - 24} 12 L${width - 5} 34 L${width - 8} 70 L${width - 28} 87 L12 82 L3 56 Z" fill="url(#h-${unique})" stroke="#91a8a9" stroke-width="3"/>
          <path d="M24 24 H${width - 35} V75 H24 Z" fill="#36474b" stroke="#71898a" stroke-width="2"/>
          <path d="M38 49 H${width - 48}" stroke="#d1d6bc" stroke-width="2" stroke-dasharray="18 12" opacity=".75"/>
          <path d="M42 30 L24 49 L42 68 M${width - 60} 28 V70" fill="none" stroke="#d1d6bc" stroke-width="2" opacity=".45"/>
          <rect x="${width * 0.66}" y="27" width="34" height="18" rx="3" fill="#718084" stroke="#a8b7b6"/>
          <rect x="${width * 0.69}" y="17" width="12" height="12" fill="#51666a"/>
          <circle cx="${width * 0.72}" cy="18" r="6" fill="none" stroke="#9fb0b0" stroke-width="2"/>
        `;
      } else if (ship.profile === 'submarine') {
        silhouette = `
          <path d="M5 50 Q18 20 55 18 H${width - 52} Q${width - 13} 23 ${width - 3} 50 Q${width - 13} 77 ${width - 52} 82 H55 Q18 79 5 50Z" fill="url(#h-${unique})" stroke="#879d9e" stroke-width="3"/>
          <rect x="${width * 0.43}" y="30" width="48" height="40" rx="16" fill="#52676a" stroke="#91a3a3" stroke-width="2"/>
          <path d="M${width * 0.5} 30 V15 H${width * 0.5 + 16}" stroke="#9aacab" stroke-width="3" fill="none"/>
          <path d="M27 31 L7 17 M27 69 L7 83 M${width - 30} 35 L${width - 6} 22 M${width - 30} 65 L${width - 6} 78" stroke="#5d7377" stroke-width="5"/>
        `;
      } else {
        const narrow = ship.profile === 'destroyer' ? 8 : 0;
        const turretPositions = ship.profile === 'battleship' ? [0.2, 0.36, 0.73, 0.84] : ship.profile === 'cruiser' ? [0.22, 0.76] : [0.24, 0.72];
        silhouette = `
          <path d="M4 50 L24 ${18 + narrow} L${width - 38} ${23 + narrow / 2} L${width - 4} 50 L${width - 38} ${77 - narrow / 2} L24 ${82 - narrow} Z" fill="url(#h-${unique})" stroke="#91a6a7" stroke-width="3"/>
          <path d="M35 50 H${width - 34}" stroke="#566d70" stroke-width="3" opacity=".9"/>
          <rect x="${width * 0.43}" y="28" width="${Math.max(34, width * 0.16)}" height="44" rx="4" fill="#526467" stroke="#839697" stroke-width="2"/>
          <rect x="${width * 0.48}" y="20" width="18" height="60" rx="3" fill="#68787a"/>
          <path d="M${width * 0.52} 22 V9 M${width * 0.52 - 9} 13 H${width * 0.52 + 9}" stroke="#a5b4b4" stroke-width="3"/>
          ${turretPositions.map((position) => `<g transform="translate(${width * position} 50)"><circle r="13" fill="#697b7c" stroke="#a0aeae" stroke-width="2"/><path d="M0 -4 H30 V4 H0" fill="#9ba7a6"/></g>`).join('')}
          <path d="M52 32 H${Math.max(64, width - 62)} M52 68 H${Math.max(64, width - 62)}" stroke="#b9c4bd" stroke-width="1" stroke-dasharray="9 8" opacity=".38"/>
        `;
      }

      return `
        <svg viewBox="${viewBox}" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="h-${unique}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#6d7e80"/><stop offset=".45" stop-color="#35494d"/><stop offset="1" stop-color="#1c2d32"/>
            </linearGradient>
          </defs>
          <g transform="${transform}">${silhouette}</g>
        </svg>`;
    }

    getSelectedDefinition() {
      return this.game.playerFleetDefinitions.find((ship) => ship.id === this.selectedShipId) || null;
    }

    handleShipSelection(event) {
      const card = event.target.closest('.ship-card');
      if (!card) return;
      const shipId = card.dataset.shipId;
      if (this.game.playerBoard.ships.some((ship) => ship.id === shipId)) {
        this.game.playerBoard.removeShip(shipId);
        this.showToast('Einheit aus dem Raster entfernt. Neue Position wählen.');
      }
      this.selectedShipId = shipId;
      this.renderPlacement();
    }

    rotateShip() {
      this.orientation = this.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      this.clearPlacementPreview();
      this.renderPlacementControls();
      this.audio.tone(310, 0.08, { volume: 0.06, type: 'square' });
    }

    handlePlacementPreview(event) {
      const cell = event.target.closest('.grid-cell');
      const definition = this.getSelectedDefinition();
      if (!cell || !definition || this.game.playerBoard.ships.some((ship) => ship.id === definition.id)) return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const valid = this.game.playerBoard.canPlace(definition, row, col, this.orientation);
      this.clearPlacementPreview();
      const previewCells = this.game.playerBoard.getPlacementCells(definition, row, col, this.orientation);
      previewCells.forEach((coordinate) => {
        const preview = this.getCell(this.elements.placementBoard, coordinate.row, coordinate.col);
        if (preview) preview.classList.add(valid ? 'preview-valid' : 'preview-invalid');
      });
      this.elements.placementHint.textContent = valid
        ? `${definition.name} auf ${this.coordinate(row, col)} positionieren.`
        : 'Position ungültig: Einheit liegt außerhalb des Rasters oder überlappt.';
    }

    clearPlacementPreview() {
      this.elements.placementBoard.querySelectorAll('.preview-valid, .preview-invalid').forEach((cell) => {
        cell.classList.remove('preview-valid', 'preview-invalid');
      });
    }

    handlePlacementClick(event) {
      const cell = event.target.closest('.grid-cell');
      const definition = this.getSelectedDefinition();
      if (!cell || !definition) return;
      if (this.game.playerBoard.ships.some((ship) => ship.id === definition.id)) {
        this.showToast('Diese Einheit ist bereits positioniert. Im Flottenregister anklicken, um sie zu versetzen.');
        return;
      }
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const result = this.game.playerBoard.placeShip(definition, row, col, this.orientation);
      if (!result.ok) {
        this.showToast('Position nicht freigegeben. Rastergrenze und andere Einheiten prüfen.');
        return;
      }
      this.audio.tone(210, 0.11, { type: 'square', volume: 0.08, endFrequency: 340 });
      this.selectNextUnplacedShip();
      this.renderPlacement();
    }

    selectNextUnplacedShip() {
      const next = this.game.playerFleetDefinitions.find((definition) => !this.game.playerBoard.ships.some((ship) => ship.id === definition.id));
      if (next) this.selectedShipId = next.id;
    }

    randomizePlayerFleet() {
      const fleet = this.game.playerFleetDefinitions;
      this.game.randomizeBoard(this.game.playerBoard, Math.random, fleet);
      this.selectedShipId = fleet[fleet.length - 1].id;
      this.audio.sonar();
      this.renderPlacement();
      this.showToast('Zufallsaufstellung berechnet. Flotte ist einsatzbereit.');
    }

    resetPlacement() {
      this.game.playerBoard.clear();
      this.selectedShipId = this.game.playerFleetDefinitions[0].id;
      this.orientation = 'horizontal';
      this.renderPlacement();
      this.showToast('Flottenaufstellung vollständig zurückgesetzt.');
    }

    renderPlacement() {
      this.renderBoard(this.elements.placementBoard, this.game.playerBoard, { showShips: true });
      this.renderPlacementControls();
    }

    renderPlacementControls() {
      const placedIds = new Set(this.game.playerBoard.ships.map((ship) => ship.id));
      const total = this.game.playerFleetDefinitions.length;
      const count = placedIds.size;
      const percent = Math.round((count / total) * 100);
      const definition = this.getSelectedDefinition();
      this.elements.shipSelector.querySelectorAll('.ship-card').forEach((card) => {
        card.classList.toggle('selected', card.dataset.shipId === this.selectedShipId);
        card.classList.toggle('placed', placedIds.has(card.dataset.shipId));
      });
      this.elements.selectedShipLabel.textContent = definition ? definition.name.toUpperCase() : '—';
      this.elements.orientationLabel.textContent = this.orientation === 'horizontal' ? 'HORIZONTAL // 090°' : 'VERTIKAL // 000°';
      this.elements.placementCount.textContent = `${count} / ${total}`;
      this.elements.readinessValue.textContent = `${percent}%`;
      this.elements.readinessPanel.querySelector('.readiness-ring').style.setProperty('--ready', `${percent * 3.6}deg`);
      this.elements.readinessPanel.classList.toggle('ready', count === total);
      this.elements.readinessText.textContent = count === total ? 'EINSATZBEREIT' : 'NICHT BEREIT';
      this.elements.startBattleButton.disabled = count !== total;
      if (count === total) {
        this.elements.placementHint.textContent = 'Alle Einheiten positioniert. Gefechtsfreigabe verfügbar.';
      } else {
        this.elements.placementHint.textContent = 'Wähle eine Einheit und bestätige die Position im Raster.';
      }
    }

    async startBattle() {
      if (this.multiplayer.active) {
        const fleetIds = new Set(this.game.playerFleetDefinitions.map((ship) => ship.id));
        const placements = this.game.playerBoard.ships
          .filter((ship) => fleetIds.has(ship.id))
          .map((ship) => ({ id: ship.id, row: ship.row, col: ship.col, orientation: ship.orientation }));
        if (placements.length !== fleetIds.size) {
          this.showToast('Vor Gefechtsbeginn müssen alle Einheiten positioniert sein.');
          return;
        }
        const accepted = await this.sendMultiplayerCommand('ready', { placements });
        if (accepted) {
          this.elements.startBattleButton.disabled = true;
          this.elements.startBattleButton.textContent = 'WARTE AUF GEGNER …';
        }
        return;
      }
      if (!this.game.startBattle()) {
        this.showToast('Vor Gefechtsbeginn müssen alle Einheiten positioniert sein.');
        return;
      }
      this.actionToken += 1;
      this.mobileBattleBoard = 'enemy';
      this.elements.combatLog.innerHTML = '';
      this.showScreen(this.elements.battleScreen);
      this.activeAbilityId = null;
      this.abilityOrientation = 'horizontal';
      this.relocationShipId = null;
      this.buildAbilityControls();
      this.addLog('Gefechtsstationen besetzt. Waffensysteme freigegeben.', 'system');
      this.addLog('Feindlicher Verband im Zielsektor erfasst.', 'system');
      this.renderBattle();
      this.startPlayerTurn();
    }

    buildAbilityControls() {
      const commander = this.game.activeCommander;
      const commanderMode = this.game.mode === 'commander' && commander;
      this.elements.commanderHud.hidden = !commanderMode;
      if (!commanderMode) {
        this.elements.abilityControls.innerHTML = '';
        return;
      }
      this.elements.abilityControls.innerHTML = commander.abilities.map((ability) => `
        <button class="ability-button" type="button" data-ability-id="${ability.id}" aria-pressed="false" title="${ability.description}">
          <span>${ability.shortName}</span><strong>${this.getAbilityCost(ability)}P</strong>
        </button>`).join('');
      const hasOrientationAbility = commander.abilities.some((ability) => ['line', 'purchase-ship', 'diagonal-flame'].includes(ability.pattern));
      this.elements.commanderHud.classList.toggle('no-orientation', !hasOrientationAbility);
      this.elements.abilityOrientationButton.hidden = !hasOrientationAbility;
      this.renderCommanderHud();
    }

    getActiveAbility() {
      return this.game.activeCommander?.abilities.find((ability) => ability.id === this.activeAbilityId) || null;
    }

    async handleAbilitySelection(event) {
      const button = event.target.closest('[data-ability-id]');
      if (!button || button.disabled || this.game.turn !== 'player' || this.cinematicActive) return;
      if (this.game.freeShotsRemaining > 0) {
        this.showToast(`Zuerst ${this.game.freeShotsRemaining} Freischuss${this.game.freeShotsRemaining === 1 ? '' : 'e'} abfeuern.`);
        return;
      }
      if (this.game.abilityJammedTurns > 0) {
        this.showToast('STÖRSENDER AKTIV // Nur ein normaler Schuss ist möglich.');
        return;
      }
      const selectedAbility = this.game.activeCommander?.abilities.find((ability) => ability.id === button.dataset.abilityId);
      if (this.multiplayer.active && ['random-barrage', 'last-revenge', 'jet-launch', 'jammer'].includes(selectedAbility?.pattern)) {
        this.activeAbilityId = null;
        this.relocationShipId = null;
        this.clearAbilityPreview();
        await this.sendMultiplayerCommand('ability', { abilityId: selectedAbility.id });
        return;
      }
      if (selectedAbility?.pattern === 'random-barrage') {
        this.activeAbilityId = null;
        this.relocationShipId = null;
        this.clearAbilityPreview();
        if (root.document.documentElement.classList.contains('mobile-layout')) {
          this.mobileBattleBoard = 'enemy';
          this.updateMobileBattleBoardLayout();
        }
        await this.executeRandomBarrage(this.getAbilityForUse(selectedAbility));
        return;
      }
      if (selectedAbility?.pattern === 'last-revenge') {
        this.activeAbilityId = null;
        this.relocationShipId = null;
        this.clearAbilityPreview();
        if (root.document.documentElement.classList.contains('mobile-layout')) {
          this.mobileBattleBoard = 'enemy';
          this.updateMobileBattleBoardLayout();
        }
        await this.executeLastRevenge(this.getAbilityForUse(selectedAbility));
        return;
      }
      if (selectedAbility?.pattern === 'jet-launch') {
        this.activeAbilityId = null;
        this.relocationShipId = null;
        this.clearAbilityPreview();
        await this.executeJetLaunch(this.getAbilityForUse(selectedAbility));
        return;
      }
      if (selectedAbility?.pattern === 'jammer') {
        this.activeAbilityId = null;
        this.relocationShipId = null;
        this.clearAbilityPreview();
        await this.executeSignalJammer(this.getAbilityForUse(selectedAbility));
        return;
      }
      const nextAbilityId = this.activeAbilityId === button.dataset.abilityId ? null : button.dataset.abilityId;
      if (nextAbilityId !== this.activeAbilityId) this.relocationShipId = null;
      this.activeAbilityId = nextAbilityId;
      this.clearAbilityPreview();
      const ability = this.getActiveAbility();
      if (ability && root.document.documentElement.classList.contains('mobile-layout')) {
        this.mobileBattleBoard = ability.target === 'player' ? 'player' : 'enemy';
        this.updateMobileBattleBoardLayout();
      }
      this.renderCommanderHud();
    }

    toggleAbilityOrientation() {
      if (this.elements.abilityOrientationButton.disabled || this.cinematicActive) return;
      this.abilityOrientation = this.abilityOrientation === 'horizontal' ? 'vertical' : 'horizontal';
      const pattern = this.getActiveAbility()?.pattern;
      const label = pattern === 'purchase-ship' ? 'SCHIFF' : pattern === 'diagonal-flame' ? 'DIAG' : 'LINIE';
      const direction = pattern === 'diagonal-flame'
        ? (this.abilityOrientation === 'horizontal' ? '╲' : '╱')
        : (this.abilityOrientation === 'horizontal' ? 'H' : 'V');
      this.elements.abilityOrientationButton.textContent = `${label} ${direction}`;
      this.clearAbilityPreview();
      this.audio.tone(340, 0.07, { type: 'square', volume: 0.05 });
    }

    renderCommanderHud() {
      const commander = this.game.activeCommander;
      if (this.game.mode !== 'commander' || !commander) {
        this.elements.commanderHud.hidden = true;
        return;
      }
      this.elements.commanderHud.hidden = false;
      this.elements.commandPoints.textContent = String(this.game.commandPoints);
      this.elements.abilityControls.querySelectorAll('.ability-button').forEach((button) => {
        const ability = commander.abilities.find((candidate) => candidate.id === button.dataset.abilityId);
        const active = ability.id === this.activeAbilityId;
        const purchaseDefinition = ability.pattern === 'purchase-ship'
          ? CONFIG.ships.find((ship) => ship.id === ability.shipId)
          : null;
        const purchaseComplete = Boolean(purchaseDefinition && this.game.purchasedShipIds.has(purchaseDefinition.id));
        const jetLaunchComplete = ability.pattern === 'jet-launch' && this.game.playerJet.launched;
        button.disabled = purchaseComplete
          || jetLaunchComplete
          || this.game.abilityJammedTurns > 0
          || this.game.commandPoints < this.getAbilityCost(ability)
          || this.game.turn !== 'player'
          || this.game.phase !== 'battle'
          || this.game.freeShotsRemaining > 0;
        button.title = purchaseComplete
          ? 'Zusätzliches Schiff bereits gekauft.'
          : jetLaunchComplete
            ? 'RAPTOR Jet wurde bereits gestartet.'
            : this.game.abilityJammedTurns > 0
              ? 'Störsender aktiv: Fähigkeiten sind in diesem Zug gesperrt.'
              : ability.description;
        button.setAttribute('aria-pressed', String(active));
      });
      const activeAbility = this.getActiveAbility();
      const orientationActive = ['line', 'purchase-ship', 'diagonal-flame'].includes(activeAbility?.pattern);
      this.elements.abilityOrientationButton.disabled = !orientationActive || this.game.turn !== 'player';
      const orientationLabel = activeAbility?.pattern === 'purchase-ship'
        ? 'SCHIFF'
        : activeAbility?.pattern === 'diagonal-flame' ? 'DIAG' : 'LINIE';
      const orientationDirection = activeAbility?.pattern === 'diagonal-flame'
        ? (this.abilityOrientation === 'horizontal' ? '╲' : '╱')
        : (this.abilityOrientation === 'horizontal' ? 'H' : 'V');
      this.elements.abilityOrientationButton.textContent = `${orientationLabel} ${orientationDirection}`;
      this.elements.enemyBoard.classList.toggle('ability-targeting', Boolean(activeAbility) && activeAbility.target !== 'player');
      this.elements.playerBoard.classList.toggle('ability-targeting', activeAbility?.target === 'player');
    }

    getAbilityCells(ability, row, col) {
      const size = CONFIG.gridSize;
      if (ability.pattern === 'purchase-ship') {
        const definition = CONFIG.ships.find((ship) => ship.id === ability.shipId);
        const length = definition?.length || 3;
        const startRow = this.abilityOrientation === 'vertical' ? Math.min(Math.max(row, 0), size - length) : row;
        const startCol = this.abilityOrientation === 'horizontal' ? Math.min(Math.max(col, 0), size - length) : col;
        return Array.from({ length }, (_, index) => ({
          row: startRow + (this.abilityOrientation === 'vertical' ? index : 0),
          col: startCol + (this.abilityOrientation === 'horizontal' ? index : 0),
        }));
      }
      if (ability.pattern === 'full-row') {
        return Array.from({ length: size }, (_, column) => ({ row, col: column }));
      }
      if (ability.pattern === 'scan') {
        const startRow = Math.min(Math.max(row - 1, 0), size - 3);
        const startCol = Math.min(Math.max(col - 1, 0), size - 3);
        return Array.from({ length: 9 }, (_, index) => ({
          row: startRow + Math.floor(index / 3),
          col: startCol + (index % 3),
        }));
      }
      if (ability.pattern === 'scan-shot') {
        const cells = [];
        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
            const targetRow = row + rowOffset;
            const targetCol = col + colOffset;
            if (targetRow >= 0 && targetRow < size && targetCol >= 0 && targetCol < size) {
              cells.push({ row: targetRow, col: targetCol });
            }
          }
        }
        return cells;
      }
      if (ability.pattern === 'hydrogen-field') {
        const areaSize = Math.max(1, Number(ability.areaSize) || 4);
        const startRow = Math.min(Math.max(row - 1, 0), size - areaSize);
        const startCol = Math.min(Math.max(col - 1, 0), size - areaSize);
        return Array.from({ length: areaSize * areaSize }, (_, index) => ({
          row: startRow + Math.floor(index / areaSize),
          col: startCol + (index % areaSize),
        }));
      }
      if (['repair', 'chemical', 'mine', 'nuclear', 'rangefinder'].includes(ability.pattern)) return [{ row, col }];
      if (ability.pattern === 'diagonal-flame') {
        const startRow = Math.min(Math.max(row - 1, 0), size - 3);
        if (this.abilityOrientation === 'vertical') {
          const startCol = Math.min(Math.max(col + 1, 2), size - 1);
          return Array.from({ length: 3 }, (_, index) => ({ row: startRow + index, col: startCol - index }));
        }
        const startCol = Math.min(Math.max(col - 1, 0), size - 3);
        return Array.from({ length: 3 }, (_, index) => ({ row: startRow + index, col: startCol + index }));
      }
      if (ability.pattern === 'square') {
        const startRow = Math.min(Math.max(row - 1, 0), size - 2);
        const startCol = Math.min(Math.max(col - 1, 0), size - 2);
        return [
          { row: startRow, col: startCol }, { row: startRow, col: startCol + 1 },
          { row: startRow + 1, col: startCol }, { row: startRow + 1, col: startCol + 1 },
        ];
      }
      if (this.abilityOrientation === 'vertical') {
        const startRow = Math.min(Math.max(row - 1, 0), size - 3);
        return Array.from({ length: 3 }, (_, index) => ({ row: startRow + index, col }));
      }
      const startCol = Math.min(Math.max(col - 1, 0), size - 3);
      return Array.from({ length: 3 }, (_, index) => ({ row, col: startCol + index }));
    }

    clearAbilityPreview() {
      [this.elements.enemyBoard, this.elements.playerBoard].forEach((board) => {
        board.querySelectorAll('.ability-preview, .ability-preview-blocked, .repair-preview, .mine-preview, .submerge-preview, .sacrifice-preview, .purchase-preview, .relocation-preview, .relocation-select-preview').forEach((cell) => {
          cell.classList.remove('ability-preview', 'ability-preview-blocked', 'repair-preview', 'mine-preview', 'submerge-preview', 'sacrifice-preview', 'purchase-preview', 'relocation-preview', 'relocation-select-preview');
        });
      });
    }

    handleTargetHover(event) {
      if (this.cinematicActive) return;
      const cell = event.target.closest('.grid-cell');
      if (!cell) return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      this.elements.targetCoordinate.textContent = this.coordinate(row, col);
      this.clearAbilityPreview();
      const ability = this.getActiveAbility();
      if (!ability || ability.target === 'player') return;
      this.getAbilityCells(ability, row, col).forEach((coordinate) => {
        const previewCell = this.getCell(this.elements.enemyBoard, coordinate.row, coordinate.col);
        if (previewCell) previewCell.classList.add(previewCell.classList.contains('shot') ? 'ability-preview-blocked' : 'ability-preview');
      });
    }

    handleRepairHover(event) {
      if (this.cinematicActive) return;
      const ability = this.getActiveAbility();
      if (!ability || ability.target !== 'player') return;
      const cell = event.target.closest('.grid-cell');
      if (!cell) return;
      this.clearAbilityPreview();
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const key = this.game.playerBoard.key(row, col);
      const shot = this.game.playerBoard.shots.get(key);
      if (ability.pattern === 'relocation') {
        this.previewRelocation(row, col);
        return;
      }
      if (ability.pattern === 'mine') {
        cell.classList.add(!shot && !this.game.playerMines.has(key) ? 'mine-preview' : 'ability-preview-blocked');
        return;
      }
      if (ability.pattern === 'submerge') {
        const ship = this.game.playerBoard.getShipAt(row, col);
        if (!ship || ship.isSunk) {
          cell.classList.add('ability-preview-blocked');
          return;
        }
        ship.getCells().forEach((coordinate) => {
          this.getCell(this.elements.playerBoard, coordinate.row, coordinate.col)?.classList.add('submerge-preview');
        });
        return;
      }
      if (ability.pattern === 'sacrifice') {
        const ship = this.game.playerBoard.getShipAt(row, col);
        const valid = ship && !ship.isSunk && this.game.playerBoard.afloatCount > 1;
        (ship ? ship.getCells() : [{ row, col }]).forEach((coordinate) => {
          this.getCell(this.elements.playerBoard, coordinate.row, coordinate.col)?.classList.add(valid ? 'sacrifice-preview' : 'ability-preview-blocked');
        });
        return;
      }
      if (ability.pattern === 'purchase-ship') {
        const definition = CONFIG.ships.find((ship) => ship.id === ability.shipId);
        const cells = this.getAbilityCells(ability, row, col);
        const start = cells[0];
        const valid = definition
          && !this.game.purchasedShipIds.has(definition.id)
          && this.game.playerBoard.canPlace(definition, start.row, start.col, this.abilityOrientation)
          && cells.every((coordinate) => !this.game.playerBoard.shots.has(this.game.playerBoard.key(coordinate.row, coordinate.col)));
        cells.forEach((coordinate) => {
          this.getCell(this.elements.playerBoard, coordinate.row, coordinate.col)?.classList.add(valid ? 'purchase-preview' : 'ability-preview-blocked');
        });
        return;
      }
      const ship = this.game.playerBoard.getShipAt(row, col);
      cell.classList.add(ship && shot && shot.type !== 'miss' ? 'repair-preview' : 'ability-preview-blocked');
    }

    previewRelocation(row, col) {
      const board = this.game.playerBoard;
      if (!this.relocationShipId) {
        const ship = board.getShipAt(row, col);
        const selectable = ship && ship.hits.size === 0;
        (ship ? ship.getCells() : [{ row, col }]).forEach((coordinate) => {
          const previewCell = this.getCell(this.elements.playerBoard, coordinate.row, coordinate.col);
          if (previewCell) previewCell.classList.add(selectable ? 'relocation-select-preview' : 'ability-preview-blocked');
        });
        return;
      }
      const ship = board.ships.find((candidate) => candidate.id === this.relocationShipId);
      if (!ship) return;
      const cells = board.getPlacementCells(ship, row, col, ship.orientation);
      const valid = !(ship.row === row && ship.col === col)
        && board.canPlace(ship, row, col, ship.orientation, ship.id)
        && cells.every((coordinate) => !board.shots.has(board.key(coordinate.row, coordinate.col)));
      cells.forEach((coordinate) => {
        const previewCell = this.getCell(this.elements.playerBoard, coordinate.row, coordinate.col);
        if (previewCell) previewCell.classList.add(valid ? 'relocation-preview' : 'ability-preview-blocked');
      });
    }

    markRelocationSelection() {
      this.elements.playerBoard.querySelectorAll('.relocation-selected').forEach((cell) => cell.classList.remove('relocation-selected'));
      if (!this.relocationShipId) return;
      const ship = this.game.playerBoard.ships.find((candidate) => candidate.id === this.relocationShipId);
      ship?.getCells().forEach((coordinate) => {
        this.getCell(this.elements.playerBoard, coordinate.row, coordinate.col)?.classList.add('relocation-selected');
      });
    }

    getCinematicPayload(results, playerShot, ability = null, sourceShipOverride = null) {
      const strongestResult = results.find((result) => result.type === 'sunk')
        || results.find((result) => result.type === 'hit')
        || results[0];
      const sourceBoard = playerShot ? this.game.playerBoard : this.game.enemyBoard;
      const sourceShip = sourceShipOverride || (ability?.pattern === 'relocation' && strongestResult?.ship
        ? strongestResult.ship
        : sourceBoard.ships.find((ship) => !ship.isSunk) || sourceBoard.ships[0] || null);
      return {
        attacker: playerShot ? 'player' : 'enemy',
        results,
        ability,
        animationId: ability?.animationId || 'standard-missile',
        sourceShip,
        targetShip: strongestResult?.ship || null,
        coordinates: results
          .filter((result) => Number.isInteger(result.row) && Number.isInteger(result.col))
          .map((result) => this.coordinate(result.row, result.col)),
      };
    }

    async playShotCinematic(results, playerShot, ability = null, sourceShipOverride = null) {
      this.cinematicActive = true;
      try {
        await this.cinematic.play(this.getCinematicPayload(results, playerShot, ability, sourceShipOverride));
        return true;
      } finally {
        this.cinematicActive = false;
      }
    }

    async handlePlayerShot(event) {
      const cell = event.target.closest('.grid-cell');
      if (!cell || this.game.phase !== 'battle' || this.cinematicActive) return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (this.game.turn !== 'player') {
        this.showToast('Waffensystem gesperrt. Feindlicher Zug läuft.');
        return;
      }
      const activeAbility = this.getActiveAbility();
      if (this.multiplayer.active) {
        if (activeAbility?.target === 'player') {
          this.showToast('Ziel für diese Fähigkeit auf dem eigenen Spielfeld auswählen.');
          return;
        }
        const accepted = activeAbility
          ? await this.sendMultiplayerCommand('ability', {
            abilityId: activeAbility.id,
            row,
            col,
            orientation: this.abilityOrientation,
          })
          : await this.sendMultiplayerCommand('fire', { row, col });
        if (accepted) {
          this.activeAbilityId = null;
          this.clearAbilityPreview();
        }
        return;
      }
      if (activeAbility) {
        if (activeAbility.target === 'player') {
          this.showToast('Ziel für diese Fähigkeit auf dem eigenen Spielfeld auswählen.');
          return;
        }
        await this.handleAbilityShot(activeAbility, row, col);
        return;
      }
      const result = this.game.playerAttack(row, col);
      if (!result.valid) {
        if (result.reason === 'already-shot') this.showToast(`${this.coordinate(row, col)} wurde bereits beschossen.`);
        return;
      }

      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const cinematicPlayed = await this.playShotCinematic([result], true);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.resolveShotFeedback(this.elements.enemyBoard, result, true, { playAudio: !cinematicPlayed });
      if (result.lastRevengeFailed) {
        this.showToast('LETZTE RACHE // 15 SCHÜSSE VERBRAUCHT // MISSION GESCHEITERT');
        this.completePlayerTurn();
        return;
      }
      if (result.lastRevengeWon) {
        this.showToast('LETZTE RACHE // ZIELFLOTTE VERNICHTET // MISSION ERFÜLLT');
        this.completePlayerTurn();
        return;
      }
      if (result.freeShotsRemaining > 0) {
        this.showToast(this.game.lastRevengeActive
          ? `LETZTE RACHE // NOCH ${result.freeShotsRemaining} SCHÜSSE`
          : `FREISCHUSS-SALVE // NOCH ${result.freeShotsRemaining}`);
        this.startPlayerTurn();
        return;
      }
      this.completePlayerTurn();
    }

    async handleAbilityShot(ability, row, col) {
      ability = this.getAbilityForUse(ability);
      const cells = this.getAbilityCells(ability, row, col);
      if (ability.pattern === 'scan') {
        await this.handleScannerAbility(ability, row, col, cells);
        return;
      }
      if (ability.pattern === 'scan-shot') {
        await this.handleScanShotAbility(ability, row, col);
        return;
      }
      if (ability.pattern === 'chemical') {
        await this.handleChemicalAbility(ability, row, col);
        return;
      }
      if (ability.pattern === 'nuclear') {
        await this.handleNuclearAbility(ability, row, col);
        return;
      }
      if (ability.pattern === 'rangefinder') {
        await this.handleRangefinderAbility(ability, row, col);
        return;
      }
      if (ability.pattern === 'full-row') {
        await this.handleTorpedoAbility(ability, row);
        return;
      }
      const result = this.game.playerAttackPattern(cells, ability);
      if (!result.valid) {
        if (result.reason === 'already-shot') this.showToast('Alle Felder in diesem Zielbereich wurden bereits beschossen.');
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const cinematicPlayed = await this.playShotCinematic(result.results, true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      result.results.forEach((shotResult) => this.resolveShotFeedback(this.elements.enemyBoard, shotResult, true, { playAudio: !cinematicPlayed }));
      const pointMessage = result.pointsGained > 0 ? ` · ${result.pointsGained}P erhalten` : ' · keine Punkte in Fähigkeitsrunde';
      this.showToast(`${ability.name} ausgeführt · ${ability.cost}P eingesetzt${pointMessage}.`);
      this.completePlayerTurn();
    }

    async handleTorpedoAbility(ability, row) {
      const result = this.game.playerTorpedoRow(row, ability);
      if (!result.valid) {
        if (result.reason === 'already-shot') this.showToast('Diese Reihe wurde bereits vollständig beschossen.');
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const cinematicPlayed = await this.playShotCinematic(result.results, true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      result.results.forEach((shotResult) => {
        this.resolveShotFeedback(this.elements.enemyBoard, shotResult, true, { playAudio: !cinematicPlayed });
      });
      const hits = result.results.filter((shotResult) => shotResult.type !== 'miss').length;
      this.addLog(`${ability.name}: Reihe ${row + 1} durchschlagen, ${hits} Treffer.`, hits ? 'hit' : 'miss');
      this.showToast(`TORPEDO // REIHE ${row + 1} // ${result.results.length} SCHÜSSE // ${hits} TREFFER // KEINE PUNKTE`);
      this.completePlayerTurn();
    }

    async handleRangefinderAbility(ability, row, col) {
      const result = this.game.playerRangefinderShot(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'already-shot') this.showToast('Dieses Feld wurde bereits beschossen.');
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([{ ...result, type: 'range-result', shotType: result.type }], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.resolveShotFeedback(this.elements.enemyBoard, result, true, { playAudio: false });
      const contactMessage = result.distance === null
        ? 'KEINE AKTIVEN KONTAKTE'
        : `NÄCHSTER KONTAKT // ${result.distance} FELD${result.distance === 1 ? '' : 'ER'}`;
      this.addLog(`${ability.name}: ${contactMessage}.`, 'system');
      this.showToast(`${contactMessage} // ${ability.cost}P // KEINE PUNKTE`);
      this.completePlayerTurn();
    }

    async executeRandomBarrage(ability) {
      const result = this.game.playerRandomBarrage(ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        if (result.reason === 'no-targets') this.showToast('Keine unbeschossenen Zielfelder verfügbar.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const cinematicPlayed = await this.playShotCinematic(result.results, true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      result.results.forEach((shotResult) => {
        this.resolveShotFeedback(this.elements.enemyBoard, shotResult, true, { playAudio: !cinematicPlayed });
      });
      const hits = result.results.filter((shotResult) => shotResult.type !== 'miss').length;
      this.addLog(`${ability.name}: ${result.results.length} Zufallsziele, ${hits} Treffer.`, hits ? 'hit' : 'miss');
      this.showToast(`AMOKLAUF // ${result.results.length} SCHÜSSE // ${hits} TREFFER // ${ability.cost}P // KEINE PUNKTE`);
      this.completePlayerTurn();
    }

    async executeLastRevenge(ability) {
      const result = this.game.playerActivateLastRevenge(ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else if (result.reason === 'free-shots-active') this.showToast('Eine Spezialschussfolge ist bereits aktiv.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog(`${ability.name} aktiviert // ${result.shotsGranted} Schüsse // Sieg oder sofortige Niederlage.`, 'system');
      this.showToast(`LETZTE RACHE // ${result.shotsGranted} SCHÜSSE // KEIN RÜCKZUG`);
      this.startPlayerTurn();
    }

    async executeJetLaunch(ability) {
      const result = this.game.playerLaunchJet(ability);
      if (!result.valid) {
        const messages = {
          'insufficient-points': 'Nicht genügend Kommandopunkte.',
          'jet-already-launched': 'Der RAPTOR Jet ist bereits gestartet.',
          'carrier-unavailable': 'Jet Start nicht möglich: Der Flugzeugträger ist nicht einsatzbereit.',
          'no-jet-position': 'Kein freier Wasser-Sektor für den RAPTOR Jet.',
        };
        this.showToast(messages[result.reason] || 'JET START ABGEBROCHEN');
        return;
      }
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([result], true, ability, result.carrier);
      if (token !== this.actionToken) return;
      this.renderBattle();
      const coordinate = this.coordinate(result.row, result.col);
      this.addLog(`RAPTOR Jet vom Flugzeugträger gestartet // eigener Sektor ${coordinate}.`, 'system');
      this.showToast(`RAPTOR JET AKTIV // SEKTOR ${coordinate} // MUSS VERTEIDIGT WERDEN`);
      this.completePlayerTurn();
    }

    async executeSignalJammer(ability) {
      const result = this.game.playerActivateJammer(ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else this.showToast('STÖRSENDER KANN NICHT AKTIVIERT WERDEN');
        return;
      }
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog('Störsender aktiv: Gegnerische Fähigkeiten für den nächsten Zug gesperrt.', 'system');
      this.showToast('STÖRSIGNAL ÜBERTRAGEN // GEGNERISCHE FÄHIGKEITEN GESPERRT');
      this.completePlayerTurn();
    }

    async handleNuclearAbility(ability, row, col) {
      const result = this.game.playerNuclearAttack(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'already-shot') this.showToast('Dieses Feld wurde bereits beschossen.');
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const cinematicResult = {
        ...result,
        type: result.nuclearHit ? 'nuclear-hit' : 'nuclear-miss',
        ship: result.nuclearHit ? result.ship : null,
      };
      await this.playShotCinematic([cinematicResult], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.resolveShotFeedback(this.elements.enemyBoard, result, true, { playAudio: false });
      this.showToast(result.nuclearHit
        ? `ATOMTREFFER // ${result.shipName} VOLLSTÄNDIG VERSENKT // ${ability.cost}P`
        : `ATOMARESULTAT: WASSER // ${ability.cost}P // KEINE PUNKTE`);
      this.completePlayerTurn();
    }

    async handleChemicalAbility(ability, row, col) {
      const result = this.game.playerChemicalAttack(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'already-shot') this.showToast('Dieses Feld wurde bereits beschossen.');
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const cinematicResult = {
        ...result,
        type: result.revealed ? 'chemical-reveal' : 'chemical-miss',
        ship: result.revealed ? result.ship : null,
      };
      await this.playShotCinematic([cinematicResult], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.resolveShotFeedback(this.elements.enemyBoard, result, true, { playAudio: false });
      if (result.revealed) {
        this.addLog(`${ability.name}: komplette Schiffssignatur bei ${this.coordinate(row, col)} sichtbar gemacht.`, 'system');
        this.showToast(`SCHIFFSSIGNATUR SICHTBAR // ${ability.cost}P EINGESETZT`);
      } else {
        this.showToast(`KEIN KONTAKT // ${ability.cost}P EINGESETZT // KEINE PUNKTE`);
      }
      this.completePlayerTurn();
    }

    async handleScannerAbility(ability, row, col, cells) {
      const result = this.game.playerScan(cells, ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const scanResult = {
        type: result.found ? 'scan-found' : 'scan-clear',
        row,
        col,
        found: result.found,
      };
      await this.playShotCinematic([scanResult], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      if (result.found) {
        this.addLog(`${ability.name}: Kontakt im gescannten 3×3-Sektor bestätigt.`, 'hit');
        this.showToast(`KONTAKT GEFUNDEN · ${ability.cost}P eingesetzt · keine Felder markiert.`);
      } else {
        this.addLog(`${ability.name}: Sektor leer. ${result.marked.length} Felder als Wasser markiert.`, 'miss');
        this.showToast(`SEKTOR LEER · ${result.marked.length} Felder als Wasser markiert · ${ability.cost}P.`);
      }
      this.completePlayerTurn();
    }

    async handleScanShotAbility(ability, row, col) {
      const result = this.game.playerScanShot(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'already-shot') this.showToast('Das Zentrum wurde bereits beschossen.');
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      const cinematicResult = {
        ...result.shot,
        type: 'scan-shot-result',
        shotType: result.shot.type,
        contactsMarked: result.contactsMarked.length,
        waterMarked: result.waterMarked.length,
      };
      await this.playShotCinematic([cinematicResult], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.resolveShotFeedback(this.elements.enemyBoard, result.shot, true, { playAudio: false });
      const contactCount = result.contactsMarked.length;
      const waterCount = result.waterMarked.length;
      this.addLog(`${ability.name}: Zentrum beschossen, ${contactCount} anonyme Kontakte, ${waterCount} Wasserfelder.`, result.shot.type === 'miss' ? 'miss' : 'hit');
      this.showToast(`SCAN-SCHUSS // ${contactCount} KONTAKT${contactCount === 1 ? '' : 'E'} // ${waterCount}× WASSER // ${ability.cost}P`);
      this.completePlayerTurn();
    }

    async handleRepairSelection(event) {
      const activeAbility = this.getActiveAbility();
      const ability = activeAbility ? this.getAbilityForUse(activeAbility) : null;
      if (!ability || ability.target !== 'player' || this.cinematicActive) return;
      const cell = event.target.closest('.grid-cell');
      if (!cell || this.game.phase !== 'battle' || this.game.turn !== 'player') return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (this.multiplayer.active) {
        await this.handleMultiplayerOwnAbility(ability, row, col);
        return;
      }
      if (ability.pattern === 'relocation') {
        await this.handleRelocationSelection(ability, row, col);
        return;
      }
      if (ability.pattern === 'mine') {
        await this.handleMineSelection(ability, row, col);
        return;
      }
      if (ability.pattern === 'submerge') {
        await this.handleSubmergeSelection(ability, row, col);
        return;
      }
      if (ability.pattern === 'sacrifice') {
        await this.handleSacrificeSelection(ability, row, col);
        return;
      }
      if (ability.pattern === 'purchase-ship') {
        await this.handlePurchaseSelection(ability, row, col);
        return;
      }
      const result = this.game.playerRepair(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else if (result.reason === 'no-ship') this.showToast('An dieser Position befindet sich kein eigenes Schiff.');
        else this.showToast('Dieses Schiffsteil ist nicht beschädigt.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog(`${ability.name}: ${result.shipName} bei ${this.coordinate(row, col)} repariert.`, 'system');
      this.showToast(`${result.shipName}: 1 Schiffsteil repariert · ${ability.cost}P eingesetzt.`);
      this.completePlayerTurn();
    }

    async handleMultiplayerOwnAbility(ability, row, col) {
      if (ability.pattern === 'relocation' && !this.relocationShipId) {
        const clickedShip = this.game.playerBoard.getShipAt(row, col);
        if (!clickedShip || clickedShip.hits.size > 0) {
          this.showToast('Zuerst ein eigenes unbeschädigtes Schiff auswählen.');
          return;
        }
        this.relocationShipId = clickedShip.id;
        this.markRelocationSelection();
        this.showToast(`${clickedShip.name} gewählt // freie Zielposition antippen.`);
        return;
      }
      const accepted = await this.sendMultiplayerCommand('ability', {
        abilityId: ability.id,
        row,
        col,
        orientation: this.abilityOrientation,
        shipId: this.relocationShipId,
      });
      if (accepted) {
        this.activeAbilityId = null;
        this.relocationShipId = null;
        this.clearAbilityPreview();
      }
    }

    async handleSubmergeSelection(ability, row, col) {
      const result = this.game.playerSubmergeShip(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else if (result.reason === 'no-ship') this.showToast('Hier befindet sich kein eigenes Schiff.');
        else if (result.reason === 'ship-sunk') this.showToast('Ein versenktes Schiff kann nicht untertauchen.');
        else this.showToast('Dieses Schiff kann aktuell nicht untertauchen.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog(`${result.shipName} ist für den nächsten gegnerischen Zug untergetaucht.`, 'system');
      this.showToast(`${result.shipName.toUpperCase()} // UNTERGETAUCHT // NÄCHSTER GEGNERISCHER ZUG BLOCKIERT`);
      this.completePlayerTurn();
    }

    async handleSacrificeSelection(ability, row, col) {
      const result = this.game.playerSacrificeShip(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else if (result.reason === 'no-ship') this.showToast('Hier befindet sich kein eigenes Schiff.');
        else if (result.reason === 'ship-sunk') this.showToast('Dieses Schiff ist bereits zerstört.');
        else if (result.reason === 'last-ship') this.showToast('Die letzte aktive Einheit kann nicht geopfert werden.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog(`${result.shipName} geopfert // ${result.freeShotsGranted} Spezialschüsse freigegeben.`, 'system');
      this.showToast(`OPFERUNG // ${result.shipName.toUpperCase()} // ${result.freeShotsGranted} SCHÜSSE // KEINE FEHLSCHUSSPUNKTE`);
      this.startPlayerTurn();
    }

    async handlePurchaseSelection(ability, row, col) {
      const result = this.game.playerPurchaseShip(row, col, this.abilityOrientation, ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else if (result.reason === 'already-purchased') this.showToast('Der zusätzliche 3er wurde bereits gekauft.');
        else if (result.reason === 'previously-fired-upon') this.showToast('Mindestens ein Zielfeld wurde bereits beschossen.');
        else this.showToast('Für den 3er ist an dieser Position nicht genug freier Raum.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog(`${result.shipName} bei ${this.coordinate(result.row, result.col)} in die Flotte aufgenommen.`, 'system');
      this.showToast(`SCHIFFSKAUF // ${result.shipName.toUpperCase()} EINSATZBEREIT // ${ability.cost}P`);
      this.completePlayerTurn();
    }

    async handleRelocationSelection(ability, row, col) {
      const board = this.game.playerBoard;
      const clickedShip = board.getShipAt(row, col);
      if (!this.relocationShipId || (clickedShip && clickedShip.id !== this.relocationShipId && clickedShip.hits.size === 0)) {
        if (!clickedShip) {
          this.showToast('Zuerst ein eigenes unbeschädigtes Schiff auswählen.');
          return;
        }
        if (clickedShip.hits.size > 0) {
          this.showToast('Getroffene Schiffe können nicht verschoben werden.');
          return;
        }
        this.relocationShipId = clickedShip.id;
        this.markRelocationSelection();
        this.showToast(`${clickedShip.name} gewählt // freie Zielposition antippen.`);
        return;
      }

      const result = this.game.playerRelocateShip(this.relocationShipId, row, col, ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else if (result.reason === 'same-position') this.showToast('Das Schiff befindet sich bereits an dieser Position.');
        else if (result.reason === 'previously-fired-upon') this.showToast('Zielbereich wurde bereits beschossen.');
        else this.showToast('Zielbereich ist blockiert oder liegt außerhalb des Rasters.');
        return;
      }
      this.activeAbilityId = null;
      this.relocationShipId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog(`${result.shipName} taktisch nach ${this.coordinate(row, col)} verlegt.`, 'system');
      this.showToast(`${result.shipName} VERSCHOBEN // ${ability.cost}P EINGESETZT`);
      this.completePlayerTurn();
    }

    async handleMineSelection(ability, row, col) {
      const result = this.game.playerPlaceMine(row, col, ability);
      if (!result.valid) {
        if (result.reason === 'insufficient-points') this.showToast('Nicht genügend Kommandopunkte.');
        else if (result.reason === 'already-shot') this.showToast('Auf einem beschossenen Feld kann keine Mine liegen.');
        else if (result.reason === 'mine-present') this.showToast('Auf diesem Feld liegt bereits eine Mine.');
        return;
      }
      this.activeAbilityId = null;
      this.clearAbilityPreview();
      const token = this.actionToken;
      this.setTurnDisplay('enemy');
      await this.playShotCinematic([result], true, ability);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.addLog(`${ability.name}: Mine bei ${this.coordinate(row, col)} scharf.`, 'system');
      this.showToast(`MINE SCHARF // BEI TREFFER 3 FREISCHÜSSE // ${ability.cost}P`);
      this.completePlayerTurn();
    }

    completePlayerTurn() {
      if (this.game.phase === 'gameover') {
        root.setTimeout(() => this.showGameOver(), 820);
        return;
      }
      this.setTurnDisplay('enemy');
      const token = this.actionToken;
      root.setTimeout(() => {
        if (token === this.actionToken && this.game.phase === 'battle') this.performEnemyTurn();
      }, CONFIG.aiDelayMs);
    }

    async performEnemyTurn() {
      const target = this.ai.chooseTarget(this.game.playerBoard);
      if (!target) return;
      const result = this.game.enemyAttack(target.row, target.col);
      if (!result.valid) return;
      const token = this.actionToken;
      const defensiveAbility = result.type === 'blocked'
        ? this.game.activeCommander?.abilities.find((ability) => ability.pattern === 'submerge')
        : null;
      const cinematicPlayed = await this.playShotCinematic([result], false, defensiveAbility);
      if (token !== this.actionToken) return;
      this.renderBattle();
      this.resolveShotFeedback(this.elements.playerBoard, result, false, { playAudio: !cinematicPlayed });
      if (result.type === 'blocked') {
        this.showToast(`BLOCKIERT // ${result.shipName.toUpperCase()} BLEIBT UNBESCHÄDIGT`);
      }
      if (result.type === 'jet-hit') {
        this.showToast('RAPTOR JET GETROFFEN // LUFTKONTAKT VERLOREN');
      } else if (result.jetMoved) {
        this.showToast(`RAPTOR JET // NEUER SEKTOR ${this.coordinate(result.jetTo.row, result.jetTo.col)}`);
      }
      if (result.mineTriggered) {
        this.addCellEffect(this.elements.playerBoard, result.row, result.col, 'mine-trigger-effect');
        this.addLog(`SEEMINE AUSGELÖST // ${result.freeShotsGranted} Freischüsse freigegeben.`, 'system');
        this.showToast(`MINE AUSGELÖST // ${result.freeShotsGranted} FREISCHÜSSE BEREIT`);
      }
      if (this.game.phase === 'gameover') {
        root.setTimeout(() => this.showGameOver(), 820);
        return;
      }
      root.setTimeout(() => this.startPlayerTurn(), 420);
    }

    startPlayerTurn() {
      if (this.game.phase !== 'battle') return;
      this.setTurnDisplay('player');
      this.elements.sonarPing.classList.remove('active');
      void this.elements.sonarPing.offsetWidth;
      this.elements.sonarPing.classList.add('active');
      this.audio.sonar();
    }

    setTurnDisplay(turn) {
      const playerTurn = turn === 'player';
      const freeVolley = playerTurn && this.game.freeShotsRemaining > 0;
      const revengeVolley = freeVolley && this.game.lastRevengeActive;
      const abilitiesJammed = playerTurn && this.game.abilityJammedTurns > 0;
      const mobileLayout = root.document.documentElement.classList.contains('mobile-layout');
      this.elements.battleTitle.textContent = mobileLayout
        ? (revengeVolley ? `Letzte Rache ×${this.game.freeShotsRemaining}` : freeVolley ? `Freischuss ×${this.game.freeShotsRemaining}` : playerTurn ? 'Dein Zug' : 'Gegner-Zug')
        : 'Taktische Gefechtskarte';
      this.elements.turnDisplay.classList.toggle('enemy', !playerTurn);
      this.elements.turnLabel.textContent = revengeVolley ? `NO RETURN ×${this.game.freeShotsRemaining}` : freeVolley ? `FREE FIRE ×${this.game.freeShotsRemaining}` : abilitiesJammed ? 'ECM LOCK // GUNS ONLY' : playerTurn ? 'TARGET LOCK READY' : 'HOSTILE SIGNAL';
      this.elements.fireOrderText.textContent = playerTurn
        ? revengeVolley
          ? `${this.game.freeShotsRemaining} Schüsse bis zur Entscheidung. Fähigkeiten sind gesperrt.`
          : freeVolley ? `${this.game.freeShotsRemaining} Freischüsse verbleiben. Fähigkeiten sind gesperrt.` : abilitiesJammed ? 'Störsender aktiv. Nur einen normalen Schuss abgeben.' : 'Ziel im feindlichen Raster wählen.'
        : 'Feindliche Zielerfassung. Position halten.';
      this.elements.enemyBoard.querySelector('.water-cells').classList.toggle('locked', !playerTurn);
      if (!playerTurn) {
        this.activeAbilityId = null;
        this.relocationShipId = null;
      }
      this.renderCommanderHud();
    }

    resolveShotFeedback(boardElement, result, playerShot, options = {}) {
      const playAudio = options.playAudio !== false;
      const coordinate = this.coordinate(result.row, result.col);
      const subject = playerShot ? 'Schuss' : 'Feindbeschuss';
      if (result.type === 'blocked') {
        this.addLog(`${subject} auf ${coordinate} – von ${result.shipName} blockiert.`, 'system');
        if (playAudio) this.audio.sonar();
        this.addCellEffect(boardElement, result.row, result.col, 'block-effect');
      } else if (result.type === 'jet-hit') {
        this.addLog(`${subject} auf ${coordinate} – RAPTOR Jet zerstört.`, 'sunk');
        if (playAudio) this.audio.explosion();
        this.addCellEffect(boardElement, result.row, result.col, 'explosion-effect');
        if (!playerShot) this.triggerOwnImpact(playAudio);
      } else if (result.type === 'miss') {
        this.addLog(`${subject} auf ${coordinate} – Wasser.`, 'miss');
        if (playAudio) this.audio.splash();
        this.addCellEffect(boardElement, result.row, result.col, 'splash-effect');
      } else if (result.type === 'hit') {
        const revealedEnemy = playerShot && this.game.enemyRevealedShipIds.has(result.shipId);
        const targetText = playerShot
          ? (revealedEnemy ? `aufgeklärte ${result.shipName}` : 'feindliche Einheit')
          : `eigenes ${result.shipName}`;
        this.addLog(`${subject} auf ${coordinate} – Treffer auf ${targetText}.`, 'hit');
        if (playAudio) this.audio.explosion();
        this.addCellEffect(boardElement, result.row, result.col, 'explosion-effect');
        if (!playerShot) this.triggerOwnImpact(playAudio);
      } else {
        this.addLog(`${playerShot ? 'Feindlicher' : 'Eigener'} ${result.shipName} versenkt!`, 'sunk');
        if (playAudio) this.audio.explosion();
        this.addCellEffect(boardElement, result.row, result.col, 'explosion-effect');
        if (!playerShot) this.triggerOwnImpact(playAudio);
      }
    }

    triggerOwnImpact(playAudio = true) {
      if (playAudio) this.audio.warning();
      this.elements.impactFlash.classList.remove('active');
      void this.elements.impactFlash.offsetWidth;
      this.elements.impactFlash.classList.add('active');
    }

    addCellEffect(boardElement, row, col, effectClass) {
      const cell = this.getCell(boardElement, row, col);
      if (!cell) return;
      const effect = document.createElement('span');
      effect.className = `effect ${effectClass}`;
      cell.appendChild(effect);
      root.setTimeout(() => effect.remove(), effectClass === 'explosion-effect' ? 1200 : 850);
    }

    renderBattle() {
      this.renderBoard(this.elements.playerBoard, this.game.playerBoard, {
        showShips: true,
        mines: this.game.playerMines,
        blockedMarkers: this.game.blockedAttackMarkers,
        submergedShipId: this.game.submergedShipId,
        jet: this.game.playerJet,
      });
      this.markRelocationSelection();
      this.renderBoard(this.elements.enemyBoard, this.game.enemyBoard, {
        showShips: false,
        showSunkShips: true,
        revealedShipIds: this.game.enemyRevealedShipIds,
        contactMarkers: this.game.enemyContactMarkers,
      });
      this.renderFleetStatus(this.elements.playerFleetList, this.game.playerBoard, {
        showDamage: true,
        definitions: this.game.playerFleetDefinitions,
        jet: this.game.playerJet,
      });
      this.renderFleetStatus(this.elements.enemyFleetList, this.game.enemyBoard, {
        revealedShipIds: this.game.enemyRevealedShipIds,
        definitions: this.multiplayer.active ? this.multiplayerOpponentFleet : this.game.enemyFleetDefinitions,
        jet: this.multiplayer.active ? this.multiplayerOpponentJet : null,
      });
      this.elements.playerAfloat.textContent = `${this.game.playerBoard.afloatCount + (this.game.playerJet.active ? 1 : 0)} AKTIV`;
      this.elements.enemyAfloat.textContent = `${this.multiplayer.active ? this.multiplayerOpponentAfloat : this.game.enemyBoard.afloatCount} AKTIV`;
      this.updateMobileBattleBoardLayout();
      this.renderCommanderHud();
      if (this.game.phase === 'battle') this.setTurnDisplay(this.game.turn);
    }

    handleMobileBoardSwitch(event) {
      if (!root.document.documentElement.classList.contains('mobile-layout') || this.game.phase !== 'battle') return;
      const station = event.target.closest('.combat-station');
      if (!station || !station.classList.contains('board-minimized')) return;
      event.preventDefault();
      event.stopPropagation();
      this.mobileBattleBoard = station === this.elements.playerStation ? 'player' : 'enemy';
      this.updateMobileBattleBoardLayout();
    }

    handleMobileBoardSwitchKey(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const station = event.target.closest('.combat-station');
      if (!station || !station.classList.contains('board-minimized')) return;
      event.preventDefault();
      this.mobileBattleBoard = station === this.elements.playerStation ? 'player' : 'enemy';
      this.updateMobileBattleBoardLayout();
    }

    updateMobileBattleBoardLayout() {
      const isMobileBattle = root.document.documentElement.classList.contains('mobile-layout') && this.game.phase === 'battle';
      this.elements.boardsArea.classList.toggle('mobile-board-switcher', isMobileBattle);
      const stations = [
        { element: this.elements.playerStation, id: 'player', label: 'Eigenes Spielfeld' },
        { element: this.elements.enemyStation, id: 'enemy', label: 'Gegnerisches Spielfeld' },
      ];
      stations.forEach(({ element, id, label }) => {
        const expanded = isMobileBattle && id === this.mobileBattleBoard;
        const minimized = isMobileBattle && !expanded;
        element.classList.toggle('board-expanded', expanded);
        element.classList.toggle('board-minimized', minimized);
        if (minimized) {
          element.tabIndex = 0;
          element.setAttribute('role', 'button');
          element.setAttribute('aria-label', `${label} minimiert. Antippen zum Vergrößern.`);
        } else {
          element.removeAttribute('tabindex');
          element.removeAttribute('role');
          element.removeAttribute('aria-label');
        }
      });
    }

    renderBoard(element, board, options) {
      const cellsContainer = element.querySelector('.water-cells');
      const cells = [...cellsContainer.querySelectorAll('.grid-cell')];
      cells.forEach((cell) => {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        const coordinate = board.key(row, col);
        const result = board.shots.get(coordinate);
        const blocked = options.blockedMarkers?.get(coordinate);
        const ship = board.getShipAt(row, col);
        cell.className = 'grid-cell';
        cell.replaceChildren();
        const shipLegallyVisible = options.showShips || ship?.isSunk || options.revealedShipIds?.has(ship?.id);
        if (ship && shipLegallyVisible) cell.classList.add('occupied');
        if (result) {
          cell.classList.add('shot');
          if (result.type === 'miss') cell.classList.add('miss');
          else if (result.type === 'jet-hit') cell.classList.add('jet-hit');
          else cell.classList.add(ship && ship.isSunk ? 'sunk-cell' : 'hit');
          const marker = document.createElement('span');
          marker.className = 'shot-marker';
          cell.appendChild(marker);
          cell.setAttribute('aria-label', `${this.coordinate(row, col)}: ${result.type === 'miss' ? 'Wasser' : result.type === 'jet-hit' ? 'RAPTOR Jet zerstört' : ship && ship.isSunk ? 'versenkt' : 'Treffer'}`);
        } else {
          cell.setAttribute('aria-label', this.coordinate(row, col));
        }
        if (!result && blocked) {
          cell.classList.add('shot-blocked');
          const marker = document.createElement('span');
          marker.className = 'blocked-marker';
          marker.textContent = 'BLOCK';
          marker.setAttribute('aria-hidden', 'true');
          cell.appendChild(marker);
          cell.setAttribute('aria-label', `${this.coordinate(row, col)}: Angriff blockiert`);
        }
        const contact = options.contactMarkers?.get(coordinate);
        if (!result && contact) {
          cell.classList.add('contact-intel');
          const marker = document.createElement('span');
          marker.className = 'contact-marker';
          marker.textContent = '?';
          marker.setAttribute('aria-hidden', 'true');
          cell.appendChild(marker);
          cell.setAttribute('aria-label', `${this.coordinate(row, col)}: anonymer Kontakt, unbeschossen`);
        }
        const mine = options.mines?.get(coordinate);
        if (mine) {
          cell.classList.add(mine.triggered ? 'mine-triggered' : 'mine-active');
          const marker = document.createElement('span');
          marker.className = 'mine-marker';
          marker.setAttribute('aria-hidden', 'true');
          cell.appendChild(marker);
          if (!result) cell.setAttribute('aria-label', `${this.coordinate(row, col)}: eigene Mine scharf`);
        }
        if (!result && options.jet?.active && options.jet.row === row && options.jet.col === col) {
          cell.classList.add('jet-active');
          const marker = document.createElement('span');
          marker.className = 'jet-marker';
          marker.textContent = '✈';
          marker.setAttribute('aria-hidden', 'true');
          cell.appendChild(marker);
          cell.setAttribute('aria-label', `${this.coordinate(row, col)}: eigener RAPTOR Jet aktiv`);
        }
      });

      cellsContainer.querySelectorAll('.ship-overlay').forEach((overlay) => overlay.remove());
      board.ships.forEach((ship) => {
        const revealed = options.revealedShipIds?.has(ship.id);
        const visible = options.showShips || revealed || (options.showSunkShips && ship.isSunk);
        if (!visible) return;
        const overlay = document.createElement('div');
        overlay.className = `ship-overlay ${ship.isSunk ? 'sunk' : ''} ${revealed && !ship.isSunk ? 'intel-revealed' : ''} ${options.submergedShipId === ship.id ? 'submerged' : ''}`;
        overlay.style.setProperty('--row', ship.row);
        overlay.style.setProperty('--col', ship.col);
        const baseWidth = ship.gridWidth || ship.length;
        const baseHeight = ship.gridHeight || 1;
        overlay.style.setProperty('--ship-width', ship.orientation === 'horizontal' ? baseWidth : baseHeight);
        overlay.style.setProperty('--ship-height', ship.orientation === 'vertical' ? baseWidth : baseHeight);
        overlay.innerHTML = this.createShipSvg(ship, ship.orientation, `${element.id}-${ship.id}`);
        cellsContainer.appendChild(overlay);
      });
    }

    renderFleetStatus(element, board, options = {}) {
      const definitions = options.definitions || this.game.playerFleetDefinitions;
      const shipRows = definitions.map((definition) => {
        const ship = board.ships.find((candidate) => candidate.id === definition.id);
        const visibleDamage = options.showDamage || ship?.isSunk || options.revealedShipIds?.has(definition.id);
        const hits = ship && visibleDamage ? ship.hits : new Set();
        return `
          <div class="mini-ship ${ship && ship.isSunk ? 'sunk' : ''}">
            <span>${definition.name}</span>
            <span class="mini-ship-cells">${Array.from({ length: definition.length }, (_, index) => `<i class="${hits.has(index) ? 'hit' : ''}"></i>`).join('')}</span>
          </div>`;
      }).join('');
      const jetRow = options.jet?.launched
        ? `<div class="mini-ship jet-status ${options.jet.destroyed ? 'sunk' : ''} ${options.jet.active ? 'active' : ''}">
            <span>RAPTOR JET</span>
            <span class="mini-ship-cells"><i class="${options.jet.destroyed ? 'hit' : ''}"></i></span>
          </div>`
        : '';
      element.innerHTML = shipRows + jetRow;
    }

    addLog(message, type = '') {
      const entry = document.createElement('div');
      entry.className = `log-entry ${type}`;
      const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      entry.innerHTML = `<span class="log-time">${time} // COMMS</span>${message}`;
      this.elements.combatLog.appendChild(entry);
      this.elements.combatLog.scrollTop = this.elements.combatLog.scrollHeight;
    }

    showGameOver() {
      const victory = this.game.winner === 'player';
      const shots = this.game.stats.playerShots;
      const hits = this.game.stats.playerHits;
      const accuracy = shots ? Math.round((hits / shots) * 100) : 0;
      this.elements.resultModal.classList.toggle('loss', !victory);
      this.elements.resultEmblem.textContent = victory ? '◆' : '×';
      this.elements.resultKicker.textContent = victory ? 'MISSION ERFOLGREICH' : 'MISSION GESCHEITERT';
      this.elements.gameoverTitle.textContent = victory ? 'GEFECHT GEWONNEN' : 'FLOTTE VERLOREN';
      this.elements.gameoverMessage.textContent = victory
        ? 'Die feindliche Flotte wurde vollständig neutralisiert.'
        : 'Alle eigenen Einheiten wurden versenkt. Rückzug aus dem Operationsgebiet.';
      this.elements.statShots.textContent = String(shots);
      this.elements.statHits.textContent = String(hits);
      this.elements.statAccuracy.textContent = `${accuracy}%`;
      this.elements.gameoverModal.hidden = false;
      this.elements.playAgainButton.focus();
      victory ? this.audio.sonar() : this.audio.warning();
    }

    coordinate(row, col) {
      return `${CONFIG.columns[col]}${row + 1}`;
    }

    getCell(boardElement, row, col) {
      return boardElement.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
    }

    showToast(message) {
      root.clearTimeout(this.toastTimer);
      this.elements.toast.textContent = message;
      this.elements.toast.classList.add('visible');
      this.toastTimer = root.setTimeout(() => this.elements.toast.classList.remove('visible'), 2500);
    }
  }

  root.NavalGame.GameUI = GameUI;
})(window);
