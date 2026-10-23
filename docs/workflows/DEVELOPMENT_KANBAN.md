# Development kanban workflow (local practice)

This describes how **we** run feature and fix work on **DorkFi/dorkfi-app**. It is **local team practice** for contributors and coding agents—not an org-wide policy. Others may follow similar habits already; this doc is the reference we point agents and new contributors at.

**Default branch:** `next` (integration). Promoting `next` → `beta` (or beyond) is a **separate** release step and is out of scope for this card workflow.

---

## 1. Branch

1. Start from an up-to-date `next`:
   ```bash
   git fetch origin next
   git checkout next
   git pull origin next
   ```
2. Create a feature branch:
   - **With a tracking issue:** `feat/<issue>-short-name` or `fix/<issue>-short-name`  
     Example: `feat/702-algo-min-balance-error`
   - **No issue yet:** `feat/short-name` or `fix/short-name`  
     Create the issue as soon as you know the number, then rename the branch if you want the issue in the name.
3. Commit on that branch and push to GitHub. Leave the branch on the remote while work is in progress. You do **not** need an open pull request until the change is ready for review.

`<issue>` is the **GitHub issue number** on DorkFi/dorkfi-app.

---

## 2. Kanban (GitHub issue + project)

Track work on the **DorkFi Development Kanban** (GitHub project on this repo).

1. If no issue exists, **create one** on DorkFi/dorkfi-app and **add it to that project**.
2. Issue body should include:
   - **Summary** — what and why, in a few sentences.
   - **Done when** — checklist of acceptance criteria.
   - **Not this card** — explicit out-of-scope items so scope creep stays visible.
   - **Branch** — the feature branch name (e.g. `feat/702-algo-min-balance-error`).

One issue per piece of work on the board unless you deliberately split subtasks.

---

## 3. Status (project field)

While implementation stays on the feature branch (no review yet):

- Set project **Status** to **In progress**.

When the pull request is open and ready for human review:

- Set **Status** to **In review**.

After the pull request **merges into `next`**:

- Set **Status** to **Done Today**.

Closing the GitHub issue (via `Closes #N` on the PR) is separate from the project column; move the card to **Done Today** on merge even though the issue may auto-close.

---

## 4. Assign and label

On the GitHub issue:

**Assign** the people who own the work (one or more).

**Labels** (use what applies):

| Group | Labels |
|-------|--------|
| Kind | `bug`, `Enhancement`, `Feature`, `Improvement`, `documentation` |
| Area | `markets`, `UI/UX`, `Mobile`, `Desktop`, `Governance`, `Wallet`, `Failed Transaction`, `risk` |
| Chain | `ALGO`, `VOI` |
| Priority (when it matters) | `High Priority`, `Medium Priority`, `Low Priority` |

**Kind hints:** `bug` for defects; `Feature` for user-visible capability; `Improvement` for refinements; `Enhancement` when none of the above fit or legacy issues used it; `documentation` for docs-only.

**Project fields** (when the card needs them): **Priority** (P0, P1, P2) and **Size** (XS, S, M, L, XL).

---

## 5. Review (pull request)

When the branch is **ready for review** (not for every WIP push):

1. Open a pull request **into `next`** from the feature branch.
2. PR body:
   - **Summary** of the change.
   - **Test plan** — what you ran or what reviewers should verify.
   - **`Closes #<issue>`** so the issue closes when the merge lands on `next`.  
     The repo also runs [close-issues-on-next](../../.github/workflows/close-issues-on-next.yml) for closing keywords in commits/PRs on `next`.
3. Before requesting review, run locally:
   ```bash
   npm run lint
   npm run test
   ```
4. Move the kanban card to **In review** and request reviewers as usual.

Prefer opening the PR when ready rather than keeping a long-lived draft PR for WIP (unless you explicitly want draft visibility).

---

## 6. Release

- **Merge to `next`** completes the card workflow (**Done Today** on the board).
- Shipping that commit to **beta** or production is **not** automatic—handle promotion on its own schedule.

---

## Agents and automation

- **Coding agents** (Cursor Cloud, Gork Bot, etc.) should follow this doc: issue on the kanban early, `feat/` / `fix/` branches from `next`, PR + test plan + `Closes #N` when ready.
- Optional GitHub automation (e.g. PR-opened kanban sync) may exist on other branches; **this workflow is issue-first and manual project updates** unless the team turns automation on repo-wide.

---

## Quick checklist

| Phase | Branch | Issue / project | PR |
|-------|--------|-----------------|-----|
| Start | `feat/` or `fix/` from `next`, push | Create/add to kanban, **In progress**, labels, branch name in body | — |
| Review | Same branch | **In review** | Into `next`, summary, test plan, `Closes #N`, lint + test |
| Done | Merged to `next` | **Done Today** | Merged |
