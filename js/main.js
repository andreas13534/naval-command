(function () {
  'use strict';

  if (window.NavalMobileLayout) window.NavalMobileLayout.sync();

  document.addEventListener('DOMContentLoaded', () => {
    const controller = new window.NavalGame.GameUI();
    controller.initialize();
    window.navalCommand = controller;
  });
})();
