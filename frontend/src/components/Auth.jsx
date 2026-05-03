import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, LogIn, UserPlus } from 'lucide-react';

const Auth = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    const endpoint = isLogin ? '/api/login' : '/api/register';
    
    try {
      const options = {
        method: 'POST',
      };
      
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        options.body = formData;
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      } else {
        options.body = JSON.stringify({ username, password });
        options.headers = { 'Content-Type': 'application/json' };
      }

      const res = await fetch(`http://localhost:8000${endpoint}`, options);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }
      
      onLogin(data.access_token, data.username);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Decorative background elements */}
      <div className="auth-bg-shape shape-1"></div>
      <div className="auth-bg-shape shape-2"></div>
      <div className="auth-bg-shape shape-3"></div>

      <motion.div 
        className="auth-box"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
      >
        <div className="auth-header">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="auth-icon-wrapper"
          >
            <span style={{ fontSize: '32px' }}>🤖</span>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.3 }}
          >
            AI Assistant
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.4 }}
          >
            {isLogin ? 'Sign in to continue your journey' : 'Join the future of AI assistants'}
          </motion.p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="Enter your username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Enter your password"
            />
          </div>
          
          <button type="submit" className="auth-button" disabled={isLoading}>
            {isLoading ? 'Processing...' : isLogin ? <><LogIn size={18} /> Sign In</> : <><UserPlus size={18} /> Register</>}
          </button>
        </form>

        <div className="auth-toggle">
          <button onClick={() => setIsLogin(!isLogin)} type="button">
            {isLogin ? "Don't have an account? Register" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
