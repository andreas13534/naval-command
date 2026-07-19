(function (root) {
  'use strict';

  class ShotCinematic {
    constructor(element, audio, registry) {
      this.element = element;
      this.canvas = element.querySelector('canvas');
      this.context = this.canvas.getContext('2d');
      this.audio = audio;
      this.registry = registry || root.NavalGame.CinematicAnimations;
      this.imageCache = new Map();
      this.animationFrame = 0;
      this.sequence = 0;
      this.phaseElement = element.querySelector('#cinematic-phase');
      this.sideElement = element.querySelector('#cinematic-side');
      this.orderElement = element.querySelector('#cinematic-order');
      this.coordinateElement = element.querySelector('#cinematic-coordinate');
      this.rangeElement = element.querySelector('#cinematic-range');
      this.resultElement = element.querySelector('#cinematic-result');
    }

    loadImage(source) {
      if (!source) return Promise.resolve(null);
      if (this.imageCache.has(source)) return this.imageCache.get(source);
      const promise = new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = source;
      });
      this.imageCache.set(source, promise);
      return promise;
    }

    getResultKind(results) {
      if (results.some((result) => result.type === 'jet-launched')) return 'jet-launched';
      if (results.some((result) => result.type === 'jammer-active')) return 'jammer-active';
      if (results.some((result) => result.type === 'jet-hit')) return 'jet-hit';
      if (results.some((result) => result.type === 'scan-shot-result')) return 'scan-shot-result';
      if (results.some((result) => result.type === 'last-revenge-armed')) return 'last-revenge-armed';
      if (results.some((result) => result.type === 'sacrificed')) return 'sacrificed';
      if (results.some((result) => result.type === 'ship-purchased')) return 'ship-purchased';
      if (results.some((result) => result.type === 'blocked')) return 'blocked';
      if (results.some((result) => result.type === 'submerged')) return 'submerged';
      if (results.some((result) => result.type === 'range-result')) return 'range-result';
      if (results.some((result) => result.type === 'repair')) return 'repair';
      if (results.some((result) => result.type === 'scan-found')) return 'scan-found';
      if (results.some((result) => result.type === 'scan-clear')) return 'scan-clear';
      if (results.some((result) => result.type === 'chemical-reveal')) return 'chemical-reveal';
      if (results.some((result) => result.type === 'chemical-miss')) return 'chemical-miss';
      if (results.some((result) => result.type === 'mine-deployed')) return 'mine-deployed';
      if (results.some((result) => result.type === 'relocation')) return 'relocation';
      if (results.some((result) => result.type === 'nuclear-hit')) return 'nuclear-hit';
      if (results.some((result) => result.type === 'nuclear-miss')) return 'nuclear-miss';
      if (results.some((result) => result.type === 'sunk')) return 'sunk';
      if (results.some((result) => result.type === 'hit')) return 'hit';
      return 'miss';
    }

    getResultMessage(attacker, kind, preset) {
      const presetMessage = preset.resultMessages?.[attacker]?.[kind];
      if (presetMessage) return presetMessage;
      if (attacker === 'player') {
        if (kind === 'jet-hit') return 'HOSTILE RAPTOR JET DESTROYED';
        if (kind === 'sunk') return 'ENEMY VESSEL DESTROYED';
        if (kind === 'hit') return 'DIRECT HIT';
        return 'IMPACT: OPEN WATER';
      }
      if (kind === 'jet-hit') return 'FRIENDLY RAPTOR JET LOST';
      if (kind === 'sunk') return 'FRIENDLY VESSEL LOST';
      if (kind === 'hit') return 'FRIENDLY VESSEL HIT';
      return 'INCOMING ATTACK MISSED';
    }

    resize() {
      const mobileLayout = root.document.documentElement.classList.contains('mobile-layout');
      const ratio = Math.min(root.devicePixelRatio || 1, mobileLayout ? 1.5 : 2);
      const width = Math.max(1, this.element.clientWidth);
      const height = Math.max(1, this.element.clientHeight);
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width, height };
    }

    getSceneLayout(width, height, enemy) {
      const portrait = root.document.documentElement.classList.contains('mobile-layout') && height > width;
      if (!portrait) {
        return {
          portrait: false,
          sourceX: width * (enemy ? 0.73 : 0.27),
          sourceY: height * 0.62,
          targetX: width * (enemy ? 0.26 : 0.74),
          targetY: height * 0.56,
        };
      }
      return {
        portrait: true,
        sourceX: width * (enemy ? 0.82 : 0.18),
        sourceY: height * 0.64,
        targetX: width * (enemy ? 0.18 : 0.82),
        targetY: height * 0.53,
      };
    }

    drawSea(context, width, height, elapsed, enemy) {
      const horizon = height * 0.48;
      const sky = context.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, enemy ? '#030405' : '#020806');
      sky.addColorStop(0.68, enemy ? '#15100f' : '#071b16');
      sky.addColorStop(1, '#0d2424');
      context.fillStyle = sky;
      context.fillRect(0, 0, width, horizon);

      const sea = context.createLinearGradient(0, horizon, 0, height);
      sea.addColorStop(0, enemy ? '#102729' : '#0a302b');
      sea.addColorStop(0.34, '#071b1c');
      sea.addColorStop(1, '#010607');
      context.fillStyle = sea;
      context.fillRect(0, horizon, width, height - horizon);

      context.save();
      context.globalAlpha = 0.38;
      const mobileLayout = root.document.documentElement.classList.contains('mobile-layout');
      const lineCount = mobileLayout ? 12 : 18;
      for (let line = 0; line < lineCount; line += 1) {
        const y = horizon + 8 + line * ((height - horizon) / (lineCount - 1));
        const amplitude = 1.5 + line * 0.18;
        context.beginPath();
        for (let x = -20; x <= width + 20; x += 12) {
          const wave = Math.sin(x * 0.025 + elapsed * 0.004 + line * 0.9) * amplitude;
          if (x === -20) context.moveTo(x, y + wave);
          else context.lineTo(x, y + wave);
        }
        context.strokeStyle = line % 3 === 0 ? 'rgba(76,255,153,.24)' : 'rgba(137,210,201,.13)';
        context.lineWidth = Math.max(0.6, line * 0.055);
        context.stroke();
      }
      context.restore();

      const fog = context.createRadialGradient(width * 0.58, horizon, 0, width * 0.58, horizon, width * 0.58);
      fog.addColorStop(0, 'rgba(109,190,176,.12)');
      fog.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = fog;
      context.fillRect(0, horizon - height * 0.14, width, height * 0.34);
    }

    drawScannerScene(context, width, height, elapsed, normalized, impactProgress, found) {
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const size = Math.min(width * 0.78, height * 0.58, 560);
      const left = centerX - size / 2;
      const top = centerY - size / 2;
      const cellSize = size / 3;

      const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.7);
      background.addColorStop(0, 'rgba(5,55,45,.95)');
      background.addColorStop(0.5, 'rgba(1,18,18,.98)');
      background.addColorStop(1, '#010506');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = 'rgba(81,255,184,.38)';
      context.lineWidth = 1;
      for (let index = 0; index <= 3; index += 1) {
        context.beginPath();
        context.moveTo(left + index * cellSize, top);
        context.lineTo(left + index * cellSize, top + size);
        context.moveTo(left, top + index * cellSize);
        context.lineTo(left + size, top + index * cellSize);
        context.stroke();
      }

      const sweepY = top + size * Math.min(1, normalized / 0.7);
      const sweep = context.createLinearGradient(0, sweepY - cellSize * 0.7, 0, sweepY + 8);
      sweep.addColorStop(0, 'rgba(81,255,184,0)');
      sweep.addColorStop(0.82, 'rgba(81,255,184,.08)');
      sweep.addColorStop(1, 'rgba(178,255,224,.72)');
      context.fillStyle = sweep;
      context.fillRect(left, top, size, Math.max(2, sweepY - top));

      context.strokeStyle = 'rgba(102,255,205,.28)';
      for (let ring = 1; ring <= 4; ring += 1) {
        context.beginPath();
        context.arc(centerX, centerY, (size * 0.11 * ring + elapsed * 0.025) % (size * 0.48), 0, Math.PI * 2);
        context.stroke();
      }

      if (impactProgress > 0) {
        const pulse = 0.65 + Math.sin(elapsed * 0.025) * 0.22;
        context.globalAlpha = Math.min(1, impactProgress * 4);
        if (found) {
          context.fillStyle = `rgba(255,85,48,${pulse})`;
          context.shadowColor = '#ff5034';
          context.shadowBlur = 34;
          context.beginPath();
          context.arc(centerX, centerY, 12 + pulse * 10, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = 'rgba(255,120,82,.78)';
          context.lineWidth = 3;
          context.strokeRect(left, top, size, size);
        } else {
          context.fillStyle = 'rgba(78,255,180,.13)';
          for (let row = 0; row < 3; row += 1) {
            for (let col = 0; col < 3; col += 1) {
              context.fillRect(left + col * cellSize + 4, top + row * cellSize + 4, cellSize - 8, cellSize - 8);
            }
          }
        }
      }
      context.globalAlpha = 0.08;
      for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);
      context.restore();
    }

    drawRepairScene(context, image, width, height, elapsed, normalized, impactProgress) {
      const centerX = width * 0.5;
      const centerY = height * 0.54;
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#020707');
      background.addColorStop(0.55, '#06201e');
      background.addColorStop(1, '#010506');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalAlpha = 0.2;
      context.strokeStyle = '#55e8ff';
      const gridStep = Math.max(30, Math.min(width, height) * 0.075);
      for (let x = -height; x < width + height; x += gridStep) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + height, height);
        context.stroke();
      }
      for (let x = 0; x < width + height; x += gridStep) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x - height, height);
        context.stroke();
      }
      context.restore();

      this.drawShip(context, image, centerX, centerY, width * 0.82, false, 1, normalized < 0.72);

      const orbit = Math.min(width, height) * 0.26;
      for (let index = 0; index < 6; index += 1) {
        const angle = elapsed * 0.0024 + (Math.PI * 2 * index) / 6;
        const droneX = centerX + Math.cos(angle) * orbit;
        const droneY = centerY + Math.sin(angle) * orbit * 0.42;
        context.strokeStyle = 'rgba(83,238,255,.42)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(droneX, droneY);
        context.lineTo(centerX, centerY);
        context.stroke();
        context.fillStyle = '#b8fff5';
        context.shadowColor = '#58efff';
        context.shadowBlur = 15;
        context.fillRect(droneX - 3, droneY - 3, 6, 6);
      }

      const beamProgress = Math.min(1, normalized / 0.72);
      const beamY = centerY - orbit * 0.65 + orbit * 1.3 * beamProgress;
      const beam = context.createLinearGradient(0, beamY - 45, 0, beamY + 6);
      beam.addColorStop(0, 'rgba(80,235,255,0)');
      beam.addColorStop(0.8, 'rgba(80,235,255,.12)');
      beam.addColorStop(1, 'rgba(178,255,227,.85)');
      context.fillStyle = beam;
      context.fillRect(centerX - width * 0.36, beamY - 45, width * 0.72, 51);

      const repairGlow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(1, orbit * (0.5 + impactProgress)));
      repairGlow.addColorStop(0, `rgba(190,255,218,${0.2 + impactProgress * 0.75})`);
      repairGlow.addColorStop(0.35, `rgba(59,255,166,${impactProgress * 0.38})`);
      repairGlow.addColorStop(1, 'rgba(23,255,145,0)');
      context.fillStyle = repairGlow;
      context.beginPath();
      context.arc(centerX, centerY, orbit * (0.5 + impactProgress), 0, Math.PI * 2);
      context.fill();

      context.save();
      context.translate(centerX, centerY);
      context.rotate(elapsed * 0.0012);
      context.strokeStyle = impactProgress > 0 ? 'rgba(124,255,188,.86)' : 'rgba(82,232,255,.5)';
      context.lineWidth = 2;
      context.strokeRect(-orbit, -orbit, orbit * 2, orbit * 2);
      context.restore();
    }

    drawChemicalScene(context, image, width, height, elapsed, normalized, impactProgress, revealed) {
      const centerX = width * 0.58;
      const centerY = height * 0.54;
      const horizon = height * 0.42;
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#020504');
      background.addColorStop(0.46, '#09211a');
      background.addColorStop(1, '#010706');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.globalAlpha = 0.18;
      context.strokeStyle = '#70ff94';
      for (let row = 0; row < 8; row += 1) {
        const y = horizon + row * (height - horizon) / 7;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y + Math.sin(elapsed * 0.002 + row) * 5);
        context.stroke();
      }
      context.restore();

      const flight = Math.min(1, normalized / 0.68);
      const startX = width * 0.12;
      const startY = height * 0.63;
      const payloadX = startX + (centerX - startX) * flight;
      const payloadY = startY - Math.sin(flight * Math.PI) * height * 0.2;
      const trail = context.createLinearGradient(startX, startY, payloadX, payloadY);
      trail.addColorStop(0, 'rgba(95,255,130,0)');
      trail.addColorStop(1, 'rgba(183,255,119,.9)');
      context.strokeStyle = trail;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(startX, startY);
      context.quadraticCurveTo(width * 0.34, height * 0.34, payloadX, payloadY);
      context.stroke();
      context.save();
      context.translate(payloadX, payloadY);
      context.rotate(-0.14 + flight * 0.25);
      context.shadowColor = '#9dff58';
      context.shadowBlur = 22;
      context.fillStyle = '#d9ff9f';
      context.fillRect(-17, -5, 34, 10);
      context.fillStyle = '#3cff77';
      context.fillRect(-11, -8, 7, 16);
      context.restore();

      if (impactProgress > 0) {
        const cloudRadius = Math.min(width, height) * (0.12 + impactProgress * 0.32);
        for (let index = 0; index < 24; index += 1) {
          const angle = index * 2.399 + elapsed * 0.0004;
          const distance = cloudRadius * ((index % 7) / 7);
          const x = centerX + Math.cos(angle) * distance;
          const y = centerY + Math.sin(angle) * distance * 0.55;
          context.fillStyle = `rgba(${revealed ? '82,255,112' : '154,210,96'},${0.08 + (1 - impactProgress) * 0.16})`;
          context.beginPath();
          context.arc(x, y, cloudRadius * (0.12 + (index % 5) * 0.035), 0, Math.PI * 2);
          context.fill();
        }
        if (revealed && image) {
          context.save();
          context.globalAlpha = Math.min(0.82, impactProgress * 2.4);
          context.filter = 'sepia(1) saturate(5) hue-rotate(62deg) brightness(1.4)';
          this.drawShip(context, image, centerX, centerY, width * 0.78, true, 1, false);
          context.restore();
          context.strokeStyle = `rgba(128,255,149,${Math.min(1, impactProgress * 2)})`;
          context.lineWidth = 2;
          const boxWidth = Math.min(width * 0.62, 620);
          context.strokeRect(centerX - boxWidth / 2, centerY - height * 0.13, boxWidth, height * 0.26);
        }
      }
    }

    drawMineScene(context, width, height, elapsed, normalized, impactProgress) {
      const centerX = width * 0.5;
      const waterline = height * 0.3;
      const seabed = height * 0.82;
      const mineY = waterline + (seabed - waterline) * Math.min(1, normalized / 0.72);
      const background = context.createLinearGradient(0, waterline, 0, height);
      background.addColorStop(0, '#0b3535');
      background.addColorStop(0.45, '#052020');
      background.addColorStop(1, '#010707');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#07100d';
      context.beginPath();
      context.moveTo(0, seabed);
      for (let x = 0; x <= width; x += 30) context.lineTo(x, seabed + Math.sin(x * 0.027) * 8);
      context.lineTo(width, height);
      context.lineTo(0, height);
      context.fill();

      context.save();
      context.strokeStyle = 'rgba(84,255,203,.22)';
      for (let ring = 1; ring <= 4; ring += 1) {
        context.beginPath();
        context.ellipse(centerX, mineY, ring * 34 + (elapsed * 0.025) % 34, ring * 12, 0, 0, Math.PI * 2);
        context.stroke();
      }
      context.strokeStyle = 'rgba(160,255,217,.5)';
      context.beginPath();
      context.moveTo(centerX, mineY + 24);
      context.lineTo(centerX, seabed + 5);
      context.stroke();
      context.translate(centerX, mineY);
      context.shadowColor = impactProgress > 0 ? '#57ff8c' : '#53e7d0';
      context.shadowBlur = 18 + impactProgress * 30;
      context.fillStyle = '#142f2d';
      context.strokeStyle = impactProgress > 0 ? '#7dff9d' : '#8cdad1';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, 24, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      for (let index = 0; index < 10; index += 1) {
        const angle = index * Math.PI / 5;
        context.beginPath();
        context.moveTo(Math.cos(angle) * 22, Math.sin(angle) * 22);
        context.lineTo(Math.cos(angle) * 39, Math.sin(angle) * 39);
        context.stroke();
      }
      if (impactProgress > 0) {
        context.fillStyle = Math.sin(elapsed * 0.018) > 0 ? '#c8ffbf' : '#42ff71';
        context.beginPath();
        context.arc(0, 0, 7, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    drawRelocationScene(context, image, width, height, elapsed, normalized, impactProgress) {
      const sourceX = width * 0.28;
      const targetX = width * 0.72;
      const centerY = height * 0.54;
      const portalRadius = Math.min(width, height) * 0.19;
      const background = context.createRadialGradient(width * 0.5, centerY, 0, width * 0.5, centerY, Math.max(width, height) * 0.72);
      background.addColorStop(0, '#10283a');
      background.addColorStop(0.52, '#06121d');
      background.addColorStop(1, '#010407');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = 'rgba(94,211,255,.2)';
      context.lineWidth = 1;
      const step = Math.max(28, Math.min(width, height) * 0.065);
      for (let x = -height; x < width + height; x += step) {
        context.beginPath();
        context.moveTo(x, height);
        context.lineTo(x + height * 0.72, height * 0.24);
        context.stroke();
      }
      for (let y = height * 0.3; y < height; y += step) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.restore();

      for (const [index, x] of [sourceX, targetX].entries()) {
        context.save();
        context.translate(x, centerY);
        context.rotate((index ? 1 : -1) * elapsed * 0.0014);
        for (let ring = 1; ring <= 4; ring += 1) {
          context.strokeStyle = `rgba(${index ? '97,255,186' : '82,210,255'},${0.42 / ring + impactProgress * 0.12})`;
          context.lineWidth = ring === 1 ? 3 : 1;
          context.beginPath();
          context.arc(0, 0, portalRadius * (0.42 + ring * 0.15), ring * 0.4, Math.PI * 1.55 + ring * 0.4);
          context.stroke();
        }
        context.restore();
      }

      const transfer = Math.min(1, normalized / 0.72);
      const sourceAlpha = Math.max(0, 1 - transfer * 1.45);
      const targetAlpha = Math.max(0, (transfer - 0.3) / 0.7);
      this.drawShip(context, image, sourceX, centerY, width * 0.62, false, sourceAlpha);
      this.drawShip(context, image, targetX, centerY, width * 0.62, false, targetAlpha);

      for (let index = 0; index < 54; index += 1) {
        const stagger = (index % 18) / 18;
        const local = Math.max(0, Math.min(1, transfer * 1.25 - stagger * 0.25));
        const x = sourceX + (targetX - sourceX) * local;
        const y = centerY + Math.sin(index * 2.1 + elapsed * 0.005) * portalRadius * (0.12 + (index % 7) * 0.045);
        context.fillStyle = index % 3 ? `rgba(106,229,255,${0.16 + local * 0.48})` : `rgba(109,255,183,${0.2 + local * 0.55})`;
        context.fillRect(x, y, 2 + index % 3, 2 + index % 3);
      }

      if (impactProgress > 0) {
        const glow = context.createRadialGradient(targetX, centerY, 0, targetX, centerY, portalRadius * (0.5 + impactProgress));
        glow.addColorStop(0, `rgba(173,255,219,${0.62 * impactProgress})`);
        glow.addColorStop(1, 'rgba(78,255,180,0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(targetX, centerY, portalRadius * (0.5 + impactProgress), 0, Math.PI * 2);
        context.fill();
      }
    }

    drawNuclearScene(context, image, width, height, elapsed, normalized, impactProgress, hit) {
      const centerX = width * 0.5;
      const centerY = height * 0.58;
      const horizon = height * 0.46;
      const sky = context.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#030303');
      sky.addColorStop(0.72, '#21130a');
      sky.addColorStop(1, '#5a2b0c');
      context.fillStyle = sky;
      context.fillRect(0, 0, width, horizon);
      const sea = context.createLinearGradient(0, horizon, 0, height);
      sea.addColorStop(0, '#2b2418');
      sea.addColorStop(0.3, '#0e1b1b');
      sea.addColorStop(1, '#010506');
      context.fillStyle = sea;
      context.fillRect(0, horizon, width, height - horizon);

      const descent = Math.min(1, normalized / 0.64);
      const warheadY = -40 + (centerY + 20) * descent;
      const trail = context.createLinearGradient(centerX, 0, centerX, warheadY);
      trail.addColorStop(0, 'rgba(255,164,62,0)');
      trail.addColorStop(0.7, 'rgba(255,126,34,.35)');
      trail.addColorStop(1, '#fff1b0');
      context.strokeStyle = trail;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(centerX, 0);
      context.lineTo(centerX + Math.sin(elapsed * 0.01) * 7, warheadY);
      context.stroke();
      context.save();
      context.translate(centerX, warheadY);
      context.shadowColor = '#ff812e';
      context.shadowBlur = 22;
      context.fillStyle = '#f7ead0';
      context.fillRect(-5, -21, 10, 42);
      context.fillStyle = '#ff6533';
      context.beginPath();
      context.moveTo(-5, -21);
      context.lineTo(0, -32);
      context.lineTo(5, -21);
      context.fill();
      context.restore();

      if (impactProgress <= 0) return;
      if (hit && image) this.drawShip(context, image, centerX, centerY + 18, width * 0.76, true, Math.max(0, 1 - impactProgress * 1.7), true);
      const flash = Math.max(0, 1 - impactProgress * 1.35);
      context.fillStyle = `rgba(255,248,204,${flash * 0.92})`;
      context.fillRect(0, 0, width, height);
      const eased = 1 - Math.pow(1 - impactProgress, 3);
      const blastRadius = Math.min(width, height) * (0.08 + eased * 0.34);
      const blast = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, blastRadius);
      blast.addColorStop(0, 'rgba(255,255,235,.98)');
      blast.addColorStop(0.18, 'rgba(255,211,92,.95)');
      blast.addColorStop(0.52, 'rgba(255,75,16,.82)');
      blast.addColorStop(1, 'rgba(83,9,0,0)');
      context.fillStyle = blast;
      context.beginPath();
      context.arc(centerX, centerY, blastRadius, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = `rgba(255,228,170,${Math.max(0, 0.9 - impactProgress)})`;
      context.lineWidth = 5;
      for (let ring = 1; ring <= 3; ring += 1) {
        context.beginPath();
        context.ellipse(centerX, centerY + 12, blastRadius * (0.55 + ring * 0.42), blastRadius * (0.12 + ring * 0.06), 0, 0, Math.PI * 2);
        context.stroke();
      }

      const stemHeight = height * 0.34 * eased;
      context.fillStyle = `rgba(62,38,24,${0.35 + impactProgress * 0.45})`;
      context.fillRect(centerX - blastRadius * 0.12, centerY - stemHeight, blastRadius * 0.24, stemHeight);
      for (let index = 0; index < 16; index += 1) {
        const angle = index * Math.PI / 8;
        const cloudX = centerX + Math.cos(angle) * blastRadius * (0.18 + (index % 5) * 0.09);
        const cloudY = centerY - stemHeight + Math.sin(angle) * blastRadius * 0.22;
        context.beginPath();
        context.arc(cloudX, cloudY, blastRadius * (0.16 + (index % 4) * 0.035), 0, Math.PI * 2);
        context.fill();
      }
    }

    drawRangefinderScene(context, width, height, elapsed, normalized, impactProgress, distance, hit) {
      const centerX = width * 0.5;
      const centerY = height * 0.52;
      const spacing = Math.max(28, Math.min(width, height) * 0.075);
      const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.72);
      background.addColorStop(0, '#073128');
      background.addColorStop(0.46, '#031712');
      background.addColorStop(1, '#010504');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(centerX, centerY);
      context.rotate(Math.PI / 4);
      context.strokeStyle = 'rgba(69,255,142,.14)';
      context.lineWidth = 1;
      for (let offset = -Math.max(width, height); offset <= Math.max(width, height); offset += spacing) {
        context.beginPath();
        context.moveTo(-Math.max(width, height), offset);
        context.lineTo(Math.max(width, height), offset);
        context.stroke();
        context.beginPath();
        context.moveTo(offset, -Math.max(width, height));
        context.lineTo(offset, Math.max(width, height));
        context.stroke();
      }
      context.restore();

      const sweep = Math.min(1, normalized / 0.69);
      const ringCount = 5;
      for (let ring = 0; ring < ringCount; ring += 1) {
        const local = Math.max(0, Math.min(1, sweep * 1.45 - ring * 0.13));
        const radius = spacing * (0.8 + ring * 0.92) * local;
        context.save();
        context.translate(centerX, centerY);
        context.rotate(Math.PI / 4);
        context.strokeStyle = `rgba(77,255,153,${0.18 + local * 0.46})`;
        context.lineWidth = ring === ringCount - 1 ? 3 : 1.5;
        context.strokeRect(-radius, -radius, radius * 2, radius * 2);
        context.restore();
      }

      const pulse = 28 + Math.sin(elapsed * 0.01) * 5;
      context.strokeStyle = hit ? 'rgba(255,190,75,.92)' : 'rgba(94,255,168,.92)';
      context.lineWidth = 2;
      context.strokeRect(centerX - pulse, centerY - pulse, pulse * 2, pulse * 2);
      context.beginPath();
      context.moveTo(centerX - pulse - 28, centerY);
      context.lineTo(centerX + pulse + 28, centerY);
      context.moveTo(centerX, centerY - pulse - 28);
      context.lineTo(centerX, centerY + pulse + 28);
      context.stroke();

      if (impactProgress > 0) {
        const displayDistance = distance === null ? 'Ø' : String(distance);
        context.save();
        context.globalAlpha = Math.min(1, impactProgress * 2.8);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = '#45ff93';
        context.shadowBlur = 28;
        context.fillStyle = '#b8ffd1';
        context.font = `700 ${Math.max(64, Math.min(width, height) * 0.21)}px monospace`;
        context.fillText(displayDistance, centerX, centerY);
        context.shadowBlur = 12;
        context.fillStyle = 'rgba(110,255,167,.85)';
        context.font = `600 ${Math.max(13, Math.min(width, height) * 0.026)}px monospace`;
        context.fillText(distance === null ? 'NO ACTIVE CONTACTS' : 'GRID DISTANCE', centerX, centerY + Math.max(70, Math.min(width, height) * 0.16));
        context.restore();
      }
    }

    drawBarrageScene(context, width, height, elapsed, normalized, impactProgress, results) {
      this.drawSea(context, width, height, elapsed, false);
      const portrait = root.document.documentElement.classList.contains('mobile-layout') && height > width;
      const startX = portrait ? width * 0.5 : width * 0.18;
      const startY = portrait ? height * 0.79 : height * 0.7;
      const targets = [
        [0.2, 0.42], [0.34, 0.34], [0.48, 0.43],
        [0.62, 0.32], [0.76, 0.4], [0.88, 0.29],
      ];
      const flight = Math.min(1, normalized / 0.66);
      results.slice(0, 6).forEach((result, index) => {
        const delay = index * 0.055;
        const local = Math.max(0, Math.min(1, (flight - delay) / (1 - delay)));
        const target = targets[index];
        const endX = width * target[0];
        const endY = height * target[1];
        const curve = Math.sin(local * Math.PI) * height * (0.18 + (index % 3) * 0.035);
        const jitter = Math.sin(index * 9.3 + elapsed * 0.013) * 4 * local;
        const x = startX + (endX - startX) * local + jitter;
        const y = startY + (endY - startY) * local - curve;
        const previous = Math.max(0, local - 0.035);
        const previousX = startX + (endX - startX) * previous;
        const previousY = startY + (endY - startY) * previous - Math.sin(previous * Math.PI) * height * (0.18 + (index % 3) * 0.035);
        const angle = Math.atan2(y - previousY, x - previousX);

        context.save();
        const trail = context.createLinearGradient(previousX, previousY, x, y);
        trail.addColorStop(0, 'rgba(105,255,154,0)');
        trail.addColorStop(1, index % 2 ? '#d6ff97' : '#62ff9d');
        context.strokeStyle = trail;
        context.lineWidth = 2.5;
        context.beginPath();
        context.moveTo(previousX, previousY);
        context.lineTo(x, y);
        context.stroke();
        context.translate(x, y);
        context.rotate(angle);
        context.shadowColor = '#77ff9d';
        context.shadowBlur = 16;
        context.fillStyle = '#edfff2';
        context.fillRect(-8, -2, 16, 4);
        context.restore();

        if (impactProgress > 0) {
          const localImpact = Math.max(0, Math.min(1, impactProgress * 1.55 - index * 0.085));
          if (localImpact > 0) {
            const hit = result.type !== 'miss';
            const radius = Math.min(width, height) * (0.035 + localImpact * (hit ? 0.1 : 0.065));
            const glow = context.createRadialGradient(endX, endY, 0, endX, endY, radius);
            glow.addColorStop(0, hit ? 'rgba(255,246,183,.95)' : 'rgba(191,255,238,.86)');
            glow.addColorStop(0.35, hit ? 'rgba(255,96,31,.75)' : 'rgba(75,218,211,.42)');
            glow.addColorStop(1, 'rgba(10,35,28,0)');
            context.fillStyle = glow;
            context.beginPath();
            context.arc(endX, endY, radius, 0, Math.PI * 2);
            context.fill();
            context.strokeStyle = hit ? `rgba(255,129,57,${1 - localImpact * 0.7})` : `rgba(118,255,228,${1 - localImpact * 0.7})`;
            context.lineWidth = 2;
            context.beginPath();
            context.ellipse(endX, endY + 8, radius * 1.35, radius * 0.28, 0, 0, Math.PI * 2);
            context.stroke();
          }
        }
      });

      context.save();
      context.strokeStyle = 'rgba(81,255,141,.24)';
      context.lineWidth = 1;
      for (let index = 0; index < 6; index += 1) {
        const x = width * targets[index][0];
        const y = height * targets[index][1];
        context.strokeRect(x - 19, y - 19, 38, 38);
      }
      context.restore();
    }

    drawTorpedoRowScene(context, width, height, elapsed, normalized, impactProgress, results) {
      const centerY = height * 0.52;
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#01070c');
      background.addColorStop(0.45, '#04232d');
      background.addColorStop(1, '#010609');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = 'rgba(69,218,255,.12)';
      context.lineWidth = 1;
      for (let row = 0; row <= 10; row += 1) {
        const y = height * (0.2 + row * 0.06);
        context.beginPath();
        context.moveTo(width * 0.04, y);
        context.lineTo(width * 0.96, y);
        context.stroke();
      }
      for (let col = 0; col <= 10; col += 1) {
        const x = width * (0.08 + col * 0.084);
        context.beginPath();
        context.moveTo(x, height * 0.18);
        context.lineTo(x, height * 0.82);
        context.stroke();
      }
      context.restore();

      const run = Math.min(1, normalized / 0.67);
      const torpedoX = width * (0.05 + run * 0.9);
      const wobbleY = centerY + Math.sin(elapsed * 0.012) * 4;
      const trail = context.createLinearGradient(width * 0.03, centerY, torpedoX, centerY);
      trail.addColorStop(0, 'rgba(68,225,255,0)');
      trail.addColorStop(0.7, 'rgba(89,233,255,.3)');
      trail.addColorStop(1, '#b7faff');
      context.strokeStyle = trail;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(width * 0.03, centerY);
      context.lineTo(torpedoX, wobbleY);
      context.stroke();

      for (let bubble = 0; bubble < 24; bubble += 1) {
        const offset = (bubble * 47 + elapsed * 0.13) % Math.max(1, torpedoX - width * 0.03);
        const x = torpedoX - offset;
        const y = centerY + Math.sin(bubble * 1.9) * 15 - (elapsed * 0.012 + bubble * 3) % 28;
        context.strokeStyle = `rgba(150,244,255,${0.18 + (bubble % 5) * 0.06})`;
        context.beginPath();
        context.arc(x, y, 1.5 + bubble % 3, 0, Math.PI * 2);
        context.stroke();
      }

      context.save();
      context.translate(torpedoX, wobbleY);
      context.shadowColor = '#63eaff';
      context.shadowBlur = 24;
      context.fillStyle = '#d9fbff';
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(7, -7);
      context.lineTo(-20, -6);
      context.lineTo(-27, 0);
      context.lineTo(-20, 6);
      context.lineTo(7, 7);
      context.closePath();
      context.fill();
      context.fillStyle = '#37b9d2';
      context.fillRect(-16, -11, 8, 22);
      context.restore();

      if (impactProgress > 0) {
        results.forEach((result, index) => {
          const local = Math.max(0, Math.min(1, impactProgress * 1.6 - index * 0.025));
          if (!local) return;
          const x = width * (0.08 + (result.col / 9) * 0.84);
          const hit = result.type !== 'miss';
          const radius = Math.min(width, height) * (0.025 + local * (hit ? 0.09 : 0.055));
          const glow = context.createRadialGradient(x, centerY, 0, x, centerY, radius);
          glow.addColorStop(0, hit ? 'rgba(255,247,196,.96)' : 'rgba(188,249,255,.9)');
          glow.addColorStop(0.38, hit ? 'rgba(255,92,29,.74)' : 'rgba(63,206,235,.38)');
          glow.addColorStop(1, 'rgba(0,18,24,0)');
          context.fillStyle = glow;
          context.beginPath();
          context.arc(x, centerY, radius, 0, Math.PI * 2);
          context.fill();
        });
      }
    }

    drawSubmergeScene(context, image, width, height, elapsed, normalized, impactProgress, blocked) {
      const centerX = width * 0.5;
      const baseY = height * 0.45;
      const dive = Math.min(1, normalized / 0.7);
      const vesselY = baseY + dive * height * 0.13;
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#061b25');
      background.addColorStop(0.4, '#043042');
      background.addColorStop(1, '#01080e');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      for (let ray = 0; ray < 9; ray += 1) {
        const x = width * (0.08 + ray * 0.105);
        const gradient = context.createLinearGradient(x, 0, x + width * 0.12, height * 0.72);
        gradient.addColorStop(0, 'rgba(95,228,255,.11)');
        gradient.addColorStop(1, 'rgba(95,228,255,0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + width * 0.16, height * 0.76);
        context.lineTo(x + width * 0.25, height * 0.76);
        context.lineTo(x + width * 0.04, 0);
        context.fill();
      }

      if (image) {
        this.drawShip(context, image, centerX, vesselY, width * 0.72, false, 0.82 - dive * 0.18);
      } else {
        context.fillStyle = 'rgba(77,201,225,.52)';
        context.beginPath();
        context.ellipse(centerX, vesselY, width * 0.2, height * 0.035, 0, 0, Math.PI * 2);
        context.fill();
      }

      const ringPulse = 1 + Math.sin(elapsed * 0.008) * 0.08;
      for (let ring = 0; ring < 4; ring += 1) {
        context.strokeStyle = `rgba(93,234,255,${0.5 - ring * 0.09})`;
        context.lineWidth = ring === 0 ? 3 : 1;
        context.beginPath();
        context.ellipse(centerX, vesselY, width * (0.22 + ring * 0.07) * ringPulse, height * (0.075 + ring * 0.025) * ringPulse, 0, 0, Math.PI * 2);
        context.stroke();
      }

      for (let bubble = 0; bubble < 34; bubble += 1) {
        const x = centerX + Math.sin(bubble * 2.3) * width * (0.06 + (bubble % 7) * 0.018);
        const y = vesselY - ((elapsed * 0.025 + bubble * 17) % (height * 0.34));
        context.strokeStyle = `rgba(145,241,255,${0.18 + (bubble % 4) * 0.09})`;
        context.beginPath();
        context.arc(x, y, 1.5 + bubble % 4, 0, Math.PI * 2);
        context.stroke();
      }

      if (blocked && impactProgress > 0) {
        const attackProgress = Math.min(1, impactProgress * 2.4);
        const projectileX = width * 0.96 - width * 0.44 * attackProgress;
        context.strokeStyle = 'rgba(255,86,47,.72)';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(width * 0.98, vesselY);
        context.lineTo(projectileX, vesselY);
        context.stroke();
        context.fillStyle = '#ffb064';
        context.shadowColor = '#ff4c28';
        context.shadowBlur = 18;
        context.beginPath();
        context.arc(projectileX, vesselY, 5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
        const barrierX = centerX + width * 0.19;
        const flash = Math.max(0, 1 - Math.abs(attackProgress - 0.92) * 5);
        context.strokeStyle = `rgba(125,246,255,${0.45 + flash * 0.55})`;
        context.lineWidth = 3 + flash * 5;
        context.beginPath();
        context.arc(barrierX, vesselY, Math.min(width, height) * (0.06 + flash * 0.06), -Math.PI / 2, Math.PI / 2);
        context.stroke();
      }
    }

    drawSacrificeScene(context, image, width, height, elapsed, normalized, impactProgress) {
      const centerX = width * 0.5;
      const centerY = height * 0.52;
      const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.72);
      background.addColorStop(0, '#35120d');
      background.addColorStop(0.48, '#120705');
      background.addColorStop(1, '#020202');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = 'rgba(255,105,62,.13)';
      context.lineWidth = 1;
      const grid = Math.max(34, Math.min(width, height) * 0.075);
      for (let x = 0; x <= width; x += grid) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      }
      for (let y = 0; y <= height; y += grid) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }

      const conversion = Math.min(1, normalized / 0.69);
      if (image) this.drawShip(context, image, centerX, centerY, width * 0.72, false, Math.max(0.08, 1 - conversion * 0.82), conversion > 0.32);
      const sliceCount = 12;
      for (let index = 0; index < sliceCount; index += 1) {
        const local = Math.max(0, Math.min(1, conversion * 1.35 - index * 0.035));
        const x = centerX - width * 0.28 + index * (width * 0.56 / (sliceCount - 1));
        const heightScale = height * (0.08 + Math.sin(index * 1.7) * 0.025);
        context.strokeStyle = `rgba(255,105,61,${0.18 + local * 0.62})`;
        context.lineWidth = index % 3 === 0 ? 3 : 1;
        context.beginPath();
        context.moveTo(x, centerY - heightScale * local);
        context.lineTo(x, centerY + heightScale * local);
        context.stroke();
      }

      for (let particle = 0; particle < 70; particle += 1) {
        const angle = particle * 2.399 + elapsed * 0.0009;
        const distance = Math.min(width, height) * (0.03 + (particle % 17) * 0.009) * conversion;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance * 0.46;
        context.fillStyle = particle % 4 ? `rgba(255,102,52,${0.25 + conversion * 0.58})` : `rgba(255,239,173,${0.32 + conversion * 0.6})`;
        context.fillRect(x, y, 2 + particle % 3, 2 + particle % 3);
      }

      if (impactProgress > 0) {
        const ready = Math.min(1, impactProgress * 2.4);
        for (let shot = 0; shot < 5; shot += 1) {
          const angle = -Math.PI * 0.8 + shot * Math.PI * 0.4;
          const radius = Math.min(width, height) * (0.12 + ready * 0.19);
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius * 0.62;
          const glow = context.createRadialGradient(x, y, 0, x, y, 25 + ready * 24);
          glow.addColorStop(0, 'rgba(255,255,210,.98)');
          glow.addColorStop(0.25, 'rgba(122,255,154,.92)');
          glow.addColorStop(1, 'rgba(56,255,118,0)');
          context.fillStyle = glow;
          context.beginPath(); context.arc(x, y, 25 + ready * 24, 0, Math.PI * 2); context.fill();
          context.strokeStyle = '#8dffad';
          context.strokeRect(x - 13, y - 13, 26, 26);
          context.fillStyle = '#d9ffe2';
          context.font = '700 12px monospace';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(String(shot + 1), x, y);
        }
      }
    }

    drawProcurementScene(context, image, width, height, elapsed, normalized, impactProgress) {
      const centerX = width * 0.5;
      const centerY = height * 0.53;
      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#020907');
      background.addColorStop(0.48, '#06271d');
      background.addColorStop(1, '#010504');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.translate(centerX, centerY + height * 0.18);
      context.strokeStyle = 'rgba(91,255,151,.2)';
      for (let line = -12; line <= 12; line += 1) {
        context.beginPath();
        context.moveTo(line * width * 0.045, height * 0.2);
        context.lineTo(line * width * 0.012, -height * 0.2);
        context.stroke();
      }
      for (let row = 0; row < 9; row += 1) {
        const y = height * 0.2 - row * height * 0.05;
        context.beginPath(); context.moveTo(-width * 0.55, y); context.lineTo(width * 0.55, y); context.stroke();
      }
      context.restore();

      const assembly = Math.min(1, normalized / 0.7);
      const dockWidth = Math.min(width * 0.68, 720);
      context.strokeStyle = `rgba(103,255,162,${0.35 + assembly * 0.48})`;
      context.lineWidth = 2;
      context.strokeRect(centerX - dockWidth * 0.5, centerY - height * 0.12, dockWidth, height * 0.24);
      for (let cell = 0; cell < 3; cell += 1) {
        const cellWidth = dockWidth / 3;
        context.strokeRect(centerX - dockWidth * 0.5 + cell * cellWidth, centerY + height * 0.14, cellWidth, height * 0.055);
      }

      const scanY = centerY - height * 0.12 + height * 0.24 * ((assembly * 2.4) % 1);
      context.strokeStyle = '#a9ffca';
      context.shadowColor = '#58ff98';
      context.shadowBlur = 18;
      context.lineWidth = 3;
      context.beginPath(); context.moveTo(centerX - dockWidth * 0.5, scanY); context.lineTo(centerX + dockWidth * 0.5, scanY); context.stroke();
      context.shadowBlur = 0;

      if (image) this.drawShip(context, image, centerX, centerY, width * 0.78, false, 0.15 + assembly * 0.85);
      for (let beam = 0; beam < 8; beam += 1) {
        const x = centerX - dockWidth * 0.42 + beam * dockWidth * 0.12;
        context.strokeStyle = `rgba(99,255,159,${0.15 + assembly * 0.35})`;
        context.beginPath(); context.moveTo(x, height * 0.12); context.lineTo(x, centerY); context.stroke();
      }

      if (impactProgress > 0) {
        const pulse = 1 + Math.sin(elapsed * 0.012) * 0.09;
        context.strokeStyle = `rgba(187,255,210,${Math.min(1, impactProgress * 2.2)})`;
        context.lineWidth = 3;
        context.beginPath();
        context.ellipse(centerX, centerY, dockWidth * 0.38 * pulse, height * 0.1 * pulse, 0, 0, Math.PI * 2);
        context.stroke();
      }
    }

    drawHydrogenFieldScene(context, width, height, elapsed, normalized, impactProgress) {
      const centerX = width * 0.5;
      const centerY = height * 0.47;
      const gridSize = Math.min(width * 0.68, height * 0.44, 520);
      const cellSize = gridSize / 4;
      const left = centerX - gridSize * 0.5;
      const top = centerY - gridSize * 0.5;
      const background = context.createRadialGradient(centerX, centerY, 1, centerX, centerY, Math.max(width, height) * 0.72);
      background.addColorStop(0, '#301407');
      background.addColorStop(0.42, '#110806');
      background.addColorStop(1, '#020302');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = 'rgba(255,146,66,.2)';
      context.lineWidth = 1;
      for (let line = 0; line <= 4; line += 1) {
        const offset = line * cellSize;
        context.beginPath(); context.moveTo(left + offset, top); context.lineTo(left + offset, top + gridSize); context.stroke();
        context.beginPath(); context.moveTo(left, top + offset); context.lineTo(left + gridSize, top + offset); context.stroke();
      }
      context.strokeStyle = 'rgba(255,191,108,.72)';
      context.lineWidth = 2;
      context.strokeRect(left, top, gridSize, gridSize);

      const descent = Math.min(1, normalized / 0.62);
      if (normalized < 0.68) {
        const warheadY = top - height * 0.2 + (centerY - (top - height * 0.2)) * descent;
        const trail = context.createLinearGradient(centerX, warheadY - height * 0.22, centerX, warheadY);
        trail.addColorStop(0, 'rgba(255,255,220,0)');
        trail.addColorStop(1, 'rgba(255,185,79,.9)');
        context.strokeStyle = trail;
        context.lineWidth = 5;
        context.beginPath(); context.moveTo(centerX, warheadY - height * 0.22); context.lineTo(centerX, warheadY); context.stroke();
        context.shadowColor = '#ff9c45';
        context.shadowBlur = 24;
        context.fillStyle = '#fff7d1';
        context.fillRect(centerX - 5, warheadY - 16, 10, 32);
        context.shadowBlur = 0;
      }

      for (let index = 0; index < 16; index += 1) {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const local = Math.max(0, Math.min(1, impactProgress * 2.1 - index * 0.055));
        const x = left + (col + 0.5) * cellSize;
        const y = top + (row + 0.5) * cellSize;
        if (local > 0) {
          const radius = cellSize * (0.12 + Math.sin(local * Math.PI) * 0.68);
          const glow = context.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
          glow.addColorStop(0, `rgba(255,255,235,${Math.min(1, local * 2)})`);
          glow.addColorStop(0.2, `rgba(255,205,79,${0.95 - local * 0.2})`);
          glow.addColorStop(0.58, `rgba(255,69,20,${0.8 - local * 0.35})`);
          glow.addColorStop(1, 'rgba(92,8,2,0)');
          context.fillStyle = glow;
          context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
        } else {
          context.fillStyle = `rgba(255,174,84,${0.22 + Math.sin(elapsed * 0.008 + index) * 0.08})`;
          context.fillRect(x - 2, y - 2, 4, 4);
        }
      }

      if (impactProgress > 0) {
        const shock = gridSize * impactProgress * 0.82;
        context.strokeStyle = `rgba(255,244,193,${Math.max(0, 1 - impactProgress)})`;
        context.lineWidth = 5;
        context.beginPath(); context.arc(centerX, centerY, shock, 0, Math.PI * 2); context.stroke();
        context.fillStyle = `rgba(255,116,35,${Math.max(0, 0.2 - impactProgress * 0.18)})`;
        context.fillRect(0, 0, width, height);
      }
      context.restore();
    }

    drawLastRevengeScene(context, width, height, elapsed, normalized, impactProgress) {
      const centerX = width * 0.5;
      const centerY = height * 0.48;
      const panelWidth = Math.min(width * 0.74, 620);
      const panelHeight = Math.min(height * 0.34, 310);
      const left = centerX - panelWidth * 0.5;
      const top = centerY - panelHeight * 0.5;
      const background = context.createRadialGradient(centerX, centerY, 1, centerX, centerY, Math.max(width, height) * 0.75);
      background.addColorStop(0, '#310606');
      background.addColorStop(0.48, '#100304');
      background.addColorStop(1, '#010203');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const armedCount = Math.min(15, Math.floor(normalized * 20));
      context.save();
      context.strokeStyle = 'rgba(255,74,55,.55)';
      context.lineWidth = 2;
      context.strokeRect(left, top, panelWidth, panelHeight);
      for (let index = 0; index < 15; index += 1) {
        const row = Math.floor(index / 5);
        const col = index % 5;
        const x = left + panelWidth * (0.12 + col * 0.19);
        const y = top + panelHeight * (0.22 + row * 0.28);
        const armed = index < armedCount;
        const pulse = armed ? 1 + Math.sin(elapsed * 0.012 + index) * 0.12 : 0.86;
        const radius = Math.min(panelWidth / 13, panelHeight / 7) * pulse;
        context.strokeStyle = armed ? '#ff725c' : 'rgba(255,87,66,.22)';
        context.fillStyle = armed ? 'rgba(255,48,34,.28)' : 'rgba(35,6,7,.5)';
        context.lineWidth = armed ? 2 : 1;
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); context.stroke();
        if (armed) {
          context.shadowColor = '#ff3d2d';
          context.shadowBlur = 16;
          context.fillStyle = '#fff0d5';
          context.beginPath(); context.arc(x, y, Math.max(2, radius * 0.18), 0, Math.PI * 2); context.fill();
          context.shadowBlur = 0;
        }
        context.fillStyle = armed ? '#ffc0a7' : 'rgba(255,126,99,.38)';
        context.font = `700 ${Math.max(8, Math.min(12, width * 0.025))}px monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(index + 1).padStart(2, '0'), x, y);
      }

      const sweepX = left + panelWidth * ((normalized * 1.8) % 1);
      const sweep = context.createLinearGradient(sweepX - panelWidth * 0.12, 0, sweepX, 0);
      sweep.addColorStop(0, 'rgba(255,60,40,0)');
      sweep.addColorStop(1, 'rgba(255,123,85,.72)');
      context.fillStyle = sweep;
      context.fillRect(sweepX - panelWidth * 0.12, top, panelWidth * 0.12, panelHeight);

      if (impactProgress > 0) {
        const ring = Math.min(width, height) * (0.1 + impactProgress * 0.42);
        context.strokeStyle = `rgba(255,221,181,${1 - impactProgress * 0.82})`;
        context.lineWidth = 4;
        context.beginPath(); context.arc(centerX, centerY, ring, 0, Math.PI * 2); context.stroke();
      }
      context.restore();
    }

    drawShip(context, image, x, y, width, enemy, alpha = 1, damaged = false) {
      if (!image) return;
      const aspect = image.naturalWidth / image.naturalHeight;
      const drawWidth = Math.min(width, aspect * width * 0.35);
      const drawHeight = drawWidth / aspect;
      context.save();
      context.globalAlpha = alpha;
      context.translate(x, y);
      context.rotate(enemy ? 0.025 : -0.025);
      context.transform(1, -0.05, -0.22, 0.72, 0, 0);
      context.shadowColor = damaged ? 'rgba(255,69,26,.8)' : enemy ? 'rgba(255,60,35,.32)' : 'rgba(54,255,123,.3)';
      context.shadowBlur = damaged ? 28 : 15;
      context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      if (enemy) {
        context.globalCompositeOperation = 'source-atop';
        context.fillStyle = 'rgba(90,8,5,.22)';
        context.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      }
      context.restore();
    }

    drawMissiles(context, width, height, progress, count, enemy, preset) {
      const scene = this.getSceneLayout(width, height, enemy);
      const missileCount = Math.min(count, preset.projectileLimit);
      for (let index = 0; index < missileCount; index += 1) {
        const delay = index * preset.projectileStagger;
        const local = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
        const direction = enemy ? -1 : 1;
        const startX = scene.portrait
          ? scene.sourceX + direction * index * width * 0.012
          : width * (enemy ? 0.73 + index * 0.012 : 0.27 - index * 0.012);
        const startY = scene.portrait ? scene.sourceY + index * height * 0.012 : height * (0.56 + index * 0.016);
        const endX = scene.portrait
          ? scene.targetX - direction * index * width * 0.018
          : width * (enemy ? 0.28 - index * 0.025 : 0.72 + index * 0.025);
        const endY = scene.portrait ? scene.targetY + index * height * 0.012 : height * (0.54 + index * 0.018);
        const arcScale = scene.portrait
          ? Math.min(height * preset.arcHeight * 0.72, width * 0.48)
          : height * preset.arcHeight;
        const arc = Math.sin(local * Math.PI) * arcScale;
        const x = startX + (endX - startX) * local;
        const y = startY + (endY - startY) * local - arc;
        const previous = Math.max(0, local - preset.projectileStagger);
        const previousX = startX + (endX - startX) * previous;
        const previousY = startY + (endY - startY) * previous - Math.sin(previous * Math.PI) * arcScale;
        const angle = Math.atan2(y - previousY, x - previousX);

        const trailLength = scene.portrait ? 78 : 100;
        const tailX = x - Math.cos(angle) * trailLength;
        const tailY = y - Math.sin(angle) * trailLength;
        const trail = scene.portrait
          ? context.createLinearGradient(tailX, tailY, x, y)
          : context.createLinearGradient(previousX - 90, previousY, x, y);
        trail.addColorStop(0, 'rgba(210,255,228,0)');
        trail.addColorStop(0.7, 'rgba(223,255,236,.38)');
        trail.addColorStop(1, enemy ? '#ff4b2d' : '#8dffac');
        context.strokeStyle = trail;
        context.lineWidth = scene.portrait ? 3.5 : 3;
        context.beginPath();
        if (scene.portrait) context.moveTo(tailX, tailY);
        else context.moveTo(previousX - Math.cos(angle) * 100, previousY - Math.sin(angle) * 100);
        context.lineTo(x, y);
        context.stroke();

        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.shadowColor = enemy ? '#ff4329' : '#77ff9d';
        context.shadowBlur = 18;
        context.fillStyle = '#ecfff2';
        context.fillRect(-10, -2, 20, 4);
        context.fillStyle = enemy ? '#ff4b26' : '#6dff94';
        context.beginPath();
        context.moveTo(-10, 0);
        context.lineTo(-25, -6);
        context.lineTo(-25, 6);
        context.closePath();
        context.fill();
        if (scene.portrait) {
          context.globalAlpha = 0.5;
          context.strokeStyle = enemy ? '#ff8a70' : '#b8ffca';
          context.lineWidth = 1;
          context.beginPath();
          context.arc(0, 0, 9 + Math.sin(progress * Math.PI * 8) * 2, 0, Math.PI * 2);
          context.stroke();
        }
        context.restore();
      }
    }

    drawImpact(context, width, height, progress, kind, strength, enemy) {
      const scene = this.getSceneLayout(width, height, enemy);
      const x = scene.targetX;
      const y = scene.targetY;
      const eased = 1 - Math.pow(1 - progress, 3);
      if (kind === 'miss') {
        context.save();
        context.strokeStyle = `rgba(208,255,246,${1 - progress * 0.7})`;
        context.lineWidth = scene.portrait ? 5 : 4;
        for (let index = 0; index < 28; index += 1) {
          const angle = Math.PI + (index / 27) * Math.PI;
          const distance = (30 + (index % 7) * 12) * eased;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance - height * 0.2 * eased);
          context.stroke();
        }
        context.strokeStyle = `rgba(128,255,226,${0.75 - progress * 0.6})`;
        context.beginPath();
        context.ellipse(x, y + 6, width * 0.16 * eased, height * 0.035 * eased, 0, 0, Math.PI * 2);
        context.stroke();
        context.restore();
        return;
      }

      const mobileImpactBoost = scene.portrait ? 1.18 : 1;
      const radius = Math.min(width, height) * (kind === 'sunk' ? 0.19 : 0.14) * mobileImpactBoost * Math.sin(Math.min(1, progress) * Math.PI * 0.72);
      const glow = context.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
      glow.addColorStop(0, 'rgba(255,255,225,.98)');
      glow.addColorStop(0.16, 'rgba(255,202,62,.95)');
      glow.addColorStop(0.48, 'rgba(255,68,20,.8)');
      glow.addColorStop(1, 'rgba(80,9,2,0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();

      for (let index = 0; index < 34 * strength; index += 1) {
        const angle = index * 2.399;
        const distance = (18 + (index % 13) * 8) * eased;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance - progress * progress * 30;
        context.fillStyle = index % 3 ? `rgba(255,112,35,${1 - progress})` : `rgba(230,255,238,${1 - progress})`;
        context.fillRect(px, py, index % 4 + 1, index % 4 + 1);
      }

      context.fillStyle = `rgba(18,20,18,${Math.min(0.72, progress * 0.75)})`;
      for (let index = 0; index < 9 * strength; index += 1) {
        const smokeX = x + Math.sin(index * 1.8) * radius * 0.55;
        const smokeY = y - progress * height * (0.1 + index * 0.006);
        context.beginPath();
        context.arc(smokeX, smokeY, radius * (0.18 + (index % 4) * 0.07), 0, Math.PI * 2);
        context.fill();
      }
    }

    drawFlameDiagonalScene(context, sourceImage, width, height, elapsed, normalized, impactProgress, enemy) {
      this.drawSea(context, width, height, elapsed, enemy);
      const scene = this.getSceneLayout(width, height, enemy);
      const direction = enemy ? -1 : 1;
      const sourceX = scene.sourceX;
      const sourceY = scene.sourceY;
      const targetX = scene.portrait ? width * (enemy ? 0.25 : 0.75) : scene.targetX;
      const targetY = scene.targetY;
      const flight = Math.min(1, normalized / 0.66);
      this.drawShip(context, sourceImage, sourceX, sourceY, width * (scene.portrait ? 0.7 : 0.5), enemy, Math.max(0.25, 1 - normalized * 0.5));

      context.save();
      context.globalCompositeOperation = 'lighter';
      for (let index = 0; index < 3; index += 1) {
        const diagonalOffset = (index - 1) * Math.min(width, height) * 0.11;
        const startX = sourceX + direction * width * 0.05;
        const startY = sourceY - height * 0.06;
        const endX = targetX + direction * diagonalOffset * 0.38;
        const endY = targetY + diagonalOffset;
        const progress = Math.max(0, Math.min(1, flight * 1.16 - index * 0.08));
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress - Math.sin(progress * Math.PI) * height * 0.12;
        context.strokeStyle = `rgba(255,112,28,${0.18 + progress * 0.56})`;
        context.lineWidth = Math.max(2, width * 0.0035);
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo((startX + endX) / 2, Math.min(startY, endY) - height * 0.2, x, y);
        context.stroke();
        const glow = context.createRadialGradient(x, y, 0, x, y, Math.max(8, width * 0.025));
        glow.addColorStop(0, 'rgba(255,255,214,.98)');
        glow.addColorStop(0.24, 'rgba(255,186,48,.94)');
        glow.addColorStop(0.62, 'rgba(255,60,12,.58)');
        glow.addColorStop(1, 'rgba(255,35,4,0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, Math.max(8, width * 0.025), 0, Math.PI * 2);
        context.fill();
        if (impactProgress > 0) {
          const radius = Math.min(width, height) * (0.04 + impactProgress * 0.11);
          const blast = context.createRadialGradient(endX, endY, 0, endX, endY, radius);
          blast.addColorStop(0, `rgba(255,255,220,${1 - impactProgress * 0.4})`);
          blast.addColorStop(0.25, `rgba(255,155,35,${0.95 - impactProgress * 0.5})`);
          blast.addColorStop(1, 'rgba(255,36,8,0)');
          context.fillStyle = blast;
          context.beginPath();
          context.arc(endX, endY, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();
      this.drawHud(context, width, height, elapsed, enemy);
    }

    drawScanShotScene(context, sourceImage, width, height, elapsed, normalized, impactProgress, enemy, result) {
      const scene = this.getSceneLayout(width, height, enemy);
      const centerX = scene.portrait ? width * (enemy ? 0.32 : 0.68) : scene.targetX;
      const centerY = scene.targetY;
      const gridSize = Math.min(width * (scene.portrait ? 0.48 : 0.34), height * 0.42, 390);
      const cellSize = gridSize / 3;
      this.drawSea(context, width, height, elapsed, enemy);
      this.drawShip(context, sourceImage, scene.sourceX, scene.sourceY, width * (scene.portrait ? 0.62 : 0.43), enemy, Math.max(0.2, 1 - normalized * 0.65));

      context.save();
      context.translate(centerX - gridSize / 2, centerY - gridSize / 2);
      context.fillStyle = 'rgba(1,20,19,.72)';
      context.fillRect(0, 0, gridSize, gridSize);
      context.strokeStyle = 'rgba(81,255,188,.7)';
      context.lineWidth = 1;
      for (let index = 0; index <= 3; index += 1) {
        context.beginPath();
        context.moveTo(index * cellSize, 0);
        context.lineTo(index * cellSize, gridSize);
        context.moveTo(0, index * cellSize);
        context.lineTo(gridSize, index * cellSize);
        context.stroke();
      }
      const sweepAngle = elapsed * 0.0036;
      context.translate(gridSize / 2, gridSize / 2);
      context.rotate(sweepAngle);
      const sweep = context.createLinearGradient(0, 0, gridSize * 0.5, 0);
      sweep.addColorStop(0, 'rgba(91,255,202,.02)');
      sweep.addColorStop(1, 'rgba(91,255,202,.62)');
      context.fillStyle = sweep;
      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, gridSize * 0.5, -0.28, 0.28);
      context.closePath();
      context.fill();
      context.restore();

      const flight = Math.min(1, normalized / 0.65);
      const projectileX = scene.sourceX + (centerX - scene.sourceX) * flight;
      const projectileY = scene.sourceY + (centerY - scene.sourceY) * flight - Math.sin(flight * Math.PI) * height * 0.1;
      context.save();
      context.globalCompositeOperation = 'lighter';
      const probeGlow = context.createRadialGradient(projectileX, projectileY, 0, projectileX, projectileY, Math.max(10, width * 0.022));
      probeGlow.addColorStop(0, 'rgba(230,255,248,1)');
      probeGlow.addColorStop(0.3, 'rgba(70,255,210,.9)');
      probeGlow.addColorStop(1, 'rgba(25,220,255,0)');
      context.fillStyle = probeGlow;
      context.beginPath();
      context.arc(projectileX, projectileY, Math.max(10, width * 0.022), 0, Math.PI * 2);
      context.fill();
      if (impactProgress > 0) {
        for (let ring = 1; ring <= 4; ring += 1) {
          context.strokeStyle = `rgba(${ring % 2 ? '70,255,205' : '255,195,76'},${Math.max(0, 0.82 - impactProgress * 0.62)})`;
          context.lineWidth = 2;
          context.beginPath();
          context.arc(centerX, centerY, impactProgress * gridSize * 0.18 * ring, 0, Math.PI * 2);
          context.stroke();
        }
      }
      context.restore();

      if (normalized > 0.66) {
        const contacts = Number(result?.contactsMarked) || 0;
        const water = Number(result?.waterMarked) || 0;
        context.save();
        context.textAlign = 'center';
        context.font = `700 ${Math.max(12, Math.min(width, height) * 0.026)}px monospace`;
        context.fillStyle = '#ffd273';
        context.fillText(`CONTACTS // ${contacts}`, centerX, centerY + gridSize * 0.68);
        context.fillStyle = '#79ffd1';
        context.fillText(`WATER // ${water}`, centerX, centerY + gridSize * 0.68 + Math.max(18, height * 0.035));
        context.restore();
      }
      this.drawHud(context, width, height, elapsed, enemy);
    }

    drawJetLaunchScene(context, sourceImage, width, height, elapsed, normalized, impactProgress, enemy) {
      const scene = this.getSceneLayout(width, height, enemy);
      this.drawSea(context, width, height, elapsed, enemy);
      const deckX = scene.portrait ? width * 0.5 : scene.sourceX;
      const deckY = height * 0.68;
      this.drawShip(context, sourceImage, deckX, deckY, width * (scene.portrait ? 0.88 : 0.58), enemy, 0.95);

      const flight = Math.min(1, Math.max(0, (normalized - 0.08) / 0.72));
      const direction = enemy ? -1 : 1;
      const startX = deckX - direction * width * 0.04;
      const endX = deckX + direction * width * (scene.portrait ? 0.56 : 0.46);
      const startY = deckY - height * 0.05;
      const endY = height * 0.22;
      const jetX = startX + (endX - startX) * flight;
      const jetY = startY + (endY - startY) * flight - Math.sin(flight * Math.PI) * height * 0.12;
      const angle = Math.atan2(endY - startY, endX - startX);

      context.save();
      context.globalCompositeOperation = 'lighter';
      const trail = context.createLinearGradient(startX, startY, jetX, jetY);
      trail.addColorStop(0, 'rgba(44,255,175,0)');
      trail.addColorStop(1, 'rgba(100,255,212,.9)');
      context.strokeStyle = trail;
      context.lineWidth = Math.max(2, width * 0.004);
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(jetX, jetY);
      context.stroke();
      context.translate(jetX, jetY);
      context.rotate(angle);
      const jetSize = Math.max(18, Math.min(width, height) * 0.055);
      context.shadowColor = '#55ffd0';
      context.shadowBlur = 24;
      context.fillStyle = '#d8fff2';
      context.beginPath();
      context.moveTo(jetSize, 0);
      context.lineTo(-jetSize * 0.55, -jetSize * 0.18);
      context.lineTo(-jetSize * 0.15, -jetSize * 0.62);
      context.lineTo(-jetSize * 0.7, -jetSize * 0.54);
      context.lineTo(-jetSize, 0);
      context.lineTo(-jetSize * 0.7, jetSize * 0.54);
      context.lineTo(-jetSize * 0.15, jetSize * 0.62);
      context.lineTo(-jetSize * 0.55, jetSize * 0.18);
      context.closePath();
      context.fill();
      context.restore();

      if (impactProgress > 0) {
        context.save();
        context.strokeStyle = `rgba(80,255,192,${Math.max(0, 1 - impactProgress * 0.65)})`;
        context.lineWidth = 2;
        const centerX = width * 0.5;
        const centerY = height * 0.38;
        for (let ring = 1; ring <= 4; ring += 1) {
          context.beginPath();
          context.arc(centerX, centerY, impactProgress * ring * Math.min(width, height) * 0.12, 0, Math.PI * 2);
          context.stroke();
        }
        context.restore();
      }
      this.drawHud(context, width, height, elapsed, enemy);
    }

    drawSignalJammerScene(context, width, height, elapsed, normalized, impactProgress, enemy) {
      const gradient = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
      gradient.addColorStop(0, enemy ? '#30110d' : '#06352b');
      gradient.addColorStop(0.5, '#031413');
      gradient.addColorStop(1, '#010405');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      const spacing = Math.max(28, Math.min(width, height) * 0.075);
      context.save();
      context.strokeStyle = enemy ? 'rgba(255,88,57,.22)' : 'rgba(77,255,190,.24)';
      for (let x = (elapsed * 0.03) % spacing; x < width; x += spacing) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      }
      for (let y = 0; y < height; y += spacing) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      for (let ring = 1; ring <= 5; ring += 1) {
        const radius = ((normalized * 1.8 + ring / 5) % 1) * Math.min(width, height) * 0.48;
        context.strokeStyle = `rgba(${enemy ? '255,92,62' : '72,255,188'},${0.75 - radius / Math.min(width, height)})`;
        context.lineWidth = 2;
        context.beginPath(); context.arc(centerX, centerY, radius, 0, Math.PI * 2); context.stroke();
      }
      context.font = `800 ${Math.max(42, Math.min(width, height) * 0.16)}px monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = enemy ? '#ff6547' : '#5cffbe';
      context.shadowColor = context.fillStyle;
      context.shadowBlur = 28;
      context.fillText('ECM', centerX + Math.sin(elapsed * 0.09) * 5, centerY);
      if (impactProgress > 0) {
        context.font = `700 ${Math.max(14, Math.min(width, height) * 0.035)}px monospace`;
        context.fillText('ABILITY CHANNELS // LOCKED', centerX, centerY + Math.min(width, height) * 0.16);
      }
      context.globalAlpha = 0.16;
      for (let band = 0; band < 9; band += 1) {
        const y = (elapsed * (0.09 + band * 0.012) + band * 73) % height;
        context.fillRect(0, y, width, 2 + (band % 3));
      }
      context.restore();
      this.drawHud(context, width, height, elapsed, enemy);
    }

    drawHud(context, width, height, elapsed, enemy) {
      const scene = this.getSceneLayout(width, height, enemy);
      context.save();
      context.strokeStyle = enemy ? 'rgba(255,74,48,.21)' : 'rgba(65,255,121,.2)';
      context.lineWidth = 1;
      const centerX = scene.targetX;
      const centerY = scene.portrait ? scene.targetY : height * 0.55;
      const pulse = (scene.portrait ? 43 : 34) + Math.sin(elapsed * 0.008) * 5;
      context.strokeRect(centerX - pulse, centerY - pulse, pulse * 2, pulse * 2);
      context.beginPath();
      context.moveTo(centerX - pulse - 22, centerY);
      context.lineTo(centerX + pulse + 22, centerY);
      context.moveTo(centerX, centerY - pulse - 22);
      context.lineTo(centerX, centerY + pulse + 22);
      context.stroke();
      context.globalAlpha = 0.08;
      for (let y = 0; y < height; y += 4) context.fillRect(0, y, width, 1);
      context.restore();
    }

    async play(options) {
      const sequence = ++this.sequence;
      cancelAnimationFrame(this.animationFrame);
      const results = options.results || [];
      const kind = this.getResultKind(results);
      const rangeResult = results.find((result) => result.type === 'range-result');
      const scanShotResult = results.find((result) => result.type === 'scan-shot-result');
      const attacker = options.attacker;
      const enemy = attacker === 'enemy';
      const preset = this.registry.get(options.animationId);
      const coordinates = options.coordinates || [];
      const coordinateText = coordinates.length > 1 ? `${coordinates[0]} +${coordinates.length - 1}` : coordinates[0] || '—';
      const reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reducedMotion ? preset.reducedDuration : preset.duration;
      const projectileCount = this.registry.resolveProjectileCount(preset, results.length);
      const [sourceImage, targetImage] = await Promise.all([
        this.loadImage(options.sourceShip?.asset),
        this.loadImage(enemy || ['repair', 'chemical', 'nuclear', 'submerge', 'sacrifice', 'procurement'].includes(preset.scene) ? options.targetShip?.asset : null),
      ]);

      this.element.hidden = false;
      this.element.className = `shot-cinematic ${enemy ? 'enemy-attack' : 'friendly-attack'} ${kind} animation-${preset.id}`;
      this.element.dataset.animationId = preset.id;
      this.element.setAttribute('aria-hidden', 'false');
      const sceneLabels = {
        scanner: 'ORACLE SONAR NETWORK',
        repair: 'ARES DAMAGE CONTROL',
        chemical: 'VIPER HAZMAT CONTROL',
        mine: 'SILENT DEFENSE NETWORK',
        relocation: 'TITAN PHASE CONTROL',
        nuclear: 'STRATEGIC WEAPONS COMMAND',
        rangefinder: 'VECTOR RANGING NETWORK',
        barrage: 'BERSERKER FIRE CONTROL',
        'torpedo-row': 'ABYSS TORPEDO COMMAND',
        submerge: 'ABYSS DIVE CONTROL',
        sacrifice: 'LEDGER CONVERSION CONTROL',
        procurement: 'LEDGER TACTICAL DRYDOCK',
        'hydrogen-field': 'PROMETHEUS FUSION COMMAND',
        'last-revenge': 'PROMETHEUS TERMINAL CONTROL',
        'flame-diagonal': 'IGNIS THERMAL FIRE CONTROL',
        'scan-shot': 'IGNIS ACTIVE PROBE NETWORK',
        'jet-launch': 'RAPTOR FLIGHT CONTROL',
        'signal-jammer': 'RAPTOR ELECTRONIC WARFARE',
      };
      this.sideElement.textContent = sceneLabels[preset.scene] || (enemy ? 'ENEMY WEAPON LAUNCH DETECTED' : 'FIRE CONTROL ACTIVE');
      const defaultOrder = enemy && preset.id === 'standard-missile' ? 'INCOMING MISSILE' : preset.orderLabel;
      this.orderElement.textContent = this.registry.formatLabel(defaultOrder, {
        count: projectileCount,
        abilityName: options.ability?.name,
        target: coordinateText,
      });
      const coordinateLabels = { scanner: 'SECTOR', repair: 'HULL', chemical: 'VECTOR', mine: 'ANCHOR', relocation: 'DESTINATION', nuclear: 'GROUND ZERO', rangefinder: 'MEASURE POINT', barrage: 'RANDOMIZED GRID', 'torpedo-row': 'HORIZONTAL ROW', submerge: 'PROTECTED VESSEL', sacrifice: 'CONVERSION TARGET', procurement: 'DEPLOYMENT ANCHOR', 'hydrogen-field': '4×4 SECTOR', 'last-revenge': 'SALVO STATUS', 'jet-launch': 'ENCRYPTED ROUTE', 'signal-jammer': 'HOSTILE SPECTRUM' };
      this.coordinateElement.textContent = `${coordinateLabels[preset.scene] || 'TARGET'}: ${coordinateText}`;
      this.resultElement.textContent = '';
      const rangeLabels = { scanner: 'ARRAY // SYNCHRONIZING', repair: 'DRONES // DEPLOYING', chemical: 'AGENT // SEALED', mine: 'FUSE // SAFE', relocation: 'MATRIX // LOCKED', nuclear: 'WARHEAD // ARMED', rangefinder: 'SOLUTION // PENDING', barrage: 'TARGETS // RANDOMIZED', 'torpedo-row': 'DEPTH // 040 M', submerge: 'BALLAST // FLOODING', sacrifice: 'ENERGY // CONVERTING', procurement: 'ASSEMBLY // QUEUED', 'hydrogen-field': 'FUSION CORE // ARMED', 'last-revenge': 'CHANNELS // 00/15', 'jet-launch': 'CATAPULT // PRESSURIZED', 'signal-jammer': 'ECM // CHARGING' };
      this.rangeElement.textContent = rangeLabels[preset.scene] || 'RANGE // 12.4 NM';
      requestAnimationFrame(() => this.element.classList.add('active'));

      if (preset.scene === 'scanner') this.audio?.sonar();
      else if (preset.scene === 'repair') this.audio?.tone(420, 0.18, { type: 'sine', volume: 0.09, endFrequency: 760 });
      else if (preset.scene === 'chemical') this.audio?.tone(310, 0.2, { type: 'sawtooth', volume: 0.08, endFrequency: 540 });
      else if (preset.scene === 'mine') this.audio?.tone(180, 0.24, { type: 'sine', volume: 0.09, endFrequency: 110 });
      else if (preset.scene === 'relocation') this.audio?.tone(260, 0.28, { type: 'sine', volume: 0.09, endFrequency: 980 });
      else if (preset.scene === 'nuclear') this.audio?.warning();
      else if (preset.scene === 'rangefinder') this.audio?.sonar();
      else if (preset.scene === 'barrage') this.audio?.warning();
      else if (preset.scene === 'torpedo-row') this.audio?.tone(130, 0.3, { type: 'sine', volume: 0.09, endFrequency: 72 });
      else if (preset.scene === 'submerge') this.audio?.sonar();
      else if (preset.scene === 'sacrifice') this.audio?.warning();
      else if (preset.scene === 'procurement') this.audio?.tone(360, 0.24, { type: 'square', volume: 0.07, endFrequency: 720 });
      else if (preset.scene === 'hydrogen-field') this.audio?.warning();
      else if (preset.scene === 'last-revenge') this.audio?.warning();
      else if (preset.scene === 'flame-diagonal') this.audio?.warning();
      else if (preset.scene === 'scan-shot') this.audio?.sonar();
      else if (preset.scene === 'jet-launch') this.audio?.tone(190, 0.35, { type: 'sawtooth', volume: 0.09, endFrequency: 980 });
      else if (preset.scene === 'signal-jammer') this.audio?.tone(820, 0.25, { type: 'square', volume: 0.07, endFrequency: 110 });
      else if (enemy) this.audio?.warning();
      else this.audio?.tone(690, 0.12, { type: 'square', volume: 0.1, endFrequency: 510 });

      return new Promise((resolve) => {
        const started = performance.now();
        let launchPlayed = false;
        let impactPlayed = false;
        let currentPhase = '';

        const frame = (now) => {
          if (sequence !== this.sequence) return resolve();
          const elapsed = now - started;
          const normalized = Math.min(1, elapsed / duration);
          const launchEnd = preset.launchEnd;
          const impactStart = preset.impactStart;
          const dimensions = this.resize();
          const { width, height } = dimensions;
          const context = this.context;
          context.clearRect(0, 0, width, height);

          const impactProgress = Math.max(0, (normalized - impactStart) / (1 - impactStart));
          const specialScene = ['scanner', 'repair', 'chemical', 'mine', 'relocation', 'nuclear', 'rangefinder', 'barrage', 'torpedo-row', 'submerge', 'sacrifice', 'procurement', 'hydrogen-field', 'last-revenge', 'flame-diagonal', 'scan-shot', 'jet-launch', 'signal-jammer'].includes(preset.scene);
          const shake = !specialScene && impactProgress > 0 && impactProgress < 0.45
            ? Math.sin(elapsed * 0.095) * (kind === 'miss' ? 2.5 : kind === 'sunk' ? 10 : 6) * preset.cameraShake * (1 - impactProgress)
            : 0;
          context.save();
          context.translate(shake, -shake * 0.4);
          const missileProgress = Math.min(1, Math.max(0, normalized / impactStart));
          if (preset.scene === 'scanner') {
            this.drawScannerScene(context, width, height, elapsed, normalized, impactProgress, kind === 'scan-found');
          } else if (preset.scene === 'repair') {
            this.drawRepairScene(context, targetImage || sourceImage, width, height, elapsed, normalized, impactProgress);
          } else if (preset.scene === 'chemical') {
            this.drawChemicalScene(context, targetImage, width, height, elapsed, normalized, impactProgress, kind === 'chemical-reveal');
          } else if (preset.scene === 'mine') {
            this.drawMineScene(context, width, height, elapsed, normalized, impactProgress);
          } else if (preset.scene === 'relocation') {
            this.drawRelocationScene(context, sourceImage, width, height, elapsed, normalized, impactProgress);
          } else if (preset.scene === 'nuclear') {
            this.drawNuclearScene(context, targetImage, width, height, elapsed, normalized, impactProgress, kind === 'nuclear-hit');
          } else if (preset.scene === 'rangefinder') {
            this.drawRangefinderScene(context, width, height, elapsed, normalized, impactProgress, rangeResult?.distance ?? null, rangeResult?.shotType !== 'miss');
          } else if (preset.scene === 'barrage') {
            this.drawBarrageScene(context, width, height, elapsed, normalized, impactProgress, results);
          } else if (preset.scene === 'torpedo-row') {
            this.drawTorpedoRowScene(context, width, height, elapsed, normalized, impactProgress, results);
          } else if (preset.scene === 'submerge') {
            this.drawSubmergeScene(context, targetImage || sourceImage, width, height, elapsed, normalized, impactProgress, kind === 'blocked');
          } else if (preset.scene === 'sacrifice') {
            this.drawSacrificeScene(context, targetImage || sourceImage, width, height, elapsed, normalized, impactProgress);
          } else if (preset.scene === 'procurement') {
            this.drawProcurementScene(context, targetImage || sourceImage, width, height, elapsed, normalized, impactProgress);
          } else if (preset.scene === 'hydrogen-field') {
            this.drawHydrogenFieldScene(context, width, height, elapsed, normalized, impactProgress);
          } else if (preset.scene === 'last-revenge') {
            this.drawLastRevengeScene(context, width, height, elapsed, normalized, impactProgress);
          } else if (preset.scene === 'flame-diagonal') {
            this.drawFlameDiagonalScene(context, sourceImage, width, height, elapsed, normalized, impactProgress, enemy);
          } else if (preset.scene === 'scan-shot') {
            this.drawScanShotScene(context, sourceImage, width, height, elapsed, normalized, impactProgress, enemy, scanShotResult);
          } else if (preset.scene === 'jet-launch') {
            this.drawJetLaunchScene(context, sourceImage, width, height, elapsed, normalized, impactProgress, enemy);
          } else if (preset.scene === 'signal-jammer') {
            this.drawSignalJammerScene(context, width, height, elapsed, normalized, impactProgress, enemy);
          } else {
            this.drawSea(context, width, height, elapsed, enemy);
            const scene = this.getSceneLayout(width, height, enemy);
            const sourceAlpha = normalized < 0.54 ? 1 : Math.max(0, 1 - (normalized - 0.54) * 3.4);
            this.drawShip(context, sourceImage, scene.sourceX, scene.sourceY, width * (scene.portrait ? 0.78 : 0.56), enemy, sourceAlpha);
            if (enemy && kind !== 'miss' && normalized > 0.46) {
              const targetAlpha = Math.min(1, (normalized - 0.46) * 5);
              const targetShipY = scene.portrait ? scene.targetY + height * 0.035 : height * 0.59;
              this.drawShip(context, targetImage, scene.targetX, targetShipY, width * (scene.portrait ? 0.66 : 0.42), !enemy, targetAlpha, impactProgress > 0.1);
            }
            if (normalized > 0.08 && normalized < impactStart + 0.025) {
              this.drawMissiles(context, width, height, missileProgress, projectileCount, enemy, preset);
            }
            const impactStrength = kind === 'sunk' ? preset.sunkImpactStrength : preset.impactStrength;
            if (impactProgress > 0) this.drawImpact(context, width, height, impactProgress, kind, impactStrength, enemy);
            this.drawHud(context, width, height, elapsed, enemy);
          }
          context.restore();

          let phase = preset.phases.launch;
          if (normalized >= launchEnd && normalized < impactStart) phase = preset.phases.flight;
          if (normalized >= impactStart) phase = ['miss', 'scan-clear', 'chemical-miss', 'nuclear-miss', 'blocked'].includes(kind) ? preset.phases.miss : preset.phases.impact;
          if (phase !== currentPhase) {
            currentPhase = phase;
            this.phaseElement.textContent = phase;
          }
          if (normalized >= launchEnd) {
            if (preset.scene === 'scanner') this.rangeElement.textContent = `SCAN // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'repair') this.rangeElement.textContent = `HULL // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'chemical') this.rangeElement.textContent = `AGENT // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'mine') this.rangeElement.textContent = `ARMING // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'relocation') this.rangeElement.textContent = `TRANSFER // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'nuclear') this.rangeElement.textContent = `DESCENT // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'rangefinder') this.rangeElement.textContent = normalized >= impactStart
              ? (rangeResult?.distance === null ? 'DISTANCE // NO CONTACTS' : `DISTANCE // ${rangeResult?.distance ?? '—'} GRID`)
              : `TRIANGULATION // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'barrage') this.rangeElement.textContent = `SALVO // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'torpedo-row') this.rangeElement.textContent = `TORPEDO RUN // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'submerge') this.rangeElement.textContent = kind === 'blocked' && normalized >= impactStart
              ? 'SHIELD // IMPACT ABSORBED'
              : `DIVE // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'sacrifice') this.rangeElement.textContent = normalized >= impactStart
              ? 'SALVO CREDIT // 5 SHOTS'
              : `CONVERSION // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'procurement') this.rangeElement.textContent = `ASSEMBLY // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'hydrogen-field') this.rangeElement.textContent = `FUSION CASCADE // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'last-revenge') this.rangeElement.textContent = `CHANNELS // ${Math.min(15, Math.floor(normalized * 20)).toString().padStart(2, '0')}/15`;
            else if (preset.scene === 'flame-diagonal') this.rangeElement.textContent = `THERMAL VECTOR // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'scan-shot') this.rangeElement.textContent = normalized >= impactStart
              ? `CONTACTS // ${scanShotResult?.contactsMarked || 0} // WATER ${scanShotResult?.waterMarked || 0}`
              : `PROBE LINK // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else if (preset.scene === 'jet-launch') this.rangeElement.textContent = normalized >= impactStart
              ? 'RAPTOR // HIDDEN CONTACT ACTIVE'
              : `AIR SPEED // ${Math.round(normalized * 980).toString().padStart(3, '0')} KT`;
            else if (preset.scene === 'signal-jammer') this.rangeElement.textContent = normalized >= impactStart
              ? 'HOSTILE ABILITIES // LOCKED'
              : `SPECTRUM DENIAL // ${Math.round(normalized * 100).toString().padStart(3, '0')}%`;
            else {
              const remaining = Math.max(0, Math.round((1 - missileProgress) * 124));
              this.rangeElement.textContent = `RANGE // ${remaining.toString().padStart(3, '0')}00 M`;
            }
          }
          if (normalized >= impactStart) this.resultElement.textContent = this.getResultMessage(attacker, kind, preset);

          if (!launchPlayed && normalized >= 0.09) {
            launchPlayed = true;
            if (preset.scene === 'scanner') this.audio?.sonar();
            else if (preset.scene === 'repair') this.audio?.tone(560, 0.14, { type: 'sine', volume: 0.08, endFrequency: 920 });
            else if (preset.scene === 'chemical') this.audio?.tone(460, 0.18, { type: 'sawtooth', volume: 0.08, endFrequency: 720 });
            else if (preset.scene === 'mine') this.audio?.tone(150, 0.16, { type: 'square', volume: 0.07, endFrequency: 90 });
            else if (preset.scene === 'relocation') this.audio?.tone(440, 0.22, { type: 'sine', volume: 0.08, endFrequency: 1180 });
            else if (preset.scene === 'nuclear') this.audio?.tone(120, 0.3, { type: 'sawtooth', volume: 0.1, endFrequency: 58 });
            else if (preset.scene === 'rangefinder') this.audio?.tone(520, 0.2, { type: 'sine', volume: 0.08, endFrequency: 980 });
            else if (preset.scene === 'barrage') this.audio?.shot();
            else if (preset.scene === 'torpedo-row') this.audio?.tone(190, 0.26, { type: 'sine', volume: 0.1, endFrequency: 88 });
            else if (preset.scene === 'submerge') this.audio?.tone(280, 0.24, { type: 'sine', volume: 0.08, endFrequency: 92 });
            else if (preset.scene === 'sacrifice') this.audio?.tone(180, 0.28, { type: 'sawtooth', volume: 0.08, endFrequency: 64 });
            else if (preset.scene === 'procurement') this.audio?.tone(440, 0.25, { type: 'square', volume: 0.07, endFrequency: 880 });
            else if (preset.scene === 'hydrogen-field') this.audio?.tone(96, 0.34, { type: 'sawtooth', volume: 0.1, endFrequency: 48 });
            else if (preset.scene === 'last-revenge') this.audio?.tone(210, 0.3, { type: 'square', volume: 0.09, endFrequency: 680 });
            else if (preset.scene === 'flame-diagonal') this.audio?.shot();
            else if (preset.scene === 'scan-shot') this.audio?.tone(620, 0.2, { type: 'sine', volume: 0.08, endFrequency: 1120 });
            else if (preset.scene === 'jet-launch') this.audio?.tone(260, 0.3, { type: 'sawtooth', volume: 0.09, endFrequency: 1320 });
            else if (preset.scene === 'signal-jammer') this.audio?.tone(1180, 0.24, { type: 'square', volume: 0.08, endFrequency: 90 });
            else this.audio?.shot();
          }
          if (!impactPlayed && normalized >= impactStart) {
            impactPlayed = true;
            if (preset.scene === 'scanner') {
              this.audio?.sonar();
              if (kind === 'scan-found') this.audio?.warning();
            } else if (preset.scene === 'repair') {
              this.audio?.tone(740, 0.3, { type: 'sine', volume: 0.1, endFrequency: 1180 });
            } else if (preset.scene === 'chemical') {
              this.audio?.tone(260, 0.38, { type: 'sawtooth', volume: 0.08, endFrequency: 80 });
              if (kind === 'chemical-reveal') this.audio?.sonar();
            } else if (preset.scene === 'mine') {
              this.audio?.tone(520, 0.24, { type: 'square', volume: 0.08, endFrequency: 880 });
            } else if (preset.scene === 'relocation') {
              this.audio?.tone(820, 0.35, { type: 'sine', volume: 0.1, endFrequency: 1480 });
            } else if (preset.scene === 'nuclear') {
              this.audio?.explosion();
              this.audio?.warning();
            } else if (preset.scene === 'rangefinder') {
              this.audio?.sonar();
              this.audio?.tone(880, 0.24, { type: 'sine', volume: 0.08, endFrequency: 1180 });
            } else if (preset.scene === 'barrage') {
              this.audio?.explosion();
              this.audio?.warning();
            } else if (preset.scene === 'torpedo-row') {
              if (kind === 'miss') this.audio?.splash();
              else this.audio?.explosion();
            } else if (preset.scene === 'submerge') {
              this.audio?.sonar();
              this.audio?.tone(kind === 'blocked' ? 940 : 620, 0.32, { type: 'sine', volume: 0.1, endFrequency: kind === 'blocked' ? 320 : 980 });
            } else if (preset.scene === 'sacrifice') {
              this.audio?.explosion();
              this.audio?.tone(740, 0.32, { type: 'square', volume: 0.08, endFrequency: 1120 });
            } else if (preset.scene === 'procurement') {
              this.audio?.sonar();
              this.audio?.tone(660, 0.35, { type: 'sine', volume: 0.09, endFrequency: 1280 });
            } else if (preset.scene === 'hydrogen-field') {
              this.audio?.explosion();
              this.audio?.warning();
            } else if (preset.scene === 'last-revenge') {
              this.audio?.warning();
              this.audio?.tone(780, 0.38, { type: 'square', volume: 0.1, endFrequency: 1260 });
            } else if (preset.scene === 'flame-diagonal') {
              this.audio?.explosion();
              this.audio?.tone(118, 0.35, { type: 'sawtooth', volume: 0.1, endFrequency: 54 });
            } else if (preset.scene === 'scan-shot') {
              this.audio?.sonar();
              this.audio?.tone(860, 0.24, { type: 'sine', volume: 0.08, endFrequency: 1280 });
            } else if (preset.scene === 'jet-launch') {
              this.audio?.tone(760, 0.34, { type: 'sawtooth', volume: 0.09, endFrequency: 1540 });
              this.audio?.sonar();
            } else if (preset.scene === 'signal-jammer') {
              this.audio?.warning();
              this.audio?.tone(140, 0.38, { type: 'square', volume: 0.09, endFrequency: 72 });
            } else if (kind === 'miss') this.audio?.splash();
            else {
              this.audio?.explosion();
              if (enemy) this.audio?.warning();
            }
          }

          if (normalized < 1) {
            this.animationFrame = requestAnimationFrame(frame);
            return;
          }
          this.element.classList.remove('active');
          root.setTimeout(() => {
            if (sequence === this.sequence) {
              this.element.hidden = true;
              this.element.setAttribute('aria-hidden', 'true');
              this.resultElement.textContent = '';
            }
            resolve();
          }, reducedMotion ? 80 : 260);
        };
        this.animationFrame = requestAnimationFrame(frame);
      });
    }
  }

  root.NavalGame.ShotCinematic = ShotCinematic;
})(typeof window !== 'undefined' ? window : globalThis);
