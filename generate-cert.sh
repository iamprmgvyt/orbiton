#!/bin/bash
# ============================================================
# Generate Self-Signed SSL Certificate
# Use this if you don't have a domain / Let's Encrypt
# ============================================================

CERTS_DIR="$(dirname "$0")/certs"
mkdir -p "$CERTS_DIR"

# Interactive input
read -rp "Enter your domain or IP [localhost]: " CN
CN="${CN:-localhost}"

echo "Generating self-signed SSL certificate for: $CN"

openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout "$CERTS_DIR/privkey.pem" \
  -out    "$CERTS_DIR/fullchain.pem" \
  -subj "/CN=${CN}/O=VPS Panel/OU=Bot Manager/C=VN" \
  -addext "subjectAltName=IP:${CN},DNS:${CN}" 2>/dev/null || \
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout "$CERTS_DIR/privkey.pem" \
  -out    "$CERTS_DIR/fullchain.pem" \
  -subj "/CN=${CN}/O=VPS Panel/C=VN"

chmod 600 "$CERTS_DIR/privkey.pem"
chmod 644 "$CERTS_DIR/fullchain.pem"

echo ""
echo "✅ Certificate generated:"
echo "   Private key:  $CERTS_DIR/privkey.pem"
echo "   Certificate:  $CERTS_DIR/fullchain.pem"
echo ""
echo "   Valid for: 10 years"
echo "   CN: $CN"
echo ""
echo "⚠️  This is a self-signed cert. Browser will show a warning."
echo "   Accept it or use Let's Encrypt for production."
echo ""
echo "Restart the panel to apply: node backend/server.js"
