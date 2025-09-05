import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestNotificationPermission, updateLastActivity, checkForBoredomDeath } from '@/utils/notifications';
import { cleanupOldVerifications, supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { AuthModal } from '@/components/AuthModal';
import { UserProfile } from '@/components/UserProfile';
import { StartTaskFlow } from '@/features/start-task/StartTaskFlow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Clock, Trophy, Cloud, User, Settings, Home as HomeIcon, FlaskConical, BarChart3, ShoppingBag, ChevronUp, ChevronDown, Cat } from 'lucide-react';
import { 
  STORAGE_KEYS, 
  PET_QUOTES, 
  TIMER_CONFIG, 
  DEATH_REASONS, 
  LEVEL_CONFIG,
  API_CONFIG,
  PET_TYPES,
  TASK_STATUS,
  VERIFICATION_STATUS
} from '@/constants';
import { 
  getVerificationsFromStorage,
  setVerificationsToStorage,
  getPendingValidationFromStorage,
  getActiveTimerFromStorage,
  removeActiveTimer,
  getTasksFromStorage,
  getFromStorage,
  setToStorage,
  getPetImage
} from '@/utils/helpers';
import AnimatedKiki from '@/components/AnimatedKiki';
import FloatingHearts from '@/components/FloatingHearts';
import { usePetStore, useTimerStore, initializeStores } from '@/store';

// Remove local Pet interface - using the one from store
import type { Pet } from '@/store';

// Memoized components to prevent unnecessary re-renders
const MemoizedPetDisplay = React.memo(({ pet, currentQuote, kikiState, onWelcomeComplete }: { 
  pet: Pet; 
  currentQuote: number;
  kikiState: 'welcome' | 'idle' | 'anxious' | 'love';
  onWelcomeComplete?: () => void;
}) => {
  const [hearts, setHearts] = useState<{ id: string; x: number; y: number }[]>([]);
  const [animationState, setAnimationState] = useState<'welcome' | 'idle' | 'anxious' | 'love'>(kikiState);
  const [isAnimating, setIsAnimating] = useState(false); // Track if love animation is in progress
  
  // Update animation state when kikiState changes (but not when love animation is playing)
  React.useEffect(() => {
    if (kikiState !== 'love' && !isAnimating) {
      setAnimationState(kikiState);
    }
  }, [kikiState, isAnimating]);
  
  const handleKikiClick = React.useCallback((e: React.MouseEvent) => {
    // Only allow click when in idle state and not currently animating
    if (animationState !== 'idle' || isAnimating) return;
    
    // Prevent multiple rapid clicks
    setIsAnimating(true);
    
    // Get position relative to the parent container, not the clickable div
    const parentContainer = e.currentTarget.parentElement;
    if (!parentContainer) return;
    
    const parentRect = parentContainer.getBoundingClientRect();
    const clickX = e.clientX - parentRect.left;
    const clickY = e.clientY - parentRect.top;
    
    const newHearts = [];
    
    // Generate 3-5 hearts at the exact click position
    const heartCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < heartCount; i++) {
      newHearts.push({
        id: `heart-${Date.now()}-${i}`,
        x: clickX + (Math.random() * 20 - 10), // Small random offset around click
        y: clickY + (Math.random() * 20 - 10),
      });
    }
    
    setHearts(prev => [...prev, ...newHearts]);
    
    // Remove hearts after animation
    setTimeout(() => {
      setHearts(prev => prev.filter(heart => 
        !newHearts.some(newHeart => newHeart.id === heart.id)
      ));
    }, 1500);
    
    // Start love animation
    setAnimationState('love');
  }, [animationState, isAnimating]);
  
  const handleLoveAnimationComplete = React.useCallback(() => {
    // Return to idle after love animation and reset animation flag
    setAnimationState('idle');
    setIsAnimating(false);
  }, []);
  
  const handleWelcomeComplete = React.useCallback(() => {
    // Welcome animation completed, switch to idle
    setAnimationState('idle');
    if (onWelcomeComplete) {
      onWelcomeComplete();
    }
  }, [onWelcomeComplete]);
  
  return (
    <div className="card-kawaii text-center space-y-4">
      <div className="relative flex justify-center">
        <AnimatedKiki 
          className="w-80 h-80 mx-auto" 
          state={animationState}
          onLoveAnimationComplete={handleLoveAnimationComplete}
          onWelcomeAnimationComplete={handleWelcomeComplete}
        />
        {/* Clickable area - responsive square in the center */}
        <div 
          className={`absolute w-[clamp(120px,30vw,150px)] h-[clamp(120px,30vw,150px)] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
            (animationState === 'idle' && !isAnimating) ? 'cursor-pointer' : 'cursor-default'
          } ${(animationState === 'idle' && !isAnimating) ? 'active:scale-95' : ''} transition-transform duration-150`}
          onClick={handleKikiClick}
          style={{ 
            pointerEvents: (animationState === 'idle' && !isAnimating) ? 'auto' : 'none',
          }}
        />
        <FloatingHearts hearts={hearts} />
      </div>
    </div>
  );
});

MemoizedPetDisplay.displayName = 'MemoizedPetDisplay';

const MemoizedHeader = React.memo(({ 
  pet, 
  user, 
  onShowUserProfile, 
  onShowAuthModal, 
  onNavigateToSettings
}: {
  pet: Pet;
  user: any;
  onShowUserProfile: () => void;
  onShowAuthModal: () => void;
  onNavigateToSettings: () => void;
}) => (
  <div className="bg-card/50 backdrop-blur-sm border-b p-4">
    <div className="max-w-md mx-auto flex justify-between items-center">
      <div>
        <h1 className="text-xl font-bold">{pet.name}</h1>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-success/20">
            <Trophy className="w-3 h-3 mr-1" />
            {pet.streak} days
          </Badge>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {user ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShowUserProfile}
            title="Cloud Profile"
          >
            <Cloud className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onShowAuthModal}
            title="Sign In for Cloud Saves"
          >
            <User className="w-5 h-5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onNavigateToSettings}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </div>
  </div>
));

MemoizedHeader.displayName = 'MemoizedHeader';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const Home = () => {
  const { pet, killPet } = usePetStore();
  const { startTimer } = useTimerStore();
  const [currentQuote, setCurrentQuote] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);
  const [showStartTaskFlow, setShowStartTaskFlow] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Debug log for user state
  React.useEffect(() => {
    console.log('Home: User state changed:', { user: !!user, userEmail: user?.email });
  }, [user]);
  
  // Calculate Kiki state - show welcome animation first time, then idle
  const kikiState: 'welcome' | 'idle' | 'anxious' | 'love' = pet ? (hasSeenWelcome ? 'idle' : 'welcome') : 'welcome';
  
  const handleWelcomeComplete = React.useCallback(() => {
    setHasSeenWelcome(true);
  }, []);
  
  // Initialize stores once
  React.useEffect(() => {
    initializeStores();
  }, []);

  // Memoized navigation handlers to prevent re-renders
  const navigationHandlers = useMemo(() => ({
    toQuickTask: () => navigate('/quick-task'),
    toBoard: () => navigate('/board'),
    toLab: () => navigate('/lab'),
    toHome: () => navigate('/home'),
    toStats: () => navigate('/stats'),
    toShop: () => navigate('/shop'),
    toSettings: () => navigate('/settings'),
    toKiki: () => navigate('/kiki'),
  }), [navigate]);

  const modalHandlers = useMemo(() => ({
    showUserProfile: () => setShowUserProfile(true),
    hideUserProfile: () => setShowUserProfile(false),
    showAuth: () => setShowAuthModal(true),
    hideAuth: () => setShowAuthModal(false),
    showStartTask: () => setShowStartTaskFlow(true),
    hideStartTask: () => setShowStartTaskFlow(false),
  }), []);

  // StartTaskFlow handlers
  const handleStartTimer = useCallback(({ minutes, category, taskName }: { minutes: number; category?: string; taskName?: string }) => {
    // Use custom task name if provided, otherwise create from category
    let finalTaskName = 'Quick task';
    
    if (taskName?.trim()) {
      // User provided a custom task name - use it directly
      finalTaskName = taskName.trim();
    } else if (category) {
      // Create task name from category
      const CATEGORY_LABELS: Record<string, string> = {
        'study': 'Study',
        'chores': 'Chores', 
        'work': 'Work',
        'create': 'Create'
      };
      const label = CATEGORY_LABELS[category] || category;
      finalTaskName = `${label} task`;
    }
    
    // Start timer and navigate to timer screen
    const taskId = finalTaskName.replace(/\s+/g, '_').toLowerCase();
    startTimer(finalTaskName, minutes, taskId);
    navigationHandlers.toQuickTask();
    setShowStartTaskFlow(false);
  }, [startTimer, navigationHandlers]);

  const handleSchedule = useCallback(({ offset, category, taskName }: { offset: 'tomorrow' | 'in3d' | 'in1w'; category?: string; taskName?: string }) => {
    // Schedule soft deadline (new feature - can implement later)
    console.log('Scheduling task:', { offset, category, taskName });
    // Show success toast
    setShowStartTaskFlow(false);
  }, []);

  // Debounced verification check to reduce API calls
  const checkVerifications = useCallback(
    debounce(async () => {
      const verifications = getVerificationsFromStorage();
      const pendingVerifications = verifications.filter(
        (v: any) => v.status === VERIFICATION_STATUS.TRIAL || v.status === VERIFICATION_STATUS.PENDING
      );
      
      for (const verification of pendingVerifications) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session?.user) continue;
          
          const { data, error } = await supabase
            .from('verifications')
            .select('status')
            .eq('id', verification.id)
            .maybeSingle();

          if (data && (data.status === VERIFICATION_STATUS.APPROVED || data.status === VERIFICATION_STATUS.REJECTED)) {
            const updatedVerifications = verifications.map((v: any) => 
              v.id === verification.id ? { ...v, status: data.status } : v
            );
            setVerificationsToStorage(updatedVerifications);
            
            if (data.status === VERIFICATION_STATUS.APPROVED) {
              const pendingValidation = getPendingValidationFromStorage();
              if (pendingValidation) {
                navigationHandlers.toQuickTask();
                return;
              }
            }
          }
        } catch (error) {
          // Silent error handling - no console.log in production
        }
      }
    }, API_CONFIG.DEBOUNCE_DELAY),
    [navigationHandlers]
  );

  const checkTimerAbandonment = useCallback(() => {
    const activeTimer = getActiveTimerFromStorage();
    if (activeTimer) {
      const timer = activeTimer;
      const now = Date.now();
      const timeSinceStart = (now - timer.startTime) / 1000;
      
      if (timer.isRunning && timeSinceStart > TIMER_CONFIG.MAX_PAUSE_TIME) {
        removeActiveTimer();
        navigate('/death', { 
          state: { 
            reason: DEATH_REASONS.TIMER_ABANDONED(Math.floor(timeSinceStart / 60)),
            overdueTasks: [`"${timer.task}" - abandoned timer`]
          } 
        });
        return;
      }
      
      if (timeSinceStart > timer.duration * 60) {
        removeActiveTimer();
        navigate('/death', { 
          state: { 
            reason: DEATH_REASONS.TIMER_EXPIRED(),
            overdueTasks: [`"${timer.task}" - timer expired`]
          } 
        });
        return;
      }
    }
  }, [navigate]);

  const checkAndUpdateStreak = useCallback(() => {
    if (!pet) return;
    
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    const lastTaskDate = pet.lastTaskDate || '';
    
    if (lastTaskDate !== today && lastTaskDate !== yesterdayStr && pet.streak > 0) {
      const { updatePet } = usePetStore.getState();
      updatePet({ streak: 0 });
    }
  }, [pet]);

  const checkOverdueTasks = useCallback(() => {
    const savedTasks = getTasksFromStorage();
    if (!savedTasks || savedTasks.length === 0) return null;

    const tasks = savedTasks;
    const currentPet = pet || {};
    const now = new Date();
    
    const overdueTasks = tasks.filter((task: any) => {
      if (task.status === TASK_STATUS.DONE) return false;
      
      if (currentPet.adoptedAt && new Date(task.createdAt) < new Date(currentPet.adoptedAt)) {
        return false;
      }
      
      if (task.dueDate && task.dueTime) {
        const dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
        return dueDateTime < now;
      } else if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(23, 59, 59, 999);
        return dueDate < now;
      }
      
      return false;
    });

    const pendingValidation = getPendingValidationFromStorage();
    if (pendingValidation) {
      return { type: 'quick-task' };
    }

    if (overdueTasks.length > 0) {
      return { 
        type: 'death',
        reason: DEATH_REASONS.OVERDUE_TASKS(overdueTasks.length),
        overdueTasks: overdueTasks.map((t: any) => ({
          title: t.title,
          dueDate: t.dueDate,
          dueTime: t.dueTime,
          id: t.id
        }))
      };
    }

    return null;
  }, [pet]);

  // Initialize and check states
  useEffect(() => {
    // First check if pet is supposed to be dead
    const isPetDead = sessionStorage.getItem('pet-is-dead') === 'true';
    const deadPetName = sessionStorage.getItem('dead-pet-name');
    
    if (isPetDead && pet && pet.name === deadPetName) {
      console.log('🚫 Dead pet detected in Home, killing in store');
      killPet();
      // Don't redirect to death screen, let it fall through to onboarding
      navigate('/onboarding');
      return;
    }
    
    if (!pet) {
      navigate('/onboarding');
      return;
    }

    // Check for active timer first
    const activeTimer = getActiveTimerFromStorage();
    if (activeTimer) {
      const timer = activeTimer;
      const now = Date.now();
      const timeSinceStart = (now - timer.startTime) / 1000;
      
      if (timer.isRunning && timeSinceStart <= timer.duration * 60) {
        navigationHandlers.toQuickTask();
        return;
      }
    }

    const pendingValidation = getPendingValidationFromStorage();
    if (pendingValidation) {
      navigationHandlers.toQuickTask();
      return;
    }

    checkTimerAbandonment();
    
    if (checkForBoredomDeath()) {
      navigate('/death', {
        state: {
          reason: DEATH_REASONS.BOREDOM_DEATH(),
          overdueTasks: ['No tasks or activity for too long...']
        }
      });
      return;
    }

    const taskCheckResult = checkOverdueTasks();
    if (taskCheckResult) {
      if (taskCheckResult.type === 'quick-task') {
        navigationHandlers.toQuickTask();
        return;
      } else if (taskCheckResult.type === 'death') {
        navigate('/death', { 
          state: { 
            reason: taskCheckResult.reason,
            overdueTasks: taskCheckResult.overdueTasks
          } 
        });
        return;
      }
    }
    
    updateLastActivity();
    checkAndUpdateStreak();
    requestNotificationPermission();
    checkVerifications();

    // Quote rotation
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % PET_QUOTES.length);
    }, TIMER_CONFIG.QUOTE_ROTATION_INTERVAL);

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimerAbandonment();
        
        const taskCheckResult = checkOverdueTasks();
        if (taskCheckResult) {
          if (taskCheckResult.type === 'quick-task') {
            navigationHandlers.toQuickTask();
          } else if (taskCheckResult.type === 'death') {
            navigate('/death', { 
              state: { 
                reason: taskCheckResult.reason,
                overdueTasks: taskCheckResult.overdueTasks
              } 
            });
          }
        }
        
        updateLastActivity();
      } else {
        setToStorage(STORAGE_KEYS.APP_BACKGROUNDED, Date.now().toString());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(quoteInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pet, navigate, navigationHandlers, checkTimerAbandonment, checkOverdueTasks, checkAndUpdateStreak, checkVerifications]);

  if (!pet) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 pb-24">
      <MemoizedHeader 
        pet={pet}
        user={user}
        onShowUserProfile={modalHandlers.showUserProfile}
        onShowAuthModal={modalHandlers.showAuth}
        onNavigateToSettings={navigationHandlers.toSettings}
      />

      <div className="max-w-md mx-auto p-4 space-y-6">
        <MemoizedPetDisplay pet={pet} currentQuote={currentQuote} kikiState={kikiState} onWelcomeComplete={handleWelcomeComplete} />

        <Button 
          onClick={modalHandlers.showStartTask}
          className="btn-kawaii w-full h-16 text-lg"
        >
          Get to work
        </Button>
      </div>


      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={navigationHandlers.toHome}
          >
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={navigationHandlers.toBoard}
          >
            <Clock className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={navigationHandlers.toKiki}
          >
            <Cat className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={navigationHandlers.toShop}
          >
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={modalHandlers.hideAuth} 
      />

      <UserProfile 
        isOpen={showUserProfile} 
        onClose={modalHandlers.hideUserProfile} 
      />

      <StartTaskFlow
        isOpen={showStartTaskFlow}
        onClose={modalHandlers.hideStartTask}
        onStartTimer={handleStartTimer}
        onSchedule={handleSchedule}
      />
    </div>
  );
};

export default Home;