import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Activity, Play, CheckCircle, Menu, Image as ImageIcon, X, User, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Suggestions from './components/Suggestions';

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', type: 'text', content: 'Hello! I am your AI Assistant 🤖. How can I help you today?', id: 'welcome' }
  ]);
  const [textInput, setTextInput] = useState('');
  const [currentAction, setCurrentAction] = useState(null);
  
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [role, setRole] = useState('General');
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  const chatEndRef = useRef(null);
  
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && !recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.interimResults = false;
    }
  }, []);

  // Handle Speech Recognition Results
  useEffect(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSendMessage(transcript);
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    rec.onend = () => {
      setIsListening(false);
    };
  }, [recognitionRef.current]);

  useEffect(() => {
    if (token) {
      fetchSessions();
    }
  }, [token]);

  useEffect(() => {
    if (currentSessionId && token) {
      fetchHistory(currentSessionId);
    }
  }, [currentSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
        if (data.sessions.length > 0 && !currentSessionId) {
          setCurrentSessionId(data.sessions[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async (sessionId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/history/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.history.length === 0) {
          setMessages([{ role: 'ai', type: 'text', content: 'Hello! I am your AI Assistant 🤖. How can I help you today?', id: 'welcome' }]);
        } else {
          setMessages(data.history);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = (newToken, newUser) => {
    setToken(newToken);
    setUsername(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUser);
  };

  const handleLogout = () => {
    setToken(null);
    setUsername('');
    setSessions([]);
    setCurrentSessionId(null);
    setMessages([{ role: 'ai', type: 'text', content: 'Hello! I am your AI Assistant 🤖. How can I help you today?', id: 'welcome' }]);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([{ role: 'ai', type: 'text', content: 'Hello! I am your AI Assistant 🤖. How can I help you today?', id: 'welcome' }]);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() && !selectedImage) return;
    
    const userMsg = { role: 'user', type: 'text', content: text, image: selectedImage, id: Date.now().toString() };
    setMessages((prev) => [...prev, userMsg]);
    setTextInput('');
    const imageToSend = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, session_id: currentSessionId, image: imageToSend }),
      });

      const data = await response.json();
      setIsLoading(false);
      
      if (token) {
        if (!currentSessionId) setCurrentSessionId(data.session_id);
        fetchSessions();
      }
      
      const aiMsgId = (Date.now() + 1).toString();
      
      if (data.type === 'text') {
        setMessages((prev) => [...prev, { role: 'ai', type: 'text', content: data.response, id: aiMsgId }]);
        speakText(data.response);
      } 
      else if (data.type === 'action' || data.type === 'multi_action') {
        setMessages((prev) => [...prev, { 
          role: 'ai', 
          type: data.type, 
          content: data.response, 
          actions: data.actions || (data.action ? [data] : []),
          id: aiMsgId 
        }]);
        
        if (data.type === 'action' && data.action) {
          setCurrentAction(`Executing: ${data.action.replace('_', ' ')}`);
        } else if (data.actions) {
          setCurrentAction(`Executing ${data.actions.length} actions...`);
        }
        
        setTimeout(() => setCurrentAction(null), 3000);
        speakText(data.response);
      } else {
         setMessages((prev) => [...prev, { role: 'ai', type: 'text', content: "I'm not sure how to respond to that.", id: aiMsgId }]);
      }

    } catch (error) {
      console.error("Error communicating with backend:", error);
      setIsLoading(false);
      setMessages((prev) => [...prev, { 
        role: 'ai', 
        type: 'text', 
        content: 'Error: Cannot connect to the API. Is the backend running?', 
        id: (Date.now() + 1).toString() 
      }]);
    }
  };

  const toggleListening = () => {
    const rec = recognitionRef.current;
    if (!rec) {
      alert("Speech Recognition API not supported in this browser. Please use Chrome/Edge or text input.");
      return;
    }
    
    if (isListening) {
      rec.stop();
      setIsListening(false);
    } else {
      try {
        rec.start();
        setIsListening(true);
      } catch (e) {
        console.error("Error starting recognition:", e);
      }
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const formatActionName = (name) => {
    if (!name) return '';
    return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const isNewChat = messages.length === 1 && messages[0].id === 'welcome';

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="main-layout">
      {isSidebarOpen && (
        <Sidebar 
          username={username} 
          onLogout={handleLogout} 
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onNewChat={handleNewChat}
        />
      )}
      <div className="app-container">
        {/* Toast for Actions */}
        <AnimatePresence>
        {currentAction && (
          <motion.div 
            initial={{ y: -50, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: -50, opacity: 0, x: '-50%' }}
            className="action-toast"
          >
            <CheckCircle size={20} color="var(--accent-color-light)" />
            <span>{currentAction}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="app-header">
        <div className="header-left">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
        </div>
        <h1 className="app-title">
          <span style={{ fontSize: '1.8rem', marginRight: '8px' }}>🤖</span>
          AI Assistant
        </h1>
        <div className="header-right"></div>
      </header>

      <div className={`chat-container ${isNewChat ? 'empty-chat-container' : ''}`}>
        
        {isNewChat ? (
          <div className="welcome-screen">
            <h2>How can I help, {username}?</h2>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              msg.id !== 'welcome' && (
                <motion.div 
                  key={msg.id} 
                  className={`message ${msg.role}`}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
              {msg.role === 'ai' && (
                <div className="message-avatar ai-avatar">🤖</div>
              )}
              {msg.role === 'user' && (
                <div className="message-avatar user-avatar"><User size={20} /></div>
              )}
              <div className="message-bubble">
                {msg.image && (
                  <img src={msg.image} alt="User Upload" className="message-image" />
                )}
                
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
                
                {/* Render action badges if present */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="action-badges">
                    {msg.actions.map((act, idx) => (
                      <div key={idx} className="action-badge">
                        <Play size={12} style={{ marginRight: '6px' }} />
                        {formatActionName(act.action)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            )
          ))}
          
          {isLoading && (
            <motion.div 
              className="message ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="message-avatar ai-avatar">🤖</div>
              <div className="message-bubble">
                <div className="typing-indicator" style={{ paddingTop: '0.5rem' }}>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className={`controls-container ${isNewChat ? 'controls-center' : ''}`}>
        <div className={`status-text ${isListening ? 'listening-text' : ''}`}>
          {isListening ? "Listening to you..." : "Tap to speak"}
        </div>
        
        {!isNewChat && <Suggestions role={role} onSuggest={handleSendMessage} />}

        <div className="text-input-container">
          <button 
            type="button" 
            className="attach-btn" 
            onClick={() => fileInputRef.current.click()}
            disabled={isLoading || isListening}
          >
            <PlusCircle size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <form 
            className="text-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(textInput);
            }}
            style={{ display: 'flex', flex: 1, alignItems: 'center' }}
          >
            <input 
              type="text" 
              className="text-input" 
              placeholder="Ask anything" 
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isLoading || isListening}
            />
            
            {/* Mic inside input box like screenshot */}
            <button 
              type="button"
              className={`inline-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
            >
              {isListening ? <Activity size={18} /> : <Mic size={18} />}
            </button>
            
            <button type="submit" className="send-button" disabled={(!textInput.trim() && !selectedImage) || isLoading}>
              <Activity size={18} /> {/* Using Activity as the Audio Icon in screenshot */}
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
};

export default App;
