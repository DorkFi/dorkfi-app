# Versioning System Overview

This document describes how automatic version management works in the DorkFi PreFi frontend application.

## Overview

The app uses an automatic version management system that:
- **Increments the patch version** (e.g., `0.1.464` → `0.1.465`) on every build
- **Displays the current version** in the UI via the `VersionDisplay` component
- **Stores version** in both `package.json` and Vite environment variables

## How It Works

### 1. Version Storage

The version is stored in two places:
- **`package.json`**: The canonical source of truth (currently at `0.1.464`)
- **`.env.local`**: Generated file containing `VITE_APP_VERSION={version}` for Vite to access at build time

### 2. Automatic Version Increment

The version is automatically incremented during the build process:

**Build Flow:**
```
npm run build
  ↓
npm run prebuild (runs automatically)
  ↓
node scripts/update-version.cjs
  ↓
  • Reads current version from package.json
  • Increments patch version (major.minor.patch + 1)
  • Updates package.json with new version
  • Creates/updates .env.local with VITE_APP_VERSION
  ↓
vite build
```

### 3. Version Update Script

**File:** `scripts/update-version.cjs`

This Node.js script:
1. Reads the current version from `package.json`
2. Parses it as `major.minor.patch`
3. Increments the patch version
4. Writes the new version back to `package.json`
5. Creates/updates `.env.local` with `VITE_APP_VERSION={newVersion}`

**Example:**
- Current: `0.1.464`
- After build: `0.1.465`

### 4. Version Display in UI

**Component:** `src/components/VersionDisplay.tsx`

The component:
- Reads version from `import.meta.env.VITE_APP_VERSION`
- Falls back to `'0.1.0'` if the env variable is missing
- Displays as `v{version}` (e.g., "v0.1.464")

**Usage Locations:**
- `src/components/Footer.tsx` - Footer component
- `src/pages/Admin.tsx` - Admin page
- `src/pages/PreFi.tsx` - PreFi page

### 5. Git Integration

**Setup Script:** `scripts/setup-version-management.sh`

The setup script:
- Adds `.env.local` to `.gitignore` (if not already present)
- Creates initial `.env.local` file if it doesn't exist
- Sets up pre-commit hook (if configured)

**Important:** `.env.local` is git-ignored to avoid conflicts between developers, as each developer's local version may differ.

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | Stores the canonical version number |
| `scripts/update-version.cjs` | Script that increments and updates version |
| `scripts/setup-version-management.sh` | Initial setup script for version management |
| `.env.local` | Generated file with `VITE_APP_VERSION` (git-ignored) |
| `src/components/VersionDisplay.tsx` | React component that displays the version |
| `.gitignore` | Contains `.env.local` to prevent committing local versions |

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run setup-version` | Initial setup (adds .env.local to gitignore, creates initial file) |
| `npm run prebuild` | Manually update version (also runs automatically before build) |
| `npm run build` | Build with automatic version update (`prebuild` runs first) |
| `npm run build:dev` | Development build with version update |

## Manual Version Control

If you need to manually set a specific version:

1. Edit `package.json` and set the desired version (e.g., `"version": "1.0.0"`)
2. Run `npm run prebuild` to update `.env.local`
3. Commit the changes

The next build will increment from your manually set version.

## Version Format

The version follows semantic versioning (semver) format:
- **Major**: Breaking changes (e.g., `1.0.0` → `2.0.0`)
- **Minor**: New features, backward compatible (e.g., `0.1.0` → `0.2.0`)
- **Patch**: Bug fixes, backward compatible (e.g., `0.1.464` → `0.1.465`)

**Current behavior:** Only the patch version is automatically incremented. To increment major or minor versions, manually edit `package.json`.

## Environment Variable Access

In the application code, access the version via:
```typescript
const version = import.meta.env.VITE_APP_VERSION || '0.1.0';
```

**Note:** The `VITE_` prefix is required for Vite to expose the variable to the client-side code.

## Troubleshooting

### Version not updating
- Check that `prebuild` script exists in `package.json`
- Verify `scripts/update-version.cjs` is executable
- Ensure the script runs before `vite build`

### Version not displaying
- Verify `.env.local` exists and contains `VITE_APP_VERSION={version}`
- Check that the variable is accessed via `import.meta.env.VITE_APP_VERSION`
- Ensure the variable name starts with `VITE_`

### Build errors
- Ensure `scripts/update-version.cjs` has correct permissions
- Check that `package.json` has a valid version format
- Verify Node.js can execute the script

## Current Status

- **Current Version:** `0.1.464` (as of last check)
- **Version Display:** Active in Footer, Admin, and PreFi pages
- **Auto-increment:** Enabled on every build
- **Git Integration:** `.env.local` is git-ignored

## Notes

- The version increments on **every build**, not every commit
- Each developer may have a different local version number
- The version in `package.json` is the source of truth
- `.env.local` is regenerated on each build with the updated version
- The fallback version (`0.1.0`) ensures the app works even if the env var is missing

