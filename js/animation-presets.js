(function (root) {
  'use strict';

  const registry = root.NavalGame.CinematicAnimations;

  registry.register('standard-missile', {
    duration: 3100,
    projectileCount: 1,
    orderLabel: 'MISSILE LAUNCH',
  });

  registry.register('square-barrage', {
    duration: 3400,
    projectileCount: 'results',
    projectileStagger: 0.055,
    arcHeight: 0.28,
    impactStrength: 1.25,
    sunkImpactStrength: 2.35,
    cameraShake: 1.18,
    orderLabel: 'AREA SALVO // {count} ROUNDS',
    phases: Object.freeze({
      launch: 'MULTI-LAUNCH SEQUENCE',
      flight: 'AREA TARGETING',
      impact: 'SECTOR DAMAGE SCAN',
      miss: 'SECTOR SPLASHDOWN',
    }),
  });

  registry.register('line-strike', {
    duration: 3250,
    projectileCount: 'results',
    projectileStagger: 0.085,
    arcHeight: 0.36,
    impactStrength: 1.1,
    sunkImpactStrength: 2.15,
    cameraShake: 1.08,
    orderLabel: 'LINE STRIKE // {count} ROUNDS',
    phases: Object.freeze({
      launch: 'SEQUENTIAL LAUNCH',
      flight: 'VECTOR ALIGNMENT',
      impact: 'LINE IMPACT SCAN',
      miss: 'LINE SPLASHDOWN',
    }),
  });

  registry.register('sector-scanner', {
    scene: 'scanner',
    duration: 3000,
    reducedDuration: 1650,
    launchEnd: 0.24,
    impactStart: 0.68,
    orderLabel: 'ORACLE 3×3 SECTOR SWEEP',
    phases: Object.freeze({
      launch: 'SONAR ARRAY CHARGING',
      flight: 'DEEP SCAN IN PROGRESS',
      impact: 'CONTACT CONFIRMED',
      miss: 'SECTOR CLEAR',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({
        'scan-found': 'CONTACT FOUND',
        'scan-clear': 'SECTOR CLEAR // WATER MARKED',
      }),
    }),
  });

  registry.register('field-repair', {
    scene: 'repair',
    duration: 3200,
    reducedDuration: 1750,
    launchEnd: 0.22,
    impactStart: 0.7,
    orderLabel: 'ARES REPAIR DRONES',
    phases: Object.freeze({
      launch: 'DRONE BAY OPEN',
      flight: 'HULL RECONSTRUCTION',
      impact: 'STRUCTURAL INTEGRITY RESTORED',
      miss: 'REPAIR ABORTED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({ repair: 'HULL SEGMENT RESTORED' }),
    }),
  });

  registry.register('chemical-reveal', {
    scene: 'chemical',
    duration: 3300,
    reducedDuration: 1750,
    launchEnd: 0.25,
    impactStart: 0.68,
    orderLabel: 'VIPER CHEMICAL PAYLOAD',
    phases: Object.freeze({
      launch: 'PAYLOAD PRESSURIZING',
      flight: 'AEROSOL VECTOR LOCK',
      impact: 'VESSEL SIGNATURE EXPOSED',
      miss: 'AGENT DISPERSED // NO CONTACT',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({
        'chemical-reveal': 'FULL VESSEL SIGNATURE REVEALED',
        'chemical-miss': 'NO CONTACT // AGENT DISSIPATED',
      }),
    }),
  });

  registry.register('mine-deployment', {
    scene: 'mine',
    duration: 3100,
    reducedDuration: 1650,
    launchEnd: 0.23,
    impactStart: 0.72,
    orderLabel: 'SILENT MINE DEPLOYMENT',
    phases: Object.freeze({
      launch: 'MINE BAY FLOODED',
      flight: 'MAGNETIC ANCHOR DESCENT',
      impact: 'PROXIMITY FUSE ARMED',
      miss: 'DEPLOYMENT ABORTED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({ 'mine-deployed': 'MINE ARMED // 3 FREE SHOTS ON TRIGGER' }),
    }),
  });

  registry.register('tactical-relocation', {
    scene: 'relocation',
    duration: 3200,
    reducedDuration: 1700,
    launchEnd: 0.24,
    impactStart: 0.72,
    orderLabel: 'TITAN PHASE RELOCATION',
    phases: Object.freeze({
      launch: 'VESSEL MATRIX ACQUIRED',
      flight: 'PHASE SHIFT IN PROGRESS',
      impact: 'NEW POSITION SECURED',
      miss: 'RELOCATION ABORTED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({ relocation: 'VESSEL RELOCATED // GRID SECURE' }),
    }),
  });

  registry.register('nuclear-annihilation', {
    scene: 'nuclear',
    duration: 3600,
    reducedDuration: 1850,
    launchEnd: 0.22,
    impactStart: 0.64,
    orderLabel: 'STRATEGIC WARHEAD RELEASE',
    phases: Object.freeze({
      launch: 'NUCLEAR AUTHORIZATION VERIFIED',
      flight: 'WARHEAD TERMINAL DESCENT',
      impact: 'TOTAL VESSEL ANNIHILATION',
      miss: 'DETONATION: OPEN WATER',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({
        'nuclear-hit': 'TARGET VESSEL ANNIHILATED',
        'nuclear-miss': 'ZERO CONTACT // WATER DETONATION',
      }),
    }),
  });

  registry.register('vector-rangefinder', {
    scene: 'rangefinder',
    duration: 3150,
    reducedDuration: 1700,
    launchEnd: 0.24,
    impactStart: 0.69,
    orderLabel: 'VECTOR RANGEFINDER ROUND',
    phases: Object.freeze({
      launch: 'CALIBRATING SINGLE ROUND',
      flight: 'MEASURING CONTACT DISTANCE',
      impact: 'DISTANCE SOLUTION ACQUIRED',
      miss: 'DISTANCE SOLUTION ACQUIRED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({ 'range-result': 'NEAREST CONTACT DISTANCE ACQUIRED' }),
    }),
  });

  registry.register('berserker-random-barrage', {
    scene: 'barrage',
    duration: 3450,
    reducedDuration: 1800,
    launchEnd: 0.22,
    impactStart: 0.66,
    projectileCount: 'results',
    projectileLimit: 6,
    orderLabel: 'BERSERKER RANDOM SALVO // {count} ROUNDS',
    phases: Object.freeze({
      launch: 'FIRE CONTROL OVERRIDE',
      flight: 'RANDOM VECTORS COMMITTED',
      impact: 'CHAOTIC SALVO COMPLETE',
      miss: 'CHAOTIC SALVO COMPLETE',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({
        sunk: 'RANDOM SALVO // VESSEL DESTROYED',
        hit: 'RANDOM SALVO // CONTACT HIT',
        miss: 'RANDOM SALVO COMPLETE',
      }),
    }),
  });

  registry.register('abyss-row-torpedo', {
    scene: 'torpedo-row',
    duration: 3450,
    reducedDuration: 1800,
    launchEnd: 0.22,
    impactStart: 0.67,
    projectileCount: 1,
    orderLabel: 'ABYSS TORPEDO // HORIZONTAL ROW',
    phases: Object.freeze({
      launch: 'TORPEDO TUBE FLOODED',
      flight: 'HORIZONTAL RUN ACTIVE',
      impact: 'FULL ROW IMPACT CONFIRMED',
      miss: 'ROW CLEARED // NO CONTACT',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({
        sunk: 'TORPEDO ROW // VESSEL DESTROYED',
        hit: 'TORPEDO ROW // CONTACT HIT',
        miss: 'TORPEDO ROW // OPEN WATER',
      }),
    }),
  });

  registry.register('abyss-submerge-shield', {
    scene: 'submerge',
    duration: 3200,
    reducedDuration: 1700,
    launchEnd: 0.24,
    impactStart: 0.7,
    orderLabel: 'ABYSS DIVE PROTOCOL',
    phases: Object.freeze({
      launch: 'BALLAST TANKS FLOODING',
      flight: 'VESSEL DESCENDING',
      impact: 'SUBMERGED SHIELD ACTIVE',
      miss: 'INCOMING ATTACK DEFLECTED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({ submerged: 'VESSEL SUBMERGED // SHIELD ACTIVE' }),
      enemy: Object.freeze({ blocked: 'BLOCKED // ZERO HULL DAMAGE' }),
    }),
  });

  registry.register('ledger-fleet-sacrifice', {
    scene: 'sacrifice',
    duration: 3350,
    reducedDuration: 1750,
    launchEnd: 0.23,
    impactStart: 0.69,
    orderLabel: 'LEDGER SACRIFICE PROTOCOL',
    phases: Object.freeze({
      launch: 'SELF-DESTRUCT AUTHORIZED',
      flight: 'VESSEL ENERGY CONVERSION',
      impact: 'FIVE SHOTS RELEASED',
      miss: 'CONVERSION ABORTED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({ sacrificed: 'VESSEL SACRIFICED // FIVE SHOTS READY' }),
    }),
  });

  registry.register('ledger-ship-procurement', {
    scene: 'procurement',
    duration: 3400,
    reducedDuration: 1800,
    launchEnd: 0.24,
    impactStart: 0.7,
    orderLabel: 'LEDGER RAPID PROCUREMENT',
    phases: Object.freeze({
      launch: 'PURCHASE AUTHORIZATION VERIFIED',
      flight: 'DRYDOCK ASSEMBLY ACTIVE',
      impact: 'NEW VESSEL COMMISSIONED',
      miss: 'PROCUREMENT ABORTED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({ 'ship-purchased': 'NEW 3-CELL VESSEL DEPLOYED' }),
    }),
  });

  registry.register('prometheus-hydrogen-bomb', {
    scene: 'hydrogen-field',
    duration: 3800,
    reducedDuration: 1900,
    launchEnd: 0.22,
    impactStart: 0.62,
    orderLabel: 'PROMETHEUS 4×4 THERMONUCLEAR STRIKE',
    phases: Object.freeze({
      launch: 'FUSION PACKAGE RELEASED',
      flight: 'SIXTEEN-POINT VECTOR LOCK',
      impact: 'SECTOR DETONATION CASCADE',
      miss: 'SECTOR DETONATION CASCADE',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({
        sunk: '4×4 SECTOR ERASED // VESSEL DESTROYED',
        hit: '4×4 SECTOR STRUCK // CONTACTS HIT',
        miss: '4×4 SECTOR STRUCK // ZERO CONTACT',
      }),
    }),
  });

  registry.register('prometheus-last-revenge', {
    scene: 'last-revenge',
    duration: 3300,
    reducedDuration: 1750,
    launchEnd: 0.25,
    impactStart: 0.72,
    orderLabel: 'PROMETHEUS FINAL RETALIATION',
    phases: Object.freeze({
      launch: 'NO-RETURN AUTHORIZATION',
      flight: 'FIFTEEN TARGET CHANNELS ARMING',
      impact: 'FINAL SALVO CONTROL RELEASED',
      miss: 'FINAL SALVO CONTROL RELEASED',
    }),
    resultMessages: Object.freeze({
      player: Object.freeze({
        'last-revenge-armed': '15 SHOTS ARMED // VICTORY OR DEFEAT',
      }),
    }),
  });
})(typeof window !== 'undefined' ? window : globalThis);
