#!/usr/bin/env python3
"""Static server with the manifest MIME type Chrome expects for installability."""
import http.server
import mimetypes
import os
import sys

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("image/svg+xml", ".svg")

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=port, bind="127.0.0.1")
