#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

/**
 * Prebuild script to update version in package.json and create version file.
 * Skips bumping when SKIP_VERSION_BUMP=1 (local smoke builds).
 * Always refreshes .env.local with the current (or new) version.
 */

function updateVersion() {
  const packageJsonPath = join(process.cwd(), 'package.json');
  const skipBump = process.env.SKIP_VERSION_BUMP === '1';

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const [major, minor, patch] = packageJson.version.split('.').map(Number);

    let version = packageJson.version;
    if (!skipBump) {
      version = `${major}.${minor}.${patch + 1}`;
      packageJson.version = version;
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`✅ Version updated to ${version}`);
      console.log(`📝 Updated package.json`);
    } else {
      console.log(`⏭️  SKIP_VERSION_BUMP=1 — keeping version ${version}`);
    }

    const envContent = `VITE_APP_VERSION=${version}\n`;
    writeFileSync(join(process.cwd(), '.env.local'), envContent);
    console.log(`📄 Created .env.local with VITE_APP_VERSION`);

    return version;
  } catch (error) {
    console.error('❌ Error updating version:', error);
    process.exit(1);
  }
}

updateVersion();
