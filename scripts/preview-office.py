#!/usr/bin/env python3
"""Office scene review only. No npm install/build or game server required."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8766)
args = parser.parse_args()

class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, value):
        route = unquote(urlsplit(value).path)
        if route.startswith('/assets/'):
            base, tail = ROOT / 'client/public/assets', route.removeprefix('/assets/')
        elif route.startswith('/shared/'):
            base, tail = ROOT / 'shared', route.removeprefix('/shared/')
        else:
            base, tail = ROOT / 'client', route.lstrip('/') or 'office.html'
        target = (base / tail).resolve()
        if not target.is_relative_to(base.resolve()):
            return str(ROOT / '__not_found__')
        return str(target)

print(f'Office preview: http://127.0.0.1:{args.port}/office.html', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
