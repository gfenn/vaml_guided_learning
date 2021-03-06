import asyncio
import time

import json

import os
import threading
import websockets
from http.server import HTTPServer
from http.server import BaseHTTPRequestHandler

from vaml.data.feed_data import feed_folder
from vaml.data_utils import load_run_field, load_metrics, load_predictions

SERVER = None
FOLDER = '../thesis_data'
TRANSFER_THREAD = None

def read_file(filename, root='www/'):
    with open('{root}{file}'.format(root=root, file=filename), 'rb') as f:
        return f.read()


def parse_request_path(request_path):
    tokens = request_path.split('?', 1)
    path = tokens[0]
    params = None
    if len(tokens) > 1:
        tokens = tokens[1].split('&')
        params = {}
        for token in tokens:
            parts = token.split('=', 1)
            params[parts[0]] = parts[1]
    return path, params


def transfer_thread():
    global TRANSFER_THREAD
    TRANSFER_THREAD = True
    feed_folder(data_folder=FOLDER, feed_run=6, ep_delay=0.1, del_last=True)
    TRANSFER_THREAD = None


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
        print(time.asctime(), 'Server Started - http://%s:%s' % (self.hostname, self.port))
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
    await websocket.send("Testing")
    # while True:
    #     now = datetime.datetime.utcnow().isoformat() + 'Z'
    #     await websocket.send(now)
    #     await asyncio.sleep(random.random() * 3)


def utf8_reader(content: bytes):
    return content.decode("utf-8")


def bytes_utf8_converter(content):
    return bytes(content, 'UTF-8')


# Nested class for request processing.  Will take the webpage API requests and convert them into responses.
# If the request is a specific "known value", will process that command, otherwise it will attempt to find
# a file in the `www` directory with the requested file name.
class VamlHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def _get_index(self, _):
        content, content_type, converter = self._find_file('index.html')
        self._send_simple(
            content_type=content_type,
            content=str(content).replace("${WEBSOCKET_PORT}", str(SERVER.websocket_port)),
            converter=converter
        )

    def _get_metrics(self, parameters):
        self._send_simple(
            content_type='application/json',
            content=json.dumps(load_metrics(
                folder=FOLDER,
                compression=int(parameters['compression'])
            )),
            converter=bytes_utf8_converter
        )

    def _get_run_metadata(self, parameters):
        self._forward_file(
            filename='{folder}/run_{id}/metadata.json'.format(
                folder=FOLDER,
                id=parameters['id']
            ),
            root=''
        )

    def _get_run_field(self, parameters):
        # Load the data
        data = load_run_field(
            folder=FOLDER,
            run_id=parameters['run'],
            compression=int(parameters['compression']),
            field=parameters['field']
        )

        # Send the data
        self._send_simple(
            content_type='application/json',
            content=json.dumps(data),
            converter=bytes_utf8_converter
        )

    def _get_predictions(self, parameters):
        # Load the data
        data = load_predictions(
            folder=FOLDER,
            run_id=parameters['run'],
            sample=parameters['sample']
        )
        self._send_simple(
            content_type='application/json',
            content=json.dumps(data),
            converter=bytes_utf8_converter
        )

    def _get_episode_data(self, parameters):
        # Returns the data about a specific episode
        self._forward_file(
            filename='{folder}/run_{run}/episode_{episode}.json'.format(
                folder=FOLDER,
                run=parameters['run_id'],
                episode=parameters['id']
            ),
            root=''
        )

    def _reset_thread(self, parameters):
        global TRANSFER_THREAD
        if TRANSFER_THREAD is None:
            print("Launching transfer thread.")
            threading.Thread(target=transfer_thread).start()
        else:
            print("Transfer thread already running.")

        time.sleep(1)
        self._send_ok()

    def _get_other(self):
        # Attempts to return the file with the requested name
        self._forward_file(filename=self.path)

    def do_GET(self):
        # Known paths - if not known, will just get the file with the provided name
        known_paths = {
            '/': self._get_index,
            '/index.html': self._get_index,
            '/data/metrics': self._get_metrics,
            '/data/run': self._get_run_metadata,
            '/data/run_field': self._get_run_field,
            '/data/episode': self._get_episode_data,
            '/data/predictions': self._get_predictions,
            '/data/reset': self._reset_thread,
        }

        # Split out the parameters (if any)
        path, params = parse_request_path(self.path)
        if path in known_paths:
            known_paths[path](params)
        else:
            self._get_other()

    def _forward_file(self, filename, root='www/'):
        try:
            content, content_type, converter = self._find_file(filename, root)
            self._send_simple(
                content_type=content_type,
                content=content,
                converter=converter
            )
        except Exception as e:
            print(e)
            self._send_simple(status_code=500)

    def _find_file(self, filename, root='www/'):
        filetypes = {
            '.js': ('text/javascript', bytes_utf8_converter, utf8_reader),
            '.json': ('application/json', bytes_utf8_converter, utf8_reader),
            '.html': ('text/html', bytes_utf8_converter, utf8_reader),
            '.css': ('text/css', bytes_utf8_converter, utf8_reader),
            '.ico': ('image/png', None, None),
            '.png': ('image/png', None, None),
        }

        suffix = os.path.splitext(filename)[1]
        if suffix not in filetypes:
            raise Exception("Invalid file type: {}".format(filename))

        content_type, converter, reader = filetypes[suffix]
        content = read_file(filename, root=root)
        if reader:
            content = reader(content)
        return content, content_type, converter

    def _send_simple(self, status_code=200, content_type='', content='', converter=bytes_utf8_converter):
        self.send_response(status_code)
        self.send_header('Content-type', content_type)
        self.end_headers()
        if converter is not None:
            content = converter(content)
        self.wfile.write(content)

    def _send_ok(self):
        self._send_simple(status_code=200, content_type='application/json', content='{}')
