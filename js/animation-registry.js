(function (root) {
  'use strict';

  class AnimationRegistry {
    constructor() {
      this.presets = new Map();
      this.defaultId = 'standard-missile';
    }

    register(id, definition) {
      if (!id || typeof id !== 'string') throw new TypeError('Animation preset requires a string id.');
      if (!definition || typeof definition !== 'object') throw new TypeError(`Animation preset "${id}" requires a definition.`);
      const defaultPhases = {
        launch: 'LAUNCH SEQUENCE',
        flight: 'TERMINAL GUIDANCE',
        impact: 'DAMAGE ASSESSMENT',
        miss: 'WATER IMPACT',
      };
      const preset = Object.freeze({
        id,
        duration: 3100,
        reducedDuration: 1800,
        projectileCount: 1,
        projectileLimit: 4,
        projectileStagger: 0.055,
        arcHeight: 0.31,
        launchEnd: 0.27,
        impactStart: 0.66,
        impactStrength: 1,
        sunkImpactStrength: 2,
        cameraShake: 1,
        orderLabel: 'MISSILE LAUNCH',
        ...definition,
        phases: Object.freeze({ ...defaultPhases, ...(definition.phases || {}) }),
      });
      this.presets.set(id, preset);
      return preset;
    }

    get(id) {
      return this.presets.get(id) || this.presets.get(this.defaultId);
    }

    has(id) {
      return this.presets.has(id);
    }

    list() {
      return [...this.presets.values()];
    }

    resolveProjectileCount(preset, resultCount) {
      const requested = preset.projectileCount === 'results' ? resultCount : preset.projectileCount;
      return Math.max(1, Math.min(Number(requested) || 1, preset.projectileLimit));
    }

    formatLabel(template, context) {
      return String(template || '')
        .replaceAll('{count}', String(context.count))
        .replaceAll('{ability}', context.abilityName || '')
        .replaceAll('{target}', context.target || '—');
    }
  }

  root.NavalGame = root.NavalGame || {};
  root.NavalGame.AnimationRegistry = AnimationRegistry;
  root.NavalGame.CinematicAnimations = new AnimationRegistry();
})(typeof window !== 'undefined' ? window : globalThis);
