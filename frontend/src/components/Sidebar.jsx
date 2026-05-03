import React from 'react';
import { motion } from 'framer-motion';
import { Search, Edit, Folder, Code, MoreHorizontal, User } from 'lucide-react';

const Sidebar = ({ username, onLogout, sessions, currentSessionId, onSelectSession, onNewChat }) => {
  const groupSessions = (sessions) => {
    const groups = {
      Today: [],
      Yesterday: [],
      'Previous 7 Days': [],
      Older: []
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    sessions.forEach(session => {
      // Parse ISO string from backend
      const sessionDate = new Date(session.created_at);
      if (sessionDate >= today) {
        groups.Today.push(session);
      } else if (sessionDate >= yesterday) {
        groups.Yesterday.push(session);
      } else if (sessionDate >= lastWeek) {
        groups['Previous 7 Days'].push(session);
      } else {
        groups.Older.push(session);
      }
    });
    
    return groups;
  };

  const displaySessions = currentSessionId === null 
    ? [{ id: 'new-chat-temp', title: 'New chat', created_at: new Date().toISOString() }, ...sessions]
    : sessions;

  const groupedSessions = groupSessions(displaySessions);

  return (
    <motion.div 
      className="sidebar"
      initial={{ x: -300 }}
      animate={{ x: 0 }}
    >
      <div className="sidebar-top-menu">
        <button className="sidebar-btn new-chat-main-btn" onClick={onNewChat}>
          <div className="btn-left">
            <Edit size={16} />
            <span>New chat</span>
          </div>
        </button>
        
        <div className="search-bar">
          <Search size={16} />
          <input type="text" placeholder="Search chats" />
        </div>
        
        <button className="sidebar-btn">
          <Folder size={16} />
          <span>Projects</span>
        </button>
        <button className="sidebar-btn">
          <Code size={16} />
          <span>Codex</span>
        </button>
        <button className="sidebar-btn">
          <MoreHorizontal size={16} />
          <span>More</span>
        </button>
      </div>

      <div className="sidebar-section history-section">
        <div className="history-list">
          {sessions.length === 0 ? (
            <p className="empty-history" style={{ paddingLeft: '1rem', marginTop: '1rem' }}>No sessions yet.</p>
          ) : (
            Object.entries(groupedSessions).map(([groupName, groupSessionsList]) => {
              if (groupSessionsList.length === 0) return null;
              return (
                <div key={groupName} className="session-group">
                  <div className="recents-header">
                    <span>{groupName}</span>
                  </div>
                  {groupSessionsList.map((session) => {
                    const isActive = currentSessionId === session.id || (currentSessionId === null && session.id === 'new-chat-temp');
                    return (
                      <div 
                        key={session.id} 
                        className={`history-item ${isActive ? 'active' : ''}`}
                        onClick={() => session.id !== 'new-chat-temp' && onSelectSession(session.id)}
                      >
                        <span className="history-text">{session.title}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <div className="sidebar-bottom">
        <div className="user-profile" onClick={onLogout} style={{ cursor: 'pointer' }} title="Logout">
          <div className="avatar">
            <User size={20} color="#fff" />
          </div>
          <span className="username">{username}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default Sidebar;
