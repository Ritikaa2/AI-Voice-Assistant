import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';

const Suggestions = ({ role, onSuggest }) => {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/suggestions/${role}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (e) {
        console.error("Failed to fetch suggestions");
      }
    };
    fetchSuggestions();
  }, [role]);

  if (suggestions.length === 0) return null;

  return (
    <div className="suggestions-container">
      <Lightbulb size={16} color="var(--accent-color-light)" />
      <div className="suggestions-scroll">
        {suggestions.map((sug, idx) => (
          <motion.button
            key={idx}
            className="suggestion-chip"
            onClick={() => onSuggest(sug)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {sug}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default Suggestions;
