# Fork and open a PR (port_refresh_v1)

## 1. Re-authenticate with GitHub (one-time)

Your `gh` token is invalid. In a terminal:

```bash
gh auth login -h github.com
```

Follow the prompts (browser or token). Use HTTPS and grant repo scope.

---

## 2. Create the fork (one-time)

From the repo root:

```bash
gh repo fork --remote=true
```

This creates a fork under your GitHub user (e.g. `mikepappalardo/dorkfi-app`) and adds it as remote `origin` (or prompts to add a different remote name). If it adds a remote named something other than `origin`, note the name (e.g. `mikepappalardo`).

---

## 3. Push your branch to the fork

If the fork was added as `origin` (and now points to your fork):

```bash
git push origin -u port_refresh_v1
```

If the fork was added under a different remote (e.g. `mikepappalardo`):

```bash
git push mikepappalardo -u port_refresh_v1
```

(Replace with the remote name `gh repo fork` reported.)

---

## 4. Open the PR

```bash
gh pr create --repo DorkFi/dorkfi-app --base main --head mikepappalardo:port_refresh_v1
```

If your fork’s default branch is not `port_refresh_v1`, `--head` should be `YOUR_GITHUB_USER:port_refresh_v1`. After the first push, you can also run:

```bash
gh pr create
```

and `gh` will suggest the fork branch.

---

## Alternative: fork on the web

1. Open https://github.com/DorkFi/dorkfi-app and click **Fork**.
2. Add your fork as a remote and push:
   ```bash
   git remote add myfork https://github.com/mikepappalardo/dorkfi-app.git
   git push myfork -u port_refresh_v1
   ```
3. On GitHub, open your fork, choose branch `port_refresh_v1`, then **Compare & pull request** to `DorkFi/dorkfi-app`.
