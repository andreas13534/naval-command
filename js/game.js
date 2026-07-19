(function (root) {
  'use strict';

  const CONFIG = root.NavalGame.CONFIG;

  class Ship {
    constructor(definition, row, col, orientation) {
      this.id = definition.id;
      this.name = definition.name;
      this.code = definition.code;
      this.length = definition.length;
      this.profile = definition.profile;
      this.asset = definition.asset || null;
      this.gridWidth = definition.gridWidth || definition.length;
      this.gridHeight = definition.gridHeight || 1;
      this.row = row;
      this.col = col;
      this.orientation = orientation;
      this.hits = new Set();
    }

    getCells() {
      const width = this.orientation === 'vertical' ? this.gridHeight : this.gridWidth;
      const height = this.orientation === 'vertical' ? this.gridWidth : this.gridHeight;
      const cells = [];
      for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
        for (let colOffset = 0; colOffset < width; colOffset += 1) {
          cells.push({ row: this.row + rowOffset, col: this.col + colOffset });
        }
      }
      return cells;
    }

    registerHit(row, col) {
      const index = this.getCells().findIndex((cell) => cell.row === row && cell.col === col);
      if (index >= 0) this.hits.add(index);
    }

    get isSunk() {
      return this.hits.size === this.length;
    }
  }

  class GameBoard {
    constructor(size = CONFIG.gridSize) {
      this.size = size;
      this.ships = [];
      this.shots = new Map();
      this.occupancy = new Map();
    }

    key(row, col) {
      return `${row},${col}`;
    }

    isInside(row, col) {
      return row >= 0 && col >= 0 && row < this.size && col < this.size;
    }

    getPlacementCells(definition, row, col, orientation) {
      const baseWidth = definition.gridWidth || definition.length;
      const baseHeight = definition.gridHeight || 1;
      const width = orientation === 'vertical' ? baseHeight : baseWidth;
      const height = orientation === 'vertical' ? baseWidth : baseHeight;
      const cells = [];
      for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
        for (let colOffset = 0; colOffset < width; colOffset += 1) {
          cells.push({ row: row + rowOffset, col: col + colOffset });
        }
      }
      return cells;
    }

    canPlace(definition, row, col, orientation, ignoredShipId = null) {
      const cells = this.getPlacementCells(definition, row, col, orientation);
      return cells.every((cell) => {
        if (!this.isInside(cell.row, cell.col)) return false;
        const occupyingShip = this.occupancy.get(this.key(cell.row, cell.col));
        return !occupyingShip || occupyingShip.id === ignoredShipId;
      });
    }

    placeShip(definition, row, col, orientation = 'horizontal') {
      if (this.ships.some((ship) => ship.id === definition.id)) {
        return { ok: false, reason: 'already-placed' };
      }
      if (!this.canPlace(definition, row, col, orientation)) {
        return { ok: false, reason: 'invalid-position' };
      }
      const ship = new Ship(definition, row, col, orientation);
      this.ships.push(ship);
      ship.getCells().forEach((cell) => this.occupancy.set(this.key(cell.row, cell.col), ship));
      return { ok: true, ship };
    }

    removeShip(shipId) {
      const index = this.ships.findIndex((ship) => ship.id === shipId);
      if (index < 0) return false;
      const [ship] = this.ships.splice(index, 1);
      ship.getCells().forEach((cell) => this.occupancy.delete(this.key(cell.row, cell.col)));
      return true;
    }

    moveShip(shipId, row, col) {
      const ship = this.ships.find((candidate) => candidate.id === shipId);
      if (!ship) return { ok: false, reason: 'no-ship' };
      if (!this.canPlace(ship, row, col, ship.orientation, ship.id)) return { ok: false, reason: 'invalid-position' };
      const oldCells = ship.getCells();
      oldCells.forEach((cell) => this.occupancy.delete(this.key(cell.row, cell.col)));
      const oldRow = ship.row;
      const oldCol = ship.col;
      ship.row = row;
      ship.col = col;
      const newCells = ship.getCells();
      newCells.forEach((cell) => this.occupancy.set(this.key(cell.row, cell.col), ship));
      return { ok: true, ship, oldRow, oldCol, oldCells, newCells };
    }

    clear() {
      this.ships = [];
      this.shots.clear();
      this.occupancy.clear();
    }

    receiveAttack(row, col) {
      if (!this.isInside(row, col)) return { valid: false, reason: 'outside' };
      const coordinate = this.key(row, col);
      if (this.shots.has(coordinate)) {
        return { valid: false, reason: 'already-shot', result: this.shots.get(coordinate) };
      }

      const ship = this.occupancy.get(coordinate);
      if (!ship) {
        const result = { type: 'miss', row, col };
        this.shots.set(coordinate, result);
        return { valid: true, ...result };
      }

      ship.registerHit(row, col);
      const type = ship.isSunk ? 'sunk' : 'hit';
      const result = { type, row, col, shipId: ship.id, shipName: ship.name, ship };
      this.shots.set(coordinate, result);
      return { valid: true, ...result };
    }

    getShipAt(row, col) {
      return this.occupancy.get(this.key(row, col)) || null;
    }

    get unshotCells() {
      const cells = [];
      for (let row = 0; row < this.size; row += 1) {
        for (let col = 0; col < this.size; col += 1) {
          if (!this.shots.has(this.key(row, col))) cells.push({ row, col });
        }
      }
      return cells;
    }

    get allShipsSunk() {
      return this.ships.length > 0 && this.ships.every((ship) => ship.isSunk);
    }

    get afloatCount() {
      return this.ships.filter((ship) => !ship.isSunk).length;
    }
  }

  class BattleshipGame {
    constructor(config = CONFIG) {
      this.config = config;
      this.playerBoard = new GameBoard(config.gridSize);
      this.enemyBoard = new GameBoard(config.gridSize);
      this.phase = 'menu';
      this.turn = 'player';
      this.winner = null;
      this.mode = 'classic';
      this.commanderId = null;
      this.commandPoints = 0;
      this.enemyRevealedShipIds = new Set();
      this.playerMines = new Map();
      this.freeShotsRemaining = 0;
      this.freeShotsGrantMissPoints = true;
      this.lastRevengeActive = false;
      this.submergedShipId = null;
      this.blockedAttackMarkers = new Map();
      this.purchasedShipIds = new Set();
      this.stats = { playerShots: 0, playerHits: 0, enemyShots: 0, enemyHits: 0 };
    }

    reset() {
      this.playerBoard = new GameBoard(this.config.gridSize);
      this.enemyBoard = new GameBoard(this.config.gridSize);
      this.phase = 'placement';
      this.turn = 'player';
      this.winner = null;
      this.commandPoints = 0;
      this.enemyRevealedShipIds = new Set();
      this.playerMines = new Map();
      this.freeShotsRemaining = 0;
      this.freeShotsGrantMissPoints = true;
      this.lastRevengeActive = false;
      this.submergedShipId = null;
      this.blockedAttackMarkers = new Map();
      this.purchasedShipIds = new Set();
      this.stats = { playerShots: 0, playerHits: 0, enemyShots: 0, enemyHits: 0 };
    }

    setMode(mode) {
      if (!['classic', 'commander'].includes(mode)) return false;
      this.mode = mode;
      this.commanderId = mode === 'classic' ? null : this.commanderId;
      return true;
    }

    setCommander(commanderId) {
      const commander = this.config.commanders.find((candidate) => candidate.id === commanderId);
      if (!commander) return false;
      this.commanderId = commanderId;
      return true;
    }

    get activeCommander() {
      return this.config.commanders.find((commander) => commander.id === this.commanderId) || null;
    }

    get baseFleetDefinitions() {
      const fleetIds = this.mode === 'commander' && this.activeCommander
        ? this.activeCommander.fleet
        : this.config.classicFleet;
      return fleetIds
        .map((shipId) => this.config.ships.find((ship) => ship.id === shipId))
        .filter(Boolean);
    }

    get playerFleetDefinitions() {
      const purchased = [...this.purchasedShipIds]
        .map((shipId) => this.config.ships.find((ship) => ship.id === shipId))
        .filter(Boolean);
      return [...this.baseFleetDefinitions, ...purchased];
    }

    get enemyFleetDefinitions() {
      return this.baseFleetDefinitions;
    }

    randomizeBoard(board, random = Math.random, definitions = this.playerFleetDefinitions) {
      board.clear();
      const ordered = [...definitions].sort((a, b) => b.length - a.length);

      const placeNext = (index) => {
        if (index >= ordered.length) return true;
        const definition = ordered[index];
        const candidates = [];
        const baseWidth = definition.gridWidth || definition.length;
        const baseHeight = definition.gridHeight || 1;
        const orientations = baseWidth === baseHeight ? ['horizontal'] : ['horizontal', 'vertical'];
        orientations.forEach((orientation) => {
          for (let row = 0; row < board.size; row += 1) {
            for (let col = 0; col < board.size; col += 1) {
              if (board.canPlace(definition, row, col, orientation)) candidates.push({ row, col, orientation });
            }
          }
        });
        for (let i = candidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        for (const candidate of candidates) {
          if (!board.placeShip(definition, candidate.row, candidate.col, candidate.orientation).ok) continue;
          if (placeNext(index + 1)) return true;
          board.removeShip(definition.id);
        }
        return false;
      };

      if (!placeNext(0)) board.clear();
      return board;
    }

    startBattle() {
      if (this.playerBoard.ships.length !== this.playerFleetDefinitions.length) return false;
      this.randomizeBoard(this.enemyBoard, Math.random, this.enemyFleetDefinitions);
      this.phase = 'battle';
      this.turn = 'player';
      return true;
    }

    playerAttack(row, col) {
      if (this.phase !== 'battle' || this.turn !== 'player') {
        return { valid: false, reason: 'not-player-turn' };
      }
      const usingFreeShot = this.freeShotsRemaining > 0;
      const usingLastRevenge = usingFreeShot && this.lastRevengeActive;
      const result = this.enemyBoard.receiveAttack(row, col);
      if (!result.valid) return result;
      this.stats.playerShots += 1;
      if (result.type !== 'miss') this.stats.playerHits += 1;
      if (this.mode === 'commander' && result.type === 'miss' && (!usingFreeShot || this.freeShotsGrantMissPoints)) this.commandPoints += 1;
      if (usingFreeShot) {
        this.freeShotsRemaining -= 1;
        if (this.freeShotsRemaining === 0) this.freeShotsGrantMissPoints = true;
      }
      if (this.enemyBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'player';
        if (usingLastRevenge) {
          this.lastRevengeActive = false;
          this.freeShotsRemaining = 0;
          this.freeShotsGrantMissPoints = true;
          result.lastRevengeWon = true;
        }
      } else if (usingLastRevenge && this.freeShotsRemaining === 0) {
        this.lastRevengeActive = false;
        this.phase = 'gameover';
        this.winner = 'enemy';
        result.lastRevengeFailed = true;
      } else if (this.freeShotsRemaining === 0) {
        this.turn = 'enemy';
      }
      return {
        ...result,
        freeShotsRemaining: this.freeShotsRemaining,
        lastRevengeActive: this.lastRevengeActive,
      };
    }

    playerAttackPattern(cells, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') {
        return { valid: false, reason: 'not-player-turn' };
      }
      if (this.mode !== 'commander' || !ability) {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) {
        return { valid: false, reason: 'insufficient-points' };
      }

      const uniqueCells = [];
      const seen = new Set();
      cells.forEach((cell) => {
        const key = this.enemyBoard.key(cell.row, cell.col);
        if (this.enemyBoard.isInside(cell.row, cell.col) && !seen.has(key) && !this.enemyBoard.shots.has(key)) {
          seen.add(key);
          uniqueCells.push(cell);
        }
      });
      if (!uniqueCells.length) return { valid: false, reason: 'already-shot' };

      this.commandPoints -= ability.cost;
      const results = uniqueCells.map((cell) => this.enemyBoard.receiveAttack(cell.row, cell.col));
      const misses = results.filter((result) => result.type === 'miss').length;
      const hits = results.length - misses;
      const pointsGained = ability.grantsMissPoints ? misses : 0;
      this.stats.playerShots += results.length;
      this.stats.playerHits += hits;
      this.commandPoints += pointsGained;

      if (this.enemyBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'player';
      } else {
        this.turn = 'enemy';
      }
      return { valid: true, type: 'ability', ability, results, pointsGained };
    }

    playerScan(cells, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') {
        return { valid: false, reason: 'not-player-turn' };
      }
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'scan') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) {
        return { valid: false, reason: 'insufficient-points' };
      }

      const uniqueCells = [];
      const seen = new Set();
      cells.forEach((cell) => {
        const key = this.enemyBoard.key(cell.row, cell.col);
        if (this.enemyBoard.isInside(cell.row, cell.col) && !seen.has(key)) {
          seen.add(key);
          uniqueCells.push(cell);
        }
      });
      if (!uniqueCells.length) return { valid: false, reason: 'outside' };

      const found = uniqueCells.some((cell) => Boolean(this.enemyBoard.getShipAt(cell.row, cell.col)));
      const marked = [];
      if (!found) {
        uniqueCells.forEach((cell) => {
          const key = this.enemyBoard.key(cell.row, cell.col);
          if (this.enemyBoard.shots.has(key)) return;
          const marker = { type: 'miss', row: cell.row, col: cell.col, scanned: true };
          this.enemyBoard.shots.set(key, marker);
          marked.push(marker);
        });
      }

      this.commandPoints -= ability.cost;
      this.turn = 'enemy';
      return { valid: true, type: 'scan', ability, found, cells: uniqueCells, marked, pointsGained: 0 };
    }

    playerRepair(row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') {
        return { valid: false, reason: 'not-player-turn' };
      }
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'repair') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) {
        return { valid: false, reason: 'insufficient-points' };
      }

      const ship = this.playerBoard.getShipAt(row, col);
      if (!ship) return { valid: false, reason: 'no-ship' };
      const hitIndex = ship.getCells().findIndex((cell) => cell.row === row && cell.col === col);
      if (hitIndex < 0 || !ship.hits.has(hitIndex)) return { valid: false, reason: 'not-damaged' };

      ship.hits.delete(hitIndex);
      this.playerBoard.shots.delete(this.playerBoard.key(row, col));
      this.stats.enemyHits = Math.max(0, this.stats.enemyHits - 1);
      this.commandPoints -= ability.cost;
      this.turn = 'enemy';
      return { valid: true, type: 'repair', ability, row, col, ship, shipId: ship.id, shipName: ship.name, pointsGained: 0 };
    }

    playerChemicalAttack(row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'chemical') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      if (!this.enemyBoard.isInside(row, col)) return { valid: false, reason: 'outside' };
      if (this.enemyBoard.shots.has(this.enemyBoard.key(row, col))) return { valid: false, reason: 'already-shot' };

      this.commandPoints -= ability.cost;
      const result = this.enemyBoard.receiveAttack(row, col);
      this.stats.playerShots += 1;
      const hit = result.type !== 'miss';
      if (hit) {
        this.stats.playerHits += 1;
        this.enemyRevealedShipIds.add(result.shipId);
      }
      if (this.enemyBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'player';
      } else {
        this.turn = 'enemy';
      }
      return { ...result, valid: true, ability, revealed: hit, revealedShipId: hit ? result.shipId : null, pointsGained: 0 };
    }

    playerPlaceMine(row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'mine') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      if (!this.playerBoard.isInside(row, col)) return { valid: false, reason: 'outside' };
      const key = this.playerBoard.key(row, col);
      if (this.playerBoard.shots.has(key)) return { valid: false, reason: 'already-shot' };
      if (this.playerMines.has(key)) return { valid: false, reason: 'mine-present' };

      const mine = { row, col, active: true, triggered: false };
      this.playerMines.set(key, mine);
      this.commandPoints -= ability.cost;
      this.turn = 'enemy';
      return { valid: true, type: 'mine-deployed', ability, row, col, mine, pointsGained: 0 };
    }

    playerRelocateShip(shipId, row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'relocation') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      const ship = this.playerBoard.ships.find((candidate) => candidate.id === shipId);
      if (!ship) return { valid: false, reason: 'no-ship' };
      if (ship.hits.size > 0) return { valid: false, reason: 'ship-damaged' };
      if (ship.row === row && ship.col === col) return { valid: false, reason: 'same-position' };
      const destinationCells = this.playerBoard.getPlacementCells(ship, row, col, ship.orientation);
      if (!this.playerBoard.canPlace(ship, row, col, ship.orientation, ship.id)) {
        return { valid: false, reason: 'invalid-position' };
      }
      if (destinationCells.some((cell) => this.playerBoard.shots.has(this.playerBoard.key(cell.row, cell.col)))) {
        return { valid: false, reason: 'previously-fired-upon' };
      }

      const moved = this.playerBoard.moveShip(ship.id, row, col);
      if (!moved.ok) return { valid: false, reason: moved.reason };
      this.commandPoints -= ability.cost;
      this.turn = 'enemy';
      return {
        valid: true,
        type: 'relocation',
        ability,
        row,
        col,
        ship,
        shipId: ship.id,
        shipName: ship.name,
        oldRow: moved.oldRow,
        oldCol: moved.oldCol,
        oldCells: moved.oldCells,
        newCells: moved.newCells,
        pointsGained: 0,
      };
    }

    playerNuclearAttack(row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'nuclear') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      if (!this.enemyBoard.isInside(row, col)) return { valid: false, reason: 'outside' };
      const key = this.enemyBoard.key(row, col);
      if (this.enemyBoard.shots.has(key)) return { valid: false, reason: 'already-shot' };

      this.commandPoints -= ability.cost;
      const direct = this.enemyBoard.receiveAttack(row, col);
      this.stats.playerShots += 1;
      const hit = direct.type !== 'miss';
      const affected = [];
      if (hit) {
        this.stats.playerHits += 1;
        const ship = direct.ship;
        ship.getCells().forEach((cell, index) => {
          ship.hits.add(index);
          const marker = {
            valid: true,
            type: 'sunk',
            row: cell.row,
            col: cell.col,
            shipId: ship.id,
            shipName: ship.name,
            ship,
            nuclear: true,
            collateral: cell.row !== row || cell.col !== col,
          };
          this.enemyBoard.shots.set(this.enemyBoard.key(cell.row, cell.col), marker);
          affected.push(marker);
        });
      }

      if (this.enemyBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'player';
      } else {
        this.turn = 'enemy';
      }
      return {
        ...direct,
        valid: true,
        type: hit ? 'sunk' : 'miss',
        ability,
        nuclearHit: hit,
        affected,
        pointsGained: 0,
      };
    }

    playerRangefinderShot(row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'rangefinder') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      if (!this.enemyBoard.isInside(row, col)) return { valid: false, reason: 'outside' };
      const key = this.enemyBoard.key(row, col);
      if (this.enemyBoard.shots.has(key)) return { valid: false, reason: 'already-shot' };

      this.commandPoints -= ability.cost;
      const result = this.enemyBoard.receiveAttack(row, col);
      this.stats.playerShots += 1;
      if (result.type !== 'miss') this.stats.playerHits += 1;

      const activeShipCells = this.enemyBoard.ships
        .filter((ship) => !ship.isSunk)
        .flatMap((ship) => ship.getCells());
      const distance = activeShipCells.length
        ? Math.min(...activeShipCells.map((cell) => Math.abs(cell.row - row) + Math.abs(cell.col - col)))
        : null;

      if (this.enemyBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'player';
      } else {
        this.turn = 'enemy';
      }
      return { ...result, valid: true, ability, distance, pointsGained: 0 };
    }

    playerRandomBarrage(ability, random = Math.random) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'random-barrage') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };

      const available = [];
      for (let row = 0; row < this.enemyBoard.size; row += 1) {
        for (let col = 0; col < this.enemyBoard.size; col += 1) {
          if (!this.enemyBoard.shots.has(this.enemyBoard.key(row, col))) available.push({ row, col });
        }
      }
      if (!available.length) return { valid: false, reason: 'no-targets' };

      const targets = [];
      const shotCount = Math.min(6, available.length);
      while (targets.length < shotCount) {
        const randomValue = Number(random());
        const safeValue = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999999) : 0;
        const index = Math.floor(safeValue * available.length);
        targets.push(available.splice(index, 1)[0]);
      }

      this.commandPoints -= ability.cost;
      const results = targets.map((cell) => this.enemyBoard.receiveAttack(cell.row, cell.col));
      const hits = results.filter((result) => result.type !== 'miss').length;
      this.stats.playerShots += results.length;
      this.stats.playerHits += hits;

      if (this.enemyBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'player';
      } else {
        this.turn = 'enemy';
      }
      return { valid: true, type: 'random-barrage', ability, results, pointsGained: 0 };
    }

    playerTorpedoRow(row, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'full-row') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      if (!Number.isInteger(row) || !this.enemyBoard.isInside(row, 0)) return { valid: false, reason: 'outside' };

      const targets = Array.from({ length: this.enemyBoard.size }, (_, col) => ({ row, col }))
        .filter((cell) => !this.enemyBoard.shots.has(this.enemyBoard.key(cell.row, cell.col)));
      if (!targets.length) return { valid: false, reason: 'already-shot' };

      this.commandPoints -= ability.cost;
      const results = targets.map((cell) => this.enemyBoard.receiveAttack(cell.row, cell.col));
      const hits = results.filter((result) => result.type !== 'miss').length;
      this.stats.playerShots += results.length;
      this.stats.playerHits += hits;

      if (this.enemyBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'player';
      } else {
        this.turn = 'enemy';
      }
      return { valid: true, type: 'row-torpedo', ability, row, results, pointsGained: 0 };
    }

    playerSubmergeShip(row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'submerge') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      if (!this.playerBoard.isInside(row, col)) return { valid: false, reason: 'outside' };
      const ship = this.playerBoard.getShipAt(row, col);
      if (!ship) return { valid: false, reason: 'no-ship' };
      if (ship.isSunk) return { valid: false, reason: 'ship-sunk' };
      if (this.submergedShipId === ship.id) return { valid: false, reason: 'already-submerged' };

      this.commandPoints -= ability.cost;
      this.submergedShipId = ship.id;
      this.turn = 'enemy';
      return {
        valid: true,
        type: 'submerged',
        ability,
        row,
        col,
        ship,
        shipId: ship.id,
        shipName: ship.name,
        pointsGained: 0,
      };
    }

    playerSacrificeShip(row, col, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'sacrifice') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      if (!this.playerBoard.isInside(row, col)) return { valid: false, reason: 'outside' };
      const ship = this.playerBoard.getShipAt(row, col);
      if (!ship) return { valid: false, reason: 'no-ship' };
      if (ship.isSunk) return { valid: false, reason: 'ship-sunk' };
      if (this.playerBoard.afloatCount <= 1) return { valid: false, reason: 'last-ship' };

      const affected = ship.getCells().map((cell, index) => {
        ship.hits.add(index);
        const marker = {
          valid: true,
          type: 'sunk',
          row: cell.row,
          col: cell.col,
          ship,
          shipId: ship.id,
          shipName: ship.name,
          sacrificed: true,
        };
        const key = this.playerBoard.key(cell.row, cell.col);
        this.playerBoard.shots.set(key, marker);
        this.playerMines.delete(key);
        this.blockedAttackMarkers.delete(key);
        return marker;
      });

      this.commandPoints -= ability.cost;
      this.submergedShipId = this.submergedShipId === ship.id ? null : this.submergedShipId;
      this.freeShotsRemaining = 5;
      this.freeShotsGrantMissPoints = false;
      this.turn = 'player';
      return {
        valid: true,
        type: 'sacrificed',
        ability,
        row,
        col,
        ship,
        shipId: ship.id,
        shipName: ship.name,
        affected,
        freeShotsGranted: 5,
        freeShotsRemaining: 5,
        pointsGained: 0,
      };
    }

    playerPurchaseShip(row, col, orientation, ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'purchase-ship') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };
      const definition = this.config.ships.find((ship) => ship.id === ability.shipId);
      if (!definition) return { valid: false, reason: 'ship-unavailable' };
      if (this.purchasedShipIds.has(definition.id) || this.playerBoard.ships.some((ship) => ship.id === definition.id)) {
        return { valid: false, reason: 'already-purchased' };
      }
      const safeOrientation = orientation === 'vertical' ? 'vertical' : 'horizontal';
      const width = safeOrientation === 'horizontal' ? (definition.gridWidth || definition.length) : (definition.gridHeight || 1);
      const height = safeOrientation === 'vertical' ? (definition.gridWidth || definition.length) : (definition.gridHeight || 1);
      const startRow = Math.min(Math.max(row, 0), this.playerBoard.size - height);
      const startCol = Math.min(Math.max(col, 0), this.playerBoard.size - width);
      const cells = this.playerBoard.getPlacementCells(definition, startRow, startCol, safeOrientation);
      if (!this.playerBoard.canPlace(definition, startRow, startCol, safeOrientation)) {
        return { valid: false, reason: 'invalid-position' };
      }
      if (cells.some((cell) => this.playerBoard.shots.has(this.playerBoard.key(cell.row, cell.col)))) {
        return { valid: false, reason: 'previously-fired-upon' };
      }

      const placed = this.playerBoard.placeShip(definition, startRow, startCol, safeOrientation);
      if (!placed.ok) return { valid: false, reason: placed.reason };
      cells.forEach((cell) => this.blockedAttackMarkers.delete(this.playerBoard.key(cell.row, cell.col)));
      this.commandPoints -= ability.cost;
      this.purchasedShipIds.add(definition.id);
      this.turn = 'enemy';
      return {
        valid: true,
        type: 'ship-purchased',
        ability,
        row: startRow,
        col: startCol,
        orientation: safeOrientation,
        ship: placed.ship,
        shipId: placed.ship.id,
        shipName: placed.ship.name,
        cells,
        pointsGained: 0,
      };
    }

    playerActivateLastRevenge(ability) {
      if (this.phase !== 'battle' || this.turn !== 'player') return { valid: false, reason: 'not-player-turn' };
      if (this.mode !== 'commander' || !ability || ability.pattern !== 'last-revenge') {
        return { valid: false, reason: 'ability-unavailable' };
      }
      if (this.freeShotsRemaining > 0 || this.lastRevengeActive) return { valid: false, reason: 'free-shots-active' };
      if (this.commandPoints < ability.cost) return { valid: false, reason: 'insufficient-points' };

      const shots = Math.max(1, Number(ability.shots) || 15);
      this.commandPoints -= ability.cost;
      this.freeShotsRemaining = shots;
      this.freeShotsGrantMissPoints = false;
      this.lastRevengeActive = true;
      this.turn = 'player';
      return {
        valid: true,
        type: 'last-revenge-armed',
        ability,
        shotsGranted: shots,
        freeShotsRemaining: shots,
        pointsGained: 0,
      };
    }

    enemyAttack(row, col) {
      if (this.phase !== 'battle' || this.turn !== 'enemy') {
        return { valid: false, reason: 'not-enemy-turn' };
      }
      const key = this.playerBoard.key(row, col);
      const targetShip = this.playerBoard.getShipAt(row, col);
      const protectedShip = this.submergedShipId
        ? this.playerBoard.ships.find((ship) => ship.id === this.submergedShipId && !ship.isSunk)
        : null;
      this.blockedAttackMarkers.delete(key);
      if (protectedShip && targetShip?.id === protectedShip.id && !this.playerBoard.shots.has(key)) {
        const blocked = {
          valid: true,
          type: 'blocked',
          row,
          col,
          ship: protectedShip,
          shipId: protectedShip.id,
          shipName: protectedShip.name,
          submerged: true,
        };
        this.stats.enemyShots += 1;
        this.blockedAttackMarkers.set(key, blocked);
        this.submergedShipId = null;
        this.turn = 'player';
        return blocked;
      }

      const result = this.playerBoard.receiveAttack(row, col);
      if (!result.valid) return result;
      this.stats.enemyShots += 1;
      if (result.type !== 'miss') this.stats.enemyHits += 1;
      this.submergedShipId = null;
      const mine = this.playerMines.get(this.playerBoard.key(row, col));
      if (mine?.active) {
        mine.active = false;
        mine.triggered = true;
        this.freeShotsRemaining += 3;
        this.freeShotsGrantMissPoints = true;
        result.mineTriggered = true;
        result.freeShotsGranted = 3;
        result.freeShotsRemaining = this.freeShotsRemaining;
      }
      if (this.playerBoard.allShipsSunk) {
        this.phase = 'gameover';
        this.winner = 'enemy';
      } else {
        this.turn = 'player';
      }
      return result;
    }
  }

  root.NavalGame.Ship = Ship;
  root.NavalGame.GameBoard = GameBoard;
  root.NavalGame.BattleshipGame = BattleshipGame;
})(typeof window !== 'undefined' ? window : globalThis);
