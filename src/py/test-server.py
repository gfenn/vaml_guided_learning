#!/usr/bin/env python3

import socket

HOST = '127.0.0.1'
PORT = 12000

with socket.socket(socket.AF_INET, socket.SOCK-STREAM) as s:
  s.bind((HOST, PORT))
  s.listen()

