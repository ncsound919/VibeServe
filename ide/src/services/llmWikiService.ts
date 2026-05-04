/**
 * LLM Wiki Service
 * Karpathy-inspired persistent markdown knowledge base.
 * Stages: Ingestion → Compilation (via DeepSeek) → Retrieval (markdown links) → Linting
 *
 * NOTE: This service is server-only. All fs/path operations are guarded against
 * browser environments. Import this file only from server-side code.
 */

// ─── Browser guard ───────────────────────────────────────────────────────────
const IS_BROWSER = typeof window !== 'undefined';

// Lazily resolved Node.js modules — never imported at the top level so Vite
// will not attempt to bundle them for the browser.
let _fs: typeof import('fs') | null = null;
let _path: typeof import('path') | null = null;

async function getFs() {
  if (IS_BROWSER) throw new Error('[llmWikiService] Not available in browser');
  if (!_fs) _fs = await import('fs');
  return _fs;
}

async function getPath() {
  if (IS_BROWSER) throw new Error('[llmWikiService] Not available in browser');
  if (!_path) _path = await import('path');
  return _path;
}

// ─── Path helpers (lazy) ─────────────────────────────────────────────────────
async function getPaths() {
  const path = await getPath();
  const WIKI_ROOT = path.resolve(process.cwd(), 'uploads', 'wiki');
  return {
    WIKI_ROOT,
    RAW_DIR: path.join(WIKI_ROOT, 'raw'),
    PAGES_DIR: path.join(WIKI_ROOT, 'pages'),
    INDEX_FILE: path.join(WIKI_ROOT, '_index.md'),
    LOCK_FILE: path.join(WIKI_ROOT, '.index.lock'),
    path,
  };
}

const flock = { locked: false };

async function acquireLock(maxWaitMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (flock.locked) {
    if (Date.now() - start > maxWaitMs) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
  flock.locked = true;
  return true;
}

function releaseLock() {
  flock.locked = false;
}

async function ensureDirs() {
  const fs = await getFs();
  const { WIKI_ROOT, RAW_DIR, PAGES_DIR } = await getPaths();
  for (const d of [WIKI_ROOT, RAW_DIR, PAGES_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

// ─── DeepSeek caller ─────────────────────────────────────────────────────────
async function callDeepSeek(
  system: string,
  user: string,
  temperature = 0.3
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return `[LLM WIKI] DeepSeek not configured. Simulated output for: ${user.slice(0, 80)}...`;
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`DeepSeek error: ${res.status}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    return `[LLM WIKI] DeepSeek call failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ─── Wiki page helpers ───────────────────────────────────────────────────────
export interface WikiPage {
  slug: string;
  title: string;
  content: string;
  tags: string[];
  related: string[];
  createdAt: string;
  updatedAt: string;
  source: string;
}

function parseWikiPage(markdown: string, slug: string, source: string): WikiPage {
  const titleMatch = markdown.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1] ?? slug;
  const tags: string[] = [];
  const tagMatch = markdown.match(/^tags:\s*(.+)$/im);
  if (tagMatch) tags.push(...tagMatch[1].split(/,\s*/).map(t => t.trim().toLowerCase()));
  const related: string[] = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = linkRegex.exec(markdown)) !== null) {
    if (!m[2].startsWith('http')) related.push(m[2].replace(/\.md$/, ''));
  }
  return {
    slug, title, content: markdown, tags,
    related: [...new Set(related)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source,
  };
}

// ─── Stage 1: Ingestion ──────────────────────────────────────────────────────
export async function ingestRaw(
  sourceName: string,
  content: string,
  metadata?: Record<string, string>
): Promise<string> {
  if (IS_BROWSER) return '';
  const fs = await getFs();
  const { RAW_DIR, path } = await getPaths();
  await ensureDirs();
  const slug = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const filename = `${slug}-${Date.now()}.md`;
  const header = [
    `---`, `source: ${sourceName}`, `ingested: ${new Date().toISOString()}`,
    ...(metadata ? Object.entries(metadata).map(([k, v]) => `${k}: ${v}`) : []),
    `---`, '',
  ].join('\n');
  fs.writeFileSync(path.join(RAW_DIR, filename), header + content, 'utf-8');
  return filename;
}

// ─── Stage 2: Compilation ────────────────────────────────────────────────────
export async function compileWikiPage(rawFiles: string[], pageTitle: string): Promise<WikiPage> {
  if (IS_BROWSER) return { slug: '', title: pageTitle, content: '', tags: [], related: [], createdAt: '', updatedAt: '', source: '' };
  const fs = await getFs();
  const { RAW_DIR, PAGES_DIR, path } = await getPaths();
  await ensureDirs();
  const slug = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const rawContent = rawFiles
    .map((f) => { const fp = path.join(RAW_DIR, f); if (!fs.existsSync(fp)) return null; return `--- ${f} ---\n${fs.readFileSync(fp, 'utf-8')}`; })
    .filter(Boolean).join('\n\n');
  if (!rawContent) {
    return { slug, title: pageTitle, content: `# ${pageTitle}\n\n*No raw source material.*\n`, tags: [], related: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'empty' };
  }
  const systemPrompt = `You are an expert technical writer compiling a wiki knowledge base. Produce structured markdown with H1 title, summary, H2/H3 sections, and backlinks using [Concept](concept-name) format.`;
  const llmOutput = await callDeepSeek(systemPrompt, `Compile into wiki page titled "${pageTitle}": ${rawContent.slice(0, 12000)}`);
  const page = parseWikiPage(llmOutput, slug, `compiled from ${rawFiles.length} sources`);
  fs.writeFileSync(path.join(PAGES_DIR, `${slug}.md`), llmOutput, 'utf-8');
  await updateIndex(page);
  return page;
}

// ─── Stage 3: Index update ───────────────────────────────────────────────────
async function updateIndex(page: WikiPage) {
  if (IS_BROWSER) return;
  const fs = await getFs();
  const { INDEX_FILE } = await getPaths();
  if (!(await acquireLock())) { console.warn('[LLM Wiki] Failed to acquire lock'); return; }
  try {
    const existing = fs.existsSync(INDEX_FILE) ? fs.readFileSync(INDEX_FILE, 'utf-8') : '# LLM Wiki Index\n\n';
    const entry = `- [${page.title}](${page.slug}.md) — tags: ${page.tags.join(', ') || 'none'}\n`;
    if (!existing.includes(`](${page.slug}.md)`)) fs.writeFileSync(INDEX_FILE, existing + entry, 'utf-8');
  } finally { releaseLock(); }
}

// ─── Stage 4: Linting ───────────────────────────────────────────────────────
export interface LintResult {
  page: string;
  issues: Array<{ severity: 'warning' | 'error'; message: string }>;
}

export async function lintWiki(): Promise<LintResult[]> {
  if (IS_BROWSER) return [];
  const fs = await getFs();
  const { PAGES_DIR, path } = await getPaths();
  await ensureDirs();
  const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md'));
  const results: LintResult[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(PAGES_DIR, file), 'utf-8');
    const issues: LintResult['issues'] = [];
    const slug = file.replace(/\.md$/, '');
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = linkRegex.exec(content)) !== null) {
      const target = m[2].replace(/\.md$/, '');
      if (target.startsWith('http') || target.startsWith('#') || target === slug) continue;
      if (!files.includes(`${target}.md`)) issues.push({ severity: 'warning', message: `Broken link to "${target}"` });
    }
    const stat = fs.existsSync(path.join(PAGES_DIR, file)) ? fs.statSync(path.join(PAGES_DIR, file)) : null;
    if (stat) {
      const ageDays = (Date.now() - stat.mtimeMs) / 86400000;
      if (ageDays > 7) issues.push({ severity: 'warning', message: `Content is ${Math.round(ageDays)} days old` });
    }
    if (issues.length > 0) results.push({ page: slug, issues });
  }
  return results;
}

// ─── Retrieval ───────────────────────────────────────────────────────────────
export async function getWikiPages(): Promise<WikiPage[]> {
  if (IS_BROWSER) return [];
  const fs = await getFs();
  const { PAGES_DIR, path } = await getPaths();
  await ensureDirs();
  const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md'));
  return files.map((f) => {
    const content = fs.readFileSync(path.join(PAGES_DIR, f), 'utf-8');
    return parseWikiPage(content, f.replace(/\.md$/, ''), 'filesystem');
  });
}

export async function getWikiPage(slug: string): Promise<WikiPage | null> {
  if (IS_BROWSER) return null;
  const fs = await getFs();
  const { PAGES_DIR, path } = await getPaths();
  const safeSlug = slug.replace(/[^a-z0-9-]/g, '');
  const filePath = path.join(PAGES_DIR, `${safeSlug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return parseWikiPage(fs.readFileSync(filePath, 'utf-8'), safeSlug, 'filesystem');
}

export async function getRawFiles(): Promise<string[]> {
  if (IS_BROWSER) return [];
  const fs = await getFs();
  const { RAW_DIR } = await getPaths();
  await ensureDirs();
  return fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('.md'));
}

export async function getWikiStats(): Promise<{ pageCount: number; rawCount: number; indexExists: boolean }> {
  if (IS_BROWSER) return { pageCount: 0, rawCount: 0, indexExists: false };
  const fs = await getFs();
  const { PAGES_DIR, RAW_DIR, INDEX_FILE } = await getPaths();
  await ensureDirs();
  return {
    pageCount: fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md')).length,
    rawCount: fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('.md')).length,
    indexExists: fs.existsSync(INDEX_FILE),
  };
}

export async function compileAllRaw(): Promise<WikiPage[]> {
  if (IS_BROWSER) return [];
  const raws = await getRawFiles();
  if (raws.length === 0) return [];
  const grouped = groupRawByTopic(raws);
  const pages: WikiPage[] = [];
  for (const [topic, files] of Object.entries(grouped)) {
    const page = await compileWikiPage(files, topic);
    pages.push(page);
  }
  return pages;
}

function groupRawByTopic(files: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = { 'Pipeline Artifacts': [] };
  for (const f of files) {
    const base = f.replace(/\.md$/, '');
    const parts = base.split('-');
    if (parts.length >= 2) {
      const topic = parts.slice(0, 2).join(' ');
      const key = topic.charAt(0).toUpperCase() + topic.slice(1);
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    } else {
      groups['Pipeline Artifacts'].push(f);
    }
  }
  return groups;
}
