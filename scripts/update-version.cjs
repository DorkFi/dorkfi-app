#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

/**
 * Prebuild script to update version in package.json and create version file
 * This script increments the patch version and creates a version file for Vite
 */

function updateVersion() {
  const packageJsonPath = join(process.cwd(), 'package.json');
  
  try {
    // Read current package.json
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    
    // Parse current version
    const [major, minor, patch] = packageJson.version.split('.').map(Number);
    
    // Increment patch version
    const newVersion = `${major}.${minor}.${patch + 1}`;
    
    // Update package.json
    packageJson.version = newVersion;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    // Create .env.local file for Vite environment variables
    const envContent = `VITE_APP_VERSION=${newVersion}\n`;
    writeFileSync(join(process.cwd(), '.env.local'), envContent);
    
    console.log(`✅ Version updated to ${newVersion}`);
    console.log(`📝 Updated package.json`);
    console.log(`📄 Created .env.local with VITE_APP_VERSION`);
    
    return newVersion;
  } catch (error) {
    console.error('❌ Error updating version:', error);
    process.exit(1);
  }
}

// Run the update
updateVersion();
