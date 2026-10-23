import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  IN_PROGRESS,
  IN_REVIEW,
  CLOSING_KEYWORD,
  ticketNumberFromPrBody,
  issueBodyLinksPr,
  hasReviewerOrAssignee,
  labelNames,
  buildIssueBody,
  prBodyWithTicket,
  desiredStatus,
  syncOne,
  run,
} = require("./pr-kanban-sync.cjs");

const closeOnNext = new RegExp(`${CLOSING_KEYWORD}\\s+#(\\d+)`, "gi");

function pr(overrides = {}) {
  return {
    number: 681,
    title: "feat(portfolio): show Tinyman LP deposits",
    body: "Notes about the change.",
    html_url: "https://github.com/DorkFi/dorkfi-app/pull/681",
    draft: true,
    labels: [{ name: "markets" }, { name: "ALGO" }],
    requested_reviewers: [],
    requested_teams: [],
    assignees: [],
    ...overrides,
  };
}

function createFakeGithub() {
  const state = {
    issues: [],
    nextNumber: 10,
    pullBodies: new Map(),
    statusWrites: [],
    projectLoads: 0,
  };
  const github = {
    rest: {
      issues: {
        async get({ issue_number }) {
          const issue = state.issues.find((item) => item.number === issue_number);
          if (!issue) {
            const error = new Error("Not Found");
            error.status = 404;
            throw error;
          }
          return { data: issue };
        },
        async create(params) {
          const number = state.nextNumber++;
          const issue = {
            number,
            node_id: `NODE_${number}`,
            title: params.title,
            body: params.body,
            labels: (params.labels || []).map((name) => ({ name })),
          };
          state.issues.push(issue);
          return { data: issue };
        },
        async listForRepo() {
          return { data: state.issues.map((issue) => ({ ...issue })) };
        },
      },
      pulls: {
        async update({ pull_number, body }) {
          state.pullBodies.set(pull_number, body);
          return { data: { number: pull_number, body } };
        },
        async list() {
          return { data: [] };
        },
      },
      search: {
        async issuesAndPullRequests() {
          return { data: { items: [] } };
        },
      },
    },
    async graphql(query, vars) {
      if (query.includes("query KanbanProject")) {
        state.projectLoads += 1;
        return {
          organization: {
            projectV2: {
              id: "PVT_test",
              field: {
                id: "FIELD_test",
                options: [
                  { id: "47fc9ee4", name: IN_PROGRESS },
                  { id: "df73e18b", name: IN_REVIEW },
                ],
              },
            },
          },
        };
      }
      if (query.includes("mutation AddKanbanItem")) {
        return { addProjectV2ItemById: { item: { id: `ITEM_${vars.contentId}` } } };
      }
      if (query.includes("mutation SetKanbanStatus")) {
        state.statusWrites.push(vars);
        return { updateProjectV2ItemFieldValue: { projectV2Item: { id: vars.itemId } } };
      }
      throw new Error(`unexpected graphql: ${query}`);
    },
    async paginate(_route, params) {
      state.listParams = params;
      return state.openPulls || [];
    },
  };
  return { github, state };
}

const core = { info() {}, warning() {} };

describe("markers", () => {
  it("reads the pull request marker and ignores the issue marker", () => {
    expect(ticketNumberFromPrBody("<!-- dorkfi-pr-ticket:44 -->")).toBe(44);
    expect(ticketNumberFromPrBody("<!-- dorkfi-pr-ticket-for:44 -->")).toBe(null);
    expect(ticketNumberFromPrBody("")).toBe(null);
  });

  it("matches an issue body to one pull request", () => {
    const body = buildIssueBody(pr());
    expect(issueBodyLinksPr(body, 681)).toBe(true);
    expect(issueBodyLinksPr(body, 682)).toBe(false);
    expect(body).toContain("https://github.com/DorkFi/dorkfi-app/pull/681");
  });
});

describe("prBodyWithTicket", () => {
  it("adds Closes and the marker without dropping existing text", () => {
    const next = prBodyWithTicket("Fixes the layout.\n\nCloses #10\n", 44);
    expect(next).toContain("Fixes the layout.");
    expect(next).toContain("Closes #10");
    expect(next).toContain("Closes #44");
    expect(ticketNumberFromPrBody(next)).toBe(44);
    expect(prBodyWithTicket(next, 44)).toBe(next);
  });

  it("writes a body the close-on-next workflow can see", () => {
    const next = prBodyWithTicket(null, 88);
    const numbers = [...next.matchAll(closeOnNext)].map((match) => Number(match[1]));
    expect(numbers).toEqual([88]);
    expect(prBodyWithTicket(next, 88)).toBe(next);
  });

  it("does not treat Closes #440 as Closes #44", () => {
    const next = prBodyWithTicket("Closes #440", 44);
    expect(next).toContain("Closes #440");
    expect(next).toContain("Closes #44");
  });
});

describe("desiredStatus", () => {
  it("starts a new pull request in progress, and does not rewind one that already has a reviewer", () => {
    expect(desiredStatus({ action: "opened", created: true, hasReviewer: false })).toBe(IN_PROGRESS);
    expect(desiredStatus({ action: "opened", created: true, hasReviewer: true })).toBe(IN_PROGRESS);
    expect(desiredStatus({ action: "opened", created: false, hasReviewer: true })).toBe(IN_REVIEW);
    expect(desiredStatus({ action: "opened", created: false, hasReviewer: false })).toBe(IN_PROGRESS);
  });

  it("puts a reopen on in review when a reviewer or assignee is still there", () => {
    expect(desiredStatus({ action: "reopened", hasReviewer: false })).toBe(IN_PROGRESS);
    expect(desiredStatus({ action: "reopened", hasReviewer: true, created: true })).toBe(IN_REVIEW);
  });

  it("moves to in review when a reviewer is requested or someone is assigned", () => {
    expect(desiredStatus({ action: "review_requested" })).toBe(IN_REVIEW);
    expect(desiredStatus({ action: "assigned" })).toBe(IN_REVIEW);
  });

  it("returns to in progress only when the draft has no reviewers left", () => {
    expect(
      desiredStatus({ action: "review_request_removed", draft: true, hasReviewer: false })
    ).toBe(IN_PROGRESS);
    expect(
      desiredStatus({ action: "unassigned", draft: true, hasReviewer: false })
    ).toBe(IN_PROGRESS);
    expect(
      desiredStatus({ action: "converted_to_draft", draft: true, hasReviewer: false })
    ).toBe(IN_PROGRESS);
    expect(
      desiredStatus({ action: "review_request_removed", draft: false, hasReviewer: false })
    ).toBe(null);
    expect(
      desiredStatus({ action: "converted_to_draft", draft: true, hasReviewer: true })
    ).toBe(null);
    expect(
      desiredStatus({ action: "unassigned", draft: false, hasReviewer: true })
    ).toBe(null);
  });

  it("backfills from whoever is already requested or assigned", () => {
    expect(desiredStatus({ action: "backfill", hasReviewer: false })).toBe(IN_PROGRESS);
    expect(desiredStatus({ action: "backfill", hasReviewer: true })).toBe(IN_REVIEW);
  });
});

describe("reviewer detection", () => {
  it("counts requested reviewers, teams, and assignees", () => {
    expect(hasReviewerOrAssignee(pr())).toBe(false);
    expect(hasReviewerOrAssignee(pr({ requested_reviewers: [{ login: "temptemp3" }] }))).toBe(true);
    expect(hasReviewerOrAssignee(pr({ requested_teams: [{ slug: "reviewers" }] }))).toBe(true);
    expect(hasReviewerOrAssignee(pr({ assignees: [{ login: "temptemp3" }] }))).toBe(true);
    expect(labelNames(pr())).toEqual(["markets", "ALGO"]);
  });
});

describe("syncOne", () => {
  it("creates one issue, links the pull request, and sets In progress", async () => {
    const { github, state } = createFakeGithub();
    const pull = pr();
    const first = await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: pull,
      action: "opened",
    });

    expect(first.created).toBe(true);
    expect(first.status).toBe(IN_PROGRESS);
    expect(state.issues).toHaveLength(1);
    expect(state.issues[0].title).toBe(pull.title);
    expect(state.issues[0].labels.map((label) => label.name)).toEqual(["markets", "ALGO"]);
    expect(issueBodyLinksPr(state.issues[0].body, 681)).toBe(true);
    const linked = state.pullBodies.get(681);
    expect(linked).toContain("Closes #10");
    expect(ticketNumberFromPrBody(linked)).toBe(10);
    expect(state.statusWrites).toEqual([
      {
        projectId: "PVT_test",
        itemId: "ITEM_NODE_10",
        fieldId: "FIELD_test",
        optionId: "47fc9ee4",
      },
    ]);

    const second = await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: { ...pull, body: linked },
      action: "opened",
    });
    expect(second.created).toBe(false);
    expect(second.status).toBe(IN_PROGRESS);
    expect(state.issues).toHaveLength(1);
    expect(state.pullBodies.size).toBe(1);
  });

  it("reuses an issue found by its body when the pull request has no marker", async () => {
    const { github, state } = createFakeGithub();
    state.issues.push({
      number: 7,
      node_id: "NODE_7",
      title: "already filed",
      body: buildIssueBody(pr()),
      labels: [],
    });
    const result = await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: pr({ body: "" }),
      action: "opened",
    });
    expect(result.created).toBe(false);
    expect(result.issue.number).toBe(7);
    expect(state.pullBodies.get(681)).toContain("Closes #7");
    expect(state.issues.filter((issue) => issue.number !== 7)).toHaveLength(0);
  });

  it("sets In review when a reviewer is requested", async () => {
    const { github, state } = createFakeGithub();
    const pull = pr({
      draft: false,
      requested_reviewers: [{ login: "temptemp3" }],
    });
    await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: pull,
      action: "opened",
    });
    state.statusWrites.length = 0;
    await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: { ...pull, body: state.pullBodies.get(681) },
      action: "review_requested",
    });
    expect(state.statusWrites.map((write) => write.optionId)).toEqual(["df73e18b"]);
  });

  it("leaves status alone when reviewers are removed but the PR is not a draft", async () => {
    const { github, state } = createFakeGithub();
    const pull = pr({ draft: false, body: "" });
    await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: pull,
      action: "opened",
    });
    const writes = state.statusWrites.length;
    const result = await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: { ...pull, body: state.pullBodies.get(681), draft: false },
      action: "review_request_removed",
    });
    expect(result.status).toBe(null);
    expect(state.statusWrites).toHaveLength(writes);
  });

  it("moves a draft with no reviewers back to In progress", async () => {
    const { github, state } = createFakeGithub();
    const pull = pr({ draft: true, assignees: [{ login: "temptemp3" }] });
    await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: pull,
      action: "assigned",
    });
    expect(state.statusWrites.at(-1).optionId).toBe("df73e18b");
    await syncOne({
      github,
      core,
      owner: "DorkFi",
      repo: "dorkfi-app",
      pr: { ...pull, body: state.pullBodies.get(681), assignees: [], draft: true },
      action: "converted_to_draft",
    });
    expect(state.statusWrites.at(-1).optionId).toBe("47fc9ee4");
  });
});

describe("run backfill", () => {
  it("syncs each open pull request without being invoked as a pull_request event", async () => {
    const { github, state } = createFakeGithub();
    state.openPulls = [
      pr({ number: 687, title: "later", html_url: "https://github.com/DorkFi/dorkfi-app/pull/687" }),
      pr({
        number: 684,
        title: "in review",
        html_url: "https://github.com/DorkFi/dorkfi-app/pull/684",
        draft: false,
        requested_reviewers: [{ login: "temptemp3" }],
      }),
    ];
    await run({
      github,
      core,
      context: {
        eventName: "workflow_dispatch",
        repo: { owner: "DorkFi", repo: "dorkfi-app" },
        payload: {},
      },
    });
    expect(state.listParams).toMatchObject({ owner: "DorkFi", repo: "dorkfi-app", state: "open" });
    expect(state.issues.map((issue) => issue.title)).toEqual(["in review", "later"]);
    expect(state.statusWrites.map((write) => write.optionId)).toEqual(["df73e18b", "47fc9ee4"]);
    expect(state.projectLoads).toBe(1);
  });
});
