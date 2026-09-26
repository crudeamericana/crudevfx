# RIFT — Phase 2

RIFT is a local-first experimental short-form video editor. It is intentionally not a general-purpose NLE: projects are capped at 60 seconds, audio is discarded, and the workflow centers on fast cuts, destructive VFX stacks, adjustment layers, transitions, and parameter automation.

## Run locally

Open `index.html` in a modern Chromium-based browser, or serve this folder with any static file server:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Architecture

- `state.project` contains the format, FPS, dimensions, and duration cap.
- `state.tracks[].clips[]` is the media timeline model. Clips include transforms, source ranges, and transition slots.
- `clip.effects[]` and adjustment-layer `effects[]` are ordered standardized stacks. Each effect owns simple parameters and optional automation curves.
- `vfx-engine.js` contains the effect registry, deterministic automation evaluator, and Canvas processors for the complete Phase 2 library.
- Right-clicking any effect parameter creates an editable timeline lane. Points support hold, linear, ease, and Bezier interpolation plus copy/paste/reset.
- Composition is drawn through Canvas. Source video elements are explicitly muted and no audio tracks are created.
- Silent export uses `canvas.captureStream()` and `MediaRecorder`; source audio never enters the stream.
- Consecutive clips receive an automatic cross-dissolve. Transition boundaries retain manual type/duration choices, can be deleted to create a hard cut, and use the same compositor path for preview and export.
- Destructive transition modes include datamosh, frame smear, RGB glitch, pixel sorting, and feedback.
- `.rift.json` saves the local project structure for reopening and future media relinking.

New VFX can be added by registering a definition and processor without replacing the timeline, automation system, adjustment layers, or compositor.
