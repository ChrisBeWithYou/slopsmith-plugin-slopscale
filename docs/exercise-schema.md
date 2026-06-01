# SlopScale Exercise Schema

This document describes SlopScale's internal generated exercise payload.

The payload is intentionally close to Sloppak/Slopsmith highway data so it can be passed into existing renderers.

## Top-level shape

```json
{
  "version": 1,
  "session": {
    "mode": "diatonic_arpeggios",
    "key": "C",
    "scale": "major",
    "bpm": 100,
    "meter": {
      "numerator": 4,
      "denominator": 4,
      "grouping": [4]
    },
    "subdivision": "eighth",
    "instrument": "guitar",
    "tuning": [0, 0, 0, 0, 0, 0],
    "position": {
      "fretMin": 0,
      "fretMax": 5
    }
  },
  "chart": {
    "notes": [],
    "chords": [],
    "chordTemplates": [],
    "handShapes": [],
    "beats": [],
    "anchors": [],
    "sections": []
  }
}
```

## Notes

Notes use Slopsmith's compact note fields:

```json
{
  "t": 0.0,
  "s": 0,
  "f": 3,
  "sus": 0.25,
  "sl": -1,
  "slu": -1,
  "bn": 0,
  "ho": false,
  "po": false,
  "hm": false,
  "hp": false,
  "pm": false,
  "mt": false,
  "vb": false,
  "tr": false,
  "ac": false,
  "tp": false
}
```

## Chord templates

Chord templates describe display names and fret shapes. Unused strings are `-1`.

```json
{
  "name": "Cmaj7",
  "displayName": "Cmaj7",
  "arp": true,
  "fingers": [-1, -1, -1, -1, -1, -1],
  "frets": [3, 3, 2, 0, 1, 0]
}
```

## Chords

A chord event references `chordTemplates[id]`.

```json
{
  "t": 0.0,
  "id": 0,
  "hd": false,
  "notes": [
    { "s": 0, "f": 3, "sus": 0 }
  ]
}
```

## Hand shapes

Arpeggio exercises should mark spans as `arp: true` so the existing 3D highway arpeggio framing can be reused.

```json
{
  "chord_id": 0,
  "start_time": 0.0,
  "end_time": 2.0,
  "arp": true
}
```

## Beats

Beats are generated from BPM, meter, and grouping. Measure starts use a non-negative `measure`; other beats use `-1`.

```json
[
  { "time": 0.0, "measure": 1 },
  { "time": 0.5, "measure": -1 }
]
```
