# SlopScale Architecture

SlopScale is a Slopsmith plugin that generates practice material and feeds it into existing visualization infrastructure.

## Non-goals

SlopScale should not:

- fork Slopsmith
- duplicate the 3D Highway renderer
- become a separate rhythm game
- invent a second chart format for playback

## Primary contract

The core target is Slopsmith's renderer bundle shape:

```js
{
  currentTime,
  songInfo,
  isReady,
  notes,
  chords,
  anchors,
  beats,
  sections,
  chordTemplates,
  handShapes,
  stringCount,
  tuning,
  capo,
  inverted,
  lefty,
  renderScale,
  lyricsVisible,
  getNoteState,
  getNoteStateProvider
}
```

Practice generation should produce arrays that fit this contract. Renderers should remain replaceable.

## Initial renderer strategy

The first adapter tries to use `window.slopsmithViz_highway_3d`, the bundled 3D Highway renderer factory. SlopScale creates a local canvas inside its plugin screen, initializes the renderer factory, and calls `draw(bundle)` each animation frame with generated practice data.

This keeps the visual language aligned with Slopsmith while allowing SlopScale to run without loading a real song.

## Future renderer strategy

When Slopsmith exposes a stable 2D tab renderer factory, SlopScale should route to it using the same adapter pattern:

```js
const factory = window.slopsmithViz_tab_2d || window.slopsmithViz_highway_2d;
const renderer = factory();
renderer.init(canvas, bundle);
renderer.draw(bundle);
```

No practice generator changes should be necessary.

## Practice generation pipeline

1. Read UI/session config.
2. Resolve instrument, tuning, fret range, key, and scale.
3. Generate fretboard candidates.
4. Generate musical source material:
   - scale degrees
   - diatonic arpeggios
   - common chord progressions
   - chord-quality overrides
5. Quantize events to rhythm grid from BPM, meter, grouping, and subdivision.
6. Emit Slopsmith-compatible notes/chords/templates/handShapes/beats/anchors.
7. Pass a bundle to the selected renderer adapter.

## Song-aware mode direction

Later versions can read `window.slopsmith.currentSong`, active arrangement metadata, and song beats/sections from the existing highway instance when a song is loaded. Song-aware mode should still emit temporary practice-chart data rather than modifying the loaded song.
