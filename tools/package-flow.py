#!/usr/bin/env python3
"""Create/validate the small, deterministic source archive used by Pyodide."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'vendor/gtnh-flow-browser'
DEST = ROOT / 'vendor/gtnh-flow-browser.zip'
MANIFEST = ROOT / 'vendor/gtnh-flow-browser.manifest.json'


def sources():
    files = list((SOURCE / 'src').rglob('*.py')) + list((SOURCE / 'data').glob('*.yaml'))
    files += [SOURCE / name for name in ('factory_graph.py', 'config_factory_graph.yaml', 'LICENSE.txt', 'README.md')]
    return {str(path.relative_to(SOURCE.parent)): path.read_bytes() for path in sorted(files)}


def build():
    contents = sources()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in contents.items():
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    data = buffer.getvalue()
    DEST.write_bytes(data)
    MANIFEST.write_text(json.dumps({'schemaVersion': 1, 'sha256': hashlib.sha256(data).hexdigest(),
        'files': {name: hashlib.sha256(data).hexdigest() for name, data in contents.items()}}, indent=2) + '\n')
    print(f'Packaged {len(contents)} source/config/license files ({len(data):,} bytes).')


def check():
    manifest = json.loads(MANIFEST.read_text())
    assert hashlib.sha256(DEST.read_bytes()).hexdigest() == manifest['sha256'], 'Archive checksum mismatch'
    with zipfile.ZipFile(DEST) as archive:
        expected = sources()
        assert set(archive.namelist()) == set(expected), 'Source archive file list is stale'
        for name, data in expected.items():
            assert archive.read(name) == data, f'Stale packaged source: {name}'
            assert hashlib.sha256(data).hexdigest() == manifest['files'][name], f'Invalid source hash: {name}'
    print(f'Validated {len(expected)} packaged files against tracked source.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    check() if args.check else build()
