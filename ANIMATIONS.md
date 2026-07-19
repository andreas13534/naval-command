# Neue Fähigkeitsanimationen hinzufügen

Das Animationssystem ist datengetrieben. Eine neue Fähigkeit benötigt normalerweise nur zwei Einträge.

## 1. Preset registrieren

In `js/animation-presets.js`:

```js
registry.register('emp-wave', {
  duration: 2800,
  projectileCount: 1,
  projectileStagger: 0.05,
  arcHeight: 0.18,
  impactStrength: 0.7,
  sunkImpactStrength: 1.2,
  cameraShake: 0.45,
  orderLabel: 'EMP PULSE // {target}',
  phases: Object.freeze({
    launch: 'CAPACITOR CHARGE',
    flight: 'PULSE PROPAGATION',
    impact: 'SYSTEM DISRUPTION',
    miss: 'PULSE DISSIPATED',
  }),
});
```

## 2. Preset mit der Fähigkeit verbinden

In `js/config.js` bei der Fähigkeit:

```js
animationId: 'emp-wave',
```

Damit verwendet die Fähigkeit automatisch das neue Preset. Ohne `animationId` wird `standard-missile` verwendet.

## Preset-Felder

| Feld | Bedeutung |
|---|---|
| `duration` | Gesamtdauer in Millisekunden |
| `reducedDuration` | Dauer bei reduzierter Bewegung |
| `projectileCount` | Zahl oder `'results'` für ein Projektil pro Ergebnis |
| `projectileLimit` | Maximale gleichzeitig gezeichnete Projektile |
| `projectileStagger` | Zeitversatz zwischen Projektilen |
| `arcHeight` | Höhe der Flugkurve relativ zur Bildschirmhöhe |
| `launchEnd` | Ende der Abschussphase zwischen 0 und 1 |
| `impactStart` | Beginn des Einschlags zwischen 0 und 1 |
| `impactStrength` | Stärke von Explosion, Partikeln und Rauch |
| `sunkImpactStrength` | Verstärkung bei versenkten Schiffen |
| `cameraShake` | Multiplikator für die Kamerabewegung |
| `orderLabel` | HUD-Text; unterstützt `{count}`, `{ability}` und `{target}` |
| `phases` | HUD-Texte für `launch`, `flight`, `impact` und `miss` |

Die Registry ist zur Laufzeit außerdem über `NavalGame.CinematicAnimations` erreichbar. Dadurch können spätere Module eigene Presets registrieren, ohne `cinematic.js` zu verändern.
