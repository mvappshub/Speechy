#!/bin/bash
# Start script for Czech TTS application
# This starts the Python TTS backend server

echo "╔══════════════════════════════════════════════╗"
echo "║   Předčítač Českého Textu - TTS Server      ║"
echo "║   Model: facebook/mms-tts-ces               ║"
echo "║   Port: 8000                                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "První spuštění stáhne model z HuggingFace (~80 MB)."
echo ""

cd "$(dirname "$0")"
python3 server.py
