"""Песочница реакций: python3 server.py → http://127.0.0.1:8765"""
import mimetypes
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

if __name__ == "__main__":
    root = str(Path(__file__).resolve().parent)
    print(f"http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), partial(SimpleHTTPRequestHandler, directory=root)).serve_forever()
