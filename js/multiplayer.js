(function (root) {
  'use strict';

  class MultiplayerClient {
    constructor() {
      this.code = null;
      this.token = null;
      this.seat = null;
      this.events = null;
      this.onState = null;
      this.onConnection = null;
    }

    get active() {
      return Boolean(this.code && this.token);
    }

    async request(url, options = {}) {
      const response = await root.fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'network-error');
        error.code = data.error || 'network-error';
        throw error;
      }
      return data;
    }

    async createLobby() {
      this.close();
      const session = await this.request('/api/lobbies', { method: 'POST', body: '{}' });
      this.connect(session);
      return session;
    }

    async joinLobby(code) {
      this.close();
      const normalized = String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
      const session = await this.request(`/api/lobbies/${encodeURIComponent(normalized)}/join`, {
        method: 'POST',
        body: '{}',
      });
      this.connect(session);
      return session;
    }

    connect(session) {
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

    async command(type, payload = {}) {
      if (!this.active) throw new Error('no-lobby');
      return this.request(`/api/lobbies/${encodeURIComponent(this.code)}/command`, {
        method: 'POST',
        body: JSON.stringify({ token: this.token, type, payload }),
      });
    }

    close() {
      this.events?.close();
      this.events = null;
      this.code = null;
      this.token = null;
      this.seat = null;
    }
  }

  root.NavalGame.MultiplayerClient = MultiplayerClient;
})(window);
