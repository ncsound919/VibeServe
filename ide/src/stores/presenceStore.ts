import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CursorPosition {
  line: number;
  column: number;
  fileName: string;
}

export interface TypingIndicator {
  isTyping: boolean;
  fileName?: string;
  timestamp: number;
}

export interface UserActivity {
  type: 'editing' | 'viewing' | 'debugging' | 'idle';
  fileName?: string;
  timestamp: number;
}

export interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  color: string;
  lastSeen: number;
  currentTab?: string;
  cursor?: CursorPosition;
  typing?: TypingIndicator;
  activity?: UserActivity;
  currentFile?: string;
  selections?: Array<{start: number; end: number; fileName: string}>;
}

export interface PresenceStore {
  users: Record<string, PresenceUser>;
  currentUserId: string;
  
  setCurrentUser: (name: string) => void;
  updateUserStatus: (userId: string, status: PresenceUser['status']) => void;
  setUserTab: (userId: string, tab: string) => void;
  addUser: (user: Omit<PresenceUser, 'id' | 'lastSeen'>) => string;
  removeUser: (userId: string) => void;
  getOnlineUsers: () => PresenceUser[];
  updateCursor: (userId: string, cursor: CursorPosition) => void;
  setTyping: (userId: string, isTyping: boolean, fileName?: string) => void;
  updateActivity: (userId: string, activity: UserActivity) => void;
  setCurrentFile: (userId: string, fileName: string) => void;
  addSelection: (userId: string, selection: {start: number; end: number; fileName: string}) => void;
  removeSelection: (userId: string, fileName: string) => void;
}

const generateId = () => `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export const usePresenceStore = create<PresenceStore>()(
  persist(
    (set, get) => ({
      users: {},
      currentUserId: '',

      setCurrentUser: (name) => {
        const id = generateId();
        const colorIndex = Object.keys(get().users).length % COLORS.length;
        
        set((state) => ({
          currentUserId: id,
          users: {
            ...state.users,
            [id]: {
              id,
              name,
              status: 'online',
              color: COLORS[colorIndex],
              lastSeen: Date.now(),
            },
          },
        }));
      },

      updateUserStatus: (userId, status) => {
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              status,
              lastSeen: Date.now(),
            },
          },
        }));
      },

      setUserTab: (userId, tab) => {
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              currentTab: tab,
              lastSeen: Date.now(),
            },
          },
        }));
      },

      addUser: (user) => {
        const id = generateId();
        const colorIndex = Object.keys(get().users).length % COLORS.length;
        
        set((state) => ({
          users: {
            ...state.users,
            [id]: {
              ...user,
              id,
              color: user.color || COLORS[colorIndex],
              lastSeen: Date.now(),
            },
          },
        }));
        
        return id;
      },

      removeUser: (userId) => {
        set((state) => {
          const { [userId]: _, ...rest } = state.users;
          return { users: rest };
        });
      },

      getOnlineUsers: () => {
        const users = Object.values(get().users);
        return users.filter(u => u.status !== 'offline').sort((a, b) => b.lastSeen - a.lastSeen);
      },

      updateCursor: (userId, cursor) => {
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              cursor,
              lastSeen: Date.now(),
            },
          },
        }));
      },

      setTyping: (userId, isTyping, fileName) => {
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              typing: { isTyping, fileName, timestamp: Date.now() },
              lastSeen: Date.now(),
            },
          },
        }));
        
        if (isTyping) {
          setTimeout(() => {
            const user = get().users[userId];
            if (user?.typing?.isTyping) {
              get().setTyping(userId, false);
            }
          }, 3000);
        }
      },

      updateActivity: (userId, activity) => {
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              activity: { ...activity, timestamp: Date.now() },
              lastSeen: Date.now(),
            },
          },
        }));
      },

      setCurrentFile: (userId, fileName) => {
        set((state) => ({
          users: {
            ...state.users,
            [userId]: {
              ...state.users[userId],
              currentFile: fileName,
              lastSeen: Date.now(),
            },
          },
        }));
      },

      addSelection: (userId, selection) => {
        set((state) => {
          const user = state.users[userId];
          const selections = user?.selections || [];
          return {
            users: {
              ...state.users,
              [userId]: {
                ...user,
                selections: [...selections, selection],
                lastSeen: Date.now(),
              },
            },
          };
        });
      },

      removeSelection: (userId, fileName) => {
        set((state) => {
          const user = state.users[userId];
          if (!user) return state;
          return {
            users: {
              ...state.users,
              [userId]: {
                ...user,
                selections: (user.selections || []).filter(s => s.fileName !== fileName),
                lastSeen: Date.now(),
              },
            },
          };
        });
      },
    }),
    {
      name: 'nexus-presence-storage',
      partialize: (state) => ({ users: state.users, currentUserId: state.currentUserId }),
    }
  )
);
