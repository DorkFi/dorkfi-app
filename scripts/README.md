# Git Helper Scripts

This directory contains helpful scripts for git workflow automation.

## generate-commit-message.sh

Automatically generates conventional commit messages based on your current git changes.

### Usage

```bash
# Generate a commit message suggestion
./scripts/generate-commit-message.sh

# Or use the alias (if added to your shell profile)
gcm
```

### Features

- Analyzes modified, staged, and untracked files
- Determines appropriate commit type (feat, fix, refactor, etc.)
- Identifies scope based on directory structure
- Generates descriptive commit messages
- Provides ready-to-use git commands
- Handles new files with appropriate commit type detection

### Example Output

```
🔍 Analyzing git changes...

📝 Modified files:
  - src/components/SupplyBorrowForm.tsx
🆕 Untracked files:
  - scripts/generate-commit-message.sh

📋 Suggested commit message:

feat(components): add new files and features

Changes:
  - Update src/components/SupplyBorrowForm.tsx
  - Add scripts/generate-commit-message.sh

💡 To use this commit message:
git add . && git commit -m "feat(components): add new files and features"

📝 Note: This will add all untracked files. To be more selective:
git add <specific-files> && git commit -m "feat(components): add new files and features"
```

## git-aliases.sh

Contains useful git aliases you can add to your shell profile.

### Setup

Add this line to your `~/.zshrc` or `~/.bashrc`:

```bash
source /path/to/dorkfi-prefi-frontend/scripts/git-aliases.sh
```

### Available Aliases

- `gcm` - Generate commit message
- `gd` - Better formatted git diff
- `gds` - Show staged changes

## Quick Start

1. Make your changes
2. Run `./scripts/generate-commit-message.sh`
3. Copy the suggested commit message
4. Run `git commit -m "your message here"`
