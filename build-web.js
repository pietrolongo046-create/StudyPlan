/**
 * StudyPlan — Build script for Tauri
 * Copies web assets from client/ into web-dist/ folder
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CLIENT = path.join(ROOT, 'client');
const DIST = path.join(ROOT, 'web-dist');

// Clean
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// Files to copy (from client/ root)
const rootFiles = [
  'index.html',
  'widget-studyplan.html',
];

rootFiles.forEach(f => {
  const src = path.join(CLIENT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, f));
  }
});

// Files from client/src/
const srcFiles = [
  'app.js',
  'styles.css',
  'tauri-bridge.js',
];

srcFiles.forEach(f => {
  const src = path.join(CLIENT, 'src', f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, f));
  }
});

// Directories to copy from client/
const dirs = ['fonts', 'services'];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

dirs.forEach(d => {
  const src = path.join(CLIENT, d);
  if (fs.existsSync(src)) {
    copyDir(src, path.join(DIST, d));
  }
});

// Copy assets from root assets/ (icons for UI)
const assetsDir = path.join(ROOT, 'assets');
if (fs.existsSync(assetsDir)) {
  copyDir(assetsDir, path.join(DIST, 'assets'));
}

console.log('✅ web-dist/ ready');
