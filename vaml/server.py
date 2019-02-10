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
    await websocket.send("Howdy do!")
    # while True:
    #     now = datetime.datetime.utcnow().isoformat() + 'Z'
    #     await websocket.send(now)
    #     await asyncio.sleep(random.random() * 3)


# Nested class for request processing
class VamlHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        # Root request?
        if self.path == '/' or self.path == '/index.html':
            content, content_type = self._find_file('index.html')
            self._send_simple(
                status_code=200,
                content_type=content_type,
                content=content.replace("${WEBSOCKET_PORT}", str(SERVER.websocket_port))
            )
            return

        # Try to find the file
        try:
            content, content_type = self._find_file(self.path)
            self._send_simple(
                status_code=200,
                content_type=content_type,
                content=content
            )
        except Exception as e:
            print(e)
            self._send_simple(status_code=500)

    def _read(self, filename):
        with open('www/{}'.format(filename)) as f:
            return f.read()

    def _find_file(self, filename):
        if filename.endswith('.js'):
            content_type = 'text/javascript'
        elif filename.endswith('.html'):
            content_type = 'text/html'
        else:
            raise Exception("Invalid file type: {}".format(filename))
        content = self._read(filename)
        return content, content_type

    def _send_simple(self, status_code, content_type='', content=''):
        self.send_response(status_code)
        self.send_header('Content-type', content_type)
        self.end_headers()
        data = bytes(content, 'UTF-8')
        self.wfile.write(data)


