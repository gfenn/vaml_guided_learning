#!/usr/bin/env python
from vaml.server import VamlServer

HOSTNAME = 'localhost'
WEB_PORT = 5678
SOCKET_PORT = 12000

if __name__ == '__main__':
    server = VamlServer(HOSTNAME, WEB_PORT, SOCKET_PORT)
    server.serve()
