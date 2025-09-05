import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingHeartsProps {
  hearts: { id: string; x: number; y: number }[];
}

const FloatingHearts: React.FC<FloatingHeartsProps> = ({ hearts }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            className="absolute text-red-500 select-none"
            style={{
              left: heart.x,
              top: heart.y,
              fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', // Responsive size
              transform: 'translate(-50%, -50%)', // Center the heart on the click position
            }}
            initial={{ 
              opacity: 1, 
              scale: 0.5,
              y: 0,
            }}
            animate={{ 
              opacity: 0, 
              scale: 1.2,
              y: -100, // Float up
            }}
            exit={{ 
              opacity: 0,
              scale: 0.3,
            }}
            transition={{ 
              duration: 1.5,
              ease: [0.4, 0, 0.2, 1], // Tailwind's ease-out
            }}
          >
            💖
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default FloatingHearts;