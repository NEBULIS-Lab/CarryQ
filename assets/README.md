# README application preview

`carryq-application.gif` shows the project application's complete USB-C and
charger insertion sequence, including synchronized external and wrist views.
It uses the existing recorded MuJoCo poses and changes only the viewing camera.
This is the scripted task illustration presented on the project website.

- GIF: 860 × 531 pixels, 226 frames, looping; approximately 7 MB.
- `carryq-application.jpg`: static preview from the same sequence.
- Recording: `web/public/media/workcell.json.gz`.
- Exporter: `web/scripts/export-readme-preview.mjs` (8 frames per second).

The exporter accepts a running project-page URL and an output directory:

```sh
node web/scripts/export-readme-preview.mjs http://localhost:36832/CarryQ/ /tmp/carryq-preview 8
```

Encode the exported PNG frames with FFmpeg's `palettegen` and `paletteuse`
filters. The current GIF uses a 192-color palette and ordered dithering.
