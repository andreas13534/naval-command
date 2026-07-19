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

testPrivateSnapshotsHideShips();
testMissAwardsPointAndChangesTurn();
testAbilityMissDoesNotAwardPoint();
testLobbyCodesAndAuthentication();
testDefensiveAbilityCoordinatesStayPrivate();

console.log('Multiplayer tests passed.');
