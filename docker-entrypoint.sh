#!/bin/sh
set -e
# seed.mjs is idempotent: it only creates the demo projects on first start.
node seed.mjs
exec node server.js
