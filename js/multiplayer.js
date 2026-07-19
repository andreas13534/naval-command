(function (root) {
  'use strict';

  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PEER_PREFIX = 'naval-command-';
  const CONNECT_TIMEOUT_MS = 12000;

  const codedError = (code) => {
    const error = new Error(code);
    error.code = code;
    return error;
  };

  class MultiplayerClient {
    constructor() {
      this.code = null;
      this.token = null;
      this.seat = null;
      this.events = null;
      this.onState = null;
      this.onConnection = null;
      this.peer = null;
      this.connection = null;
      this.match = null;
      this.pendingCommands = new Map();
      this.commandSequence = 0;
      this.welcomeResolve = null;
      this.welcomeReject = null;
      this.closing = false;
      const parameters = new URLSearchParams(root.location.search);
      this.peerMode = root.location.hostname.endsWith('.github.io') || parameters.has('p2p');
    }

    get active() {
      return Boolean(this.code && this.token);
    }

    normalizeCode(code) {
      return String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
    }

    makeCode() {
      const bytes = new Uint8Array(6);
      if (root.crypto?.getRandomValues) root.crypto.getRandomValues(bytes);
      else bytes.forEach((_value, index) => { bytes[index] = Math.floor(Math.random() * 256); });
      return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
    }

    peerId(code) {
      return `${PEER_PREFIX}${code.toLowerCase()}`;
    }

    async request(url, options = {}) {
      const response = await root.fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw codedError(data.error || 'network-error');
      return data;
    }

    openPeer(id) {
      if (typeof root.Peer !== 'function') return Promise.reject(codedError('peer-network-unavailable'));
      return new Promise((resolve, reject) => {
        const peer = id ? new root.Peer(id, { debug: 1 }) : new root.Peer({ debug: 1 });
        const timer = root.setTimeout(() => {
          peer.destroy();
          reject(codedError('peer-network-unavailable'));
        }, CONNECT_TIMEOUT_MS);
        peer.once('open', () => {
          root.clearTimeout(timer);
          resolve(peer);
        });
        peer.once('error', (error) => {
          root.clearTimeout(timer);
          peer.destroy();
          reject(codedError(error?.type === 'unavailable-id' ? 'unavailable-id' : 'peer-network-unavailable'));
        });
      });
    }

    async createLobby() {
      this.close();
      if (!this.peerMode) {
        const session = await this.request('/api/lobbies', { method: 'POST', body: '{}' });
        this.connectServer(session);
        return session;
      }
      if (typeof root.NavalGame.MultiplayerMatch !== 'function') throw codedError('peer-network-unavailable');
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = this.makeCode();
        try {
          this.peer = await this.openPeer(this.peerId(code));
          this.code = code;
          this.token = 'p2p-host';
          this.seat = 0;
          this.match = new root.NavalGame.MultiplayerMatch();
          this.closing = false;
          this.peer.on('connection', (connection) => this.acceptConnection(connection));
          this.peer.on('error', () => {
            if (!this.closing) this.onConnection?.('reconnecting');
          });
          return { code, token: this.token, seat: 0 };
        } catch (error) {
          if (error.code !== 'unavailable-id') throw error;
        }
      }
      throw codedError('lobby-code-unavailable');
    }

    async joinLobby(code) {
      this.close();
      const normalized = this.normalizeCode(code);
      if (normalized.length !== 6) throw codedError('lobby-not-found');
      if (!this.peerMode) {
        const session = await this.request(`/api/lobbies/${encodeURIComponent(normalized)}/join`, {
          method: 'POST',
          body: '{}',
        });
        this.connectServer(session);
        return session;
      }

      this.peer = await this.openPeer();
      this.code = normalized;
      this.token = 'p2p-guest';
      this.seat = 1;
      this.closing = false;
      const connection = this.peer.connect(this.peerId(normalized), { reliable: true, serialization: 'json' });
      this.connection = connection;
      this.bindGuestConnection(connection);

      await new Promise((resolve, reject) => {
        const timer = root.setTimeout(() => reject(codedError('lobby-not-found')), CONNECT_TIMEOUT_MS);
        this.welcomeResolve = () => {
          root.clearTimeout(timer);
          resolve();
        };
        this.welcomeReject = (error) => {
          root.clearTimeout(timer);
          reject(error);
        };
        connection.on('open', () => connection.send({ kind: 'hello' }));
        connection.on('error', () => this.welcomeReject?.(codedError('lobby-not-found')));
        this.peer.on('error', (error) => {
          if (error?.type === 'peer-unavailable') this.welcomeReject?.(codedError('lobby-not-found'));
          else if (!this.closing) this.onConnection?.('reconnecting');
        });
      }).catch((error) => {
        this.close();
        throw error;
      });

      return { code: normalized, token: this.token, seat: 1 };
    }

    connectServer(session) {
      this.code = session.code;
      this.token = session.token;
      this.seat = session.seat;
      this.events = new root.EventSource(`/api/lobbies/${encodeURIComponent(this.code)}/events?token=${encodeURIComponent(this.token)}`);
      this.events.addEventListener('state', (event) => {
        const payload = JSON.parse(event.data);
        this.onConnection?.('connected');
        this.onState?.(payload);
      });
      this.events.addEventListener('open', () => this.onConnection?.('connected'));
      this.events.addEventListener('error', () => this.onConnection?.('reconnecting'));
    }

    acceptConnection(connection) {
      const occupied = Boolean(this.connection);
      if (occupied) {
        connection.on('open', () => {
          connection.send({ kind: 'error', code: 'lobby-full' });
          root.setTimeout(() => connection.close(), 80);
        });
        return;
      }
      this.connection = connection;
      connection.on('open', () => this.onConnection?.('connected'));
      connection.on('data', (message) => this.handleHostMessage(connection, message));
      connection.on('close', () => {
        if (this.connection !== connection) return;
        this.connection = null;
        this.match?.setConnected(1, false);
        if (!this.closing) {
          this.onConnection?.('reconnecting');
          this.broadcastPeerState();
        }
      });
      connection.on('error', () => {
        if (!this.closing) this.onConnection?.('reconnecting');
      });
    }

    handleHostMessage(connection, message) {
      if (!message || typeof message !== 'object') return;
      if (message.kind === 'hello') {
        this.match.setConnected(1, true);
        connection.send({ kind: 'welcome', code: this.code });
        this.broadcastPeerState();
        return;
      }
      if (message.kind !== 'command' || !Number.isInteger(message.requestId)) return;
      const result = this.match.command(1, message.commandType, message.payload || {});
      connection.send({ kind: 'command-result', requestId: message.requestId, result });
      if (result.ok) this.broadcastPeerState();
    }

    bindGuestConnection(connection) {
      connection.on('data', (message) => this.handleGuestMessage(message));
      connection.on('close', () => {
        if (!this.closing) this.onConnection?.('reconnecting');
      });
    }

    handleGuestMessage(message) {
      if (!message || typeof message !== 'object') return;
      if (message.kind === 'welcome') {
        const resolve = this.welcomeResolve;
        this.welcomeResolve = null;
        this.welcomeReject = null;
        this.onConnection?.('connected');
        resolve?.();
        return;
      }
      if (message.kind === 'error') {
        this.welcomeReject?.(codedError(message.code || 'network-error'));
        return;
      }
      if (message.kind === 'state') {
        this.onConnection?.('connected');
        this.onState?.(message.payload);
        return;
      }
      if (message.kind === 'command-result') {
        const pending = this.pendingCommands.get(message.requestId);
        if (!pending) return;
        this.pendingCommands.delete(message.requestId);
        if (message.result?.ok) pending.resolve(message.result);
        else pending.reject(codedError(message.result?.reason || 'command-rejected'));
      }
    }

    statePayload(seat, opponentJoined) {
      return {
        type: 'state',
        code: this.code,
        opponentJoined,
        state: this.match.snapshot(seat),
      };
    }

    broadcastPeerState() {
      if (!this.match) return;
      const joined = Boolean(this.connection?.open);
      this.onState?.(this.statePayload(0, joined));
      if (joined) this.connection.send({ kind: 'state', payload: this.statePayload(1, true) });
    }

    async command(type, payload = {}) {
      if (!this.active) throw codedError('no-lobby');
      if (!this.peerMode) {
        return this.request(`/api/lobbies/${encodeURIComponent(this.code)}/command`, {
          method: 'POST',
          body: JSON.stringify({ token: this.token, type, payload }),
        });
      }
      if (this.seat === 0) {
        const result = this.match.command(0, type, payload);
        if (!result.ok) throw codedError(result.reason || 'command-rejected');
        this.broadcastPeerState();
        return result;
      }
      if (!this.connection?.open) throw codedError('network-error');
      const requestId = ++this.commandSequence;
      return new Promise((resolve, reject) => {
        const timer = root.setTimeout(() => {
          this.pendingCommands.delete(requestId);
          reject(codedError('network-error'));
        }, CONNECT_TIMEOUT_MS);
        this.pendingCommands.set(requestId, {
          resolve: (result) => { root.clearTimeout(timer); resolve(result); },
          reject: (error) => { root.clearTimeout(timer); reject(error); },
        });
        this.connection.send({ kind: 'command', requestId, commandType: type, payload });
      });
    }

    close() {
      this.closing = true;
      this.events?.close();
      this.connection?.close();
      this.peer?.destroy();
      this.pendingCommands.forEach(({ reject }) => reject(codedError('network-error')));
      this.pendingCommands.clear();
      this.events = null;
      this.connection = null;
      this.peer = null;
      this.match = null;
      this.code = null;
      this.token = null;
      this.seat = null;
      this.welcomeResolve = null;
      this.welcomeReject = null;
    }
  }

  root.NavalGame.MultiplayerClient = MultiplayerClient;
})(window);
