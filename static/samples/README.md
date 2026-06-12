# static/samples — committed sample assets (license-cleared only)

Unlike `static/irs/` and `static/nam/` (gitignored pending licensing), everything in
this directory is **license-cleared for redistribution and committed to git**. Each
asset set below records its provenance and license. Only add assets here whose
license verifiably permits redistribution in an AGPL-3.0 plugin repo.

## Shinyguitar derived subset (`sg_*.ogg`) — CC0 1.0

A slimmed, derived subset of **Shinyguitar** by Karoryfer Samples (sampling and
mapping by D. Smolken), obtained from the open-source mirror
`github.com/sfzinstruments/karoryfer.shinyguitar`. The library is licensed
**CC0 1.0 Universal** (public-domain dedication — the repo's LICENSE file; the
readme adds "you can do whatever you want with it"). This subset is a processed
derivative: the **electric direct-input (DI) pickup signal** only, transcoded to
OGG Vorbis (q3, mono 44.1k) with sustains trimmed to 4.5 s (0.4 s fade-out).

| Files | Source articulation | Layers kept |
|---|---|---|
| `sg_sus_<midi>_vl<2\|3>_rr<1\|2>.ogg` (68) | pitched sustains, 17 keycenters MIDI 37–84 (minor-3rd spacing) | velocity layers vl2 (mid-soft) + vl3 (mid-hard) of 4; round-robins 1–2 of 4 |
| `sg_chuck_<1-4>_rr<1\|2>.ogg` (8) | strummed dead-string mutes (multi-string chucks) | RR 1–2 of 5 |
| `sg_mutestr_<1-6>_rr<1\|2>.ogg` (12) | per-string dead mutes (string 1 = low) | RR 1–2 of 5 |

Source SFZ velocity splits: vl2 = 33–64, vl3 = 65–96 (of 127). Pitched palm-mutes
are realized at runtime by envelope-shortening the sustains (the same technique the
source library uses via its CC110 "mute" control), not by separate samples.
Dropped from the subset: the acoustic/microphone channel, vl1/vl4, rr3–rr5,
release noises, and body percussion.

Region table + player live in `screen.js` §14; served by the `/sample/{name}`
route in `routes.py`.
