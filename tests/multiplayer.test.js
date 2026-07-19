'use strict';

const assert = require('node:assert/strict');
const { MultiplayerMatch } = require('../server/multiplayer-game.js');
const { LobbyStore } = require('../server/lobby-store.js');

const standardFleet = [
  { id: 'carrier', row: 0, col: 0, orientation: 'horizontal' },
  { id: 'battleship', row: 1, col: 0, orientation: 'horizontal' },
  { id: 'cruiser', row: 2, col: 0, orientation: 'horizontal' },
  { id: 'submarine', row: 3, col: 0, orientation: 'horizontal' },
  { id: 'destroyer', row: 4, col: 0, orientation: 'horizontal' },
];

function startStandardMatch() {
  const match = new MultiplayerMatch(() => 0);
  assert.equal(match.command(0, 'select-commander', { commanderId: 'standard' }).ok, true);
  assert.equal(match.command(1, 'select-commander', { commanderId: 'standard' }).ok, true);
  assert.equal(match.command(0, 'ready', { placements: standardFleet }).ok, true);
  assert.equal(match.command(1, 'ready', { placements: standardFleet }).ok, true);
  assert.equal(match.phase, 'battle');
  return match;
}

function testPrivateSnapshotsHideShips() {
  const match = startStandardMatch();
  const snapshot = match.snapshot(0);
  assert.equal(snapshot.you.board.ships.length, 5);
  assert.equal(snapshot.opponent.board.ships.length, 0);

  const hit = match.command(0, 'fire', { row: 0, col: 0 });
  assert.equal(hit.ok, true);
  const afterHit = match.snapshot(0);
  assert.equal(afterHit.opponent.board.ships.length, 0);
  assert.equal(afterHit.opponent.board.shots[0].type, 'hit');
  assert.equal('shipId' in afterHit.opponent.board.shots[0], false);
  const joiningPlayerView = match.snapshot(1);
  assert.equal(joiningPlayerView.lastEvent.sourceShipId, 'carrier');
  assert.equal(joiningPlayerView.opponent.board.ships.length, 0);
}

function testMissAwardsPointAndChangesTurn() {
  const match = startStandardMatch();
  assert.equal(match.command(0, 'fire', { row: 9, col: 9 }).ok, true);
  assert.equal(match.players[0].commandPoints, 1);
  assert.equal(match.turnSeat, 1);
  assert.equal(match.command(0, 'fire', { row: 9, col: 8 }).reason, 'not-your-turn');
}

function testAbilityMissDoesNotAwardPoint() {
  const match = startStandardMatch();
  match.players[0].commandPoints = 6;
  const result = match.command(0, 'ability', {
    abilityId: 'square-barrage',
    row: 8,
    col: 8,
  });
  assert.equal(result.ok, true);
  assert.equal(match.players[0].commandPoints, 0);
  assert.equal(match.players[0].shots, 4);
  assert.equal(match.turnSeat, 1);
}

function testLobbyCodesAndAuthentication() {
  const store = new LobbyStore();
  const created = store.create();
  assert.match(created.lobby.code, /^[A-Z2-9]{6}$/);
  assert.equal(store.authenticate(created.lobby.code.toLowerCase(), created.token).seat, 0);
  const joined = store.join(created.lobby.code);
  assert.equal(joined.ok, true);
  assert.equal(joined.seat, 1);
  assert.equal(store.join(created.lobby.code).reason, 'lobby-full');
  assert.equal(store.authenticate(created.lobby.code, 'wrong-token'), null);
}

function testDefensiveAbilityCoordinatesStayPrivate() {
  const kwonFleet = [
    { id: 'battleship', row: 0, col: 0, orientation: 'horizontal' },
    { id: 'heavy-missile-cruiser', row: 1, col: 0, orientation: 'horizontal' },
    { id: 'destroyer', row: 2, col: 0, orientation: 'horizontal' },
    { id: 'patrol-interceptor', row: 3, col: 0, orientation: 'horizontal' },
  ];
  const match = new MultiplayerMatch(() => 0);
  match.command(0, 'select-commander', { commanderId: 'captain-dae-hyun-kwon' });
  match.command(1, 'select-commander', { commanderId: 'captain-dae-hyun-kwon' });
  match.command(0, 'ready', { placements: kwonFleet });
  match.command(1, 'ready', { placements: kwonFleet });
  match.players[0].commandPoints = 7;
  assert.equal(match.command(0, 'ability', { abilityId: 'mine-layer', row: 9, col: 9 }).ok, true);
  assert.equal(match.snapshot(0).lastEvent.results[0].row, 9);
  assert.deepEqual(match.snapshot(1).lastEvent.results, []);
}

function startValeMatch() {
  const valeFleet = [
    { id: 'square-catamaran', row: 0, col: 0, orientation: 'horizontal' },
    { id: 'heavy-missile-cruiser', row: 2, col: 0, orientation: 'horizontal' },
    { id: 'fast-destroyer', row: 3, col: 0, orientation: 'horizontal' },
  ];
  const match = new MultiplayerMatch(() => 0);
  assert.equal(match.command(0, 'select-commander', { commanderId: 'captain-lucian-vale' }).ok, true);
  assert.equal(match.command(1, 'select-commander', { commanderId: 'captain-lucian-vale' }).ok, true);
  assert.equal(match.command(0, 'ready', { placements: valeFleet }).ok, true);
  assert.equal(match.command(1, 'ready', { placements: valeFleet }).ok, true);
  return match;
}

function testValeAbilitiesAndScanPrivacy() {
  const scanMatch = startValeMatch();
  scanMatch.players[0].commandPoints = 6;
  const scanned = scanMatch.command(0, 'ability', {
    abilityId: 'scan-shot',
    row: 2,
    col: 4,
  });
  assert.equal(scanned.ok, true);
  assert.equal(scanMatch.players[1].board.getShipAt(2, 3).hits.size, 0, 'adjacent contact is not damaged');
  assert.equal(scanMatch.players[1].board.shots.has('2,3'), false, 'contact remains a legal fire target');
  const attackerView = scanMatch.snapshot(0);
  assert.deepEqual(attackerView.you.contactMarkers, [{ type: 'contact', row: 2, col: 3 }]);
  assert.equal('shipId' in attackerView.you.contactMarkers[0], false, 'contact marker reveals no ship identity');
  assert.equal(attackerView.lastEvent.contactsMarked, 1);
  assert.equal(attackerView.lastEvent.waterMarked, 7);
  assert.equal(attackerView.you.commandPoints, 0);
  assert.equal(scanMatch.turnSeat, 1);
  const defenderView = scanMatch.snapshot(1);
  assert.deepEqual(defenderView.you.contactMarkers, []);
  assert.equal('contactMarkers' in defenderView.opponent, false);

  const flameMatch = startValeMatch();
  flameMatch.players[0].commandPoints = 6;
  const flame = flameMatch.command(0, 'ability', {
    abilityId: 'flame-missile',
    row: 9,
    col: 9,
    orientation: 'horizontal',
  });
  assert.equal(flame.ok, true);
  assert.deepEqual(flameMatch.snapshot(0).lastEvent.results.map(({ row, col }) => [row, col]), [[7, 7], [8, 8], [9, 9]]);
  assert.equal(flameMatch.players[0].shots, 3);
  assert.equal(flameMatch.players[0].commandPoints, 0, 'ability misses grant no points');
  assert.equal(flameMatch.turnSeat, 1);
}

function startCrossMatch() {
  const crossFleet = [
    { id: 'carrier', row: 0, col: 0, orientation: 'horizontal' },
    { id: 'fork-ship', row: 2, col: 0, orientation: 'horizontal' },
    { id: 'patrol-interceptor', row: 4, col: 0, orientation: 'horizontal' },
  ];
  const match = new MultiplayerMatch(() => 0);
  assert.equal(match.command(0, 'select-commander', { commanderId: 'captain-imani-cross' }).ok, true);
  assert.equal(match.command(1, 'select-commander', { commanderId: 'captain-imani-cross' }).ok, true);
  assert.equal(match.command(0, 'ready', { placements: crossFleet }).ok, true);
  assert.equal(match.command(1, 'ready', { placements: crossFleet }).ok, true);
  return match;
}

function testCrossJetPrivacyMovementAndVictory() {
  const match = startCrossMatch();
  match.players[0].commandPoints = 8;
  const launch = match.command(0, 'ability', { abilityId: 'jet-launch' });
  assert.equal(launch.ok, true);
  assert.equal(match.turnSeat, 1);
  const ownerView = match.snapshot(0);
  assert.equal(ownerView.you.jet.active, true);
  assert.equal(Number.isInteger(ownerView.you.jet.row), true);
  assert.equal(ownerView.you.board.ships.some((ship) => ship.row === ownerView.you.jet.row && ship.col === ownerView.you.jet.col), false);
  assert.equal(ownerView.lastEvent.sourceShipId, 'carrier');
  assert.equal('row' in ownerView.lastEvent.results[0], false, 'launch event never broadcasts the hidden position');
  const enemyView = match.snapshot(1);
  assert.deepEqual(enemyView.opponent.jet, { launched: true, active: true, destroyed: false });
  assert.equal('row' in enemyView.opponent.jet, false);
  assert.equal(enemyView.opponent.afloatCount, 4, 'jet counts as one required active target');

  const oldJet = { row: match.players[0].jet.row, col: match.players[0].jet.col };
  const shotCell = match.players[0].board.unshotCells.find((cell) => !match.players[0].board.getShipAt(cell.row, cell.col)
    && (cell.row !== oldJet.row || cell.col !== oldJet.col));
  const shot = match.command(1, 'fire', shotCell);
  assert.equal(shot.ok, true);
  assert.equal(shot.event.results[0].jetMoved, true);
  assert.notDeepEqual({ row: match.players[0].jet.row, col: match.players[0].jet.col }, oldJet);
  assert.equal('row' in match.snapshot(1).opponent.jet, false, 'movement stays private from the attacker');

  for (const ship of match.players[0].board.ships) {
    for (const cell of ship.getCells()) {
      if (match.players[0].board.shots.has(match.players[0].board.key(cell.row, cell.col))) continue;
      assert.equal(match.attackCell(1, 0, cell.row, cell.col).ok, true);
    }
  }
  assert.equal(match.players[0].board.allShipsSunk, true);
  assert.equal(match.phase, 'battle', 'multiplayer does not end while the jet remains active');
  const jetHit = match.attackCell(1, 0, match.players[0].jet.row, match.players[0].jet.col);
  assert.equal(jetHit.type, 'jet-hit');
  assert.equal(match.phase, 'gameover');
  assert.equal(match.winnerSeat, 1);
}

function testCrossSignalJammer() {
  const match = startCrossMatch();
  match.players[0].commandPoints = 3;
  assert.equal(match.command(0, 'ability', { abilityId: 'signal-jammer' }).ok, true);
  assert.equal(match.players[1].abilityJammedTurns, 1);
  match.players[1].commandPoints = 8;
  const rejected = match.command(1, 'ability', { abilityId: 'jet-launch' });
  assert.equal(rejected.reason, 'abilities-jammed');
  assert.equal(match.players[1].commandPoints, 8, 'jammed ability spends no points');
  assert.equal(match.turnSeat, 1, 'rejected ability keeps the turn');
  assert.equal(match.command(1, 'fire', { row: 9, col: 9 }).ok, true);
  assert.equal(match.players[1].abilityJammedTurns, 0, 'a valid normal shot consumes the one-turn jam');
}

testPrivateSnapshotsHideShips();
testMissAwardsPointAndChangesTurn();
testAbilityMissDoesNotAwardPoint();
testLobbyCodesAndAuthentication();
testDefensiveAbilityCoordinatesStayPrivate();
testValeAbilitiesAndScanPrivacy();
testCrossJetPrivacyMovementAndVictory();
testCrossSignalJammer();

console.log('Multiplayer tests passed.');
