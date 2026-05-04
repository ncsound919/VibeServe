import { useEffect, useState, useRef } from 'react';
import { usePresenceStore, type PresenceUser } from '../stores/presenceStore';
import { Users, Circle, FileEdit, Eye, Bug, Type, Pause } from 'lucide-react';

export function PresenceBar() {
  const { users, currentUserId, setCurrentUser, updateUserStatus, getOnlineUsers } = usePresenceStore();
  const [showDetails, setShowDetails] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUserId) {
      setCurrentUser('You');
    }
  }, [currentUserId, setCurrentUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        setShowDetails(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onlineUsers = getOnlineUsers();
  const otherUsers = onlineUsers.filter(u => u.id !== currentUserId);

  const getActivityIcon = (activity?: PresenceUser['activity']) => {
    if (!activity) return null;
    switch (activity.type) {
      case 'editing': return <FileEdit className="w-3 h-3 text-emerald-400" />;
      case 'viewing': return <Eye className="w-3 h-3 text-blue-400" />;
      case 'debugging': return <Bug className="w-3 h-3 text-red-400" />;
      case 'idle': return <Pause className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className="relative" ref={detailsRef}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700">
        <Users className="w-4 h-4 text-slate-400" />
        
        <div className="flex -space-x-2">
          {onlineUsers.slice(0, 5).map((user) => (
            <PresenceAvatar
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUserId}
              onClick={() => setShowDetails(!showDetails)}
            />
          ))}
          
          {onlineUsers.length > 5 && (
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 border-2 border-slate-800 cursor-pointer"
              onClick={() => setShowDetails(!showDetails)}
            >
              +{onlineUsers.length - 5}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-slate-500">
            {otherUsers.length > 0
              ? `${otherUsers.length} other${otherUsers.length > 1 ? 's' : ''} online`
              : 'Only you'
            }
          </span>

          {otherUsers.some(u => u.typing?.isTyping) && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-900/30 rounded">
              <Type className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-300">
                {otherUsers.filter(u => u.typing?.isTyping).length} typing...
              </span>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <select
            className="bg-slate-700 border-none rounded px-2 py-1 text-xs text-slate-300"
            value={users[currentUserId]?.status || 'online'}
            onChange={(e) => updateUserStatus(currentUserId, e.target.value as PresenceUser['status'])}
          >
            <option value="online">Online</option>
            <option value="away">Away</option>
            <option value="busy">Busy</option>
          </select>
        </div>
      </div>

      {showDetails && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-slate-700">
            <h4 className="text-sm font-medium text-white">Online Users ({onlineUsers.length})</h4>
          </div>
          <div className="p-2 space-y-1">
            {onlineUsers.map(user => (
              <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0 -right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    user.status === 'online' ? 'bg-emerald-500' :
                    user.status === 'away' ? 'bg-yellow-500' :
                    user.status === 'busy' ? 'bg-red-500' : 'bg-slate-500'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">{user.name}</span>
                    {user.id === currentUserId && (
                      <span className="text-xs text-slate-500">(you)</span>
                    )}
                    {getActivityIcon(user.activity)}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {user.currentFile && (
                      <span className="flex items-center gap-1">
                        <FileEdit className="w-3 h-3" />
                        {user.currentFile.split('/').pop()}
                      </span>
                    )}
                    {user.cursor && (
                      <span>Line {user.cursor.line}</span>
                    )}
                  </div>

                  {user.typing?.isTyping && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex gap-0.5">
                        <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" />
                        <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce delay-100" />
                        <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce delay-200" />
                      </div>
                      <span className="text-xs text-emerald-400">Typing...</span>
                    </div>
                  )}

                  {user.selections && user.selections.length > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      {user.selections.length} selection{user.selections.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PresenceAvatar({ user, isCurrentUser, onClick }: { user: PresenceUser; isCurrentUser?: boolean; onClick?: () => void }) {
  const statusColor = {
    online: 'bg-emerald-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-slate-500',
  }[user.status];

  const activityColor = {
    editing: 'border-emerald-400',
    viewing: 'border-blue-400',
    debugging: 'border-red-400',
    idle: 'border-slate-400',
  }[user.activity?.type || 'idle'];

  return (
    <div
      className="relative group cursor-pointer"
      title={`${user.name}${isCurrentUser ? ' (you)' : ''} - ${user.status}`}
      onClick={onClick}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium border-2 ${
          user.activity ? activityColor : 'border-slate-800'
        }`}
        style={{ backgroundColor: user.color }}
      >
        {user.name.charAt(0).toUpperCase()}
        {user.typing?.isTyping && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
          </div>
        )}
      </div>

      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${statusColor}`} />

      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="font-medium">{user.name} {isCurrentUser && '(you)'}</div>
        {user.currentFile && (
          <div className="text-slate-400">Editing: {user.currentFile.split('/').pop()}</div>
        )}
        {user.activity && (
          <div className="text-slate-400 capitalize">{user.activity.type}</div>
        )}
        {user.cursor && (
          <div className="text-slate-500">Line {user.cursor.line}, Col {user.cursor.column}</div>
        )}
      </div>
    </div>
  );
}
