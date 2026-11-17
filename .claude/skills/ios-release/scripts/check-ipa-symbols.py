#!/usr/bin/env python3
"""Checks an EAS iOS build for missing module symbols before it goes to the store.

Build 8 (1.0.1) crashed on launch with dyld "Symbol not found": a prebuilt Expo module was newer
than the ExpoModulesCore it was linked with. This downloads nothing; give it an unzipped .app and
it lists every symbol the app, its frameworks and its extensions import from the bundled
React/Expo/Hermes frameworks that none of those frameworks exports.

Usage: check-ipa-symbols.py <path/to/Payload/app.app>
Exit 0 when nothing is missing, 1 otherwise.
"""
import glob
import os
import subprocess
import sys

# Only symbols that should come from frameworks bundled in the app; system symbols are skipped.
OWNED = ('ExpoModulesCore', 'ExpoFileSystem', 'ExpoFont', 'ExpoModulesJSI', 'ExpoModulesWorklets',
         'ExpoUI', 'ExpoWidgets', 'hermes', 'RCT', 'facebook', 'React')


def nm(args, path):
    out = subprocess.run(['nm', *args, path], capture_output=True, text=True).stdout
    return [line.strip() for line in out.splitlines() if line.strip()]


def binary_of(bundle):
    return os.path.join(bundle, os.path.splitext(os.path.basename(bundle))[0])


def main(app):
    frameworks = glob.glob(os.path.join(app, 'Frameworks', '*.framework'))
    frameworks += glob.glob(os.path.join(app, 'PlugIns', '*', 'Frameworks', '*.framework'))
    exports = set()
    for fw in frameworks:
        exports.update(nm(['-gU', '-j'], binary_of(fw)))

    binaries = [binary_of(fw) for fw in frameworks]
    binaries.append(binary_of(app))
    binaries += [binary_of(ext) for ext in glob.glob(os.path.join(app, 'PlugIns', '*.appex'))]

    missing = {}
    for b in binaries:
        if not os.path.exists(b):
            print(f'skip (not found): {b}')
            continue
        for sym in nm(['-u', '-j'], b):
            if any(k in sym for k in OWNED) and sym not in exports:
                missing.setdefault(b, []).append(sym)

    for b, syms in missing.items():
        print(f'{os.path.relpath(b, app)}: {len(syms)} missing, e.g. {syms[:3]}')
    total = sum(len(v) for v in missing.values())
    print(f'checked {len(binaries)} binaries; missing {total}')
    return 1 if total else 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
