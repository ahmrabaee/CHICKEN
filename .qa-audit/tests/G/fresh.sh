#!/bin/sh
cd "E:/DEV/Chicken FMS/.qa-audit"
node harness/instance.mjs stop ga >/dev/null 2>&1
node harness/instance.mjs start ga 3119 dev --fresh 2>&1 | tail -1 | cut -c1-80
