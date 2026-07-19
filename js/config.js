(function (root) {
  'use strict';

  const SHIPS = Object.freeze([
    Object.freeze({ id: 'carrier', name: 'Flugzeugträger', code: 'CVN', length: 5, profile: 'carrier', asset: 'assets/individual-ships/grid-ready-128/09-aircraft-carrier-5x1.png' }),
    Object.freeze({ id: 'battleship', name: 'Schlachtschiff', code: 'BB', length: 4, profile: 'battleship', asset: 'assets/individual-ships/grid-ready-128/07-modern-battleship-4x1.png' }),
    Object.freeze({ id: 'cruiser', name: 'Kreuzer', code: 'CG', length: 3, profile: 'cruiser', asset: 'assets/individual-ships/grid-ready-128/05-missile-frigate-3x1.png' }),
    Object.freeze({ id: 'submarine', name: 'U-Boot', code: 'SSN', length: 3, profile: 'submarine', asset: 'assets/individual-ships/grid-ready-128/04-attack-submarine-3x1.png' }),
    Object.freeze({ id: 'destroyer', name: 'Zerstörer', code: 'DDG', length: 2, profile: 'destroyer', asset: 'assets/individual-ships/grid-ready-128/02-stealth-corvette-2x1.png' }),
    Object.freeze({ id: 'patrol-interceptor', name: 'Patrouillen-Abfangjäger', code: 'PTI', length: 2, profile: 'destroyer', asset: 'assets/individual-ships/grid-ready-128/01-patrol-interceptor-2x1.png' }),
    Object.freeze({ id: 'rapid-corvette', name: 'Schnellkorvette', code: 'RVC', length: 2, profile: 'destroyer', asset: 'assets/individual-ships/grid-ready-128/03-fast-destroyer-3x1.png' }),
    Object.freeze({ id: 'torpedo-cutter', name: 'Torpedokutter', code: 'TRC', length: 2, profile: 'submarine', asset: 'assets/individual-ships/grid-ready-128/04-attack-submarine-3x1.png' }),
    Object.freeze({ id: 'missile-boat', name: 'Raketenboot', code: 'MSB', length: 2, profile: 'cruiser', asset: 'assets/individual-ships/grid-ready-128/05-missile-frigate-3x1.png' }),
    Object.freeze({ id: 'fast-destroyer', name: 'Schnellzerstörer', code: 'FDD', length: 3, profile: 'destroyer', asset: 'assets/individual-ships/grid-ready-128/03-fast-destroyer-3x1.png' }),
    Object.freeze({ id: 'heavy-missile-cruiser', name: 'Schwerer Raketenkreuzer', code: 'HMC', length: 4, profile: 'cruiser', asset: 'assets/individual-ships/grid-ready-128/06-heavy-missile-cruiser-4x1.png' }),
    Object.freeze({ id: 'amphibious-landing-ship', name: 'Amphibisches Landungsschiff', code: 'ALS', length: 4, profile: 'carrier', asset: 'assets/individual-ships/grid-ready-128/08-amphibious-landing-ship-4x1.png' }),
    Object.freeze({ id: 'experimental-command-ship', name: 'Experimentelles Kommandoschiff', code: 'XCS', length: 5, profile: 'carrier', asset: 'assets/individual-ships/grid-ready-128/10-experimental-command-ship-5x1.png' }),
    Object.freeze({ id: 'square-catamaran', name: 'Quadrat-Katamaran', code: 'XSC', length: 4, gridWidth: 2, gridHeight: 2, profile: 'experimental', asset: 'assets/individual-ships/grid-ready-128/11-square-catamaran-2x2.png' }),
    Object.freeze({ id: 'fork-ship', name: 'Gabelschiff', code: 'XFS', length: 6, gridWidth: 3, gridHeight: 2, profile: 'experimental', asset: 'assets/individual-ships/grid-ready-128/12-fork-ship-3x2.png' }),
    Object.freeze({ id: 'floating-fortress', name: 'Schwimmende Festung', code: 'XFF', length: 14, gridWidth: 7, gridHeight: 2, profile: 'experimental', asset: 'assets/individual-ships/grid-ready-128/13-floating-fortress-7x2.png' }),
  ]);

  const CLASSIC_FLEET = Object.freeze(['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer']);
  const DEBUG_FLEET = Object.freeze([
    'patrol-interceptor', 'destroyer', 'rapid-corvette', 'torpedo-cutter', 'missile-boat', 'fast-destroyer', 'submarine', 'cruiser',
    'heavy-missile-cruiser', 'battleship', 'amphibious-landing-ship', 'carrier',
    'experimental-command-ship', 'square-catamaran', 'fork-ship', 'floating-fortress',
  ]);

  const STANDARD_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'square-barrage',
      name: '2×2-Sperrfeuer',
      shortName: 'QUADRAT 2×2',
      cost: 6,
      pattern: 'square',
      animationId: 'square-barrage',
      grantsMissPoints: false,
      description: 'Beschießt vier Felder in einem kompakten 2×2-Zielbereich.',
    }),
    Object.freeze({
      id: 'line-strike',
      name: 'Dreier-Linienfeuer',
      shortName: 'LINIE ×3',
      cost: 4,
      pattern: 'line',
      animationId: 'line-strike',
      grantsMissPoints: false,
      description: 'Beschießt drei zusammenhängende Felder horizontal oder vertikal.',
    }),
  ]);

  const VOSS_FLEET = Object.freeze(['destroyer', 'cruiser', 'carrier']);
  const VOSS_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'sector-scanner',
      name: 'ORACLE-Sektorscanner',
      shortName: 'SCAN 3×3',
      cost: 8,
      pattern: 'scan',
      target: 'enemy',
      animationId: 'sector-scanner',
      grantsMissPoints: false,
      description: 'Scannt einen 3×3-Sektor. Bei einem Fund bleibt das Raster unverändert; ein leerer Sektor wird vollständig als Wasser markiert.',
    }),
    Object.freeze({
      id: 'field-repair',
      name: 'ARES-Feldreparatur',
      shortName: 'REPARATUR',
      cost: 3,
      pattern: 'repair',
      target: 'player',
      animationId: 'field-repair',
      grantsMissPoints: false,
      description: 'Repariert genau ein getroffenes Teil eines eigenen Schiffes.',
    }),
  ]);

  const KWON_FLEET = Object.freeze(['battleship', 'heavy-missile-cruiser', 'destroyer', 'patrol-interceptor']);
  const KWON_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'chemical-bomb',
      name: 'Chemiebombe',
      shortName: 'CHEM-BOMBE',
      cost: 4,
      pattern: 'chemical',
      target: 'enemy',
      animationId: 'chemical-reveal',
      grantsMissPoints: false,
      description: 'Feuert einen Spezialschuss. Bei einem Treffer wird das gesamte betroffene Schiff sichtbar, aber nicht zusätzlich beschädigt.',
    }),
    Object.freeze({
      id: 'mine-layer',
      name: 'Minenleger',
      shortName: 'SEEMINE',
      cost: 7,
      pattern: 'mine',
      target: 'player',
      animationId: 'mine-deployment',
      grantsMissPoints: false,
      description: 'Legt eine verborgene Mine auf ein unbeschossenes eigenes Feld. Wird dieses Feld beschossen, folgen drei normale Freischüsse.',
    }),
  ]);

  const GRAVES_FLEET = Object.freeze(['floating-fortress', 'patrol-interceptor']);
  const GRAVES_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'fleet-relocation',
      name: 'Verschiebung',
      shortName: 'VERSCHIEBUNG',
      cost: 5,
      pattern: 'relocation',
      target: 'player',
      animationId: 'tactical-relocation',
      grantsMissPoints: false,
      description: 'Verlegt ein vollständig unbeschädigtes eigenes Schiff auf freie Felder. Die Ausrichtung bleibt erhalten.',
    }),
    Object.freeze({
      id: 'nuclear-strike',
      name: 'Atombombe',
      shortName: 'ATOMBOMBE',
      cost: 7,
      pattern: 'nuclear',
      target: 'enemy',
      animationId: 'nuclear-annihilation',
      grantsMissPoints: false,
      description: 'Feuert einen einzelnen Nuklearschuss. Bei einem Treffer sinkt das gesamte getroffene Schiff sofort.',
    }),
  ]);

  const DHILLON_FLEET = Object.freeze(['fork-ship', 'heavy-missile-cruiser', 'fast-destroyer']);
  const DHILLON_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'rangefinder-shot',
      name: 'Entfernungsmesser',
      shortName: 'ENTFERNUNG',
      cost: 5,
      pattern: 'rangefinder',
      target: 'enemy',
      animationId: 'vector-rangefinder',
      grantsMissPoints: false,
      description: 'Feuert einen einzelnen Schuss und meldet danach nur die Felddistanz zum nächsten noch aktiven gegnerischen Schiff.',
    }),
    Object.freeze({
      id: 'berserker-barrage',
      name: 'Amoklauf',
      shortName: 'AMOKLAUF ×6',
      cost: 8,
      pattern: 'random-barrage',
      target: 'automatic',
      animationId: 'berserker-random-barrage',
      grantsMissPoints: false,
      description: 'Feuert automatisch sechs Schüsse auf zufällige, noch unbeschossene Felder. Die Ziele können nicht gewählt werden.',
    }),
  ]);

  const SERRANO_FLEET = Object.freeze(['carrier', 'submarine', 'cruiser']);
  const SERRANO_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'row-torpedo',
      name: 'Torpedo',
      shortName: 'TORPEDO-REIHE',
      cost: 14,
      pattern: 'full-row',
      target: 'enemy',
      animationId: 'abyss-row-torpedo',
      grantsMissPoints: false,
      description: 'Feuert einen Torpedo durch die gewählte horizontale Reihe und beschießt jedes dort noch unbeschossene Feld.',
    }),
    Object.freeze({
      id: 'submerge-vessel',
      name: 'Untertauchen',
      shortName: 'UNTERTAUCHEN',
      cost: 5,
      pattern: 'submerge',
      target: 'player',
      animationId: 'abyss-submerge-shield',
      grantsMissPoints: false,
      description: 'Wählt ein eigenes aktives Schiff. Es ist während des nächsten gegnerischen Zuges unverwundbar; ein Treffer darauf wird blockiert.',
    }),
  ]);

  const FALK_FLEET = Object.freeze(['patrol-interceptor', 'destroyer', 'rapid-corvette', 'torpedo-cutter', 'missile-boat']);
  const FALK_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'fleet-sacrifice',
      name: 'Opferung',
      shortName: 'OPFERUNG ×5',
      cost: 6,
      pattern: 'sacrifice',
      target: 'player',
      animationId: 'ledger-fleet-sacrifice',
      grantsMissPoints: false,
      description: 'Zerstört ein eigenes aktives Schiff außer der letzten Einheit und gewährt sofort fünf Spezialschüsse ohne Fehlschusspunkte.',
    }),
    Object.freeze({
      id: 'ship-procurement',
      name: 'Schiffskauf',
      shortName: 'SCHIFFSKAUF',
      cost: 13,
      pattern: 'purchase-ship',
      target: 'player',
      shipId: 'fast-destroyer',
      animationId: 'ledger-ship-procurement',
      grantsMissPoints: false,
      description: 'Kauft einmal pro Gefecht einen 3er-Schnellzerstörer und platziert ihn horizontal oder vertikal auf freien, unbeschossenen Feldern.',
    }),
  ]);

  const OKAFOR_FLEET = Object.freeze(['square-catamaran', 'battleship', 'cruiser']);
  const OKAFOR_ABILITIES = Object.freeze([
    Object.freeze({
      id: 'hydrogen-bombardment',
      name: 'Wasserstoffbombe',
      shortName: 'H-BOMBE 4×4',
      cost: 12,
      pattern: 'hydrogen-field',
      target: 'enemy',
      areaSize: 4,
      animationId: 'prometheus-hydrogen-bomb',
      grantsMissPoints: false,
      description: 'Beschießt alle noch unbeschossenen Felder eines 4×4-Zielsektors. Der Sektor wird an Spielfeldrändern vollständig ins Raster verschoben.',
    }),
    Object.freeze({
      id: 'last-revenge',
      name: 'Letzte Rache',
      shortName: 'LETZTE RACHE',
      cost: 15,
      pattern: 'last-revenge',
      target: 'automatic',
      shots: 15,
      animationId: 'prometheus-last-revenge',
      grantsMissPoints: false,
      description: 'Gewährt 15 frei wählbare Schüsse ohne Fehlschusspunkte. Ist die gegnerische Flotte danach nicht versenkt, geht das Gefecht sofort verloren.',
    }),
  ]);

  const TEST_PORTRAITS = Object.freeze([
    '01-male-veteran-commander.png',
    '02-male-tactical-analyst.png',
    '03-male-red-bearded-corsair.png',
    '04-male-sikh-strategist.png',
    '05-male-daring-navigator.png',
    '06-male-master-tactician.png',
    '07-male-fleet-guardian.png',
    '08-male-silent-officer.png',
    '09-female-braided-commander.png',
    '10-female-silver-admiral.png',
    '11-female-eyepatch-captain.png',
    '12-male-scandinavian-polar-captain.png',
    '13-male-italian-commander.png',
    '14-male-slavic-veteran.png',
    '15-male-french-officer.png',
    '16-female-scandinavian-arctic-captain.png',
    '17-female-greek-strategist.png',
    '18-female-irish-officer.png',
    '19-female-slavic-admiral.png',
  ]);

  const TEST_COMMANDERS = TEST_PORTRAITS.map((fileName, index) => {
    const number = String(index + 1).padStart(2, '0');
    if (index === 0) {
      return Object.freeze({
        id: 'captain-elias-voss',
        name: 'Kapitän Elias Voss',
        rank: 'Bergungskommando // ORACLE',
        portrait: 'elias-voss',
        portraitAsset: `assets/captain-portraits/${fileName}`,
        fleet: VOSS_FLEET,
        abilities: VOSS_ABILITIES,
      });
    }
    if (index === 1) {
      return Object.freeze({
        id: 'captain-dae-hyun-kwon',
        name: 'Kapitän Dae-Hyun Kwon',
        rank: 'Spezialwaffen // VIPER',
        portrait: 'dae-hyun-kwon',
        portraitAsset: `assets/captain-portraits/${fileName}`,
        fleet: KWON_FLEET,
        abilities: KWON_ABILITIES,
      });
    }
    if (index === 2) {
      return Object.freeze({
        id: 'captain-ronan-graves',
        name: 'Kapitän Ronan Graves',
        rank: 'Belagerungskommando // TITAN',
        portrait: 'ronan-graves',
        portraitAsset: `assets/captain-portraits/${fileName}`,
        fleet: GRAVES_FLEET,
        abilities: GRAVES_ABILITIES,
      });
    }
    if (index === 3) {
      return Object.freeze({
        id: 'captain-arjan-dhillon',
        name: 'Kapitän Arjan Dhillon',
        rank: 'Feuerleitkommando // VECTOR',
        portrait: 'arjan-dhillon',
        portraitAsset: `assets/captain-portraits/${fileName}`,
        fleet: DHILLON_FLEET,
        abilities: DHILLON_ABILITIES,
      });
    }
    if (index === 4) {
      return Object.freeze({
        id: 'captain-mateo-serrano',
        name: 'Kapitän Mateo Serrano',
        rank: 'Unterwasserkommando // ABYSS',
        portrait: 'mateo-serrano',
        portraitAsset: `assets/captain-portraits/${fileName}`,
        fleet: SERRANO_FLEET,
        abilities: SERRANO_ABILITIES,
      });
    }
    if (index === 5) {
      return Object.freeze({
        id: 'captain-leander-falk',
        name: 'Kapitän Leander Falk',
        rank: 'Strategische Logistik // LEDGER',
        portrait: 'leander-falk',
        portraitAsset: `assets/captain-portraits/${fileName}`,
        fleet: FALK_FLEET,
        abilities: FALK_ABILITIES,
      });
    }
    if (index === 6) {
      return Object.freeze({
        id: 'captain-malik-okafor',
        name: 'Kapitän Malik Okafor',
        rank: 'Strategische Abschreckung // PROMETHEUS',
        portrait: 'malik-okafor',
        portraitAsset: `assets/captain-portraits/${fileName}`,
        fleet: OKAFOR_FLEET,
        abilities: OKAFOR_ABILITIES,
      });
    }
    return Object.freeze({
      id: `test-captain-${number}`,
      name: '#Test',
      rank: `PROTOTYP // ${number}`,
      portrait: `test-${number}`,
      portraitAsset: `assets/captain-portraits/${fileName}`,
      fleet: CLASSIC_FLEET,
      abilities: STANDARD_ABILITIES,
    });
  });

  const COMMANDERS = Object.freeze([
    Object.freeze({
      id: 'standard',
      name: 'Standard-Kommandant',
      rank: 'Flottenkommando',
      portrait: 'standard',
      fleet: CLASSIC_FLEET,
      abilities: STANDARD_ABILITIES,
    }),
    Object.freeze({
      id: 'debug',
      name: 'TEST/DEBUG-Kommandant',
      rank: 'Systemdiagnose // DEV',
      portrait: 'debug',
      fleet: DEBUG_FLEET,
      abilities: Object.freeze([
        Object.freeze({
          id: 'square-barrage',
          name: '2×2-Sperrfeuer',
          shortName: 'QUADRAT 2×2',
          cost: 1,
          pattern: 'square',
          animationId: 'square-barrage',
          grantsMissPoints: false,
          description: 'Debug-Version: vier Felder im 2×2-Zielbereich für nur einen Punkt.',
        }),
        Object.freeze({
          id: 'line-strike',
          name: 'Dreier-Linienfeuer',
          shortName: 'LINIE ×3',
          cost: 1,
          pattern: 'line',
          animationId: 'line-strike',
          grantsMissPoints: false,
          description: 'Debug-Version: drei Felder in einer Linie für nur einen Punkt.',
        }),
      ]),
    }),
    ...TEST_COMMANDERS,
  ]);

  const CONFIG = Object.freeze({
    gridSize: 10,
    ships: SHIPS,
    classicFleet: CLASSIC_FLEET,
    commanders: COMMANDERS,
    columns: Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']),
    aiDelayMs: 620,
    future: Object.freeze({
      boardSizes: [8, 10, 12],
      modes: ['singlePlayer', 'localTwoPlayer', 'onlineMultiplayer'],
      specialActions: [],
    }),
  });

  root.NavalGame = root.NavalGame || {};
  root.NavalGame.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
