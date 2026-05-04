/**
 * Nexus Alpha Gamification & Self-Learning Service
 * Tracks system progression: XP, levels, achievements, streaks, and learning insights.
 * Integrates with wiki, pipeline, agents, and autoresearch for real-time scoring.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "uploads", "nexus");
const PROGRESS_FILE = path.join(DATA_DIR, "progression.json");
const ACHIEVEMENTS_FILE = path.join(DATA_DIR, "achievements.json");

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "pipeline" | "wiki" | "agent" | "learning" | "milestone";
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  xpReward: number;
}

interface Progression {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  pipelineRuns: number;
  pipelineWins: number;
  pipelineStreak: number;
  pipelineFailures: number;
  failureStreak: number;
  longestFailureStreak: number;
  failureRecoveries: number;
  wikiPages: number;
  wikiEdits: number;
  agentsDeployed: number;
  reposScanned: number;
  reposBuilt: number;
  searchQueries: number;
  learningIterations: number;
  insightsGenerated: number;
  currentStreak: number;
  longestStreak: number;
  lastActive: string;
  badges: string[];
  levelTitle: string;
  recentWins: Array<{ type: string; message: string; xp: number; ts: string }>;
  trendData: Array<{ label: string; xp: number; runs: number; wins: number }>;
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadProgress(): Progression {
  ensureDir();
  if (!existsSync(PROGRESS_FILE)) return getDefaultProgress();
  try { return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")); } 
  catch { return getDefaultProgress(); }
}

function saveProgress(p: Progression) {
  ensureDir();
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2), "utf-8");
}

function getDefaultProgress(): Progression {
  return {
    level: 1, xp: 0, xpToNext: 100, totalXp: 0,
    pipelineRuns: 0, pipelineWins: 0, pipelineStreak: 0,
    pipelineFailures: 0, failureStreak: 0, longestFailureStreak: 0, failureRecoveries: 0,
    wikiPages: 0, wikiEdits: 0,
    agentsDeployed: 0, reposScanned: 0, reposBuilt: 0,
    searchQueries: 0, learningIterations: 0, insightsGenerated: 0,
    currentStreak: 0, longestStreak: 0,
    lastActive: new Date().toISOString(),
    badges: [],
    levelTitle: "Nexus Initiate",
    recentWins: [],
    trendData: [],
  };
}

const LEVEL_TITLES: Record<number, string> = {
  1: "Nexus Initiate", 2: "Pipeline Apprentice", 3: "Build Squire",
  4: "Code Knight", 5: "Architecture Baron", 6: "Integration Viscount",
  7: "Autonomy Earl", 8: "Synthesis Marquis", 9: "Nexus Duke",
  10: "Alpha Archon", 15: "Singularity Sage", 20: "Omniscient Oracle",
};

function getLevelTitle(level: number): string {
  let title = "Transcendent Nexus";
  for (const [lvl, t] of Object.entries(LEVEL_TITLES)) {
    if (level >= Number(lvl)) title = t;
  }
  return title;
}

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first-pipeline", name: "First Light", description: "Launch your first pipeline run", icon: "Rocket", category: "pipeline", unlocked: false, progress: 0, target: 1, rarity: "common", xpReward: 50 },
  { id: "pipeline-master", name: "Pipeline Master", description: "Complete 10 successful pipeline runs", icon: "Zap", category: "pipeline", unlocked: false, progress: 0, target: 10, rarity: "rare", xpReward: 200 },
  { id: "pipeline-streak-5", name: "Unstoppable", description: "5 consecutive successful pipeline wins", icon: "Flame", category: "pipeline", unlocked: false, progress: 0, target: 5, rarity: "epic", xpReward: 500 },
  { id: "wiki-scribe", name: "Wiki Scribe", description: "Compile 10 wiki knowledge pages", icon: "BookOpen", category: "wiki", unlocked: false, progress: 0, target: 10, rarity: "common", xpReward: 100 },
  { id: "wiki-library", name: "The Great Library", description: "Build 100 wiki pages", icon: "Library", category: "wiki", unlocked: false, progress: 0, target: 100, rarity: "legendary", xpReward: 1000 },
  { id: "first-agent", name: "Agent Smith", description: "Deploy your first autonomous agent", icon: "Bot", category: "agent", unlocked: false, progress: 0, target: 1, rarity: "common", xpReward: 75 },
  { id: "agent-army", name: "Agent Army", description: "Deploy 5 active agents", icon: "Users", category: "agent", unlocked: false, progress: 0, target: 5, rarity: "rare", xpReward: 300 },
  { id: "repo-scanner", name: "Trend Spotter", description: "Scan trending repos 10 times", icon: "Search", category: "learning", unlocked: false, progress: 0, target: 10, rarity: "common", xpReward: 100 },
  { id: "build-king", name: "Build King", description: "Successfully build 25 repos", icon: "Hammer", category: "pipeline", unlocked: false, progress: 0, target: 25, rarity: "epic", xpReward: 400 },
  { id: "insight-generator", name: "Insight Engine", description: "Generate 50 AI insights", icon: "Lightbulb", category: "learning", unlocked: false, progress: 0, target: 50, rarity: "rare", xpReward: 250 },
  { id: "level-5", name: "Rising Star", description: "Reach level 5", icon: "Star", category: "milestone", unlocked: false, progress: 0, target: 5, rarity: "rare", xpReward: 300 },
  { id: "level-10", name: "Alpha Archon", description: "Reach level 10", icon: "Crown", category: "milestone", unlocked: false, progress: 0, target: 10, rarity: "legendary", xpReward: 1000 },
  { id: "daily-streak-7", name: "Week Warrior", description: "7-day active streak", icon: "Calendar", category: "milestone", unlocked: false, progress: 0, target: 7, rarity: "epic", xpReward: 400 },
  { id: "repo-synthesizer", name: "Synthesizer", description: "Cross-synthesize 3 repos in one pipeline", icon: "GitMerge", category: "pipeline", unlocked: false, progress: 0, target: 1, rarity: "rare", xpReward: 200 },
  { id: "learning-loop", name: "Self-Learner", description: "Complete 10 autonomous learning iterations", icon: "RefreshCw", category: "learning", unlocked: false, progress: 0, target: 10, rarity: "rare", xpReward: 250 },
  { id: "total-xp-1000", name: "XP Millennial", description: "Earn 1,000 total XP", icon: "TrendingUp", category: "milestone", unlocked: false, progress: 0, target: 1000, rarity: "rare", xpReward: 100 },
  { id: "total-xp-10000", name: "XP Myriad", description: "Earn 10,000 total XP", icon: "Award", category: "milestone", unlocked: false, progress: 0, target: 10000, rarity: "legendary", xpReward: 500 },
  { id: "failure-phoenix", name: "Phoenix Rising", description: "Recover from a pipeline failure to win again", icon: "Flame", category: "pipeline", unlocked: false, progress: 0, target: 1, rarity: "common", xpReward: 100 },
  { id: "failure-streak-3", name: "Trial by Fire", description: "Survive a 3-pipeline failure streak", icon: "AlertTriangle", category: "pipeline", unlocked: false, progress: 0, target: 3, rarity: "rare", xpReward: 300 },
  { id: "failure-recoveries-5", name: "Comeback Kid", description: "Recover from 5 separate pipeline failures", icon: "RefreshCw", category: "pipeline", unlocked: false, progress: 0, target: 5, rarity: "epic", xpReward: 500 },
];

function loadAchievements(): Achievement[] {
  ensureDir();
  if (!existsSync(ACHIEVEMENTS_FILE)) return ALL_ACHIEVEMENTS.map(a => ({...a}));
  try { return JSON.parse(readFileSync(ACHIEVEMENTS_FILE, "utf-8")); }
  catch { return ALL_ACHIEVEMENTS.map(a => ({...a})); }
}

function saveAchievements(achievements: Achievement[]) {
  ensureDir();
  writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2), "utf-8");
}

// ─── XP AWARD SYSTEM ────────────────────────────────────────────────────────────

export function awardXp(amount: number, reason: string): Progression {
  const p = loadProgress();
  p.xp += amount;
  p.totalXp += amount;
  p.recentWins.unshift({ type: "xp", message: reason, xp: amount, ts: new Date().toISOString() });
  if (p.recentWins.length > 20) p.recentWins.length = 20;

  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level += 1;
    p.xpToNext = xpForLevel(p.level);
    p.recentWins.unshift({ type: "levelup", message: `Reached Level ${p.level}`, xp: 0, ts: new Date().toISOString() });
    p.badges.push(`level-${p.level}`);
  }
  p.levelTitle = getLevelTitle(p.level);
  p.lastActive = new Date().toISOString();

  saveProgress(p);
  checkAchievements(p);
  return p;
}

export function trackPipelineRun(success: boolean, repoCount: number): Progression {
  const p = loadProgress();
  p.pipelineRuns += 1;
  p.lastActive = new Date().toISOString();

  if (success) {
    p.pipelineWins += 1;
    p.pipelineStreak += 1;
    p.reposBuilt += repoCount;
    if (p.failureStreak > 0) p.failureRecoveries += 1;
    p.failureStreak = 0;
    p.currentStreak += 1;
    p.failureStreak = 0;
    if (p.currentStreak > p.longestStreak) p.longestStreak = p.currentStreak;

    let xp = 25 + repoCount * 15;
    if (p.pipelineStreak >= 3) xp = Math.floor(xp * 1.5);
    if (repoCount >= 3) xp += 50;

    const msg = repoCount >= 3
      ? `Cross-synthesized ${repoCount} repos successfully!`
      : `Pipeline completed: ${repoCount} repo(s)`;
    awardXp(xp, msg);

    p.trendData.push({ label: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), xp, runs: 1, wins: 1 });
  } else {
    p.pipelineStreak = 0;
    p.pipelineFailures += 1;
    p.failureStreak += 1;
    if (p.failureStreak > p.longestFailureStreak) p.longestFailureStreak = p.failureStreak;
    p.recentWins.unshift({ type: "failure", message: `Pipeline failed (${repoCount} repo(s))`, xp: 0, ts: new Date().toISOString() });
    p.trendData.push({ label: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), xp: 0, runs: 1, wins: 0 });
  }

  if (p.trendData.length > 30) p.trendData = p.trendData.slice(-30);
  saveProgress(p);
  checkAchievements(p);
  return p;
}

export function trackWikiActivity(pagesAdded: number): Progression {
  const p = loadProgress();
  p.wikiPages += pagesAdded;
  p.wikiEdits += 1;
  p.lastActive = new Date().toISOString();

  const xp = pagesAdded * 10;
  if (pagesAdded > 0) awardXp(xp, `Compiled ${pagesAdded} wiki page(s)`);

  saveProgress(p);
  return p;
}

export function trackAgentDeploy(): Progression {
  const p = loadProgress();
  p.agentsDeployed += 1;
  p.lastActive = new Date().toISOString();
  awardXp(50, "Agent deployed");
  return p;
}

export function trackRepoScan(): Progression {
  const p = loadProgress();
  p.reposScanned += 1;
  p.lastActive = new Date().toISOString();
  awardXp(10, "Trending repos scanned");
  return p;
}

export function trackLearningIteration(insights: number): Progression {
  const p = loadProgress();
  p.learningIterations += 1;
  p.insightsGenerated += insights;
  p.lastActive = new Date().toISOString();
  awardXp(insights * 5, `${insights} new insight(s) generated`);
  return p;
}

export function trackSearch(): Progression {
  const p = loadProgress();
  p.searchQueries += 1;
  p.lastActive = new Date().toISOString();
  awardXp(2, "Knowledge search performed");
  return p;
}

// ─── ACHIEVEMENT CHECKER ───────────────────────────────────────────────────────

function checkAchievements(p: Progression): Achievement[] {
  const achievements = loadAchievements();
  let changed = false;

  const check = (ach: Achievement) => {
    if (ach.unlocked) return;
    switch (ach.id) {
      case "first-pipeline": ach.progress = Math.min(p.pipelineRuns, ach.target); break;
      case "pipeline-master": ach.progress = Math.min(p.pipelineWins, ach.target); break;
      case "pipeline-streak-5": ach.progress = Math.min(p.pipelineStreak, ach.target); break;
      case "wiki-scribe": ach.progress = Math.min(p.wikiPages, ach.target); break;
      case "wiki-library": ach.progress = Math.min(p.wikiPages, ach.target); break;
      case "first-agent": ach.progress = Math.min(p.agentsDeployed, ach.target); break;
      case "agent-army": ach.progress = Math.min(p.agentsDeployed, ach.target); break;
      case "repo-scanner": ach.progress = Math.min(p.reposScanned, ach.target); break;
      case "build-king": ach.progress = Math.min(p.reposBuilt, ach.target); break;
      case "insight-generator": ach.progress = Math.min(p.insightsGenerated, ach.target); break;
      case "level-5": ach.progress = Math.min(p.level, ach.target); break;
      case "level-10": ach.progress = Math.min(p.level, ach.target); break;
      case "daily-streak-7": ach.progress = Math.min(p.currentStreak, ach.target); break;
      case "repo-synthesizer": ach.progress = p.reposBuilt >= 3 ? ach.target : 0; break;
      case "learning-loop": ach.progress = Math.min(p.learningIterations, ach.target); break;
      case "total-xp-1000": ach.progress = Math.min(p.totalXp, ach.target); break;
      case "total-xp-10000": ach.progress = Math.min(p.totalXp, ach.target); break;
      case "failure-phoenix": ach.progress = p.failureRecoveries >= 1 ? ach.target : 0; break;
      case "failure-streak-3": ach.progress = Math.min(p.longestFailureStreak, ach.target); break;
      case "failure-recoveries-5": ach.progress = Math.min(p.failureRecoveries, ach.target); break;
    }
    if (ach.progress >= ach.target && !ach.unlocked) {
      ach.unlocked = true;
      ach.unlockedAt = new Date().toISOString();
      awardXp(ach.xpReward, `Achievement: ${ach.name}`);
      p.badges.push(ach.id);
      changed = true;
    }
  };

  achievements.forEach(check);
  if (changed) saveAchievements(achievements);
  return achievements;
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────────

export function getProgression(): Progression {
  const p = loadProgress();
  p.levelTitle = getLevelTitle(p.level);
  p.xpToNext = xpForLevel(p.level);
  return p;
}

export function getAchievements(): Achievement[] {
  return loadAchievements();
}

export function getLearningInsights(): string[] {
  const p = loadProgress();
  const insights: string[] = [];

  if (p.pipelineWins === 0) insights.push("Run your first pipeline to begin learning");
  else if (p.pipelineWins < 5) insights.push(`Pipeline success rate: ${((p.pipelineWins / Math.max(p.pipelineRuns, 1)) * 100).toFixed(0)}% — keep building!`);
  else insights.push(`Strong pipeline mastery: ${p.pipelineWins} wins out of ${p.pipelineRuns} runs`);

  if (p.pipelineFailures > 0) {
    insights.push(`Pipeline failures: ${p.pipelineFailures} total, longest streak: ${p.longestFailureStreak}, recoveries: ${p.failureRecoveries}`);
    if (p.failureStreak > 2) insights.push(`⚠️ Current failure streak: ${p.failureStreak} — consider checking integration status`);
  }

  if (p.wikiPages < 5) insights.push("Expand the wiki: compile more knowledge pages for deeper context");
  else if (p.wikiPages < 25) insights.push(`Wiki growing: ${p.wikiPages} pages — knowledge compound effect active`);
  else insights.push(`Massive wiki: ${p.wikiPages} pages forming a comprehensive knowledge graph`);

  if (p.agentsDeployed === 0) insights.push("Deploy an agent to unlock autonomous capabilities");
  else insights.push(`${p.agentsDeployed} agent(s) active — autonomous coverage expanding`);

  if (p.learningIterations > 0) {
    insights.push(`Self-learning active: ${p.learningIterations} loops, ${p.insightsGenerated} insights`);
  }

  const recentWinRate = p.trendData.slice(-5).filter(t => t.wins > 0).length;
  if (recentWinRate >= 4) insights.push("Recent performance: Excellent — on a hot streak!");
  else if (recentWinRate >= 2) insights.push("Recent performance: Steady — room to optimize");

  return insights;
}

export function getTrendData() {
  return loadProgress().trendData;
}

export function resetProgression() {
  saveProgress(getDefaultProgress());
  saveAchievements(ALL_ACHIEVEMENTS.map(a => ({...a})));
}

const ACHIEVEMENT_FEATURES: Record<string, string> = {
  'pipeline-master': 'parallel-security-audit',
  'wiki-library': 'deep-rag-context',
  'insight-generator': 'auto-apply-suggestions',
  'level-10': 'autonomous-retry',
  'learning-loop': 'trend-based-phase-tuning',
};

export function getUnlockedPipelineFeatures(): string[] {
  const achievements = loadAchievements();
  const features: string[] = [];
  for (const [achId, feature] of Object.entries(ACHIEVEMENT_FEATURES)) {
    if (achievements.find(a => a.id === achId && a.unlocked)) {
      features.push(feature);
    }
  }
  return features;
}
