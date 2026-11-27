#!/usr/bin/env python3
"""Open Night Studies in a local browser. Python 3 standard library."""
import argparse
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

class GalleryHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.webp': 'image/webp'}
    def list_directory(self, path):
        self.send_error(404)
        return None

if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--port', type=int, default=17473, help='Local port. Keep the same port to reopen your saved library.')
    cli.add_argument('--no-open', action='store_true', help='Print the address without opening a browser.')
    args = cli.parse_args()
    handler = partial(GalleryHandler, directory=str(Path(__file__).resolve().parent / 'docs'))
    try:
        local_server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        sys.exit(f'포트 {args.port}를 열 수 없습니다. 실행 중인 Night Studies 창을 확인하거나 --port 로 다른 포트를 선택하세요. ({error})')
    with local_server as server:
        url = 'http://127.0.0.1:%d/' % server.server_port
        print('Night Studies  ·  '+url, flush=True)
        print('창을 닫거나 Ctrl+C를 눌러 종료하세요.', flush=True)
        if not args.no_open: webbrowser.open(url)
        try: server.serve_forever()
        except KeyboardInterrupt: pass
