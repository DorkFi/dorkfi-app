"use strict";

// Links a pull request to one tracking issue on the DorkFi Development Kanban
// (https://github.com/orgs/DorkFi/projects/2) and moves Status between
// "In progress" and "In review".
//
// Idempotency key: an HTML marker in the PR body (`dorkfi-pr-ticket:<issue>`)
// and the matching marker in the issue body (`dorkfi-pr-ticket-for:<pr>`).
// The PR also gets `Closes #<issue>` so close-issues-on-next.yml closes the
// ticket when the PR reaches `next`.

const PROJECT_NUMBER = 2;
const IN_PROGRESS = "In progress";
const IN_REVIEW = "In review";

const PR_MARKER_RE = /<!--\s*dorkfi-pr-ticket:\s*(\d+)\s*-->/;
const ISSUE_MARKER_RE = /<!--\s*dorkfi-pr-ticket-for:\s*(\d+)\s*-->/;
const CLOSING_KEYWORD =
  "(?:fix|fixes|close|closes|closed|resolve|resolves|addresses)";

const PROJECT_QUERY = `
  query KanbanProject($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        id
        field(name: "Status") {
          ... on ProjectV2SingleSelectField {
            id
            options { id name }
          }
        }
      }
    }
  }
`;

const ADD_ITEM = `
  mutation AddKanbanItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { id }
    }
  }
`;

const SET_STATUS = `
  mutation SetKanbanStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }
    ) {
      projectV2Item { id }
    }
  }
`;

function ticketNumberFromPrBody(body) {
  if (!body) return null;
  const match = String(body).match(PR_MARKER_RE);
  return match ? Number(match[1]) : null;
}

function issueBodyLinksPr(body, prNumber) {
  if (!body) return false;
  const match = String(body).match(ISSUE_MARKER_RE);
  return Boolean(match) && Number(match[1]) === Number(prNumber);
}

function closingLinePresent(body, issueNumber) {
  const re = new RegExp(`${CLOSING_KEYWORD}\\s+#${issueNumber}\\b`, "i");
  return re.test(body || "");
}

function hasReviewerOrAssignee(pr) {
  const reviewers = (pr && pr.requested_reviewers) || [];
  const teams = (pr && pr.requested_teams) || [];
  const assignees = (pr && pr.assignees) || [];
  return reviewers.length > 0 || teams.length > 0 || assignees.length > 0;
}

function labelNames(pr) {
  return ((pr && pr.labels) || []).map((label) => label && label.name).filter(Boolean);
}

function issueTitle(pr) {
  const title = String((pr && pr.title) || "").trim();
  return title || `Pull request #${pr.number}`;
}

function buildIssueBody(pr) {
  return [
    `Tracking ticket for pull request #${pr.number}.`,
    "",
    pr.html_url,
    "",
    `<!-- dorkfi-pr-ticket-for:${pr.number} -->`,
    "",
  ].join("\n");
}

// Appends the closing keyword and the marker. A second call with the same
// issue number returns the body unchanged when both are already present.
function prBodyWithTicket(body, issueNumber) {
  const marker = `<!-- dorkfi-pr-ticket:${issueNumber} -->`;
  let next = body ?? "";
  const marked = ticketNumberFromPrBody(next);
  if (marked && marked !== issueNumber) {
    next = next.replace(PR_MARKER_RE, marker);
  }
  if (!closingLinePresent(next, issueNumber)) {
    const trimmed = next.replace(/\s*$/, "");
    next = trimmed ? `${trimmed}\n\nCloses #${issueNumber}\n` : `Closes #${issueNumber}\n`;
  }
  if (!ticketNumberFromPrBody(next)) {
    const trimmed = next.replace(/\s*$/, "");
    next = trimmed ? `${trimmed}\n\n${marker}\n` : `${marker}\n`;
  }
  return next;
}

// Status to write, or null when this event should leave Status alone.
// `created` is true only when this run just filed the tracking issue.
function desiredStatus({ action, draft = false, hasReviewer = false, created = false }) {
  if (action === "review_requested" || action === "assigned") {
    return IN_REVIEW;
  }
  if (
    action === "review_request_removed" ||
    action === "unassigned" ||
    action === "converted_to_draft"
  ) {
    // Both have to be true: nobody left to review, and the PR is a draft again.
    return draft && !hasReviewer ? IN_PROGRESS : null;
  }
  if (action === "backfill") {
    return hasReviewer ? IN_REVIEW : IN_PROGRESS;
  }
  if (action === "opened") {
    // A new ticket starts In progress, even if reviewers were added in the
    // same create (a following review_requested event moves it). A later re-run
    // of this same opened event must not drag an already-reviewed PR backwards.
    if (created || !hasReviewer) return IN_PROGRESS;
    return IN_REVIEW;
  }
  if (action === "reopened") {
    // review_requested does not fire again for reviewers who are still on the PR.
    return hasReviewer ? IN_REVIEW : IN_PROGRESS;
  }
  return null;
}

function logInfo(core, message) {
  if (core && typeof core.info === "function") core.info(message);
  else console.log(message);
}

function logWarning(core, message) {
  if (core && typeof core.warning === "function") core.warning(message);
  else console.warn(message);
}

function notFound(error) {
  return error && (error.status === 404 || error.status === 410);
}

async function loadIssue(github, owner, repo, issueNumber) {
  const { data } = await github.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return data;
}

async function findCandidateIssues(github, core, { owner, repo, prNumber }) {
  const found = new Map();
  const query = `repo:${owner}/${repo} is:issue "dorkfi-pr-ticket-for:${prNumber}" in:body`;
  try {
    const { data } = await github.rest.search.issuesAndPullRequests({
      q: query,
      per_page: 10,
    });
    for (const item of data.items || []) {
      if (!item.pull_request && issueBodyLinksPr(item.body, prNumber)) {
        found.set(item.number, item);
      }
    }
  } catch (error) {
    logWarning(
      core,
      `Issue search failed (${error.status || error.message}). Checking the recent issue list.`
    );
  }

  // Search can lag behind a ticket created moments ago. The list API does not.
  const { data: recent } = await github.rest.issues.listForRepo({
    owner,
    repo,
    state: "all",
    sort: "created",
    direction: "desc",
    per_page: 30,
  });
  for (const item of recent || []) {
    if (!item.pull_request && issueBodyLinksPr(item.body, prNumber)) {
      found.set(item.number, item);
    }
  }
  return [...found.values()].sort((a, b) => a.number - b.number);
}

async function ensureTicket(github, core, { owner, repo, pr }) {
  const marked = ticketNumberFromPrBody(pr.body);
  if (marked) {
    try {
      const issue = await loadIssue(github, owner, repo, marked);
      if (!issue.pull_request && issueBodyLinksPr(issue.body, pr.number)) {
        return { issue, created: false };
      }
      logWarning(
        core,
        `PR #${pr.number} marker points at #${marked}, which is not this pull request's ticket. Searching.`
      );
    } catch (error) {
      if (!notFound(error)) throw error;
      logWarning(
        core,
        `PR #${pr.number} marker points at missing issue #${marked}. Searching.`
      );
    }
  }

  const candidates = await findCandidateIssues(github, core, {
    owner,
    repo,
    prNumber: pr.number,
  });
  if (candidates.length > 1) {
    logWarning(
      core,
      `PR #${pr.number} has ${candidates.length} kanban tickets. Using #${candidates[0].number}.`
    );
  }
  if (candidates.length > 0) {
    const issue = await loadIssue(github, owner, repo, candidates[0].number);
    if (!issue.pull_request && issueBodyLinksPr(issue.body, pr.number)) {
      return { issue, created: false };
    }
  }

  const labels = labelNames(pr);
  const { data: issue } = await github.rest.issues.create({
    owner,
    repo,
    title: issueTitle(pr),
    body: buildIssueBody(pr),
    ...(labels.length ? { labels } : {}),
  });
  logInfo(core, `PR #${pr.number}: created tracking issue #${issue.number}`);
  return { issue, created: true };
}

async function linkPullRequestBody(github, core, { owner, repo, pr, issueNumber }) {
  const nextBody = prBodyWithTicket(pr.body, issueNumber);
  if (nextBody === (pr.body ?? "")) return nextBody;
  await github.rest.pulls.update({
    owner,
    repo,
    pull_number: pr.number,
    body: nextBody,
  });
  logInfo(core, `PR #${pr.number}: added Closes #${issueNumber}`);
  return nextBody;
}

async function loadProject(github, owner) {
  const data = await github.graphql(PROJECT_QUERY, {
    org: owner,
    number: PROJECT_NUMBER,
  });
  const project = data.organization && data.organization.projectV2;
  if (!project || !project.id) {
    throw new Error(
      `Could not read organization project ${owner} #${PROJECT_NUMBER}. PROJECT_TOKEN needs access to the DorkFi Development Kanban.`
    );
  }
  const field = project.field;
  if (!field || !field.id || !Array.isArray(field.options)) {
    throw new Error(
      `Organization project ${owner} #${PROJECT_NUMBER} has no Status single-select field.`
    );
  }
  return { projectId: project.id, fieldId: field.id, options: field.options };
}

async function setProjectStatus(github, { owner, contentNodeId, status, project }) {
  const board = project || (await loadProject(github, owner));
  const option = board.options.find((item) => item.name === status);
  if (!option) {
    const names = board.options.map((item) => item.name).join(", ");
    throw new Error(`Kanban Status has no "${status}" option. Options: ${names}`);
  }
  const added = await github.graphql(ADD_ITEM, {
    projectId: board.projectId,
    contentId: contentNodeId,
  });
  const itemId = added.addProjectV2ItemById && added.addProjectV2ItemById.item.id;
  if (!itemId) {
    throw new Error(`Could not add issue ${contentNodeId} to the kanban.`);
  }
  await github.graphql(SET_STATUS, {
    projectId: board.projectId,
    itemId,
    fieldId: board.fieldId,
    optionId: option.id,
  });
  return { ...board, optionId: option.id, itemId };
}

async function syncOne({ github, core, owner, repo, pr, action, project }) {
  const { issue, created } = await ensureTicket(github, core, { owner, repo, pr });
  await linkPullRequestBody(github, core, {
    owner,
    repo,
    pr,
    issueNumber: issue.number,
  });

  const hasReviewer = hasReviewerOrAssignee(pr);
  let status = desiredStatus({
    action,
    draft: Boolean(pr.draft),
    hasReviewer,
    created,
  });
  // A ticket created on an event that does not itself choose a column still
  // has to land on the board.
  if (status == null && created) {
    status = hasReviewer ? IN_REVIEW : IN_PROGRESS;
  }
  if (!status) {
    logInfo(core, `PR #${pr.number}: issue #${issue.number} status unchanged`);
    return { issue, created, status: null };
  }
  if (!issue.node_id) {
    throw new Error(`Issue #${issue.number} has no node id, so it cannot be added to the kanban.`);
  }
  await setProjectStatus(github, {
    owner,
    contentNodeId: issue.node_id,
    status,
    project,
  });
  logInfo(core, `PR #${pr.number}: issue #${issue.number} → ${status}`);
  return { issue, created, status };
}

async function run({ github, context, core }) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  if (context.eventName === "workflow_dispatch") {
    logInfo(core, "Backfill mode: syncing every open pull request.");
    const prs = await github.paginate(github.rest.pulls.list, {
      owner,
      repo,
      state: "open",
      per_page: 100,
    });
    const ordered = [...prs].sort((a, b) => a.number - b.number);
    logInfo(core, `Found ${ordered.length} open pull request(s).`);
    const project = ordered.length ? await loadProject(github, owner) : null;
    for (const pr of ordered) {
      await syncOne({ github, core, owner, repo, pr, action: "backfill", project });
    }
    return;
  }

  const pr = context.payload && context.payload.pull_request;
  if (!pr) {
    logInfo(core, "No pull request on this event. Nothing to do.");
    return;
  }
  await syncOne({
    github,
    core,
    owner,
    repo,
    pr,
    action: context.payload.action,
  });
}

module.exports = {
  PROJECT_NUMBER,
  IN_PROGRESS,
  IN_REVIEW,
  CLOSING_KEYWORD,
  ticketNumberFromPrBody,
  issueBodyLinksPr,
  closingLinePresent,
  hasReviewerOrAssignee,
  labelNames,
  issueTitle,
  buildIssueBody,
  prBodyWithTicket,
  desiredStatus,
  syncOne,
  run,
};
