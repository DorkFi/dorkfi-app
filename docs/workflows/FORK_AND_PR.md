# Fork and open a PR (GitHub CLI)

Use this when you work from a local clone and need to contribute via your own fork instead of pushing directly to the upstream repo.

**Placeholders**

| Placeholder | Meaning |
|-------------|---------|
| `UPSTREAM_OWNER/REPO` | The repository you are contributing to (e.g. `acme/widgets`) |
| `YOUR_USER` | Your GitHub username |
| `YOUR_BRANCH` | The branch with your changes |
| `BASE_BRANCH` | The branch you want to merge into (often `main` or `master`) |
| `FORK_REMOTE` | The git remote pointing at your fork (often `origin` after `gh repo fork`, or a name you choose) |

---

## 0. Optional: authenticate with GitHub

If `gh` is not logged in, or commands fail with auth errors:

```bash
gh auth login -h github.com
```

Follow the prompts (browser or token). Use HTTPS and grant `repo` scope if you will open PRs and push to private forks.

---

## 1. Ensure `upstream` and your fork remote

**Typical layout**

- `upstream` → `https://github.com/UPSTREAM_OWNER/REPO.git` (read from here, open PRs against this)
- `origin` or `fork` → your fork `https://github.com/YOUR_USER/REPO.git`

If you cloned the upstream repo directly, add `upstream` only if you need it for syncing; the fork step below can add your fork as a remote.

---

## 2. Create the fork (one-time per machine / clone)

From your local clone of the upstream repo (so `gh` knows which repo to fork):

```bash
gh repo fork --remote=true
```

Or pass the repository explicitly:

```bash
gh repo fork UPSTREAM_OWNER/REPO --remote=true
```

This creates a fork under `YOUR_USER` and adds a remote (commonly `origin`) pointing at it. Note the remote name `gh` prints.

If the fork already exists on GitHub, you can add it manually:

```bash
git remote add FORK_REMOTE https://github.com/YOUR_USER/REPO.git
```

---

## 3. Push your branch to the fork

Replace `FORK_REMOTE` with the remote that points at your fork:

```bash
git push FORK_REMOTE -u YOUR_BRANCH
```

---

## 4. Open the PR

**Explicit (works from any clone, first time):**

```bash
gh pr create --repo UPSTREAM_OWNER/REPO --base BASE_BRANCH --head YOUR_USER:YOUR_BRANCH
```

**Interactive (after push, often enough):**

```bash
gh pr create
```

`gh` can detect the fork and suggest the correct head branch.

---

## Alternative: fork on the web

1. Open `https://github.com/UPSTREAM_OWNER/REPO` and use **Fork**.
2. Add your fork and push:
   ```bash
   git remote add FORK_REMOTE https://github.com/YOUR_USER/REPO.git
   git push FORK_REMOTE -u YOUR_BRANCH
   ```
3. On GitHub, open your fork, select `YOUR_BRANCH`, then **Compare & pull request** targeting `UPSTREAM_OWNER/REPO` and `BASE_BRANCH`.

---

## Quick reference

| Goal | Command |
|------|---------|
| See remotes | `git remote -v` |
| Default repo for `gh` in this folder | `gh repo set-default UPSTREAM_OWNER/REPO` |
