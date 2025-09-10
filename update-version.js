#!/usr/bin/env node

// Simple script to update version numbers for cache-busting
// Run this before deploying to update cache versions

const fs = require('fs');
const path = require('path');

// Read current version
const versionPath = path.join(__dirname, 'version.js');
let versionContent = fs.readFileSync(versionPath, 'utf8');

// Extract current version
const versionMatch = versionContent.match(/patch:\s*(\d+)/);
const currentPatch = versionMatch ? parseInt(versionMatch[1]) : 0;
const newPatch = currentPatch + 1;

// Update version in version.js
versionContent = versionContent.replace(
  /patch:\s*\d+/,
  `patch: ${newPatch}`
);
versionContent = versionContent.replace(
  /build:\s*Date\.now\(\)/,
  `build: ${Date.now()}`
);

fs.writeFileSync(versionPath, versionContent);

// Update service worker version
const swPath = path.join(__dirname, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// Update cache names with new version
const newVersion = `2.0.${newPatch}`;
swContent = swContent.replace(
  /line-rehearsal-v[\d.]+/g,
  `line-rehearsal-v${newVersion}`
);

fs.writeFileSync(swPath, swContent);

console.log(`✅ Version updated to ${newVersion}`);
console.log('📦 Cache versions updated in service worker');
console.log('🚀 Ready for deployment!');
