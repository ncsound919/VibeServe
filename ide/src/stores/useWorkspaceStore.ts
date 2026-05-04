import { create } from "zustand";

export interface Project {
  id: string;
  name: string;
  description: string;
  repos: string[];
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
  buildConfig: {
    autoRun: boolean;
    branch: string;
    environment: "development" | "staging" | "production";
  };
  buildHistory: {
    id: string;
    status: "success" | "failed" | "running";
    timestamp: string;
    duration: number;
    triggeredBy: string;
  }[];
}

export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  webhookSent?: boolean;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: ("build.success" | "build.failed" | "security.alert" | "agent.error")[];
  active: boolean;
}

interface WorkspaceStore {
  projects: Project[];
  activeProjectId: string | null;
  notifications: Notification[];
  webhooks: WebhookConfig[];
  pinnedFiles: string[];
  // Projects
  createProject: (p: Omit<Project, "id" | "createdAt" | "updatedAt" | "buildHistory">) => string;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  addBuildHistory: (projectId: string, entry: Project["buildHistory"][0]) => void;
  // Notifications
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  // Webhooks
  addWebhook: (w: Omit<WebhookConfig, "id">) => void;
  updateWebhook: (id: string, updates: Partial<WebhookConfig>) => void;
  removeWebhook: (id: string) => void;
  fireWebhook: (event: WebhookConfig["events"][0], payload: unknown) => void;
  // Context Pinning
  togglePinnedFile: (filePath: string) => void;
  clearPinnedFiles: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  notifications: [],
  webhooks: [],
  pinnedFiles: [],

  createProject: (p) => {
    const id = `proj-${Date.now()}`;
    const now = new Date().toISOString();
    const project: Project = { ...p, id, createdAt: now, updatedAt: now, buildHistory: [] };
    set((s) => ({ projects: [project, ...s.projects], activeProjectId: id }));
    return id;
  },

  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    })),

  deleteProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    })),

  setActiveProject: (id) => set({ activeProjectId: id }),

  addBuildHistory: (projectId, entry) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, buildHistory: [entry, ...p.buildHistory].slice(0, 50) }
          : p
      ),
    })),

  addNotification: (n) => {
    const notification: Notification = {
      ...n,
      id: `notif-${Date.now()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set((s) => ({ notifications: [notification, ...s.notifications].slice(0, 100) }));
    // Fire webhooks
    get().fireWebhook(
      n.type === "error" ? "build.failed" : n.type === "success" ? "build.success" : "security.alert",
      notification
    );
  },

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

  clearNotifications: () => set({ notifications: [] }),

  addWebhook: (w) =>
    set((s) => ({ webhooks: [...s.webhooks, { ...w, id: `wh-${Date.now()}` }] })),

  updateWebhook: (id, updates) =>
    set((s) => ({ webhooks: s.webhooks.map((w) => (w.id === id ? { ...w, ...updates } : w)) })),

  removeWebhook: (id) => set((s) => ({ webhooks: s.webhooks.filter((w) => w.id !== id) })),

  fireWebhook: async (event, payload) => {
    const { webhooks } = get();
    const targets = webhooks.filter((w) => w.active && w.events.includes(event));
    for (const wh of targets) {
      try {
        await fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, payload, sentAt: new Date().toISOString() }),
        });
      } catch {
        // Webhook delivery failure is non-fatal
      }
    }
  },

  togglePinnedFile: (filePath) => 
    set((s) => ({
      pinnedFiles: s.pinnedFiles.includes(filePath) 
        ? s.pinnedFiles.filter(f => f !== filePath)
        : [...s.pinnedFiles, filePath]
    })),

  clearPinnedFiles: () => set({ pinnedFiles: [] }),
}));
