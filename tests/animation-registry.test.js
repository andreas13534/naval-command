'use strict';

const assert = require('node:assert/strict');
require('../js/animation-registry.js');
require('../js/animation-presets.js');
require('../js/config.js');

const { AnimationRegistry, CinematicAnimations, CONFIG } = globalThis.NavalGame;

assert.equal(CinematicAnimations.has('standard-missile'), true);
assert.equal(CinematicAnimations.has('square-barrage'), true);
assert.equal(CinematicAnimations.has('line-strike'), true);
assert.equal(CinematicAnimations.has('sector-scanner'), true);
assert.equal(CinematicAnimations.has('field-repair'), true);
assert.equal(CinematicAnimations.has('chemical-reveal'), true);
assert.equal(CinematicAnimations.has('mine-deployment'), true);
assert.equal(CinematicAnimations.has('tactical-relocation'), true);
assert.equal(CinematicAnimations.has('nuclear-annihilation'), true);
assert.equal(CinematicAnimations.has('vector-rangefinder'), true);
assert.equal(CinematicAnimations.has('berserker-random-barrage'), true);
assert.equal(CinematicAnimations.has('abyss-row-torpedo'), true);
assert.equal(CinematicAnimations.has('abyss-submerge-shield'), true);
assert.equal(CinematicAnimations.has('ledger-fleet-sacrifice'), true);
assert.equal(CinematicAnimations.has('ledger-ship-procurement'), true);
assert.equal(CinematicAnimations.has('prometheus-hydrogen-bomb'), true);
assert.equal(CinematicAnimations.has('prometheus-last-revenge'), true);
assert.equal(CinematicAnimations.has('ignis-flame-missile'), true);
assert.equal(CinematicAnimations.has('ignis-scan-shot'), true);
assert.equal(CinematicAnimations.has('raptor-jet-launch'), true);
assert.equal(CinematicAnimations.has('raptor-signal-jammer'), true);
assert.equal(CinematicAnimations.get('missing-preset').id, 'standard-missile', 'unknown ids use the safe default');
assert.equal(CinematicAnimations.resolveProjectileCount(CinematicAnimations.get('square-barrage'), 4), 4);
assert.equal(CinematicAnimations.resolveProjectileCount(CinematicAnimations.get('berserker-random-barrage'), 6), 6);
assert.equal(CinematicAnimations.formatLabel('SALVO {count} // {target}', { count: 4, target: 'E7' }), 'SALVO 4 // E7');

for (const commander of CONFIG.commanders) {
  for (const ability of commander.abilities) {
    assert.equal(CinematicAnimations.has(ability.animationId), true, `${ability.id} must reference a registered animation`);
  }
}

const isolated = new AnimationRegistry();
isolated.register('standard-missile', { duration: 1000 });
isolated.register('future-ability', { projectileCount: 'results', projectileLimit: 6 });
assert.equal(isolated.resolveProjectileCount(isolated.get('future-ability'), 5), 5, 'future presets can be added without cinematic changes');

console.log('Animation registry tests passed.');
