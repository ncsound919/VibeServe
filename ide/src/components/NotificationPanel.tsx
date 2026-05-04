/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const notifications = useWorkspaceStore((s) => s.notifications);
  const markRead = useWorkspaceStore((s) => s.markRead);
  const markAllRead = useWorkspaceStore((s) => s.markAllRead);
  const clearNotifications = useWorkspaceStore((s) => s.clearNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const iconMap = {
    success: <CheckCircle2 size={14} className="text-emerald-400" />,
    error: <AlertCircle size={14} className="text-rose-400" />,
    warning: <AlertTriangle size={14} className="text-amber-400" />,
    info: <Info size={14} className="text-blue-400" />,
  };

  const borderMap = {
    success: 'border-emerald-500/30',
    error: 'border-rose-500/30',
    warning: 'border-amber-500/30',
    info: 'border-blue-500/30',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="p-2 rounded-lg hover:bg-[#1a1b1e] transition-colors relative"
      >
        <Info size={16} className="text-[#8E9299]" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 rounded-full text-[8px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-full mt-2 w-80 bg-[#151619] border border-[#2d2e32] rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-3 border-b border-[#2d2e32]">
                <span className="text-xs font-mono text-[#8E9299]">NOTIFICATIONS</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] font-mono text-blue-400 hover:text-blue-300"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-[10px] text-[#4a4b50]">
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`p-3 border-b border-[#1a1b1e] cursor-pointer hover:bg-[#1a1b1e] ${
                        !n.read ? 'bg-[#1a1b1e]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {iconMap[n.type]}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-white truncate">
                              {n.title}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(n.id);
                              }}
                            >
                              <X
                                size={12}
                                className="text-[#4a4b50] hover:text-white"
                              />
                            </button>
                          </div>
                          <p className="text-[10px] text-[#8E9299] truncate mt-0.5">
                            {n.message}
                          </p>
                          <span className="text-[8px] text-[#4a4b50] mt-1 block">
                            {new Date(n.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-2 border-t border-[#2d2e32]">
                  <button
                    onClick={clearNotifications}
                    className="w-full text-[10px] font-mono text-[#4a4b50] hover:text-rose-400 text-center py-1"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
