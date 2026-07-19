'use strict';

const assert = require('node:assert/strict');
require('../js/config.js');
require('../js/game.js');
require('../js/ai.js');

const { CONFIG, GameBoard, BattleshipGame, RandomTargetAI } = globalThis.NavalGame;

function testPlacementRules() {
  const board = new GameBoard(10);
  const carrier = CONFIG.ships[0];
  const battleship = CONFIG.ships[1];
  assert.equal(board.placeShip(carrier, 0, 5, 'horizontal').ok, true);
  assert.equal(board.placeShip(battleship, 0, 7, 'vertical').ok, false, 'overlap must be rejected');
  assert.equal(board.placeShip(battleship, 8, 0, 'vertical').ok, false, 'out-of-bounds must be rejected');
  assert.equal(board.placeShip(battleship, 1, 0, 'horizontal').ok, true, 'adjacent ships are allowed');
}

function testAttacksAndSinking() {
  const board = new GameBoard(10);
  const destroyer = CONFIG.ships.find((ship) => ship.id === 'destroyer');
  board.placeShip(destroyer, 3, 3, 'horizontal');
  assert.equal(board.receiveAttack(0, 0).type, 'miss');
  assert.equal(board.receiveAttack(3, 3).type, 'hit');
  assert.equal(board.receiveAttack(3, 3).valid, false, 'duplicate attack must be rejected');
  assert.equal(board.receiveAttack(3, 4).type, 'sunk');
  assert.equal(board.allShipsSunk, true);
}

function testRandomFleetAndAI() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.randomizeBoard(game.playerBoard);
  assert.equal(game.playerBoard.ships.length, game.playerFleetDefinitions.length);
  assert.equal(game.playerBoard.occupancy.size, game.playerFleetDefinitions.reduce((sum, ship) => sum + ship.length, 0));
  game.randomizeBoard(game.enemyBoard);
  const ai = new RandomTargetAI(() => 0);
  const first = ai.chooseTarget(game.playerBoard);
  game.playerBoard.receiveAttack(first.row, first.col);
  const second = ai.chooseTarget(game.playerBoard);
  assert.notDeepEqual(second, first, 'AI must not choose an attacked field');
}

function testExperimentalFootprints() {
  const board = new GameBoard(10);
  const fortressDefinition = CONFIG.ships.find((ship) => ship.id === 'floating-fortress');
  assert.equal(board.placeShip(fortressDefinition, 0, 0, 'horizontal').ok, true);
  const fortress = board.ships[0];
  assert.equal(fortress.getCells().length, 14);
  const rows = new Set(fortress.getCells().map((cell) => cell.row));
  const cols = new Set(fortress.getCells().map((cell) => cell.col));
  assert.equal(rows.size * cols.size, 14, 'fortress footprint must rotate as one 7x2 rectangle');
}

function testGameFlowAndVictory() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.randomizeBoard(game.playerBoard);
  assert.equal(game.startBattle(), true);
  for (const ship of game.enemyBoard.ships) {
    for (const cell of ship.getCells()) {
      game.turn = 'player';
      game.playerAttack(cell.row, cell.col);
    }
  }
  assert.equal(game.phase, 'gameover');
  assert.equal(game.winner, 'player');
}

function testDefeatAndTurnProtection() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.randomizeBoard(game.playerBoard);
  game.startBattle();
  assert.equal(game.enemyAttack(0, 0).reason, 'not-enemy-turn', 'enemy may not fire during player turn');
  for (const ship of game.playerBoard.ships) {
    for (const cell of ship.getCells()) {
      game.turn = 'enemy';
      game.enemyAttack(cell.row, cell.col);
    }
  }
  assert.equal(game.phase, 'gameover');
  assert.equal(game.winner, 'enemy');
}

function testCommanderPointsAndAbilities() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.setMode('commander');
  assert.equal(game.setCommander('standard'), true);
  game.randomizeBoard(game.playerBoard, Math.random, game.playerFleetDefinitions);
  game.startBattle();

  const miss = game.enemyBoard.unshotCells.find((cell) => !game.enemyBoard.getShipAt(cell.row, cell.col));
  const missResult = game.playerAttack(miss.row, miss.col);
  assert.equal(missResult.type, 'miss');
  assert.equal(game.commandPoints, 1, 'a miss awards one command point');

  const ability = CONFIG.commanders[0].abilities[1];
  game.commandPoints = ability.cost;
  game.turn = 'player';
  const available = game.enemyBoard.unshotCells.slice(0, 3);
  const abilityResult = game.playerAttackPattern(available, ability);
  assert.equal(abilityResult.valid, true);
  assert.equal(abilityResult.results.length, 3);
  assert.equal(game.turn, 'enemy');
  assert.equal(abilityResult.pointsGained, 0, 'standard abilities do not award miss points');
  assert.equal(game.commandPoints, 0, 'ability misses must not refund points');

  const squareAbility = CONFIG.commanders[0].abilities[0];
  game.commandPoints = squareAbility.cost;
  game.turn = 'player';
  const squareTargets = game.enemyBoard.unshotCells.slice(0, 4);
  const squareResult = game.playerAttackPattern(squareTargets, squareAbility);
  assert.equal(squareResult.valid, true);
  assert.equal(squareResult.results.length, 4, '2x2 barrage fires four shots');
  assert.equal(squareResult.pointsGained, 0);
  assert.equal(game.commandPoints, 0);
  assert.equal(game.stats.playerShots >= 8, true);
}

function testPortraitCommanderPlaceholders() {
  const standard = CONFIG.commanders.find((commander) => commander.id === 'standard');
  assert.equal(CONFIG.commanders.some((commander) => commander.id === 'debug'), false, 'the standalone debug commander must not be selectable');
  const placeholders = CONFIG.commanders.filter((commander) => commander.portraitAsset);
  assert.equal(placeholders.length, 19, 'all new portrait files must create a commander');
  assert.equal(new Set(placeholders.map((commander) => commander.id)).size, 19, 'placeholder commander IDs must be unique');
  const voss = CONFIG.commanders.find((commander) => commander.id === 'captain-elias-voss');
  assert.equal(voss.name, 'Kapitän Elias Voss');
  assert.deepEqual(voss.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [2, 3, 5]);
  assert.deepEqual(voss.abilities.map((ability) => ability.cost), [8, 3]);
  const kwon = CONFIG.commanders.find((commander) => commander.id === 'captain-dae-hyun-kwon');
  assert.equal(kwon.name, 'Kapitän Dae-Hyun Kwon');
  assert.deepEqual(kwon.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [4, 4, 2, 2]);
  assert.deepEqual(kwon.abilities.map((ability) => ability.cost), [4, 7]);
  assert.deepEqual(kwon.abilities.map((ability) => ability.animationId), ['chemical-reveal', 'mine-deployment']);
  const graves = CONFIG.commanders.find((commander) => commander.id === 'captain-ronan-graves');
  assert.equal(graves.name, 'Kapitän Ronan Graves');
  assert.deepEqual(graves.fleet, ['floating-fortress', 'patrol-interceptor']);
  assert.deepEqual(graves.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [14, 2]);
  assert.deepEqual(graves.abilities.map((ability) => ability.cost), [5, 7]);
  assert.deepEqual(graves.abilities.map((ability) => ability.animationId), ['tactical-relocation', 'nuclear-annihilation']);
  const dhillon = CONFIG.commanders.find((commander) => commander.id === 'captain-arjan-dhillon');
  assert.equal(dhillon.name, 'Kapitän Arjan Dhillon');
  assert.deepEqual(dhillon.fleet, ['fork-ship', 'heavy-missile-cruiser', 'fast-destroyer']);
  assert.deepEqual(dhillon.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [6, 4, 3]);
  assert.deepEqual(dhillon.abilities.map((ability) => ability.cost), [5, 8]);
  assert.deepEqual(dhillon.abilities.map((ability) => ability.animationId), ['vector-rangefinder', 'berserker-random-barrage']);
  const serrano = CONFIG.commanders.find((commander) => commander.id === 'captain-mateo-serrano');
  assert.equal(serrano.name, 'Kapitän Mateo Serrano');
  assert.deepEqual(serrano.fleet, ['carrier', 'submarine', 'cruiser']);
  assert.deepEqual(serrano.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [5, 3, 3]);
  assert.deepEqual(serrano.abilities.map((ability) => ability.cost), [14, 5]);
  assert.deepEqual(serrano.abilities.map((ability) => ability.animationId), ['abyss-row-torpedo', 'abyss-submerge-shield']);
  const falk = CONFIG.commanders.find((commander) => commander.id === 'captain-leander-falk');
  assert.equal(falk.name, 'Kapitän Leander Falk');
  assert.deepEqual(falk.fleet, ['patrol-interceptor', 'destroyer', 'rapid-corvette', 'torpedo-cutter', 'missile-boat']);
  assert.deepEqual(falk.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [2, 2, 2, 2, 2]);
  assert.equal(new Set(falk.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).asset)).size, 5, 'Falk receives five visually distinct supplied ship textures');
  assert.deepEqual(falk.abilities.map((ability) => ability.cost), [6, 13]);
  assert.deepEqual(falk.abilities.map((ability) => ability.animationId), ['ledger-fleet-sacrifice', 'ledger-ship-procurement']);
  const okafor = CONFIG.commanders.find((commander) => commander.id === 'captain-malik-okafor');
  assert.equal(okafor.name, 'Kapitän Malik Okafor');
  assert.deepEqual(okafor.fleet, ['square-catamaran', 'battleship', 'cruiser']);
  assert.deepEqual(okafor.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [4, 4, 3]);
  const squareShip = CONFIG.ships.find((ship) => ship.id === okafor.fleet[0]);
  assert.deepEqual([squareShip.gridWidth, squareShip.gridHeight], [2, 2], 'the requested 2x2 ship uses the supplied square footprint');
  assert.deepEqual(okafor.abilities.map((ability) => ability.cost), [12, 15]);
  assert.deepEqual(okafor.abilities.map((ability) => ability.animationId), ['prometheus-hydrogen-bomb', 'prometheus-last-revenge']);
  const vale = CONFIG.commanders.find((commander) => commander.id === 'captain-lucian-vale');
  assert.equal(vale.name, 'Kapitän Lucian Vale');
  assert.deepEqual(vale.fleet, ['square-catamaran', 'heavy-missile-cruiser', 'fast-destroyer']);
  const valeSquare = CONFIG.ships.find((ship) => ship.id === vale.fleet[0]);
  assert.deepEqual([valeSquare.gridWidth, valeSquare.gridHeight], [2, 2]);
  assert.deepEqual(vale.abilities.map((ability) => ability.cost), [6, 6]);
  assert.deepEqual(vale.abilities.map((ability) => ability.animationId), ['ignis-flame-missile', 'ignis-scan-shot']);
  const cross = CONFIG.commanders.find((commander) => commander.id === 'captain-imani-cross');
  assert.equal(cross.name, 'Kapitän Imani Cross');
  assert.deepEqual(cross.fleet, ['carrier', 'fork-ship', 'patrol-interceptor']);
  assert.deepEqual(cross.fleet.map((shipId) => CONFIG.ships.find((ship) => ship.id === shipId).length), [5, 6, 2]);
  const crossFork = CONFIG.ships.find((ship) => ship.id === cross.fleet[1]);
  assert.deepEqual([crossFork.gridWidth, crossFork.gridHeight], [3, 2]);
  assert.deepEqual(cross.abilities.map((ability) => ability.cost), [8, 3]);
  assert.deepEqual(cross.abilities.map((ability) => ability.animationId), ['raptor-jet-launch', 'raptor-signal-jammer']);
  const finishedIds = new Set([voss.id, kwon.id, graves.id, dhillon.id, serrano.id, falk.id, okafor.id, vale.id, cross.id]);
  for (const commander of placeholders.filter((commander) => !finishedIds.has(commander.id))) {
    assert.equal(commander.name, '#Test');
    assert.deepEqual(commander.fleet, standard.fleet, `${commander.id} must start with the standard fleet`);
    assert.deepEqual(commander.abilities, standard.abilities, `${commander.id} must start with the standard abilities`);
    assert.match(commander.portraitAsset, /^assets\/captain-portraits\/.+\.png$/);
  }
}

function testCrossJetAndSignalJammer() {
  const makeGame = () => {
    const game = new BattleshipGame(CONFIG);
    game.reset();
    game.setMode('commander');
    assert.equal(game.setCommander('captain-imani-cross'), true);
    game.playerBoard.clear();
    assert.equal(game.playerBoard.placeShip(CONFIG.ships.find((ship) => ship.id === 'carrier'), 0, 0, 'horizontal').ok, true);
    assert.equal(game.playerBoard.placeShip(CONFIG.ships.find((ship) => ship.id === 'fork-ship'), 2, 0, 'horizontal').ok, true);
    assert.equal(game.playerBoard.placeShip(CONFIG.ships.find((ship) => ship.id === 'patrol-interceptor'), 4, 0, 'horizontal').ok, true);
    game.enemyBoard.clear();
    assert.equal(game.enemyBoard.placeShip(CONFIG.ships.find((ship) => ship.id === 'destroyer'), 8, 0, 'horizontal').ok, true);
    game.phase = 'battle';
    game.turn = 'player';
    return game;
  };

  const game = makeGame();
  const launch = game.activeCommander.abilities.find((ability) => ability.pattern === 'jet-launch');
  const jammer = game.activeCommander.abilities.find((ability) => ability.pattern === 'jammer');
  game.commandPoints = launch.cost - 1;
  assert.equal(game.playerLaunchJet(launch, () => 0).reason, 'insufficient-points');
  assert.equal(game.playerJet.launched, false);
  assert.equal(game.turn, 'player');

  game.commandPoints = launch.cost;
  const launched = game.playerLaunchJet(launch, () => 0);
  assert.equal(launched.valid, true);
  assert.equal(game.playerJet.active, true);
  assert.equal(game.playerBoard.getShipAt(game.playerJet.row, game.playerJet.col), null, 'jet starts over water');
  assert.equal(game.commandPoints, 0);
  assert.equal(game.turn, 'enemy');

  const firstJetCell = { row: game.playerJet.row, col: game.playerJet.col };
  const enemyMiss = game.playerBoard.unshotCells.find((cell) => !game.playerBoard.getShipAt(cell.row, cell.col)
    && (cell.row !== firstJetCell.row || cell.col !== firstJetCell.col));
  const moved = game.enemyAttack(enemyMiss.row, enemyMiss.col, () => 0);
  assert.equal(moved.valid, true);
  assert.equal(moved.jetMoved, true);
  assert.notDeepEqual({ row: game.playerJet.row, col: game.playerJet.col }, firstJetCell, 'jet moves after a valid enemy shot');

  game.turn = 'player';
  game.commandPoints = launch.cost;
  assert.equal(game.playerLaunchJet(launch, () => 0).reason, 'jet-already-launched');
  assert.equal(game.commandPoints, launch.cost, 'invalid repeat launch spends no points');

  for (const ship of game.playerBoard.ships) {
    for (const cell of ship.getCells()) {
      game.turn = 'enemy';
      const result = game.enemyAttack(cell.row, cell.col, () => 0);
      assert.equal(result.valid, true);
    }
  }
  assert.equal(game.playerBoard.allShipsSunk, true);
  assert.equal(game.phase, 'battle', 'active jet keeps the player alive after every ship sinks');
  game.turn = 'enemy';
  const jetHit = game.enemyAttack(game.playerJet.row, game.playerJet.col, () => 0);
  assert.equal(jetHit.type, 'jet-hit');
  assert.equal(game.playerJet.destroyed, true);
  assert.equal(game.phase, 'gameover');
  assert.equal(game.winner, 'enemy');

  const jammerGame = makeGame();
  jammerGame.commandPoints = jammer.cost;
  const jammed = jammerGame.playerActivateJammer(jammer);
  assert.equal(jammed.valid, true);
  assert.equal(jammerGame.enemyAbilityJammedTurns, 1);
  assert.equal(jammerGame.commandPoints, 0);
  const water = jammerGame.playerBoard.unshotCells.find((cell) => !jammerGame.playerBoard.getShipAt(cell.row, cell.col));
  assert.equal(jammerGame.enemyAttack(water.row, water.col, () => 0).valid, true);
  assert.equal(jammerGame.enemyAbilityJammedTurns, 0, 'jam lasts exactly one enemy turn');
}

function testValeFlameMissileAndScanShot() {
  const makeGame = () => {
    const game = new BattleshipGame(CONFIG);
    game.reset();
    game.setMode('commander');
    assert.equal(game.setCommander('captain-lucian-vale'), true);
    game.playerBoard.clear();
    game.playerFleetDefinitions.forEach((definition, index) => {
      assert.equal(game.playerBoard.placeShip(definition, index * 2, 0, 'horizontal').ok, true);
    });
    game.enemyBoard.clear();
    const destroyer = CONFIG.ships.find((ship) => ship.id === 'fast-destroyer');
    assert.equal(game.enemyBoard.placeShip(destroyer, 4, 4, 'horizontal').ok, true);
    game.phase = 'battle';
    game.turn = 'player';
    return game;
  };

  const flameGame = makeGame();
  const flame = flameGame.activeCommander.abilities.find((ability) => ability.pattern === 'diagonal-flame');
  flameGame.commandPoints = flame.cost - 1;
  assert.equal(flameGame.playerAttackPattern([{ row: 0, col: 0 }], flame).reason, 'insufficient-points');
  assert.equal(flameGame.turn, 'player');
  flameGame.commandPoints = flame.cost;
  const flameResult = flameGame.playerAttackPattern([
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 2 },
  ], flame);
  assert.equal(flameResult.valid, true);
  assert.equal(flameResult.results.length, 3);
  assert.equal(flameResult.pointsGained, 0);
  assert.equal(flameGame.commandPoints, 0);
  assert.equal(flameGame.turn, 'enemy');

  const scanGame = makeGame();
  const scanShot = scanGame.activeCommander.abilities.find((ability) => ability.pattern === 'scan-shot');
  scanGame.commandPoints = scanShot.cost;
  const scanResult = scanGame.playerScanShot(3, 3, scanShot);
  assert.equal(scanResult.valid, true);
  assert.equal(scanResult.shot.type, 'miss');
  assert.equal(scanResult.contactsMarked.length, 1);
  assert.equal(scanResult.waterMarked.length, 7);
  assert.equal(scanGame.enemyBoard.getShipAt(4, 4).hits.size, 0, 'scan contact must not damage the adjacent ship');
  assert.equal(scanGame.enemyContactMarkers.has('4,4'), true);
  assert.equal(scanGame.enemyBoard.shots.has('4,4'), false, 'contact marker remains fireable');
  assert.equal(scanGame.stats.playerShots, 1, 'only the center is a real shot');
  assert.equal(scanGame.commandPoints, 0, 'scan-shot grants no miss points');

  scanGame.turn = 'player';
  scanGame.commandPoints = scanShot.cost;
  const duplicate = scanGame.playerScanShot(3, 3, scanShot);
  assert.equal(duplicate.reason, 'already-shot');
  assert.equal(scanGame.commandPoints, scanShot.cost, 'invalid center spends no points');
  assert.equal(scanGame.turn, 'player');

  const contactHit = scanGame.playerAttack(4, 4);
  assert.equal(contactHit.type, 'hit');
  assert.equal(scanGame.enemyContactMarkers.has('4,4'), false, 'firing clears the anonymous marker');
}

function testFalkSacrificeAndProcurement() {
  const makeGame = () => {
    const game = new BattleshipGame(CONFIG);
    game.reset();
    game.setMode('commander');
    assert.equal(game.setCommander('captain-leander-falk'), true);
    game.playerBoard.clear();
    game.playerFleetDefinitions.forEach((definition, row) => {
      assert.equal(game.playerBoard.placeShip(definition, row, 0, 'horizontal').ok, true);
    });
    game.enemyBoard.clear();
    const carrier = CONFIG.ships.find((ship) => ship.id === 'carrier');
    game.enemyBoard.placeShip(carrier, 8, 0, 'horizontal');
    game.phase = 'battle';
    game.turn = 'player';
    return game;
  };

  const game = makeGame();
  const sacrifice = game.activeCommander.abilities.find((ability) => ability.pattern === 'sacrifice');
  const procurement = game.activeCommander.abilities.find((ability) => ability.pattern === 'purchase-ship');

  game.commandPoints = sacrifice.cost - 1;
  assert.equal(game.playerSacrificeShip(0, 0, sacrifice).reason, 'insufficient-points');
  assert.equal(game.commandPoints, sacrifice.cost - 1);
  game.commandPoints = sacrifice.cost;
  assert.equal(game.playerSacrificeShip(9, 9, sacrifice).reason, 'no-ship');
  assert.equal(game.commandPoints, sacrifice.cost, 'an invalid sacrifice spends no points');

  const sacrificedShip = game.playerBoard.getShipAt(0, 0);
  const sacrificedCells = sacrificedShip.getCells();
  const firstKey = game.playerBoard.key(sacrificedCells[0].row, sacrificedCells[0].col);
  game.playerMines.set(firstKey, { active: true });
  game.blockedAttackMarkers.set(firstKey, { type: 'blocked' });
  const sacrificed = game.playerSacrificeShip(0, 0, sacrifice);
  assert.equal(sacrificed.valid, true);
  assert.equal(sacrificed.type, 'sacrificed');
  assert.equal(sacrificed.affected.length, 2);
  assert.equal(sacrificedShip.isSunk, true);
  assert.equal(game.playerBoard.afloatCount, 4);
  assert.equal(game.playerMines.has(firstKey), false);
  assert.equal(game.blockedAttackMarkers.has(firstKey), false);
  assert.equal(game.commandPoints, 0);
  assert.equal(game.freeShotsRemaining, 5);
  assert.equal(game.freeShotsGrantMissPoints, false);
  assert.equal(game.turn, 'player');
  assert.equal(game.stats.enemyHits, 0, 'self-destruction is not credited to the enemy');

  game.commandPoints = procurement.cost;
  assert.equal(game.playerPurchaseShip(7, 7, 'horizontal', procurement).reason, 'free-shots-active');
  assert.equal(game.commandPoints, procurement.cost);
  const freeMisses = game.enemyBoard.unshotCells
    .filter((cell) => !game.enemyBoard.getShipAt(cell.row, cell.col))
    .slice(0, 5);
  freeMisses.forEach((cell, index) => {
    const result = game.playerAttack(cell.row, cell.col);
    assert.equal(result.type, 'miss');
    assert.equal(result.freeShotsRemaining, 4 - index);
    assert.equal(game.commandPoints, procurement.cost, 'sacrifice volley misses never award points');
    assert.equal(game.turn, index < 4 ? 'player' : 'enemy');
  });
  assert.equal(game.freeShotsGrantMissPoints, true, 'normal point policy returns after the sacrifice volley');
  game.turn = 'player';
  const normalMiss = game.enemyBoard.unshotCells.find((cell) => !game.enemyBoard.getShipAt(cell.row, cell.col));
  game.playerAttack(normalMiss.row, normalMiss.col);
  assert.equal(game.commandPoints, procurement.cost + 1, 'a later normal miss still awards one point');

  const lastShipGame = makeGame();
  const lastSacrifice = lastShipGame.activeCommander.abilities.find((ability) => ability.pattern === 'sacrifice');
  lastShipGame.playerBoard.ships.slice(0, 4).forEach((ship) => {
    ship.getCells().forEach((cell) => lastShipGame.playerBoard.receiveAttack(cell.row, cell.col));
  });
  lastShipGame.commandPoints = lastSacrifice.cost;
  assert.equal(lastShipGame.playerSacrificeShip(4, 0, lastSacrifice).reason, 'last-ship');
  assert.equal(lastShipGame.commandPoints, lastSacrifice.cost);

  const purchaseGame = makeGame();
  const buyShip = purchaseGame.activeCommander.abilities.find((ability) => ability.pattern === 'purchase-ship');
  purchaseGame.commandPoints = buyShip.cost - 1;
  assert.equal(purchaseGame.playerPurchaseShip(9, 9, 'horizontal', buyShip).reason, 'insufficient-points');
  purchaseGame.commandPoints = buyShip.cost;
  assert.equal(purchaseGame.playerPurchaseShip(0, 0, 'horizontal', buyShip).reason, 'invalid-position');
  assert.equal(purchaseGame.commandPoints, buyShip.cost);
  purchaseGame.playerBoard.receiveAttack(7, 7);
  assert.equal(purchaseGame.playerPurchaseShip(7, 7, 'horizontal', buyShip).reason, 'previously-fired-upon');
  assert.equal(purchaseGame.commandPoints, buyShip.cost, 'an invalid berth spends no points');

  const bought = purchaseGame.playerPurchaseShip(9, 9, 'horizontal', buyShip);
  assert.equal(bought.valid, true);
  assert.equal(bought.type, 'ship-purchased');
  assert.equal(bought.row, 9);
  assert.equal(bought.col, 7, 'edge placement is clamped to a complete three-cell berth');
  assert.equal(bought.cells.length, 3);
  assert.equal(purchaseGame.commandPoints, 0);
  assert.equal(purchaseGame.turn, 'enemy');
  assert.equal(purchaseGame.purchasedShipIds.has('fast-destroyer'), true);
  assert.equal(purchaseGame.playerBoard.ships.length, 6);
  assert.equal(purchaseGame.playerFleetDefinitions.length, 6);
  assert.equal(purchaseGame.enemyFleetDefinitions.length, 5, 'the purchased ship belongs only to the player');
  purchaseGame.turn = 'player';
  purchaseGame.commandPoints = buyShip.cost;
  assert.equal(purchaseGame.playerPurchaseShip(6, 6, 'vertical', buyShip).reason, 'already-purchased');
  assert.equal(purchaseGame.commandPoints, buyShip.cost);
}

function testOkaforHydrogenBombAndLastRevenge() {
  const makeGame = () => {
    const game = new BattleshipGame(CONFIG);
    game.reset();
    game.setMode('commander');
    assert.equal(game.setCommander('captain-malik-okafor'), true);
    game.phase = 'battle';
    game.turn = 'player';
    return game;
  };

  const hydrogenGame = makeGame();
  const hydrogen = hydrogenGame.activeCommander.abilities.find((ability) => ability.pattern === 'hydrogen-field');
  const revenge = hydrogenGame.activeCommander.abilities.find((ability) => ability.pattern === 'last-revenge');
  const square = CONFIG.ships.find((ship) => ship.id === 'square-catamaran');
  const battleship = CONFIG.ships.find((ship) => ship.id === 'battleship');
  hydrogenGame.enemyBoard.placeShip(square, 0, 0, 'horizontal');
  hydrogenGame.enemyBoard.placeShip(battleship, 7, 0, 'horizontal');
  const enemySquare = hydrogenGame.enemyBoard.ships.find((ship) => ship.id === 'square-catamaran');
  const sector = Array.from({ length: 16 }, (_, index) => ({ row: Math.floor(index / 4), col: index % 4 }));

  hydrogenGame.commandPoints = hydrogen.cost - 1;
  const deniedBomb = hydrogenGame.playerAttackPattern(sector, hydrogen);
  assert.equal(deniedBomb.reason, 'insufficient-points');
  assert.equal(hydrogenGame.enemyBoard.shots.size, 0);
  assert.equal(hydrogenGame.commandPoints, hydrogen.cost - 1);

  hydrogenGame.enemyBoard.receiveAttack(3, 3);
  hydrogenGame.commandPoints = hydrogen.cost;
  const bomb = hydrogenGame.playerAttackPattern(sector, hydrogen);
  assert.equal(bomb.valid, true);
  assert.equal(bomb.results.length, 15, 'already fired-upon cells are skipped inside the 4x4 sector');
  assert.equal(bomb.results.filter((result) => result.type !== 'miss').length, 4);
  assert.equal(enemySquare.isSunk, true);
  assert.equal(hydrogenGame.enemyBoard.shots.size, 16);
  assert.equal(hydrogenGame.stats.playerShots, 15);
  assert.equal(hydrogenGame.stats.playerHits, 4);
  assert.equal(bomb.pointsGained, 0);
  assert.equal(hydrogenGame.commandPoints, 0, 'hydrogen-bomb misses award no ability-round points');
  assert.equal(hydrogenGame.turn, 'enemy');

  hydrogenGame.turn = 'player';
  hydrogenGame.commandPoints = hydrogen.cost;
  const exhaustedSector = hydrogenGame.playerAttackPattern(sector, hydrogen);
  assert.equal(exhaustedSector.reason, 'already-shot');
  assert.equal(hydrogenGame.commandPoints, hydrogen.cost, 'a fully exhausted sector spends no points');
  assert.equal(hydrogenGame.turn, 'player');

  const failureGame = makeGame();
  const failureRevenge = failureGame.activeCommander.abilities.find((ability) => ability.pattern === 'last-revenge');
  failureGame.enemyBoard.placeShip(battleship, 9, 0, 'horizontal');
  failureGame.commandPoints = failureRevenge.cost - 1;
  const deniedRevenge = failureGame.playerActivateLastRevenge(failureRevenge);
  assert.equal(deniedRevenge.reason, 'insufficient-points');
  assert.equal(failureGame.freeShotsRemaining, 0);
  assert.equal(failureGame.turn, 'player');

  failureGame.commandPoints = failureRevenge.cost;
  const armed = failureGame.playerActivateLastRevenge(failureRevenge);
  assert.equal(armed.valid, true);
  assert.equal(armed.type, 'last-revenge-armed');
  assert.equal(armed.shotsGranted, 15);
  assert.equal(failureGame.commandPoints, 0);
  assert.equal(failureGame.freeShotsRemaining, 15);
  assert.equal(failureGame.freeShotsGrantMissPoints, false);
  assert.equal(failureGame.lastRevengeActive, true);

  const failureTargets = failureGame.enemyBoard.unshotCells
    .filter((cell) => !failureGame.enemyBoard.getShipAt(cell.row, cell.col))
    .slice(0, 15);
  const firstRevengeShot = failureGame.playerAttack(failureTargets[0].row, failureTargets[0].col);
  assert.equal(firstRevengeShot.freeShotsRemaining, 14);
  const duplicate = failureGame.playerAttack(failureTargets[0].row, failureTargets[0].col);
  assert.equal(duplicate.reason, 'already-shot');
  assert.equal(failureGame.freeShotsRemaining, 14, 'an invalid target does not consume a revenge shot');
  failureTargets.slice(1).forEach((cell, index) => {
    const result = failureGame.playerAttack(cell.row, cell.col);
    if (index < 13) {
      assert.equal(failureGame.phase, 'battle');
      assert.equal(failureGame.turn, 'player');
    } else {
      assert.equal(result.lastRevengeFailed, true);
    }
  });
  assert.equal(failureGame.commandPoints, 0, 'all fifteen revenge misses award zero points');
  assert.equal(failureGame.freeShotsRemaining, 0);
  assert.equal(failureGame.lastRevengeActive, false);
  assert.equal(failureGame.phase, 'gameover');
  assert.equal(failureGame.winner, 'enemy');

  const victoryGame = makeGame();
  const victoryRevenge = victoryGame.activeCommander.abilities.find((ability) => ability.pattern === 'last-revenge');
  const destroyer = CONFIG.ships.find((ship) => ship.id === 'destroyer');
  victoryGame.enemyBoard.placeShip(destroyer, 4, 4, 'horizontal');
  victoryGame.commandPoints = victoryRevenge.cost;
  victoryGame.playerActivateLastRevenge(victoryRevenge);
  victoryGame.playerAttack(4, 4);
  const winningShot = victoryGame.playerAttack(4, 5);
  assert.equal(winningShot.lastRevengeWon, true);
  assert.equal(victoryGame.phase, 'gameover');
  assert.equal(victoryGame.winner, 'player');
  assert.equal(victoryGame.freeShotsRemaining, 0);
  assert.equal(victoryGame.lastRevengeActive, false);
  assert.equal(victoryGame.commandPoints, 0);
}

function testSerranoTorpedoAndSubmerge() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.setMode('commander');
  assert.equal(game.setCommander('captain-mateo-serrano'), true);
  const torpedo = game.activeCommander.abilities.find((ability) => ability.pattern === 'full-row');
  const submerge = game.activeCommander.abilities.find((ability) => ability.pattern === 'submerge');
  const carrier = CONFIG.ships.find((ship) => ship.id === 'carrier');
  const submarine = CONFIG.ships.find((ship) => ship.id === 'submarine');
  const cruiser = CONFIG.ships.find((ship) => ship.id === 'cruiser');

  game.enemyBoard.clear();
  game.enemyBoard.placeShip(submarine, 2, 4, 'horizontal');
  game.enemyBoard.placeShip(cruiser, 6, 0, 'horizontal');
  game.enemyBoard.placeShip(carrier, 8, 0, 'horizontal');
  game.enemyBoard.receiveAttack(2, 0);
  game.phase = 'battle';
  game.turn = 'player';

  game.commandPoints = torpedo.cost - 1;
  const torpedoDenied = game.playerTorpedoRow(2, torpedo);
  assert.equal(torpedoDenied.reason, 'insufficient-points');
  assert.equal(game.commandPoints, torpedo.cost - 1);
  assert.equal(game.enemyBoard.shots.size, 1, 'denied torpedo must not mutate the row');

  game.commandPoints = torpedo.cost;
  const rowStrike = game.playerTorpedoRow(2, torpedo);
  assert.equal(rowStrike.valid, true);
  assert.equal(rowStrike.results.length, 9, 'the torpedo fires only at the nine still-unshot row cells');
  assert.equal(rowStrike.results.filter((result) => result.type !== 'miss').length, 3);
  assert.equal(Array.from({ length: 10 }, (_, col) => game.enemyBoard.shots.has(game.enemyBoard.key(2, col))).every(Boolean), true);
  assert.equal(rowStrike.pointsGained, 0);
  assert.equal(game.commandPoints, 0, 'torpedo misses grant no ability-round points');
  assert.equal(game.stats.playerShots, 9);
  assert.equal(game.stats.playerHits, 3);
  assert.equal(game.turn, 'enemy');

  game.turn = 'player';
  game.commandPoints = torpedo.cost;
  const finishedRow = game.playerTorpedoRow(2, torpedo);
  assert.equal(finishedRow.reason, 'already-shot');
  assert.equal(game.commandPoints, torpedo.cost, 'a completed row is invalid and spends no points');

  game.playerBoard.clear();
  game.playerBoard.placeShip(carrier, 0, 0, 'horizontal');
  game.playerBoard.placeShip(submarine, 3, 0, 'horizontal');
  game.playerBoard.placeShip(cruiser, 6, 0, 'horizontal');
  game.turn = 'player';
  game.commandPoints = submerge.cost;
  const emptyTarget = game.playerSubmergeShip(9, 9, submerge);
  assert.equal(emptyTarget.reason, 'no-ship');
  assert.equal(game.commandPoints, submerge.cost);
  assert.equal(game.turn, 'player');

  const ownCruiser = game.playerBoard.ships.find((ship) => ship.id === 'cruiser');
  ownCruiser.getCells().forEach((cell) => game.playerBoard.receiveAttack(cell.row, cell.col));
  const sunkTarget = game.playerSubmergeShip(6, 0, submerge);
  assert.equal(sunkTarget.reason, 'ship-sunk');
  assert.equal(game.commandPoints, submerge.cost);

  const dive = game.playerSubmergeShip(3, 0, submerge);
  const ownSubmarine = game.playerBoard.ships.find((ship) => ship.id === 'submarine');
  assert.equal(dive.valid, true);
  assert.equal(dive.shipId, 'submarine');
  assert.equal(game.submergedShipId, 'submarine');
  assert.equal(game.commandPoints, 0);
  assert.equal(game.turn, 'enemy');

  const blocked = game.enemyAttack(3, 0);
  const blockedKey = game.playerBoard.key(3, 0);
  assert.equal(blocked.type, 'blocked');
  assert.equal(ownSubmarine.hits.size, 0, 'a blocked strike must not damage the submerged ship');
  assert.equal(game.playerBoard.shots.has(blockedKey), false, 'blocked cell remains legally targetable later');
  assert.equal(game.playerBoard.unshotCells.some((cell) => cell.row === 3 && cell.col === 0), true);
  assert.equal(game.blockedAttackMarkers.has(blockedKey), true);
  assert.equal(game.stats.enemyShots, 1);
  assert.equal(game.stats.enemyHits, 0);
  assert.equal(game.submergedShipId, null, 'protection expires after the enemy turn');
  assert.equal(game.turn, 'player');

  game.commandPoints = submerge.cost;
  game.playerSubmergeShip(3, 0, submerge);
  const otherTarget = game.enemyAttack(9, 9);
  assert.equal(otherTarget.type, 'miss');
  assert.equal(game.submergedShipId, null, 'protection also expires when the enemy attacks elsewhere');
  game.turn = 'enemy';
  const laterHit = game.enemyAttack(3, 0);
  assert.equal(laterHit.type, 'hit');
  assert.equal(ownSubmarine.hits.size, 1);
  assert.equal(game.blockedAttackMarkers.has(blockedKey), false, 'a later real hit replaces the old block marker');
  assert.equal(game.stats.enemyHits, 1);
}

function testDhillonRangefinderAndBarrage() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.setMode('commander');
  assert.equal(game.setCommander('captain-arjan-dhillon'), true);
  const rangefinder = game.activeCommander.abilities.find((ability) => ability.pattern === 'rangefinder');
  const barrage = game.activeCommander.abilities.find((ability) => ability.pattern === 'random-barrage');
  const destroyer = CONFIG.ships.find((ship) => ship.id === 'fast-destroyer');
  const cruiser = CONFIG.ships.find((ship) => ship.id === 'heavy-missile-cruiser');

  game.enemyBoard.clear();
  game.enemyBoard.placeShip(destroyer, 4, 4, 'horizontal');
  game.enemyBoard.placeShip(cruiser, 8, 0, 'horizontal');
  game.phase = 'battle';
  game.turn = 'player';

  game.commandPoints = rangefinder.cost - 1;
  const denied = game.playerRangefinderShot(0, 0, rangefinder);
  assert.equal(denied.reason, 'insufficient-points');
  assert.equal(game.commandPoints, rangefinder.cost - 1, 'denied rangefinder shot spends no points');
  assert.equal(game.enemyBoard.shots.size, 0);

  game.commandPoints = rangefinder.cost;
  const measuredMiss = game.playerRangefinderShot(0, 0, rangefinder);
  assert.equal(measuredMiss.valid, true);
  assert.equal(measuredMiss.type, 'miss');
  assert.equal(measuredMiss.distance, 8, 'rangefinder reports Manhattan grid distance to the nearest active ship cell');
  assert.equal(measuredMiss.pointsGained, 0);
  assert.equal(game.commandPoints, 0, 'rangefinder misses never refund command points');
  assert.equal('nearestCell' in measuredMiss, false, 'rangefinder must not expose a hidden coordinate');
  assert.equal('direction' in measuredMiss, false, 'rangefinder must not expose a hidden direction');

  game.turn = 'player';
  game.commandPoints = rangefinder.cost;
  const duplicate = game.playerRangefinderShot(0, 0, rangefinder);
  assert.equal(duplicate.reason, 'already-shot');
  assert.equal(game.commandPoints, rangefinder.cost, 'duplicate rangefinder target spends no points');

  const measuredHit = game.playerRangefinderShot(4, 4, rangefinder);
  assert.equal(measuredHit.type, 'hit');
  assert.equal(measuredHit.distance, 0, 'a hit on a still-active ship reports distance zero');
  assert.equal(game.stats.playerShots, 2);
  assert.equal(game.stats.playerHits, 1);

  game.turn = 'player';
  game.commandPoints = barrage.cost - 1;
  const barrageDenied = game.playerRandomBarrage(barrage, () => 0);
  assert.equal(barrageDenied.reason, 'insufficient-points');
  assert.equal(game.commandPoints, barrage.cost - 1);

  game.commandPoints = barrage.cost;
  const shotsBefore = game.stats.playerShots;
  const hitsBefore = game.stats.playerHits;
  const randomSalvo = game.playerRandomBarrage(barrage, () => 0);
  assert.equal(randomSalvo.valid, true);
  assert.equal(randomSalvo.results.length, 6);
  assert.equal(new Set(randomSalvo.results.map((result) => `${result.row},${result.col}`)).size, 6, 'random barrage targets must be distinct');
  assert.equal(randomSalvo.results.every((result) => result.valid), true);
  assert.equal(randomSalvo.pointsGained, 0);
  assert.equal(game.commandPoints, 0);
  assert.equal(game.stats.playerShots, shotsBefore + 6);
  assert.equal(game.stats.playerHits, hitsBefore + randomSalvo.results.filter((result) => result.type !== 'miss').length);
  assert.equal(game.turn, 'enemy');
}

function testGravesRelocationAndNuclearStrike() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.setMode('commander');
  assert.equal(game.setCommander('captain-ronan-graves'), true);
  const relocation = game.activeCommander.abilities.find((ability) => ability.pattern === 'relocation');
  const nuclear = game.activeCommander.abilities.find((ability) => ability.pattern === 'nuclear');
  const fortress = CONFIG.ships.find((ship) => ship.id === 'floating-fortress');
  const patrol = CONFIG.ships.find((ship) => ship.id === 'patrol-interceptor');

  game.playerBoard.clear();
  game.playerBoard.placeShip(fortress, 0, 0, 'horizontal');
  game.playerBoard.placeShip(patrol, 8, 0, 'horizontal');
  game.enemyBoard.clear();
  game.enemyBoard.placeShip(patrol, 0, 0, 'horizontal');
  game.enemyBoard.placeShip(fortress, 6, 0, 'horizontal');
  game.phase = 'battle';
  game.turn = 'player';

  game.commandPoints = relocation.cost;
  const blockedMove = game.playerRelocateShip('floating-fortress', 8, 0, relocation);
  assert.equal(blockedMove.reason, 'invalid-position');
  assert.equal(game.commandPoints, relocation.cost, 'blocked relocation spends no points');
  assert.equal(game.turn, 'player');

  game.playerBoard.receiveAttack(4, 0);
  const firedUponMove = game.playerRelocateShip('floating-fortress', 4, 0, relocation);
  assert.equal(firedUponMove.reason, 'previously-fired-upon');
  assert.equal(game.commandPoints, relocation.cost);

  const ownPatrol = game.playerBoard.ships.find((ship) => ship.id === 'patrol-interceptor');
  const patrolCell = ownPatrol.getCells()[0];
  game.playerBoard.receiveAttack(patrolCell.row, patrolCell.col);
  const damagedMove = game.playerRelocateShip('patrol-interceptor', 8, 4, relocation);
  assert.equal(damagedMove.reason, 'ship-damaged');
  assert.equal(game.commandPoints, relocation.cost);

  const moved = game.playerRelocateShip('floating-fortress', 3, 1, relocation);
  assert.equal(moved.valid, true);
  assert.equal(moved.ship.row, 3);
  assert.equal(moved.ship.col, 1);
  assert.equal(moved.ship.getCells().length, 14);
  assert.equal(game.playerBoard.getShipAt(0, 0), null, 'old fortress cells must be released');
  assert.equal(game.playerBoard.getShipAt(3, 1).id, 'floating-fortress');
  assert.equal(game.commandPoints, 0);
  assert.equal(game.turn, 'enemy');
  assert.equal(moved.pointsGained, 0);

  game.turn = 'player';
  game.commandPoints = nuclear.cost - 1;
  const nuclearDenied = game.playerNuclearAttack(0, 0, nuclear);
  assert.equal(nuclearDenied.reason, 'insufficient-points');
  assert.equal(game.commandPoints, nuclear.cost - 1);

  game.commandPoints = nuclear.cost;
  const nuclearMiss = game.playerNuclearAttack(9, 9, nuclear);
  assert.equal(nuclearMiss.type, 'miss');
  assert.equal(nuclearMiss.pointsGained, 0);
  assert.equal(game.commandPoints, 0);
  assert.equal(game.stats.playerShots, 1);
  assert.equal(game.stats.playerHits, 0);

  game.turn = 'player';
  game.commandPoints = nuclear.cost;
  const duplicateNuke = game.playerNuclearAttack(9, 9, nuclear);
  assert.equal(duplicateNuke.reason, 'already-shot');
  assert.equal(game.commandPoints, nuclear.cost, 'duplicate nuclear target spends no points');

  const enemyPatrol = game.enemyBoard.ships.find((ship) => ship.id === 'patrol-interceptor');
  const nuclearHit = game.playerNuclearAttack(0, 0, nuclear);
  assert.equal(nuclearHit.nuclearHit, true);
  assert.equal(enemyPatrol.isSunk, true);
  assert.equal(nuclearHit.affected.length, 2);
  assert.equal(enemyPatrol.getCells().every((cell) => game.enemyBoard.shots.get(game.enemyBoard.key(cell.row, cell.col)).type === 'sunk'), true);
  assert.equal(game.stats.playerShots, 2, 'nuclear strike counts as one shot, not one per destroyed cell');
  assert.equal(game.stats.playerHits, 1);
  assert.equal(game.turn, 'enemy');

  game.turn = 'player';
  game.commandPoints = nuclear.cost;
  const fortressNuke = game.playerNuclearAttack(6, 0, nuclear);
  assert.equal(fortressNuke.affected.length, 14);
  assert.equal(game.enemyBoard.allShipsSunk, true);
  assert.equal(game.phase, 'gameover');
  assert.equal(game.winner, 'player');
}

function testKwonChemicalBombAndMineLayer() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.setMode('commander');
  assert.equal(game.setCommander('captain-dae-hyun-kwon'), true);
  const chemical = game.activeCommander.abilities.find((ability) => ability.pattern === 'chemical');
  const mineLayer = game.activeCommander.abilities.find((ability) => ability.pattern === 'mine');
  game.randomizeBoard(game.playerBoard, Math.random, game.playerFleetDefinitions);
  game.enemyBoard.clear();
  const battleship = CONFIG.ships.find((ship) => ship.id === 'battleship');
  game.enemyBoard.placeShip(battleship, 4, 3, 'horizontal');
  game.phase = 'battle';
  game.turn = 'player';

  game.commandPoints = chemical.cost - 1;
  const denied = game.playerChemicalAttack(4, 3, chemical);
  assert.equal(denied.reason, 'insufficient-points');
  assert.equal(game.commandPoints, chemical.cost - 1, 'invalid chemical target must spend no points');
  assert.equal(game.turn, 'player');

  game.commandPoints = chemical.cost;
  const chemicalMiss = game.playerChemicalAttack(0, 0, chemical);
  assert.equal(chemicalMiss.valid, true);
  assert.equal(chemicalMiss.type, 'miss');
  assert.equal(chemicalMiss.revealed, false);
  assert.equal(chemicalMiss.pointsGained, 0, 'ability miss grants no points');
  assert.equal(game.commandPoints, 0);
  assert.equal(game.enemyRevealedShipIds.size, 0);

  game.turn = 'player';
  game.commandPoints = chemical.cost;
  const chemicalHit = game.playerChemicalAttack(4, 3, chemical);
  assert.equal(chemicalHit.type, 'hit');
  assert.equal(chemicalHit.revealed, true);
  assert.equal(game.enemyRevealedShipIds.has('battleship'), true);
  assert.equal(chemicalHit.ship.hits.size, 1, 'reveal does not destroy additional ship cells');
  assert.equal(game.commandPoints, 0);
  assert.equal(game.turn, 'enemy');

  game.turn = 'player';
  game.commandPoints = chemical.cost;
  const duplicate = game.playerChemicalAttack(4, 3, chemical);
  assert.equal(duplicate.reason, 'already-shot');
  assert.equal(game.commandPoints, chemical.cost, 'duplicate chemical target spends no points');

  const mineCell = game.playerBoard.unshotCells[0];
  game.commandPoints = mineLayer.cost;
  const deployed = game.playerPlaceMine(mineCell.row, mineCell.col, mineLayer);
  assert.equal(deployed.valid, true);
  assert.equal(game.commandPoints, 0);
  assert.equal(game.turn, 'enemy');
  assert.equal(game.playerMines.get(game.playerBoard.key(mineCell.row, mineCell.col)).active, true);

  const triggered = game.enemyAttack(mineCell.row, mineCell.col);
  assert.equal(triggered.mineTriggered, true);
  assert.equal(triggered.freeShotsGranted, 3);
  assert.equal(game.freeShotsRemaining, 3);
  assert.equal(game.turn, 'player');
  assert.equal(game.playerMines.get(game.playerBoard.key(mineCell.row, mineCell.col)).triggered, true);

  game.commandPoints = chemical.cost;
  const blockedDuringVolley = game.playerChemicalAttack(4, 4, chemical);
  assert.equal(blockedDuringVolley.reason, 'free-shots-active');
  assert.equal(game.commandPoints, chemical.cost);

  const waterTargets = game.enemyBoard.unshotCells.filter((cell) => !game.enemyBoard.getShipAt(cell.row, cell.col)).slice(0, 3);
  for (let index = 0; index < waterTargets.length; index += 1) {
    const shot = game.playerAttack(waterTargets[index].row, waterTargets[index].col);
    assert.equal(shot.valid, true);
    assert.equal(shot.freeShotsRemaining, 2 - index);
    assert.equal(game.turn, index < 2 ? 'player' : 'enemy');
  }
  assert.equal(game.commandPoints, chemical.cost + 3, 'normal free-shot misses still grant regular miss points');
}

function testVossScannerAndRepair() {
  const game = new BattleshipGame(CONFIG);
  game.reset();
  game.setMode('commander');
  assert.equal(game.setCommander('captain-elias-voss'), true);
  const scanner = game.activeCommander.abilities.find((ability) => ability.pattern === 'scan');
  const repair = game.activeCommander.abilities.find((ability) => ability.pattern === 'repair');

  game.randomizeBoard(game.playerBoard, Math.random, game.playerFleetDefinitions);
  game.enemyBoard.clear();
  const carrier = CONFIG.ships.find((ship) => ship.id === 'carrier');
  game.enemyBoard.placeShip(carrier, 5, 3, 'horizontal');
  game.phase = 'battle';
  game.turn = 'player';
  game.commandPoints = scanner.cost;

  const clearSector = Array.from({ length: 9 }, (_, index) => ({ row: Math.floor(index / 3), col: index % 3 }));
  const clearResult = game.playerScan(clearSector, scanner);
  assert.equal(clearResult.valid, true);
  assert.equal(clearResult.found, false);
  assert.equal(clearResult.marked.length, 9, 'an empty scan marks the complete 3x3 sector as water');
  assert.equal(game.commandPoints, 0);
  assert.equal(game.stats.playerShots, 0, 'scanner markers are information, not shots');

  game.turn = 'player';
  game.commandPoints = scanner.cost;
  const foundSector = Array.from({ length: 9 }, (_, index) => ({ row: 4 + Math.floor(index / 3), col: 2 + (index % 3) }));
  const shotsBeforeFound = game.enemyBoard.shots.size;
  const foundResult = game.playerScan(foundSector, scanner);
  assert.equal(foundResult.found, true);
  assert.equal(foundResult.marked.length, 0, 'a positive scan must not reveal individual cells');
  assert.equal(game.enemyBoard.shots.size, shotsBeforeFound);

  const ownShip = game.playerBoard.ships[0];
  const damagedCell = ownShip.getCells()[0];
  game.playerBoard.receiveAttack(damagedCell.row, damagedCell.col);
  assert.equal(ownShip.hits.size, 1);
  game.turn = 'player';
  game.commandPoints = repair.cost;
  game.stats.enemyHits = 1;
  const repairResult = game.playerRepair(damagedCell.row, damagedCell.col, repair);
  assert.equal(repairResult.valid, true);
  assert.equal(ownShip.hits.size, 0);
  assert.equal(game.playerBoard.shots.has(game.playerBoard.key(damagedCell.row, damagedCell.col)), false);
  assert.equal(game.commandPoints, 0);
  assert.equal(game.turn, 'enemy');
}

testPlacementRules();
testAttacksAndSinking();
testRandomFleetAndAI();
testGameFlowAndVictory();
testDefeatAndTurnProtection();
testCommanderPointsAndAbilities();
testPortraitCommanderPlaceholders();
testVossScannerAndRepair();
testKwonChemicalBombAndMineLayer();
testGravesRelocationAndNuclearStrike();
testDhillonRangefinderAndBarrage();
testSerranoTorpedoAndSubmerge();
testFalkSacrificeAndProcurement();
testOkaforHydrogenBombAndLastRevenge();
testValeFlameMissileAndScanShot();
testCrossJetAndSignalJammer();
testExperimentalFootprints();
console.log('All game logic tests passed.');
