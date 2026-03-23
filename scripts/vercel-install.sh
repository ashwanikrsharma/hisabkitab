#!/bin/sh
# Narrow workspaces to exclude mobile for Vercel builds
node -e "
const fs=require('fs');
const p=JSON.parse(fs.readFileSync('package.json','utf8'));
p.workspaces=['src/web','src/services','src/shared'];
fs.writeFileSync('package.json',JSON.stringify(p,null,2));
"
rm -f package-lock.json
npm install --legacy-peer-deps
