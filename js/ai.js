(function (root) {
  'use strict';

  class RandomTargetAI {
    constructor(random = Math.random) {
      this.random = random;
    }

    chooseTarget(board) {
      const available = board.unshotCells;
      if (!available.length) return null;
      return available[Math.floor(this.random() * available.length)];
    }

    reset() {
      // Erweiterungspunkt für zustandsbehaftete KI-Strategien.
    }
  }

  root.NavalGame.RandomTargetAI = RandomTargetAI;
})(typeof window !== 'undefined' ? window : globalThis);
