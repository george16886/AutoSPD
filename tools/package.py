"""Build the Chrome Web Store upload: dist/autospd-<version>.zip.

Zips extension/ without the unit tests, then checks that every file the
manifest references is in the archive.

Run from the repository root:  python tools/package.py
"""

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTENSION = ROOT / "extension"
EXCLUDED_DIRS = {"tests"}


def manifest_files(manifest):
    """Paths the manifest points at, relative to extension/."""
    files = set(manifest.get("icons", {}).values())
    action = manifest.get("action", {})
    files.update(action.get("default_icon", {}).values())
    files.add(action.get("default_popup"))
    files.add(manifest.get("options_page"))
    files.add(manifest.get("background", {}).get("service_worker"))
    for script in manifest.get("content_scripts", []):
        files.update(script.get("js", []))
        files.update(script.get("css", []))
    return {f for f in files if f}


def main():
    manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
    out = ROOT / "dist" / f"autospd-{manifest['version']}.zip"
    out.parent.mkdir(exist_ok=True)

    packed = []
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(EXTENSION.rglob("*")):
            relative = path.relative_to(EXTENSION)
            if path.is_dir() or relative.parts[0] in EXCLUDED_DIRS:
                continue
            archive.write(path, relative.as_posix())
            packed.append(relative.as_posix())

    missing = sorted(manifest_files(manifest) - set(packed))
    if missing:
        out.unlink()
        sys.exit(f"manifest references files that are not in the package: {missing}")

    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB, {len(packed)} files)")
    for name in packed:
        print("  " + name)


if __name__ == "__main__":
    main()
