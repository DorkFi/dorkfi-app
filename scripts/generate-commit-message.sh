#!/bin/bash

# Generate git commit message based on current changes
# Usage: ./scripts/generate-commit-message.sh

echo "🔍 Analyzing git changes..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Get list of modified files
MODIFIED_FILES=$(git diff --name-only)
STAGED_FILES=$(git diff --cached --name-only)
UNTRACKED_FILES=$(git ls-files --others --exclude-standard)

if [ -z "$MODIFIED_FILES" ] && [ -z "$STAGED_FILES" ] && [ -z "$UNTRACKED_FILES" ]; then
    echo "ℹ️  No changes detected"
    exit 0
fi

echo ""
echo "📝 Modified files:"
if [ -n "$MODIFIED_FILES" ]; then
    echo "$MODIFIED_FILES" | sed 's/^/  - /'
fi

if [ -n "$STAGED_FILES" ]; then
    echo "📦 Staged files:"
    echo "$STAGED_FILES" | sed 's/^/  - /'
fi

if [ -n "$UNTRACKED_FILES" ]; then
    echo "🆕 Untracked files:"
    echo "$UNTRACKED_FILES" | sed 's/^/  - /'
fi

echo ""
echo "📋 Suggested commit message:"
echo ""

# Analyze changes and generate commit message
COMMIT_TYPE="feat"
COMMIT_SCOPE=""
COMMIT_DESCRIPTION=""

# Combine all files for analysis
ALL_FILES="$MODIFIED_FILES $STAGED_FILES $UNTRACKED_FILES"

# Determine commit type based on file patterns
if echo "$ALL_FILES" | grep -q "test\|spec"; then
    COMMIT_TYPE="test"
elif echo "$ALL_FILES" | grep -q "docs\|README\|\.md"; then
    COMMIT_TYPE="docs"
elif echo "$ALL_FILES" | grep -q "style\|css\|scss"; then
    COMMIT_TYPE="style"
elif echo "$ALL_FILES" | grep -q "refactor"; then
    COMMIT_TYPE="refactor"
elif echo "$ALL_FILES" | grep -q "fix\|bug"; then
    COMMIT_TYPE="fix"
elif [ -n "$UNTRACKED_FILES" ]; then
    COMMIT_TYPE="feat"
fi

# Determine scope based on directory structure
if echo "$ALL_FILES" | grep -q "src/components/"; then
    COMMIT_SCOPE="components"
elif echo "$ALL_FILES" | grep -q "src/hooks/"; then
    COMMIT_SCOPE="hooks"
elif echo "$ALL_FILES" | grep -q "src/services/"; then
    COMMIT_SCOPE="services"
elif echo "$ALL_FILES" | grep -q "src/pages/"; then
    COMMIT_SCOPE="pages"
elif echo "$ALL_FILES" | grep -q "src/utils/"; then
    COMMIT_SCOPE="utils"
fi

# Generate description based on actual changes
if [ -n "$UNTRACKED_FILES" ]; then
    COMMIT_DESCRIPTION="add new files and features"
elif [ -n "$MODIFIED_FILES" ]; then
    # Get a sample of the changes
    SAMPLE_DIFF=$(git diff --unified=1 | head -20)
    
    if echo "$SAMPLE_DIFF" | grep -q "TODO\|FIXME"; then
        COMMIT_DESCRIPTION="add TODO comments for future improvements"
    elif echo "$SAMPLE_DIFF" | grep -q "console\.log\|console\.error"; then
        COMMIT_DESCRIPTION="add debugging logs"
    elif echo "$SAMPLE_DIFF" | grep -q "import.*from"; then
        COMMIT_DESCRIPTION="update imports and dependencies"
    elif echo "$SAMPLE_DIFF" | grep -q "export.*function\|export.*const"; then
        COMMIT_DESCRIPTION="add new functions and exports"
    elif echo "$SAMPLE_DIFF" | grep -q "return.*null\|return.*undefined"; then
        COMMIT_DESCRIPTION="update return values and logic"
    else
        COMMIT_DESCRIPTION="update implementation"
    fi
else
    COMMIT_DESCRIPTION="stage changes for commit"
fi

# Format the commit message
if [ -n "$COMMIT_SCOPE" ]; then
    COMMIT_HEADER="${COMMIT_TYPE}(${COMMIT_SCOPE}): ${COMMIT_DESCRIPTION}"
else
    COMMIT_HEADER="${COMMIT_TYPE}: ${COMMIT_DESCRIPTION}"
fi

echo "$COMMIT_HEADER"
echo ""

# Add bullet points for specific files
echo "Changes:"
if [ -n "$MODIFIED_FILES" ]; then
    echo "$MODIFIED_FILES" | while read -r file; do
        echo "  - Update $file"
    done
fi

if [ -n "$STAGED_FILES" ]; then
    echo "$STAGED_FILES" | while read -r file; do
        echo "  - Stage $file"
    done
fi

if [ -n "$UNTRACKED_FILES" ]; then
    echo "$UNTRACKED_FILES" | while read -r file; do
        echo "  - Add $file"
    done
fi

echo ""
echo "💡 To use this commit message:"
if [ -n "$UNTRACKED_FILES" ]; then
    echo "git add . && git commit -m \"$COMMIT_HEADER\""
    echo ""
    echo "📝 Note: This will add all untracked files. To be more selective:"
    echo "git add <specific-files> && git commit -m \"$COMMIT_HEADER\""
else
    echo "git commit -m \"$COMMIT_HEADER\""
fi
echo ""
echo "📋 Or copy the full message above for a detailed commit"
