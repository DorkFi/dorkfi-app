#!/usr/bin/env node

const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

/**
 * Prebuild script to update version in package.json and sync VITE_APP_VERSION
 * in .env.local without clobbering other local env vars (e.g. VITE_PRIVY_APP_ID).
 * Skips bumping when SKIP_VERSION_BUMP=1 (local smoke builds).
 */

function upsertEnvVar(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const trimmed = content.replace(/\n+$/, "");
  return trimmed.length > 0 ? `${trimmed}\n${line}\n` : `${line}\n`;
}

function updateVersion() {
  const packageJsonPath = join(process.cwd(), "package.json");
  const envLocalPath = join(process.cwd(), ".env.local");
  const skipBump = process.env.SKIP_VERSION_BUMP === "1";

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const [major, minor, patch] = packageJson.version.split(".").map(Number);

    let version = packageJson.version;
    if (!skipBump) {
      version = `${major}.${minor}.${patch + 1}`;
      packageJson.version = version;
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
      console.log(`✅ Version updated to ${version}`);
      console.log(`📝 Updated package.json`);
    } else {
      console.log(`⏭️  SKIP_VERSION_BUMP=1 — keeping version ${version}`);
    }

    const existingEnv = existsSync(envLocalPath)
      ? readFileSync(envLocalPath, "utf8")
      : "";
    const envContent = upsertEnvVar(existingEnv, "VITE_APP_VERSION", version);
    writeFileSync(envLocalPath, envContent);
    console.log(`📄 Updated .env.local VITE_APP_VERSION (preserved other vars)`);

    return version;
  } catch (error) {
    console.error("❌ Error updating version:", error);
    process.exit(1);
  }
}

updateVersion();
