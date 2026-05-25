"""SlopScale plugin routes.

Routes provide preset persistence and temporary sloppak generation. The temp
sloppak path is intentionally not inserted into the library index; the frontend
passes the returned DLC-relative filename straight to Slopsmith's player.
"""

from __future__ import annotations

import importlib
import json
import os
import shutil
import tempfile
import time
import uuid
import wave
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

PLUGIN_ID = "slopscale"
SCHEMA_VERSION = 1
TEMP_ROOT_NAME = ".slopscale-temp"


class PresetPayload(BaseModel):
    id: str = Field(min_length=1, max_length=96)
    name: str = Field(min_length=1, max_length=160)
    kind: str = Field(default="exercise", max_length=64)
    config: dict[str, Any] = Field(default_factory=dict)


class TempSloppakPayload(BaseModel):
    exercise: dict[str, Any] = Field(default_factory=dict)


def _data_dir(context: dict) -> Path:
    root = Path(context["config_dir"]) / "plugin_data" / PLUGIN_ID
    root.mkdir(parents=True, exist_ok=True)
    return root


def _presets_path(context: dict) -> Path:
    return _data_dir(context) / "presets.json"


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Invalid SlopScale preset file: {exc}") from exc


def _atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    tmp_path = Path(tmp)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp_path, path)
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass


def _model_dump(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _get_dlc_dir_from_server(context: dict) -> Path | None:
    # Same process as server.py. Prefer the actual helper so desktop and Docker
    # both follow the user's active Slopsmith config.
    try:
        server = importlib.import_module("server")
        getter = getattr(server, "_get_dlc_dir", None)
        if callable(getter):
            value = getter()
            if value:
                return Path(value)
    except Exception:
        pass

    # Fallback for tests/dev environments where importing server is unavailable.
    cfg_path = Path(context["config_dir"]) / "config.json"
    cfg = _read_json(cfg_path, {}) if cfg_path.exists() else {}
    for key in ("dlc_dir", "dlc_path", "dlc", "library_dir", "library_path"):
        value = cfg.get(key)
        if isinstance(value, str) and value.strip():
            return Path(value)
    return None


def _normalise_note(note: Any, *, include_time: bool = True) -> dict[str, Any]:
    if not isinstance(note, dict):
        return {}
    out = {
        "s": int(note.get("s", 0) or 0),
        "f": int(note.get("f", 0) or 0),
        "sus": float(note.get("sus", 0) or 0),
        "sl": int(note.get("sl", -1) if note.get("sl", -1) is not None else -1),
        "slu": int(note.get("slu", -1) if note.get("slu", -1) is not None else -1),
        "bn": float(note.get("bn", 0) or 0),
        "ho": bool(note.get("ho", False)),
        "po": bool(note.get("po", False)),
        "hm": bool(note.get("hm", False)),
        "hp": bool(note.get("hp", False)),
        "pm": bool(note.get("pm", False)),
        "mt": bool(note.get("mt", False)),
        "vb": bool(note.get("vb", False)),
        "tr": bool(note.get("tr", False)),
        "ac": bool(note.get("ac", False)),
        "tp": bool(note.get("tp", False)),
    }
    if include_time:
        out["t"] = float(note.get("t", 0) or 0)
    return out


def _normalise_chart(exercise: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(exercise, dict):
        raise HTTPException(400, "exercise must be an object")
    session = exercise.get("session") if isinstance(exercise.get("session"), dict) else {}
    chart = exercise.get("chart") if isinstance(exercise.get("chart"), dict) else {}

    notes = [_normalise_note(n, include_time=True) for n in chart.get("notes", []) if isinstance(n, dict)]
    notes = [n for n in notes if n]
    notes.sort(key=lambda n: float(n.get("t", 0)))

    templates = []
    for t in chart.get("chordTemplates", chart.get("templates", [])) or []:
        if not isinstance(t, dict):
            continue
        frets = list(t.get("frets", []))[:8]
        fingers = list(t.get("fingers", []))[:8]
        templates.append({
            "name": str(t.get("name") or t.get("displayName") or "Chord"),
            "displayName": str(t.get("displayName") or t.get("name") or "Chord"),
            "arp": bool(t.get("arp", False)),
            "frets": [int(x) if isinstance(x, (int, float)) else -1 for x in frets],
            "fingers": [int(x) if isinstance(x, (int, float)) else -1 for x in fingers],
        })

    chords = []
    for ch in chart.get("chords", []) or []:
        if not isinstance(ch, dict):
            continue
        chord_notes = [_normalise_note(n, include_time=False) for n in ch.get("notes", []) if isinstance(n, dict)]
        chords.append({
            "t": float(ch.get("t", 0) or 0),
            "id": int(ch.get("id", 0) or 0),
            "hd": bool(ch.get("hd", False)),
            "notes": chord_notes,
        })
    chords.sort(key=lambda c: float(c.get("t", 0)))

    handshapes = []
    for hs in chart.get("handShapes", chart.get("handshapes", [])) or []:
        if not isinstance(hs, dict):
            continue
        handshapes.append({
            "chord_id": int(hs.get("chord_id", 0) or 0),
            "start_time": float(hs.get("start_time", 0) or 0),
            "end_time": float(hs.get("end_time", 0) or 0),
            "arp": bool(hs.get("arp", False)),
        })

    anchors = []
    for a in chart.get("anchors", []) or []:
        if not isinstance(a, dict):
            continue
        anchors.append({"time": float(a.get("time", 0) or 0), "fret": int(a.get("fret", 1) or 1), "width": int(a.get("width", 4) or 4)})
    if not anchors:
        anchors = [{"time": 0.0, "fret": int(session.get("fretMin", 0) or 0), "width": 4}]

    beats = []
    for b in chart.get("beats", []) or []:
        if not isinstance(b, dict):
            continue
        beats.append({"time": float(b.get("time", 0) or 0), "measure": int(b.get("measure", -1) or -1)})
    if not beats:
        beats = [{"time": 0.0, "measure": 1}]

    sections = []
    for i, s in enumerate(chart.get("sections", []) or []):
        if not isinstance(s, dict):
            continue
        sections.append({"name": str(s.get("name") or "practice"), "number": int(s.get("number", i + 1) or i + 1), "time": float(s.get("time", 0) or 0)})
    if not sections:
        sections = [{"name": "practice", "number": 1, "time": 0.0}]

    duration = float(chart.get("duration", 0) or 0)
    if duration <= 0:
        max_note = max((float(n.get("t", 0)) + float(n.get("sus", 0)) for n in notes), default=0)
        max_chord = max((float(c.get("t", 0)) for c in chords), default=0)
        duration = max(8.0, max_note, max_chord) + 2.0
    duration = max(1.0, min(duration, 900.0))

    arranged = {
        "name": "Lead",
        "tuning": list(session.get("tuning") or ([0, 0, 0, 0] if int(session.get("stringCount", 6) or 6) == 4 else [0, 0, 0, 0, 0, 0])),
        "capo": 0,
        "notes": notes,
        "chords": chords,
        "anchors": anchors,
        "handshapes": handshapes,
        "templates": templates,
        "beats": beats,
        "sections": sections,
    }
    return session, {"arrangement": arranged, "duration": duration}


def _write_silence_wav(path: Path, duration: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 44100
    frames_total = int(max(1.0, duration) * sample_rate)
    chunk_frames = sample_rate
    silence = b"\x00\x00" * chunk_frames
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        remaining = frames_total
        while remaining > 0:
            n = min(chunk_frames, remaining)
            wf.writeframes(silence[: n * 2])
            remaining -= n


def _dump_yaml(data: dict[str, Any]) -> str:
    try:
        import yaml  # type: ignore
        return yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    except Exception:
        # Minimal manifest fallback. Values are JSON-encoded scalars/lists, which
        # are valid YAML for this simple structure.
        lines = []
        for key in ("title", "artist", "album", "year", "duration"):
            lines.append(f"{key}: {json.dumps(data.get(key))}")
        lines.append("arrangements:")
        for a in data.get("arrangements", []):
            lines.append(f"  - id: {json.dumps(a['id'])}")
            lines.append(f"    name: {json.dumps(a['name'])}")
            lines.append(f"    file: {json.dumps(a['file'])}")
            lines.append(f"    tuning: {json.dumps(a['tuning'])}")
            lines.append(f"    capo: {int(a.get('capo', 0))}")
        lines.append("stems:")
        for s in data.get("stems", []):
            lines.append(f"  - id: {json.dumps(s['id'])}")
            lines.append(f"    file: {json.dumps(s['file'])}")
            lines.append(f"    default: {'true' if s.get('default', True) else 'false'}")
        return "\n".join(lines) + "\n"


def _cleanup_temp_root(temp_root: Path) -> None:
    try:
        temp_root.mkdir(parents=True, exist_ok=True)
        entries = [p for p in temp_root.iterdir() if p.name.endswith(".sloppak")]
        now = time.time()
        for p in entries:
            try:
                if now - p.stat().st_mtime > 24 * 3600:
                    shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)
            except OSError:
                pass
        entries = [p for p in temp_root.iterdir() if p.name.endswith(".sloppak")]
        entries.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        for p in entries[20:]:
            shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)
    except Exception:
        pass


def setup(app: FastAPI, context: dict) -> None:
    data_dir = _data_dir(context)
    presets_path = _presets_path(context)

    @app.get(f"/api/plugins/{PLUGIN_ID}/status")
    def status():
        dlc_dir = _get_dlc_dir_from_server(context)
        return {
            "ok": True,
            "plugin": PLUGIN_ID,
            "schema_version": SCHEMA_VERSION,
            "data_dir": str(data_dir),
            "preset_file_exists": presets_path.exists(),
            "dlc_dir_available": bool(dlc_dir),
        }

    @app.get(f"/api/plugins/{PLUGIN_ID}/assets/{filename}")
    def plugin_asset(filename: str):
        if filename != "slopscale.css":
            raise HTTPException(404, "Asset not found.")
        path = Path(__file__).parent / "static" / "slopscale.css"
        if not path.exists():
            raise HTTPException(404, "Asset not found.")
        return Response(path.read_text(encoding="utf-8"), media_type="text/css")

    @app.get(f"/api/plugins/{PLUGIN_ID}/presets")
    def list_presets():
        data = _read_json(presets_path, {"version": SCHEMA_VERSION, "presets": []})
        presets = data.get("presets", [])
        if not isinstance(presets, list):
            raise HTTPException(500, "Invalid presets file: presets must be a list.")
        return {"version": data.get("version", SCHEMA_VERSION), "presets": presets}

    @app.post(f"/api/plugins/{PLUGIN_ID}/presets")
    def save_preset(payload: PresetPayload):
        data = _read_json(presets_path, {"version": SCHEMA_VERSION, "presets": []})
        presets = data.get("presets", [])
        if not isinstance(presets, list):
            raise HTTPException(500, "Invalid presets file: presets must be a list.")

        next_preset = _model_dump(payload)
        updated = False
        for i, existing in enumerate(presets):
            if isinstance(existing, dict) and existing.get("id") == payload.id:
                presets[i] = next_preset
                updated = True
                break
        if not updated:
            presets.append(next_preset)

        out = {"version": SCHEMA_VERSION, "presets": presets}
        _atomic_write_json(presets_path, out)
        return {"ok": True, "preset": next_preset, "updated": updated}

    @app.delete(f"/api/plugins/{PLUGIN_ID}/presets/{preset_id}")
    def delete_preset(preset_id: str):
        data = _read_json(presets_path, {"version": SCHEMA_VERSION, "presets": []})
        presets = data.get("presets", [])
        if not isinstance(presets, list):
            raise HTTPException(500, "Invalid presets file: presets must be a list.")

        kept = [p for p in presets if not (isinstance(p, dict) and p.get("id") == preset_id)]
        if len(kept) == len(presets):
            raise HTTPException(404, "Preset not found.")

        out = {"version": SCHEMA_VERSION, "presets": kept}
        _atomic_write_json(presets_path, out)
        return {"ok": True, "deleted": preset_id}

    @app.post(f"/api/plugins/{PLUGIN_ID}/temp-sloppak")
    def build_temp_sloppak(payload: TempSloppakPayload):
        dlc_dir = _get_dlc_dir_from_server(context)
        if not dlc_dir:
            raise HTTPException(409, "DLC folder is not configured, so SlopScale cannot launch a temporary player chart.")
        dlc_dir = dlc_dir.resolve()
        if not dlc_dir.exists() or not dlc_dir.is_dir():
            raise HTTPException(409, f"Configured DLC folder does not exist: {dlc_dir}")

        exercise = payload.exercise
        session, chart = _normalise_chart(exercise)
        arranged = chart["arrangement"]
        duration = chart["duration"]

        temp_root = dlc_dir / TEMP_ROOT_NAME
        _cleanup_temp_root(temp_root)

        key = str(session.get("key", "C"))
        scale = str(session.get("scale", "major")).replace("_", " ")
        mode = str(session.get("mode", "practice")).replace("_", " ")
        title = f"SlopScale - {key} {scale} {mode}"
        slug = "slopscale-" + uuid.uuid4().hex[:12]
        sloppak_dir = temp_root / f"{slug}.sloppak"
        work_dir = Path(tempfile.mkdtemp(prefix="slopscale-work-", dir=str(data_dir)))
        try:
            (work_dir / "arrangements").mkdir(parents=True, exist_ok=True)
            (work_dir / "stems").mkdir(parents=True, exist_ok=True)
            (work_dir / "arrangements" / "lead.json").write_text(
                json.dumps(arranged, indent=2, sort_keys=False) + "\n",
                encoding="utf-8",
            )
            _write_silence_wav(work_dir / "stems" / "silence.wav", duration)

            manifest = {
                "title": title,
                "artist": "SlopScale",
                "album": "Practice Tools",
                "year": 2026,
                "duration": duration,
                "arrangements": [{
                    "id": "lead",
                    "name": "Lead",
                    "file": "arrangements/lead.json",
                    "tuning": arranged.get("tuning", [0, 0, 0, 0, 0, 0]),
                    "capo": 0,
                }],
                "stems": [{"id": "full", "file": "stems/silence.wav", "default": True}],
                "slopscale": {"version": SCHEMA_VERSION, "generated": True, "session": session},
            }
            (work_dir / "manifest.yaml").write_text(_dump_yaml(manifest), encoding="utf-8")

            if sloppak_dir.exists():
                shutil.rmtree(sloppak_dir, ignore_errors=True)
            shutil.move(str(work_dir), str(sloppak_dir))
            rel = sloppak_dir.relative_to(dlc_dir).as_posix()
            return {"ok": True, "filename": rel, "title": title, "duration": duration}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(500, f"Failed to build temporary SlopScale sloppak: {exc}") from exc
        finally:
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)
