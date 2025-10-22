# Git commit message generator aliases
# Add these to your ~/.zshrc or ~/.bashrc

# Quick commit message generation
alias gcm='./scripts/generate-commit-message.sh'

# Quick commit with generated message (use with caution)
alias gcmc='./scripts/generate-commit-message.sh && echo "Press Enter to commit with the suggested message, or Ctrl+C to cancel" && read && git commit -m "$(./scripts/generate-commit-message.sh | grep "^[a-z]*(" | head -1)"'

# Show git diff with better formatting
alias gd='git diff --color=always | less -R'

# Show staged changes
alias gds='git diff --cached --color=always | less -R'
