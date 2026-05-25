"""SlopScale plugin routes.

The frontend generator can run entirely in-browser, but these routes provide
stable plugin status and preset persistence under CONFIG_DIR. Presets are
kept out of the repository and included in Slopsmith settings export/import
through plugin.json's settings.server_files declaration.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

PLUGIN_ID = "slopscale"
SCHEMA_VERSION = 1


class PresetPayload(BaseModel):
    id: str = Field(min_length=1, max_length=96)
    name: str = Field(min_length=1, max_length=160)
    kind: str = Field(default="exercise", max_length=64)
    config: dict[str, Any] = Field(default_factory=dict)


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


def setup(app: FastAPI, context: dict) -> None:
    data_dir = _data_dir(context)
    presets_path = _presets_path(context)

    @app.get(f"/api/plugins/{PLUGIN_ID}/status")
    def status():
        return {
            "ok": True,
            "plugin": PLUGIN_ID,
            "schema_version": SCHEMA_VERSION,
            "data_dir": str(data_dir),
            "preset_file_exists": presets_path.exists(),
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

        next_preset = payload.model_dump()
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
