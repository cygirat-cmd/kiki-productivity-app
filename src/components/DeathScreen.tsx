import React, { useEffect, useState, useRef } from 'react';
import { motion, useAnimation, AnimationControls } from 'framer-motion';
import AnimatedKiki from './AnimatedKiki';
import anvilImage from '@/assets/anvil.png';

// Animation timeline configuration
const TIMELINE_CONFIG = {
  KIKI_VISIBLE: { delay: 1.0 },
  SHADOW_GROW: { duration: 3.5, delay: 2.0 },
  ANVIL_DROP: { duration: 1.2, delay: 4.5 },
  BLACKOUT: { duration: 0.12 },
  FINAL_DELAY: 2.0
};

// Mobile-first responsive sizes
const RESPONSIVE_SIZES = {
  KIKI: 'clamp(120px, 35vw, 240px)',
  ANVIL: 'clamp(130px, 38vw, 280px)',
};

interface DeathScreenProps {
  isOpen: boolean;
  onFinish?: () => void;
  assets: {
    anvilSrc: string;
    kikiIdle?: 'lottie' | 'image';
    kikiSrc?: string;
  };
}

const DeathScreen: React.FC<DeathScreenProps> = ({ 
  isOpen, 
  onFinish,
  assets = { anvilSrc: anvilImage }
}) => {
  // Animation controls
  const shadowControls = useAnimation();
  const anvilControls = useAnimation();
  const blackoutControls = useAnimation();
  
  // State
  const [showKiki, setShowKiki] = useState(false);
  const [kikiState, setKikiState] = useState<'welcome' | 'idle'>('idle');
  const [animationState, setAnimationState] = useState<'welcome' | 'idle'>('idle');
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Sound effects
  const anvilSoundRef = useRef<HTMLAudioElement | null>(null);
  const anvilHitSoundRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hitSoundBufferRef = useRef<AudioBuffer | null>(null);
  const fallSoundBufferRef = useRef<AudioBuffer | null>(null);
  
  // Refs for cleanup
  const timelineRef = useRef<NodeJS.Timeout[]>([]);

  // Clear all timeouts
  const clearTimeouts = () => {
    timelineRef.current.forEach(timeout => clearTimeout(timeout));
    timelineRef.current = [];
  };

  // Load sound buffers for Web Audio API instant playback
  const loadSoundBuffers = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Load fall sound buffer
      const fallResponse = await fetch('/sounds/anvil_sound_fall.mp3');
      const fallArrayBuffer = await fallResponse.arrayBuffer();
      const fallAudioBuffer = await audioContextRef.current.decodeAudioData(fallArrayBuffer);
      fallSoundBufferRef.current = fallAudioBuffer;
      
      // Load hit sound buffer
      const hitResponse = await fetch('/sounds/anvil_sound_hit.mp3');
      const hitArrayBuffer = await hitResponse.arrayBuffer();
      const hitAudioBuffer = await audioContextRef.current.decodeAudioData(hitArrayBuffer);
      hitSoundBufferRef.current = hitAudioBuffer;
    } catch (error) {
      console.log('Failed to load Web Audio sound buffers:', error);
    }
  };

  // Main animation timeline
  const startDeathSequence = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    try {
      // Reset all animations to initial state
      await Promise.all([
        shadowControls.set({ opacity: 0, scale: 0.6 }),
        anvilControls.set({ y: '-60vh', opacity: 1, rotate: 0, scaleY: 1, filter: 'blur(0px)' }),
        blackoutControls.set({ opacity: 0 })
      ]);

      // Phase 1: Show Kiki immediately (like in Home) + START SOUND
      setShowKiki(true);
      
      // Start anvil fall sound IMMEDIATELY using Web Audio API
      try {
        if (audioContextRef.current && fallSoundBufferRef.current) {
          const source = audioContextRef.current.createBufferSource();
          const gainNode = audioContextRef.current.createGain();
          
          source.buffer = fallSoundBufferRef.current;
          gainNode.gain.value = 0.7; // Volume
          
          source.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          
          source.start(0); // Play immediately
        } else {
          // Fallback to HTML5 audio
          if (anvilSoundRef.current) {
            anvilSoundRef.current.currentTime = 0;
            anvilSoundRef.current.play().catch((error) => {
              console.log('Fallback anvil sound failed:', error);
            });
          }
        }
      } catch (error) {
        console.log('Web Audio fall sound error:', error);
        // Fallback to HTML5 audio
        if (anvilSoundRef.current) {
          anvilSoundRef.current.currentTime = 0;
          anvilSoundRef.current.play().catch(() => {});
        }
      }

      // Phase 2: Shadow grows slowly to build tension
      timelineRef.current.push(setTimeout(() => {
        shadowControls.start({
          scale: 1.3,
          opacity: 0.8,
          transition: {
            duration: TIMELINE_CONFIG.SHADOW_GROW.duration,
            ease: 'easeOut' // Slower start, faster end
          }
        });
      }, 2000)); // Start shadow growth

      // Phase 2.5: Trigger welcome animation early in anvil drop
      timelineRef.current.push(setTimeout(() => {
        triggerFinalWelcome();
      }, (TIMELINE_CONFIG.ANVIL_DROP.delay + 0.2) * 1000)); // 0.2 seconds after anvil starts falling

      // Phase 3: Anvil drop with impact detection
      timelineRef.current.push(setTimeout(() => {
        let hasTriggeredBlackout = false;
        
        // Ensure sound buffers are loaded (should already be done in useEffect)
        if (!audioContextRef.current || !hitSoundBufferRef.current || !fallSoundBufferRef.current) {
          loadSoundBuffers();
        }
        
        // Calculate different endpoints based on screen size
        const isDesktop = window.innerWidth >= 1024;
        const anvilEndPosition = isDesktop ? '40vh' : '50vh'; // Let anvil fall lower on mobile
        
        // Calculate blackout threshold - let anvil be visible longer on desktop
        const blackoutThreshold = isDesktop ? 38 : 40; // Desktop: blackout just before endpoint, Mobile: at calculated position
        
        anvilControls.start({
          y: anvilEndPosition,
          rotate: 25,
          filter: 'blur(0px)', // Will be animated
          transition: {
            duration: TIMELINE_CONFIG.ANVIL_DROP.duration,
            ease: "linear", // Constant speed - no acceleration or deceleration
            onUpdate: (latest: any) => {
              // Check if anvil reached impact threshold
              if (hasTriggeredBlackout) return;
              
              const currentY = parseFloat(latest.y?.replace('vh', '') || '0');
              console.log('Anvil position:', currentY); // Debug
              
              // Add motion blur as anvil falls faster
              const blurAmount = Math.min(currentY / 10, 3); // Max 3px blur
              anvilControls.set({ filter: `blur(${blurAmount}px)` });
              
              if (currentY >= blackoutThreshold) { // Responsive blackout threshold
                hasTriggeredBlackout = true;
                triggerBlackout();
              }
            }
          }
        });
        
        // Fallback - trigger blackout after animation duration if not triggered earlier
        setTimeout(() => {
          if (!hasTriggeredBlackout) {
            console.log('Fallback blackout triggered'); // Debug
            triggerBlackout();
          }
        }, TIMELINE_CONFIG.ANVIL_DROP.duration * 1000 - 200);
      }, TIMELINE_CONFIG.ANVIL_DROP.delay * 1000)); // Start anvil drop after configured delay

    } catch (error) {
      console.error('Death sequence error:', error);
      handleSequenceComplete();
    }
  };

  // Blackout and finish
  const triggerBlackout = async () => {
    try {
      // Stop all animations
      clearTimeouts();
      
      // Stop anvil sound and play hit sound at blackout
      if (anvilSoundRef.current) {
        anvilSoundRef.current.pause();
        anvilSoundRef.current.currentTime = 0;
      }
      
      // Play anvil hit sound at exact moment of blackout using Web Audio API for instant playback
      try {
        if (audioContextRef.current && hitSoundBufferRef.current) {
          const source = audioContextRef.current.createBufferSource();
          const gainNode = audioContextRef.current.createGain();
          
          source.buffer = hitSoundBufferRef.current;
          gainNode.gain.value = 0.8; // Volume
          
          source.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
          
          source.start(0); // Play immediately
        } else {
          // Fallback to HTML5 audio if Web Audio API failed
          if (anvilHitSoundRef.current) {
            anvilHitSoundRef.current.currentTime = 0;
            anvilHitSoundRef.current.play().catch((error) => {
              console.log('Fallback anvil hit sound failed:', error);
            });
          }
        }
      } catch (error) {
        console.log('Web Audio hit sound error:', error);
        // Fallback to HTML5 audio
        if (anvilHitSoundRef.current) {
          anvilHitSoundRef.current.currentTime = 0;
          anvilHitSoundRef.current.play().catch(() => {});
        }
      }
      
      // Instant blackout - no transition
      blackoutControls.set({ opacity: 1 });

      // Brief squash effect (visual feedback even in blackout)
      anvilControls.set({ scaleY: 0.96 });
      setTimeout(() => {
        anvilControls.set({ scaleY: 1 });
      }, 70);

      // Final callback after blackout
      setTimeout(() => {
        handleSequenceComplete();
      }, TIMELINE_CONFIG.FINAL_DELAY * 1000);

    } catch (error) {
      console.error('Blackout error:', error);
      handleSequenceComplete();
    }
  };

  // Update animation state when kikiState changes (smooth transition like in Home)
  useEffect(() => {
    setAnimationState(kikiState);
  }, [kikiState]);

  // Trigger welcome animation before blackout
  const triggerFinalWelcome = () => {
    console.log('Triggering final welcome animation before blackout');
    setKikiState('welcome');
  };

  // Complete the sequence
  const handleSequenceComplete = () => {
    clearTimeouts();
    setIsAnimating(false);
    setShowKiki(false);
    setKikiState('idle'); // Reset for next time
    setAnimationState('idle'); // Reset animation state too
    if (onFinish) {
      onFinish();
    }
  };

  // Initialize sound effects
  useEffect(() => {
    // Preload anvil sounds
    anvilSoundRef.current = new Audio('/sounds/anvil_sound_fall.mp3');
    anvilSoundRef.current.preload = 'auto';
    anvilSoundRef.current.volume = 0.7; // Adjust volume as needed
    
    anvilHitSoundRef.current = new Audio('/sounds/anvil_sound_hit.mp3');
    anvilHitSoundRef.current.preload = 'auto';
    anvilHitSoundRef.current.volume = 0.8; // Slightly louder for impact
    
    // Preload Web Audio API buffers for instant sound playback
    loadSoundBuffers();
    
    return () => {
      // Cleanup sounds
      if (anvilSoundRef.current) {
        anvilSoundRef.current.pause();
        anvilSoundRef.current = null;
      }
      if (anvilHitSoundRef.current) {
        anvilHitSoundRef.current.pause();
        anvilHitSoundRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Start sequence when opened
  useEffect(() => {
    if (isOpen && !isAnimating) {
      // Prevent body scroll during animation
      document.body.style.overflow = 'hidden';
      startDeathSequence();
    }
    
    return () => {
      // Cleanup on unmount or close
      document.body.style.overflow = '';
      clearTimeouts();
      setIsAnimating(false);
      setShowKiki(false);
      
      // Stop any playing sounds
      if (anvilSoundRef.current) {
        anvilSoundRef.current.pause();
        anvilSoundRef.current.currentTime = 0;
      }
      if (anvilHitSoundRef.current) {
        anvilHitSoundRef.current.pause();
        anvilHitSoundRef.current.currentTime = 0;
      }
    };
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
      {/* Normal app background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary/20 to-accent/20" />

      {/* Main content area with safe margins */}
      <div className="absolute inset-0" style={{ 
        minHeight: '100vh',
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)'
      }}>
          {/* Shadow Circle */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={shadowControls}
            initial={{ opacity: 0, scale: 0.6 }}
            style={{
              width: RESPONSIVE_SIZES.KIKI,
              height: `calc(${RESPONSIVE_SIZES.KIKI} * 0.4)`,
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 80%)',
              margin: 'auto',
              marginTop: `calc(60vh + ${RESPONSIVE_SIZES.KIKI} * 0.2)`,
              willChange: 'transform, opacity'
            }}
          />

          {/* Kiki - Subtle Breathing Animation */}
          {showKiki && (
            <motion.div
              className="absolute inset-0 flex items-end justify-center"
              animate={{
                scale: [1, 1.008, 1],
                y: [0, -0.5, 0]
              }}
              transition={{
                duration: 4.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              style={{
                width: RESPONSIVE_SIZES.KIKI,
                height: RESPONSIVE_SIZES.KIKI,
                margin: 'auto',
                marginBottom: window.innerWidth >= 1024 ? '18vh' : '25vh', // Lower on desktop monitors
                willChange: 'transform'
              }}
            >
              {assets.kikiIdle === 'lottie' ? (
                <AnimatedKiki 
                  className="w-full h-full" 
                  state={animationState}
                />
              ) : (
                <img 
                  src={assets.kikiSrc} 
                  alt="Kiki" 
                  className="w-full h-full object-contain"
                />
              )}
            </motion.div>
          )}

          {/* Anvil */}
          <motion.div
            className="absolute inset-x-0 flex justify-center"
            animate={anvilControls}
            initial={{ y: '-60vh', opacity: 1, rotate: 0, scaleY: 1 }}
            style={{
              width: RESPONSIVE_SIZES.ANVIL,
              height: RESPONSIVE_SIZES.ANVIL,
              margin: '0 auto',
              willChange: 'transform'
            }}
          >
            <img 
              src={assets.anvilSrc} 
              alt="Anvil" 
              className="w-full h-full object-contain drop-shadow-xl"
            />
          </motion.div>
        </div>

      {/* Final Blackout */}
      <motion.div
        className="absolute inset-0 bg-black pointer-events-none"
        animate={blackoutControls}
        initial={{ opacity: 0 }}
        style={{ willChange: 'opacity' }}
      />
    </div>
  );
};

export default DeathScreen;