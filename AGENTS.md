# Agent notes (DorkFi/dorkfi-app)

Local workflow for features and fixes—not org-wide policy. Full steps: [Development kanban workflow](docs/workflows/DEVELOPMENT_KANBAN.md).

## Every feature or fix

1. **Branch** from `next`: `feat/<issue>-short-name` or `fix/<issue>-short-name` (or `feat/short-name` / `fix/short-name` until an issue exists). Commit and push; no PR required until review-ready.
2. **Kanban** — GitHub issue on DorkFi/dorkfi-app, on **DorkFi Development Kanban**, with Summary, Done when, Not this card, and the branch name. Status **In progress** while on the feature branch.
3. **Labels & assign** — Kind, Area, Chain, Priority as needed; project P0–P2 and Size when the card needs them.
4. **Review** — PR into `next` with summary, test plan, and `Closes #<issue>`. Run `npm run lint` and `npm run test` first. Status **In review**.
5. **After merge to `next`** — Status **Done Today**. Beta promotion is separate.

Do not deploy or change production hosting unless explicitly asked.
