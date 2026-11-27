#!/usr/bin/env python3
"""Run the Night Studies studios on a loopback HTTP server."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import locale
from pathlib import Path
import sys
import webbrowser

class GalleryHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.mjs': 'text/javascript',
        '.wasm': 'application/wasm',
        '.webp': 'image/webp',
    }

    def list_directory(self, path):
        self.send_error(404)
        return None

if __name__ == '__main__':
    # Accept --lang before building the localized help and error messages.
    language_parser = argparse.ArgumentParser(add_help=False)
    language_parser.add_argument('--lang', choices=('en', 'ko', 'de'))
    language = language_parser.parse_known_args()[0].lang
    system_language = (locale.getlocale()[0] or 'en').split('_')[0]
    def local(en, ko, de):
        return {'ko': ko, 'de': de}.get(language or system_language, en)

    cli = argparse.ArgumentParser(description=local('Run Night Studies locally.', 'Night Studies를 로컬에서 엽니다.', 'Night Studies lokal starten.'))
    cli.add_argument('--lang', choices=('en', 'ko', 'de'), help=local('Studio language', '화면 언어', 'Sprache der Werkstätten'))
    cli.add_argument('--port', type=int, default=17473, help=local('Local port. Use the same port to reopen your library.', '로컬 포트. 같은 포트를 사용하면 보관함을 다시 열 수 있습니다.', 'Lokaler Port. Nutze für dein Archiv immer denselben Port.'))
    cli.add_argument('--no-open', action='store_true', help=local('Print the address without opening a browser.', '브라우저를 열지 않고 주소를 표시합니다.', 'Adresse anzeigen, ohne den Browser zu öffnen.'))
    args = cli.parse_args()
    handler = partial(GalleryHandler, directory=str(Path(__file__).resolve().parent / 'docs'))
    try:
        local_server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError as error:
        sys.exit(local('Cannot open the port. Check for another Night Studies window or choose --port.', '포트를 열 수 없습니다. 실행 중인 Night Studies 창을 확인하거나 --port로 다른 포트를 선택하세요.', 'Port nicht verfügbar. Prüfe andere Night-Studies-Fenster oder wähle einen anderen Port mit --port.') + ' (' + str(error) + ')')
    with local_server as server:
        url = f'http://127.0.0.1:{server.server_port}/'
        if args.lang:
            url += '?lang=' + args.lang
        print('Night Studies  ·  ' + url, flush=True)
        print(local('Press Ctrl+C to stop.', 'Ctrl+C를 누르면 종료됩니다.', 'Zum Beenden Strg+C drücken.'), flush=True)
        if not args.no_open:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
