/**
 * GitHub REST API Service
 * Replaces simulated repo data with real GitHub API calls.
 */

import { withBreaker } from '../lib/circuitBreaker';
import { fetchGitHubProxy } from './apiClient';
import { logger } from '../lib/logger';

const GITHUB_API = "https://api.github.com";
const TIMEOUT = 10000;
const GITHUB_CIRCUIT = 'github-api';

function getHeaders(token?: string): HeadersInit {
  const finalToken = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Nexus-Alpha",
  };
  if (finalToken) headers["Authorization"] = `Bearer ${finalToken}`;
  return headers;
}

export interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  html_url: string;
  pushed_at: string;
  open_issues_count: number;
}

export interface GHTrendingRepo extends GHRepo {
  weeklyGrowth?: number;
}



/** Search trending repos created/pushed in last N days */
export async function searchTrendingRepos(
  query: string,
  days = 7,
  token?: string
): Promise<GHRepo[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  const url = new URL(`${GITHUB_API}/search/repositories`);
  url.searchParams.set("q", `${query} pushed:>${since}`);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "20");

  return withBreaker(
    GITHUB_CIRCUIT,
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      try {
        const res = await fetch(url.toString(), { headers: getHeaders(token), signal: controller.signal });
        if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
        const data = await res.json();
        return (data.items || []) as GHRepo[];
      } finally {
        clearTimeout(timer);
      }
    },
    [], // Return empty instead of misleading fake data
  );
}

/** Get a specific repo's details */
export async function getRepo(owner: string, repo: string, token?: string): Promise<GHRepo> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Trigger a GitHub Actions workflow dispatch */
export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowId: string,
  ref = "main",
  inputs: Record<string, string> = {},
  token?: string
): Promise<void> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: "POST",
      headers: { ...getHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref, inputs }),
    }
  );
  if (!res.ok) throw new Error(`GitHub workflow trigger failed: ${res.status} ${res.statusText}`);
}

/** List workflow runs for a repo */
export async function getWorkflowRuns(
  owner: string,
  repo: string,
  workflowId?: string,
  token?: string
) {
  const path = workflowId
    ? `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`
    : `${GITHUB_API}/repos/${owner}/${repo}/actions/runs`;
  const res = await fetch(`${path}?per_page=10`, { headers: getHeaders(token) });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const json = await res.json();
  return json.workflow_runs;
}

/** Get the latest commit SHA for a branch */
export async function getLatestCommit(
  owner: string,
  repo: string,
  branch = "main",
  token?: string
): Promise<{ sha: string; message: string; author: string; date: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/commits/${branch}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const json = await res.json();
  return {
    sha: json.sha,
    message: json.commit.message,
    author: json.commit.author.name,
    date: json.commit.author.date,
  };
}

/** Run npm audit via GitHub security advisories API */
export async function getSecurityAdvisories(
  ecosystem = "npm",
  token?: string
): Promise<{ ghsa_id: string; summary: string; severity: string; published_at: string }[]> {
  const res = await fetch(
    `${GITHUB_API}/advisories?ecosystem=${ecosystem}&per_page=10&sort=published&direction=desc`,
    { headers: getHeaders(token) }
  );
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

/** Create a new GitHub repository */
export async function createRepo(
  name: string,
  options: {
    description?: string;
    private?: boolean;
    autoInit?: boolean;
    token?: string;
  } = {}
): Promise<GHRepo> {
  const { token, ...body } = options;
  const res = await fetch(`${GITHUB_API}/user/repos`, {
    method: "POST",
    headers: { ...getHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name, ...body }),
  });
  if (!res.ok) throw new Error(`GitHub create repo failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Create or update a file in a GitHub repository */
export async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  options: { branch?: string; sha?: string; token?: string } = {}
): Promise<{ content: { sha: string }; commit: { sha: string } }> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: options.branch || "main",
  };
  if (options.sha) body.sha = options.sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...getHeaders(options.token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub create/update file failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Push multiple files to a GitHub repo (useful for uploading a built project) */
export async function pushFilesToRepo(
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  message: string,
  token?: string
): Promise<void> {
  const baseUrl = `${GITHUB_API}/repos/${owner}/${repo}`;

  const refRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, { headers: getHeaders(token) });
  if (!refRes.ok) throw new Error(`Branch not found: ${refRes.status}`);
  const ref = await refRes.json();
  const latestCommitSha = ref.object.sha;

  const commitRes = await fetch(`${baseUrl}/git/commits/${latestCommitSha}`, { headers: getHeaders(token) });
  if (!commitRes.ok) throw new Error(`Commit not found: ${commitRes.status}`);
  const commit = await commitRes.json();
  const treeSha = commit.tree.sha;

  const treeEntries = files.map(f => ({
    path: f.path,
    mode: "100644" as const,
    type: "blob" as const,
    content: f.content,
  }));

  const treeRes = await fetch(`${baseUrl}/git/trees`, {
    method: "POST",
    headers: { ...getHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: treeSha, tree: treeEntries }),
  });
  if (!treeRes.ok) throw new Error(`Tree creation failed: ${treeRes.status}`);
  const newTree = await treeRes.json();

  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: "POST",
    headers: { ...getHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [latestCommitSha] }),
  });
  if (!newCommitRes.ok) throw new Error(`Commit creation failed: ${newCommitRes.status}`);
  const newCommit = await newCommitRes.json();

  const updateRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers: { ...getHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });
  if (!updateRes.ok) throw new Error(`Branch update failed: ${updateRes.status}`);
}
