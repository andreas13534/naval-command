(function (root) {
  'use strict';

  class AudioManager {
    constructor() {
      this.enabled = true;
      this.context = null;
      this.master = null;
      this.ambient = null;
      this.music = null;
    }

    attachMusic(element) {
      this.music = element || null;
      if (this.music) this.music.volume = 0.22;
    }

    ensureContext() {
      if (!this.enabled) return null;
      if (!this.context) {
        const AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) return null;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume();
      return this.context;
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled) this.stopAmbient();
      return this.enabled;
    }

    toggle() {
      return this.setEnabled(!this.enabled);
    }

    tone(frequency, duration, options = {}) {
      const context = this.ensureContext();
      if (!context) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = options.type || 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      if (options.endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, context.currentTime + duration);
      }
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(options.volume || 0.25, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(this.master);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + 0.02);
    }

    noise(duration, volume = 0.15, filterFrequency = 900) {
      const context = this.ensureContext();
      if (!context) return;
      const frameCount = Math.floor(context.sampleRate * duration);
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < frameCount; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = filterFrequency;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      source.connect(filter).connect(gain).connect(this.master);
      source.start();
    }

    sonar() {
      this.tone(780, 0.75, { volume: 0.18, endFrequency: 620 });
    }

    shot() {
      this.noise(0.14, 0.3, 500);
      this.tone(90, 0.22, { type: 'sawtooth', volume: 0.18, endFrequency: 45 });
    }

    splash() {
      this.noise(0.35, 0.14, 1800);
      this.tone(240, 0.25, { volume: 0.08, endFrequency: 110 });
    }

    explosion() {
      this.noise(0.65, 0.34, 650);
      this.tone(75, 0.55, { type: 'sawtooth', volume: 0.24, endFrequency: 35 });
    }

    warning() {
      this.tone(520, 0.18, { type: 'square', volume: 0.12 });
      root.setTimeout(() => this.tone(420, 0.25, { type: 'square', volume: 0.1 }), 170);
    }

    startAmbient() {
      if (this.enabled && this.music) {
        const playback = this.music.play();
        if (playback && typeof playback.catch === 'function') playback.catch(() => { /* waits for the next user gesture */ });
      }
      const context = this.ensureContext();
      if (!context || this.ambient) return;
      const frameCount = context.sampleRate * 3;
      const buffer = context.createBuffer(1, frameCount, context.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let index = 0; index < frameCount; index += 1) {
        last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
        data[index] = last;
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      gain.gain.value = 0.055;
      source.connect(filter).connect(gain).connect(this.master);
      source.start();
      this.ambient = source;
    }

    stopAmbient() {
      if (this.music) this.music.pause();
      if (!this.ambient) return;
      try { this.ambient.stop(); } catch (_error) { /* already stopped */ }
      this.ambient = null;
    }
  }

  root.NavalGame.AudioManager = AudioManager;
})(typeof window !== 'undefined' ? window : globalThis);
