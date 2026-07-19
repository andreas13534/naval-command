'use strict';

const crypto = require('node:crypto');
const { MultiplayerMatch } = require('./multiplayer-game.js');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class LobbyStore {
  constructor(options = {}) {
    this.lobbies = new Map();
    this.randomBytes = options.randomBytes || crypto.randomBytes;
    this.now = options.now || Date.now;
    this.maxIdleMs = options.maxIdleMs || 6 * 60 * 60 * 1000;
  }

  makeCode() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const bytes = this.randomBytes(6);
      const code = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
      if (!this.lobbies.has(code)) return code;
    }
    throw new Error('Lobby-Code konnte nicht erzeugt werden.');
  }

  create() {
    const code = this.makeCode();
    const lobby = {
      code,
      match: new MultiplayerMatch(),
      players: [this.createSession(), null],
      streams: [new Set(), new Set()],
      createdAt: this.now(),
      touchedAt: this.now(),
    };
    this.lobbies.set(code, lobby);
    return { lobby, seat: 0, token: lobby.players[0].token };
  }

  createSession() {
    return { token: crypto.randomBytes(24).toString('base64url') };
  }

  normalizeCode(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
  }

  join(code) {
    const lobby = this.lobbies.get(this.normalizeCode(code));
    if (!lobby) return { ok: false, status: 404, reason: 'lobby-not-found' };
    if (lobby.players[1]) return { ok: false, status: 409, reason: 'lobby-full' };
    lobby.players[1] = this.createSession();
    lobby.match.setConnected(1, true);
    lobby.touchedAt = this.now();
    this.broadcast(lobby);
    return { ok: true, lobby, seat: 1, token: lobby.players[1].token };
  }

  authenticate(code, token) {
    const lobby = this.lobbies.get(this.normalizeCode(code));
    if (!lobby || typeof token !== 'string') return null;
    const seat = lobby.players.findIndex((session) => session?.token === token);
    if (seat < 0) return null;
    lobby.touchedAt = this.now();
    return { lobby, seat };
  }

  subscribe(lobby, seat, response) {
    lobby.streams[seat].add(response);
    lobby.match.setConnected(seat, true);
    this.sendState(lobby, seat, response);
    this.broadcast(lobby);
  }

  unsubscribe(lobby, seat, response) {
    lobby.streams[seat].delete(response);
    if (lobby.streams[seat].size === 0) lobby.match.setConnected(seat, false);
    this.broadcast(lobby);
  }

  command(lobby, seat, type, payload) {
    const result = lobby.match.command(seat, type, payload);
    lobby.touchedAt = this.now();
    if (result.ok) this.broadcast(lobby);
    return result;
  }

  sendState(lobby, seat, response) {
    if (response.writableEnded) return;
    const payload = JSON.stringify({
      type: 'state',
      code: lobby.code,
      opponentJoined: Boolean(lobby.players[1]),
      state: lobby.match.snapshot(seat),
    });
    response.write(`id: ${lobby.match.eventId}\nevent: state\ndata: ${payload}\n\n`);
  }

  broadcast(lobby) {
    lobby.streams.forEach((responses, seat) => {
      responses.forEach((response) => {
        try {
          this.sendState(lobby, seat, response);
        } catch (_error) {
          responses.delete(response);
        }
      });
    });
  }

  keepAlive() {
    this.lobbies.forEach((lobby) => {
      lobby.streams.forEach((responses) => responses.forEach((response) => {
        if (!response.writableEnded) response.write(': keep-alive\n\n');
      }));
    });
  }

  cleanup() {
    const cutoff = this.now() - this.maxIdleMs;
    this.lobbies.forEach((lobby, code) => {
      if (lobby.touchedAt >= cutoff) return;
      lobby.streams.forEach((responses) => responses.forEach((response) => response.end()));
      this.lobbies.delete(code);
    });
  }
}

module.exports = { LobbyStore };
