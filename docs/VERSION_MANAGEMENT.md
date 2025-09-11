# Version Management

This project includes automatic version management that increments the version on every commit and displays it in the footer.

## How it works

1. **Version Display**: The app version is displayed in the footer using the `VersionDisplay` component
2. **Automatic Updates**: The version is automatically incremented (patch version) on every commit
3. **Build Integration**: The version is updated before each build process

## Setup

Run the setup script to configure version management:

```bash
npm run setup-version
```

This will:
- Set up a pre-commit git hook to auto-increment version
- Add `.env.local` to `.gitignore`
- Create initial `.env.local` file

## Scripts

- `npm run setup-version` - Initial setup of version management
- `npm run prebuild` - Manually update version (runs automatically on build)
- `npm run build` - Build with version update

## Files

- `scripts/update-version.js` - Script that increments version in package.json and creates .env.local
- `scripts/setup-version-management.sh` - Setup script for git hooks and configuration
- `src/components/VersionDisplay.tsx` - Component that displays the version
- `.env.local` - Generated file containing VITE_APP_VERSION (ignored by git)
- `.git/hooks/pre-commit` - Git hook that runs version update before commits

## Manual Version Control

If you need to manually set a specific version, you can:

1. Edit `package.json` to set the desired version
2. Run `npm run prebuild` to update the environment variables
3. Commit the changes

The next commit will increment from your manually set version.
