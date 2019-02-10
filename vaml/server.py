import asyncio
import time

import datetime
import threading
import random
import websockets
from http.server import HTTPServer
from http.server import BaseHTTPRequestHandler

SERVER = None


class VamlServer:
    def __init__(self, hostname, port, websocket_port):
        self.hostname = hostname
        self.port = port
        self.websocket_port = websocket_port
        self.server = HTTPServer((hostname, port), VamlHandler)

        # Assign this to the global value
        global SERVER
        if SERVER is not None:
            print("Only one server can be created at a time.  Failing.")
            exit(1)
        SERVER = self

    def _server_websocket(self):
        print("Serving websocket server...")
        start_server = websockets.serve(websocket_handler, self.hostname, self.websocket_port)
        asyncio.get_event_loop().run_until_complete(start_server)
        asyncio.get_event_loop().run_forever()

    def _serve_http(self):
        print(time.asctime(), 'Server Started - %s:%s' % (self.hostname, self.port))
        try:
            self.server.serve_forever()
        except KeyboardInterrupt:
            pass
        self.server.server_close()
        print(time.asctime(), 'Server Stopped')

    def serve(self):
        threading.Thread(target=self._serve_http).start()
        self._server_websocket()


async def websocket_handler(websocket, path):
    while True:
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        await websocket.send(now)
        await asyncio.sleep(random.random() * 3)


# Nested class for request processing
class VamlHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        paths = {
            '/foo': {'status': 200},
            '/bar': {'status': 302},
            '/baz': {'status': 404},
            '/qux': {'status': 500}
        }

        if self.path in paths:
            self.respond(paths[self.path])
        else:
            self.respond({'status': 500})

    def handle_http(self, status_code, path):
        self.send_response(status_code)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

        with open('www/page.html') as f:
            content = f.read()
        content = content.replace("${WEBSOCKET_PORT}", str(SERVER.websocket_port))
        return bytes(content, 'UTF-8')

    def respond(self, opts):
        response = self.handle_http(opts['status'], self.path)
        self.wfile.write(response)

