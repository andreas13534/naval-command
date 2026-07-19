# Cyber Naval Individual Ships

This folder is the handoff location for individual ship assets.

- `grid-ready-128/`: use these directly in the game. Every canvas is exactly `gridWidth * 128` by `gridHeight * 128` pixels.
- `png/`: transparent high-resolution master PNG files.
- `chroma-sources/`: original magenta-background generation outputs.
- `manifest.json`: canonical IDs, filenames, and grid footprints.
- `preview-contact-sheet.png`: visual overview only; do not use as an in-game asset.
- `previous-versions/`: superseded carrier and fortress files from before the length-proportion adjustment.

All ships use strict top-down orientation with the stern on the left and bow on the right. Assets are RGBA PNGs. Runtime code should read `manifest.json` and use the files from `grid-ready-128/`.

Notable non-linear footprints:

- `square-catamaran`: 2x2
- `fork-ship`: 3x2
- `floating-fortress`: 7x2

The aircraft carrier is `5x1`.
