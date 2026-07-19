'use strict';

globalThis.NavalGame = globalThis.NavalGame || {};
require('../js/config.js');
require('../js/game.js');

const { CONFIG, GameBoard } = globalThis.NavalGame;

const clampInteger = (value, minimum, maximum) => {
  const number = Number(value);
  if (!Number.isInteger(number)) return null;
  return Math.min(Math.max(number, minimum), maximum);
};

const publicShip = (ship, includePosition = true) => ({
  id: ship.id,
  name: ship.name,
  code: ship.code,
  length: ship.length,
  profile: ship.profile,
  asset: ship.asset,
  gridWidth: ship.gridWidth,
  gridHeight: ship.gridHeight,
  ...(includePosition ? { row: ship.row, col: ship.col, orientation: ship.orientation } : {}),
  hits: [...ship.hits],
  isSunk: ship.isSunk,
});

class MultiplayerMatch {
  constructor(random = Math.random) {
    this.random = random;
    this.phase = 'selection';
    this.turnSeat = 0;
    this.winnerSeat = null;
    this.eventId = 0;
    this.lastEvent = null;
    this.players = [this.createPlayer(), this.createPlayer()];
  }

  createPlayer() {
    return {
      commanderId: null,
      board: new GameBoard(CONFIG.gridSize),
      ready: false,
      commandPoints: 0,
      shots: 0,
      hits: 0,
      mines: new Map(),
      revealedEnemyShipIds: new Set(),
      submergedShipId: null,
      purchasedShipIds: new Set(),
      freeShotsRemaining: 0,
      freeShotsGrantMissPoints: false,
      lastRevengeActive: false,
      connected: true,
    };
  }

  commander(player) {
    return CONFIG.commanders.find((candidate) => candidate.id === player.commanderId) || null;
  }

  opponentSeat(seat) {
    return seat === 0 ? 1 : 0;
  }

  setConnected(seat, connected) {
    if (this.players[seat]) this.players[seat].connected = connected;
  }

  command(seat, type, payload = {}) {
    if (![0, 1].includes(seat)) return { ok: false, reason: 'invalid-seat' };
    if (type === 'select-commander') return this.selectCommander(seat, payload.commanderId);
    if (type === 'ready') return this.ready(seat, payload.placements);
    if (type === 'fire') return this.fire(seat, payload.row, payload.col);
    if (type === 'ability') return this.useAbility(seat, payload);
    return { ok: false, reason: 'unknown-command' };
  }

  selectCommander(seat, commanderId) {
    if (this.phase !== 'selection' && this.phase !== 'placement') return { ok: false, reason: 'wrong-phase' };
    const commander = CONFIG.commanders.find((candidate) => candidate.id === commanderId);
    if (!commander) return { ok: false, reason: 'invalid-commander' };
    const player = this.players[seat];
    player.commanderId = commanderId;
    player.ready = false;
    player.board.clear();
    this.phase = 'placement';
    return this.recordEvent(seat, 'commander-selected', { commanderId });
  }

  ready(seat, placements) {
    if (this.phase !== 'placement') return { ok: false, reason: 'wrong-phase' };
    const player = this.players[seat];
    const commander = this.commander(player);
    if (!commander) return { ok: false, reason: 'commander-required' };
    if (!Array.isArray(placements) || placements.length !== commander.fleet.length) {
      return { ok: false, reason: 'incomplete-fleet' };
    }

    const board = new GameBoard(CONFIG.gridSize);
    const expectedIds = new Set(commander.fleet);
    for (const placement of placements) {
      if (!placement || !expectedIds.has(placement.id)) return { ok: false, reason: 'invalid-fleet' };
      expectedIds.delete(placement.id);
      const definition = CONFIG.ships.find((ship) => ship.id === placement.id);
      const row = clampInteger(placement.row, 0, CONFIG.gridSize - 1);
      const col = clampInteger(placement.col, 0, CONFIG.gridSize - 1);
      const orientation = placement.orientation === 'vertical' ? 'vertical' : 'horizontal';
      if (row === null || col === null) return { ok: false, reason: 'invalid-position' };
      const placed = board.placeShip(definition, row, col, orientation);
      if (!placed.ok) return { ok: false, reason: placed.reason };
    }
    if (expectedIds.size) return { ok: false, reason: 'incomplete-fleet' };

    player.board = board;
    player.ready = true;
    if (this.players.every((candidate) => candidate.ready)) {
      this.phase = 'battle';
      this.turnSeat = 0;
    }
    return this.recordEvent(seat, 'fleet-ready', { battleStarted: this.phase === 'battle' });
  }

  validateTurn(seat) {
    if (this.phase !== 'battle') return { ok: false, reason: 'wrong-phase' };
    if (this.turnSeat !== seat) return { ok: false, reason: 'not-your-turn' };
    return null;
  }

  validateCell(board, row, col) {
    const safeRow = clampInteger(row, 0, board.size - 1);
    const safeCol = clampInteger(col, 0, board.size - 1);
    if (safeRow === null || safeCol === null) return null;
    return { row: safeRow, col: safeCol };
  }

  fire(seat, row, col) {
    const invalid = this.validateTurn(seat);
    if (invalid) return invalid;
    const attacker = this.players[seat];
    if (attacker.freeShotsRemaining > 0) return this.fireFreeShot(seat, row, col);
    const defenderSeat = this.opponentSeat(seat);
    const result = this.attackCell(seat, defenderSeat, row, col, { grantsMissPoints: true });
    if (!result.ok) return result;
    if (this.phase === 'battle' && !result.mineTriggered) this.turnSeat = defenderSeat;
    return this.recordEvent(seat, 'shot', { results: [result], abilityId: null });
  }

  fireFreeShot(seat, row, col) {
    const attacker = this.players[seat];
    const defenderSeat = this.opponentSeat(seat);
    const result = this.attackCell(seat, defenderSeat, row, col, {
      grantsMissPoints: attacker.freeShotsGrantMissPoints,
    });
    if (!result.ok) return result;
    attacker.freeShotsRemaining -= 1;
    if (this.phase === 'battle' && !result.mineTriggered && attacker.freeShotsRemaining <= 0) {
      if (attacker.lastRevengeActive) {
        attacker.lastRevengeActive = false;
        this.finish(defenderSeat);
      } else {
        this.turnSeat = defenderSeat;
      }
    }
    return this.recordEvent(seat, 'shot', {
      results: [result],
      abilityId: attacker.lastRevengeActive ? 'last-revenge' : 'free-shot',
      freeShotsRemaining: attacker.freeShotsRemaining,
    });
  }

  attackCell(attackerSeat, defenderSeat, row, col, options = {}) {
    const attacker = this.players[attackerSeat];
    const defender = this.players[defenderSeat];
    const cell = this.validateCell(defender.board, row, col);
    if (!cell) return { ok: false, reason: 'outside' };
    const key = defender.board.key(cell.row, cell.col);
    if (defender.board.shots.has(key)) return { ok: false, reason: 'already-shot' };

    const targetShip = defender.board.getShipAt(cell.row, cell.col);
    const protectedShip = defender.submergedShipId
      ? defender.board.ships.find((ship) => ship.id === defender.submergedShipId && !ship.isSunk)
      : null;
    defender.submergedShipId = null;
    attacker.shots += 1;
    if (protectedShip && targetShip?.id === protectedShip.id) {
      return { ok: true, valid: true, type: 'blocked', ...cell, shipId: targetShip.id };
    }

    const attack = defender.board.receiveAttack(cell.row, cell.col);
    const hit = attack.type !== 'miss';
    if (hit) attacker.hits += 1;
    const pointsGained = !hit && options.grantsMissPoints ? 1 : 0;
    attacker.commandPoints += pointsGained;
    const mine = defender.mines.get(key);
    let mineTriggered = false;
    if (mine) {
      defender.mines.delete(key);
      defender.freeShotsRemaining += 3;
      defender.freeShotsGrantMissPoints = true;
      this.turnSeat = defenderSeat;
      mineTriggered = true;
    }
    if (defender.board.allShipsSunk) this.finish(attackerSeat);
    return {
      ok: true,
      valid: true,
      type: attack.type,
      ...cell,
      shipId: hit ? attack.shipId : null,
      shipName: hit ? attack.shipName : null,
      pointsGained,
      mineTriggered,
    };
  }

  useAbility(seat, payload) {
    const invalid = this.validateTurn(seat);
    if (invalid) return invalid;
    const player = this.players[seat];
    if (player.freeShotsRemaining > 0) return { ok: false, reason: 'free-shots-active' };
    const commander = this.commander(player);
    const ability = commander?.abilities.find((candidate) => candidate.id === payload.abilityId);
    if (!ability) return { ok: false, reason: 'ability-unavailable' };
    if (player.commandPoints < ability.cost) return { ok: false, reason: 'insufficient-points' };

    const handlers = {
      square: () => this.areaAbility(seat, ability, payload, 2),
      line: () => this.lineAbility(seat, ability, payload),
      scan: () => this.scanAbility(seat, ability, payload),
      repair: () => this.repairAbility(seat, ability, payload),
      chemical: () => this.singleAbilityShot(seat, ability, payload, { reveal: true }),
      mine: () => this.mineAbility(seat, ability, payload),
      relocation: () => this.relocationAbility(seat, ability, payload),
      nuclear: () => this.nuclearAbility(seat, ability, payload),
      rangefinder: () => this.rangefinderAbility(seat, ability, payload),
      'random-barrage': () => this.randomAbility(seat, ability),
      'full-row': () => this.rowAbility(seat, ability, payload),
      submerge: () => this.submergeAbility(seat, ability, payload),
      sacrifice: () => this.sacrificeAbility(seat, ability, payload),
      'purchase-ship': () => this.purchaseAbility(seat, ability, payload),
      'hydrogen-field': () => this.areaAbility(seat, ability, payload, ability.areaSize || 4),
      'last-revenge': () => this.lastRevengeAbility(seat, ability),
    };
    return handlers[ability.pattern]?.() || { ok: false, reason: 'ability-unavailable' };
  }

  spendAndEnd(seat, ability, type, detail, options = {}) {
    const player = this.players[seat];
    player.commandPoints -= ability.cost;
    if (this.phase === 'battle' && options.keepTurn !== true) this.turnSeat = this.opponentSeat(seat);
    return this.recordEvent(seat, type, { abilityId: ability.id, ...detail });
  }

  getAreaCells(row, col, size) {
    const startRow = Math.min(Math.max((Number(row) || 0) - 1, 0), CONFIG.gridSize - size);
    const startCol = Math.min(Math.max((Number(col) || 0) - 1, 0), CONFIG.gridSize - size);
    const cells = [];
    for (let rowOffset = 0; rowOffset < size; rowOffset += 1) {
      for (let colOffset = 0; colOffset < size; colOffset += 1) {
        cells.push({ row: startRow + rowOffset, col: startCol + colOffset });
      }
    }
    return cells;
  }

  fireSpecialCells(seat, cells) {
    const defenderSeat = this.opponentSeat(seat);
    const defender = this.players[defenderSeat];
    const results = [];
    for (const cell of cells) {
      if (this.phase !== 'battle') break;
      if (defender.board.shots.has(defender.board.key(cell.row, cell.col))) continue;
      const result = this.attackCell(seat, defenderSeat, cell.row, cell.col, { grantsMissPoints: false });
      if (result.ok) results.push(result);
    }
    return results;
  }

  areaAbility(seat, ability, payload, size) {
    const cell = this.validateCell(this.players[this.opponentSeat(seat)].board, payload.row, payload.col);
    if (!cell) return { ok: false, reason: 'outside' };
    const cells = this.getAreaCells(cell.row, cell.col, size);
    if (!cells.some(({ row, col }) => !this.players[this.opponentSeat(seat)].board.shots.has(`${row},${col}`))) {
      return { ok: false, reason: 'already-shot' };
    }
    const results = this.fireSpecialCells(seat, cells);
    return this.spendAndEnd(seat, ability, 'ability', { results });
  }

  lineAbility(seat, ability, payload) {
    const cell = this.validateCell(this.players[this.opponentSeat(seat)].board, payload.row, payload.col);
    if (!cell) return { ok: false, reason: 'outside' };
    const vertical = payload.orientation === 'vertical';
    const startRow = vertical ? Math.min(Math.max(cell.row - 1, 0), CONFIG.gridSize - 3) : cell.row;
    const startCol = vertical ? cell.col : Math.min(Math.max(cell.col - 1, 0), CONFIG.gridSize - 3);
    const cells = Array.from({ length: 3 }, (_, index) => ({
      row: vertical ? startRow + index : startRow,
      col: vertical ? startCol : startCol + index,
    })).filter(({ row, col }) => row < CONFIG.gridSize && col < CONFIG.gridSize);
    const results = this.fireSpecialCells(seat, cells);
    if (!results.length) return { ok: false, reason: 'already-shot' };
    return this.spendAndEnd(seat, ability, 'ability', { results, orientation: vertical ? 'vertical' : 'horizontal' });
  }

  scanAbility(seat, ability, payload) {
    const defender = this.players[this.opponentSeat(seat)];
    const cell = this.validateCell(defender.board, payload.row, payload.col);
    if (!cell) return { ok: false, reason: 'outside' };
    const cells = this.getAreaCells(cell.row, cell.col, 3);
    const found = cells.some(({ row, col }) => {
      const ship = defender.board.getShipAt(row, col);
      return ship && !ship.isSunk;
    });
    const results = [];
    if (!found) {
      cells.forEach(({ row, col }) => {
        const key = defender.board.key(row, col);
        if (!defender.board.shots.has(key)) {
          const marker = { valid: true, type: 'miss', row, col, scan: true };
          defender.board.shots.set(key, marker);
          results.push(marker);
        }
      });
    }
    return this.spendAndEnd(seat, ability, 'ability', { found, results });
  }

  repairAbility(seat, ability, payload) {
    const player = this.players[seat];
    const cell = this.validateCell(player.board, payload.row, payload.col);
    if (!cell) return { ok: false, reason: 'outside' };
    const ship = player.board.getShipAt(cell.row, cell.col);
    const hitIndex = ship?.getCells().findIndex((candidate) => candidate.row === cell.row && candidate.col === cell.col);
    if (!ship || hitIndex < 0 || !ship.hits.has(hitIndex)) return { ok: false, reason: 'not-damaged' };
    ship.hits.delete(hitIndex);
    player.board.shots.delete(player.board.key(cell.row, cell.col));
    const opponent = this.players[this.opponentSeat(seat)];
    opponent.hits = Math.max(0, opponent.hits - 1);
    return this.spendAndEnd(seat, ability, 'ability', { results: [{ valid: true, type: 'repair', ...cell, shipId: ship.id }] });
  }

  singleAbilityShot(seat, ability, payload, options = {}) {
    const defenderSeat = this.opponentSeat(seat);
    const result = this.attackCell(seat, defenderSeat, payload.row, payload.col, { grantsMissPoints: false });
    if (!result.ok) return result;
    if (options.reveal && result.shipId) this.players[seat].revealedEnemyShipIds.add(result.shipId);
    return this.spendAndEnd(seat, ability, 'ability', { results: [result], revealedShipId: options.reveal ? result.shipId : null });
  }

  mineAbility(seat, ability, payload) {
    const player = this.players[seat];
    const cell = this.validateCell(player.board, payload.row, payload.col);
    if (!cell) return { ok: false, reason: 'outside' };
    const key = player.board.key(cell.row, cell.col);
    if (player.board.shots.has(key) || player.mines.has(key)) return { ok: false, reason: 'invalid-position' };
    player.mines.set(key, cell);
    return this.spendAndEnd(seat, ability, 'ability', { results: [{ valid: true, type: 'mine-deployed', ...cell }] });
  }

  relocationAbility(seat, ability, payload) {
    const player = this.players[seat];
    const ship = player.board.ships.find((candidate) => candidate.id === payload.shipId);
    const cell = this.validateCell(player.board, payload.row, payload.col);
    if (!ship || !cell) return { ok: false, reason: 'invalid-position' };
    if (ship.hits.size) return { ok: false, reason: 'ship-damaged' };
    const destination = player.board.getPlacementCells(ship, cell.row, cell.col, ship.orientation);
    if (!player.board.canPlace(ship, cell.row, cell.col, ship.orientation, ship.id)
      || destination.some(({ row, col }) => player.board.shots.has(player.board.key(row, col)))) {
      return { ok: false, reason: 'invalid-position' };
    }
    const moved = player.board.moveShip(ship.id, cell.row, cell.col);
    return this.spendAndEnd(seat, ability, 'ability', {
      results: [{ valid: true, type: 'relocation', ...cell, shipId: ship.id }],
      oldRow: moved.oldRow,
      oldCol: moved.oldCol,
    });
  }

  nuclearAbility(seat, ability, payload) {
    const defenderSeat = this.opponentSeat(seat);
    const defender = this.players[defenderSeat];
    const result = this.attackCell(seat, defenderSeat, payload.row, payload.col, { grantsMissPoints: false });
    if (!result.ok) return result;
    const results = [result];
    if (result.shipId) {
      const ship = defender.board.ships.find((candidate) => candidate.id === result.shipId);
      ship.getCells().forEach((cell, index) => {
        ship.hits.add(index);
        const key = defender.board.key(cell.row, cell.col);
        if (!defender.board.shots.has(key)) {
          const marker = { valid: true, type: 'sunk', ...cell, shipId: ship.id, shipName: ship.name, nuclear: true };
          defender.board.shots.set(key, marker);
          results.push(marker);
        }
      });
      if (defender.board.allShipsSunk) this.finish(seat);
    }
    return this.spendAndEnd(seat, ability, 'ability', { results });
  }

  rangefinderAbility(seat, ability, payload) {
    const defenderSeat = this.opponentSeat(seat);
    const defender = this.players[defenderSeat];
    const result = this.attackCell(seat, defenderSeat, payload.row, payload.col, { grantsMissPoints: false });
    if (!result.ok) return result;
    const activeCells = defender.board.ships.filter((ship) => !ship.isSunk).flatMap((ship) => ship.getCells());
    const distance = activeCells.length
      ? Math.min(...activeCells.map((cell) => Math.abs(cell.row - result.row) + Math.abs(cell.col - result.col)))
      : null;
    return this.spendAndEnd(seat, ability, 'ability', { results: [result], distance });
  }

  randomAbility(seat, ability) {
    const board = this.players[this.opponentSeat(seat)].board;
    const available = board.unshotCells;
    if (!available.length) return { ok: false, reason: 'no-targets' };
    const cells = [];
    while (available.length && cells.length < 6) {
      const index = Math.floor(Math.min(Math.max(this.random(), 0), 0.999999) * available.length);
      cells.push(available.splice(index, 1)[0]);
    }
    const results = this.fireSpecialCells(seat, cells);
    return this.spendAndEnd(seat, ability, 'ability', { results });
  }

  rowAbility(seat, ability, payload) {
    const row = clampInteger(payload.row, 0, CONFIG.gridSize - 1);
    if (row === null) return { ok: false, reason: 'outside' };
    const cells = Array.from({ length: CONFIG.gridSize }, (_, col) => ({ row, col }));
    const results = this.fireSpecialCells(seat, cells);
    if (!results.length) return { ok: false, reason: 'already-shot' };
    return this.spendAndEnd(seat, ability, 'ability', { results });
  }

  submergeAbility(seat, ability, payload) {
    const player = this.players[seat];
    const cell = this.validateCell(player.board, payload.row, payload.col);
    const ship = cell ? player.board.getShipAt(cell.row, cell.col) : null;
    if (!ship || ship.isSunk) return { ok: false, reason: 'no-ship' };
    player.submergedShipId = ship.id;
    return this.spendAndEnd(seat, ability, 'ability', { results: [{ valid: true, type: 'submerged', ...cell, shipId: ship.id }] });
  }

  sacrificeAbility(seat, ability, payload) {
    const player = this.players[seat];
    const cell = this.validateCell(player.board, payload.row, payload.col);
    const ship = cell ? player.board.getShipAt(cell.row, cell.col) : null;
    if (!ship || ship.isSunk) return { ok: false, reason: 'no-ship' };
    if (player.board.afloatCount <= 1) return { ok: false, reason: 'last-ship' };
    const results = ship.getCells().map((target, index) => {
      ship.hits.add(index);
      const result = { valid: true, type: 'sunk', ...target, shipId: ship.id, sacrificed: true };
      player.board.shots.set(player.board.key(target.row, target.col), result);
      player.mines.delete(player.board.key(target.row, target.col));
      return result;
    });
    player.commandPoints -= ability.cost;
    player.freeShotsRemaining = 5;
    player.freeShotsGrantMissPoints = false;
    return this.recordEvent(seat, 'ability', { abilityId: ability.id, results, freeShotsRemaining: 5 });
  }

  purchaseAbility(seat, ability, payload) {
    const player = this.players[seat];
    const definition = CONFIG.ships.find((ship) => ship.id === ability.shipId);
    if (!definition || player.purchasedShipIds.has(definition.id) || player.board.ships.some((ship) => ship.id === definition.id)) {
      return { ok: false, reason: 'already-purchased' };
    }
    const cell = this.validateCell(player.board, payload.row, payload.col);
    if (!cell) return { ok: false, reason: 'outside' };
    const orientation = payload.orientation === 'vertical' ? 'vertical' : 'horizontal';
    const cells = player.board.getPlacementCells(definition, cell.row, cell.col, orientation);
    if (cells.some(({ row, col }) => player.board.shots.has(player.board.key(row, col)))) {
      return { ok: false, reason: 'invalid-position' };
    }
    const placed = player.board.placeShip(definition, cell.row, cell.col, orientation);
    if (!placed.ok) return { ok: false, reason: placed.reason };
    player.purchasedShipIds.add(definition.id);
    return this.spendAndEnd(seat, ability, 'ability', { results: [{ valid: true, type: 'ship-purchased', ...cell, shipId: definition.id }] });
  }

  lastRevengeAbility(seat, ability) {
    const player = this.players[seat];
    player.commandPoints -= ability.cost;
    player.freeShotsRemaining = Math.max(1, Number(ability.shots) || 15);
    player.freeShotsGrantMissPoints = false;
    player.lastRevengeActive = true;
    return this.recordEvent(seat, 'ability', {
      abilityId: ability.id,
      results: [],
      freeShotsRemaining: player.freeShotsRemaining,
    });
  }

  finish(winnerSeat) {
    this.phase = 'gameover';
    this.winnerSeat = winnerSeat;
  }

  recordEvent(actorSeat, type, detail) {
    this.eventId += 1;
    this.lastEvent = { id: this.eventId, actorSeat, type, ...detail };
    return { ok: true, event: this.lastEvent };
  }

  sanitizeEvent(seat) {
    if (!this.lastEvent) return null;
    const event = JSON.parse(JSON.stringify(this.lastEvent));
    const viewerIsActor = event.actorSeat === seat;
    const actor = this.players[event.actorSeat];
    const ability = this.commander(actor)?.abilities.find((candidate) => candidate.id === event.abilityId);
    if (!viewerIsActor && ability?.target === 'player') {
      event.results = [];
      delete event.oldRow;
      delete event.oldCol;
    }
    if (!viewerIsActor && ability?.pattern === 'scan') delete event.found;
    if (!viewerIsActor && ability?.pattern === 'rangefinder') delete event.distance;
    if (Array.isArray(event.results)) {
      event.results.forEach((result) => {
        if (!viewerIsActor) return;
        const defender = this.players[this.opponentSeat(event.actorSeat)];
        const ship = result.shipId ? defender.board.ships.find((candidate) => candidate.id === result.shipId) : null;
        const mayReveal = ship?.isSunk || this.players[seat].revealedEnemyShipIds.has(result.shipId);
        if (!mayReveal) {
          delete result.shipId;
          delete result.shipName;
        }
      });
    }
    return event;
  }

  boardSnapshot(board, includeAllShips, revealedIds = new Set()) {
    const ships = board.ships
      .filter((ship) => includeAllShips || ship.isSunk || revealedIds.has(ship.id))
      .map((ship) => publicShip(ship));
    const shots = [...board.shots.values()].map((shot) => ({
      type: shot.type,
      row: shot.row,
      col: shot.col,
      ...(shot.shipId && (includeAllShips || board.ships.find((ship) => ship.id === shot.shipId)?.isSunk || revealedIds.has(shot.shipId))
        ? { shipId: shot.shipId, shipName: shot.shipName }
        : {}),
      scan: shot.scan === true,
    }));
    return { size: board.size, ships, shots };
  }

  snapshot(seat) {
    const player = this.players[seat];
    const opponent = this.players[this.opponentSeat(seat)];
    return {
      phase: this.phase,
      seat,
      turnSeat: this.turnSeat,
      yourTurn: this.phase === 'battle' && this.turnSeat === seat,
      winnerSeat: this.winnerSeat,
      eventId: this.eventId,
      lastEvent: this.sanitizeEvent(seat),
      you: {
        commanderId: player.commanderId,
        ready: player.ready,
        connected: player.connected,
        commandPoints: player.commandPoints,
        shots: player.shots,
        hits: player.hits,
        freeShotsRemaining: player.freeShotsRemaining,
        lastRevengeActive: player.lastRevengeActive,
        submergedShipId: player.submergedShipId,
        purchasedShipIds: [...player.purchasedShipIds],
        mines: [...player.mines.values()],
        board: this.boardSnapshot(player.board, true),
      },
      opponent: {
        commanderId: opponent.commanderId,
        ready: opponent.ready,
        connected: opponent.connected,
        shots: opponent.shots,
        hits: opponent.hits,
        freeShotsRemaining: opponent.freeShotsRemaining,
        afloatCount: opponent.board.afloatCount,
        fleetIds: opponent.board.ships.map((ship) => ship.id),
        board: this.boardSnapshot(opponent.board, false, player.revealedEnemyShipIds),
      },
    };
  }
}

module.exports = { MultiplayerMatch };
