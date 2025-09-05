import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { syncOnTaskComplete } from "@/utils/cloudSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pause, Square, Camera, MessageSquare, UserCheck, Upload, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { updateLastActivity } from "@/utils/notifications";
import { supabase, VerificationRecord, cleanupOldVerifications } from "@/lib/supabaseClient";
import { FILE_SIZE_LIMITS, TASK_STATUS } from "@/constants";
import { 
  getPauseTokensFromStorage, 
  setPauseTokensToStorage,
  getSessionStatsFromStorage,
  setSessionStatsToStorage,
  getTasksFromStorage,
  setTasksToStorage,
  getPetFromStorage,
  setPetToStorage,
  getActiveTimerFromStorage,
  setActiveTimerToStorage,
  removeActiveTimer,
  getPendingValidationFromStorage,
  setPendingValidationToStorage,
  removePendingValidation,
  getPendingShareUrlFromStorage,
  setPendingShareUrlToStorage,
  removePendingShareUrl,
  getVerificationsFromStorage,
  setVerificationsToStorage,
  removeVerifications,
  getInsuranceFromStorage,
  setInsuranceToStorage,
  getCoinsFromStorage,
  setCoinsToStorage
} from "@/utils/helpers";
import AnimatedKiki from "@/components/AnimatedKiki";
import { usePetStore, useTimerStore, useTaskStore } from '@/store';

// Utility function for UUID generation (token generation moved to RPC)
const generateUUID = () => {
  return crypto.randomUUID();
};

// Helper function to create review tokens via RPC
async function createReviewToken(supabase: any, verificationId: string, ttlSeconds = 86400) {
  const { data, error } = await supabase.rpc('create_review_token', {
    p_verification_id: verificationId,   // verification.id (TEXT or UUID)
    p_ttl_seconds: ttlSeconds,
  });

  if (error) {
    console.error('create_review_token RPC error:', error);
    throw error;
  }
  return data as string; // token
}

interface TaskTimer {
  task: string;
  duration: number; // in minutes
  startTime: number | null;
  isRunning: boolean;
  timeElapsed: number;
  pauseUsed: boolean;
  pauseTimeUsed: number; // in seconds
  wasPaused: boolean;
  pauseStartTime: number | null;
  totalSessionTime: number; // total time since session started
}

interface Task {
  id: string;
  title: string;
  status: typeof TASK_STATUS[keyof typeof TASK_STATUS];
  dueDate?: string;
  dueTime?: string;
}

const QuickTask = () => {
  // Store hooks
  const { pet, pauseTokens, usePauseToken, useInsurance, addCoins } = usePetStore();
  const { 
    timer, validation, sessionStats,
    startTimer: startTimerStore, pauseTimer, resumeTimer, stopTimer: stopTimerStore, stopTimerForValidation,
    startValidation, updateValidationTime, canPause, getKikiState, 
    getProgress, getRemainingTime, formatTime, isInNoPauseZone,
    updateTimeElapsed, updateTotalSessionTime, restoreTimer
  } = useTimerStore();
  const { getTasksByStatus } = useTaskStore();
  
  // Local UI state
  const [task, setTask] = useState("");
  const [minutes, setMinutes] = useState(25); // Default pomodoro
  const [seconds, setSeconds] = useState(0);
  const [abortHolding, setAbortHolding] = useState(false);
  const [abortProgress, setAbortProgress] = useState(0);
  const [failHolding, setFailHolding] = useState(false);
  const [failProgress, setFailProgress] = useState(0);
  // UI State
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [photoProof, setPhotoProof] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(validation.isValidating);
  const [validationTimeLeft, setValidationTimeLeft] = useState(validation.validationTimeLeft);

  // Sync local validation state with store
  useEffect(() => {
    setShowValidation(validation.isValidating);
    setValidationTimeLeft(validation.validationTimeLeft);
  }, [validation.isValidating, validation.validationTimeLeft]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingVerification, setPendingVerification] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelectingFile, setIsSelectingFile] = useState(false);
  const [lastUploadTime, setLastUploadTime] = useState<number>(0);
  const [uploadCooldown, setUploadCooldown] = useState<number>(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Broadcast channel for cross-tab communication
  const [broadcastChannel] = useState(() => new BroadcastChannel('kiki-verification'));

  useEffect(() => {
    // Load tasks from store
    const todoTasks = getTasksByStatus(TASK_STATUS.TODO);
    setAvailableTasks(todoTasks);
    
    // Legacy localStorage checks for migration
    const pendingValidation = getPendingValidationFromStorage();
    const activeTimer = getActiveTimerFromStorage();
    const savedShareUrl = getPendingShareUrlFromStorage();

    // Check if there's a pending share link from previous session
    if (savedShareUrl) {
      setVerificationUrl(savedShareUrl);
      setShowVerificationModal(true);
      // User will see the share screen instead of the main task interface
    }

    // Check for active timer first - restore timer state (but only if no pending verification)
    const verifications = getVerificationsFromStorage();
    const hasPendingVerification = verifications.some((v: any) => v.status === 'trial');
    
    if (activeTimer && !hasPendingVerification) {
      const savedTimer = activeTimer;
      const now = Date.now();
      const timeSinceStart = (now - savedTimer.startTime) / 1000;
      
      // If timer is still valid and running, restore it
      if (savedTimer.isRunning && timeSinceStart <= savedTimer.duration * 60) {
        setTask(savedTimer.task);
        // Restore timer to Zustand store
        restoreTimer(savedTimer);
        updateTimeElapsed(Math.floor(timeSinceStart));
        updateTotalSessionTime(Math.floor(timeSinceStart) + (savedTimer.pauseTimeUsed || 0));
        return; // Skip other checks when timer is active
      }
    }

    // Check for pending validation
    if (pendingValidation) {
      const validationData = pendingValidation;
      setTask(validationData.task);
      
      // Calculate remaining validation time from timestamp
      if (validationData.timestamp) {
        const validationStartTime = new Date(validationData.timestamp).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - validationStartTime) / 1000);
        const remainingTime = Math.max(0, 60 - elapsedSeconds); // 60 seconds total
        setValidationTimeLeft(remainingTime);
        
        // If time already expired, navigate to death after render
        if (remainingTime <= 0) {
          setTimeout(() => {
            navigate("/death", { 
              state: { 
                reason: "CORPORATE EXECUTION: Verification timeout exceeded. Productivity Agent #4251 failed to secure user evidence within allocated timeframe. Termination protocol activated. - Kiki Corp Efficiency Division ⏰🏢" 
              } 
            });
          }, 0);
          return;
        }
      } else {
        // Fallback if no timestamp
        setValidationTimeLeft(60);
      }
      
      // Create a mock timer for validation display
      const mockTimer: TaskTimer = {
        task: validationData.task,
        duration: 25, // Default duration
        startTime: null,
        isRunning: false,
        timeElapsed: 0,
        pauseUsed: false,
        pauseTimeUsed: 0,
        wasPaused: validationData.wasPaused || false,
        pauseStartTime: null,
        totalSessionTime: 0
      };
      
      // Mock timer should not be set directly - use store functions
      setShowValidation(true);
    }

    // Update last activity
    updateLastActivity();
    
    // Listen for verification updates from other tabs
    const handleBroadcastMessage = (event: MessageEvent) => {
      console.log('Received broadcast message:', event.data);
      if (event.data.type === 'verification-update' && event.data.id === pendingVerification) {
        console.log('Verification update received for our pending verification');
        if (event.data.status === 'approved') {
          handleTaskComplete();
        } else if (event.data.status === 'rejected') {
          handleTaskFailed();
        }
      }
    };
    
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
    
    return () => {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    };
  }, [pendingVerification]);

  // Initialize verification state on mount (separate from pendingVerification dependency)
  useEffect(() => {
    // Restore verification state after page refresh
    restoreVerificationState();
    
    // Check for pending verifications on mount (in case friend verified while app was closed)
    checkAllPendingVerifications();
  }, []); // Empty dependency array - runs only once on mount

  // Check verification status periodically
  useEffect(() => {
    if (!pendingVerification) return;
    
    const interval = setInterval(checkVerificationStatus, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [pendingVerification]);

  // Cooldown timer for anti-spam protection
  useEffect(() => {
    if (uploadCooldown > 0) {
      const interval = setInterval(() => {
        setUploadCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [uploadCooldown]);

  // Prevent navigation away from validation screen
  useEffect(() => {
    if (showValidation) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "You must complete task validation! Kiki's life depends on it!";
      };
      
      const handlePopState = () => {
        // Block back button navigation during validation
        window.history.pushState(null, '', window.location.pathname);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      
      // Push current state to prevent back navigation
      window.history.pushState(null, '', window.location.pathname);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [showValidation]);

  // Validation countdown timer - 1 minute to upload photo or Kiki dies
  useEffect(() => {
    if (showValidation && !pendingVerification) {
      // Only reset to 60 if we don't have a stored validation time (new validation)
      const pendingValidation = getPendingValidationFromStorage();
      if (!pendingValidation?.timestamp) {
        setValidationTimeLeft(60); // Reset to 60 seconds only for new validations
      }
      
      const interval = setInterval(() => {
        setValidationTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            // Time's up - Kiki dies (defer navigation to avoid setState during render)
            setTimeout(() => {
              navigate("/death", { 
                state: { 
                  reason: "CORPORATE EXECUTION: Verification timeout exceeded. Productivity Agent #4251 failed to secure user evidence within allocated timeframe. Termination protocol activated. - Kiki Corp Efficiency Division ⏰🏢" 
                } 
              });
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [showValidation, pendingVerification, navigate]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timer?.startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        
        if (timer.isRunning) {
          // Running timer - update elapsed time
          const elapsed = Math.floor((now - timer.startTime!) / 1000);
          const totalSession = Math.floor((now - timer.startTime!) / 1000) + timer.pauseTimeUsed;
          
          updateTimeElapsed(elapsed);
          updateTotalSessionTime(totalSession);
          
          // Check if time is up
          if (elapsed >= timer.duration * 60) {
            stopTimerForValidation();
            setShowValidation(true);
            
            // Clear active timer from localStorage since validation started
            removeActiveTimer();
            
            // Save validation state to localStorage
            setPendingValidationToStorage({
              task: timer.task,
              taskId: timer.taskId,
              timestamp: new Date().toISOString(),
              wasPaused: timer.wasPaused
            });
            
            toast({
              title: "TIME IS UP!",
              description: "Show proof that you finished the task or Kiki gets fired! 📋",
            });
          }
        } else if (timer.pauseStartTime) {
          // Paused timer - check pause time limit (3 minutes max)
          const pauseTime = Math.floor((now - timer.pauseStartTime) / 1000);
          
          if (pauseTime >= 180) { // 3 minutes = 180 seconds
            // Force resume or kill Kiki
            toast({
              title: "Pause time exceeded!",
              description: "Maximum pause time reached. Kiki is getting anxious...",
              variant: "destructive"
            });
            
            // Auto-kill Kiki if pause is too long
            navigate("/death", { 
              state: { reason: "CORPORATE EXECUTION: Productivity Agent #4251 failed to maintain user focus during extended pause. Contract terminated by Kiki Corp. We apologize for the inconvenience. 🏢⚡" } 
            });
          }
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [timer?.isRunning, timer?.startTime, timer?.duration, timer?.pauseStartTime, toast, navigate]);

  const startTimer = () => {
    if (!task.trim()) {
      toast({
        title: "Hold up!",
        description: "What task are you even doing? Kiki needs to know!",
        variant: "destructive"
      });
      return;
    }

    // Reset verification state when starting new timer
    setPendingVerification(null);
    setVerificationUrl(null);
    setPhotoProof(null);
    setShowPhotoUpload(false);
    setShowVerificationModal(false);

    const totalDurationInMinutes = minutes + (seconds / 60);
    if (totalDurationInMinutes <= 0) {
      toast({
        title: "Invalid duration!",
        description: "Timer must be at least 1 second!",
        variant: "destructive"
      });
      return;
    }

    // Use store to start timer
    const taskId = task.replace(/\s+/g, '_').toLowerCase();
    startTimerStore(task, totalDurationInMinutes, taskId);
    
    // Save active timer to localStorage for abandonment detection
    setActiveTimerToStorage({
      task,
      duration: totalDurationInMinutes,
      startTime: Date.now(),
      isRunning: true,
      timeElapsed: 0,
      pauseUsed: false,
      pauseTimeUsed: 0,
      wasPaused: false,
      pauseStartTime: null,
      totalSessionTime: 0
    });
    
    toast({
      title: "Timer started!",
      description: `Good luck with "${task}"! Kiki is rooting for you!`,
    });
  };

  const pauseTimerLocal = () => {
    const canPauseNow = canPause();
    if (!canPauseNow) {
      let reason = "Pausing is restricted";
      if (timer && timer.totalSessionTime < 600) reason = "Need 10+ minutes total session time";
      else if (timer && timer.timeElapsed < 300) reason = "Cannot pause in first 5 minutes";
      else if (timer && timer.timeElapsed > (timer.duration * 60 - 300)) reason = "Cannot pause in last 5 minutes";
      else if (timer && timer.pauseUsed && pauseTokens === 0) reason = "Already used pause (buy tokens for more)";
      else if (sessionStats.pausesUsed / Math.max(1, sessionStats.totalSessions) > 0.7) reason = "Pause abuse detected - restriction applied";
      
      toast({
        title: "Cannot pause now",
        description: reason,
        variant: "destructive"
      });
      return;
    }

    // Use pause token if this is a repeat pause
    let useToken = false;
    if (timer?.pauseUsed) {
      useToken = true;
      if (!usePauseToken()) {
        toast({
          title: "No pause tokens",
          description: "You don't have any pause tokens left!",
          variant: "destructive"
        });
        return;
      }
    }

    // Use store to pause timer
    pauseTimer();
    
    toast({
      title: useToken ? "Pause token used" : "Timer paused",
      description: `Max 3 minutes pause. ${useToken ? 'Token consumed.' : "Kiki is getting anxious..."} ⏰`,
      variant: "destructive"
    });
  };

  const resumeTimerLocal = () => {
    if (timer) {
      const pauseTime = timer.pauseStartTime ? Math.floor((Date.now() - timer.pauseStartTime) / 1000) : 0;
      
      // Use store to resume timer
      resumeTimer();

      toast({
        title: "Timer resumed",
        description: `Paused for ${pauseTime}s. Let's get back to work!`,
      });
    }
  };

  const stopTimerLocal = () => {
    // Use store to stop timer
    stopTimerStore();
    
    setShowValidation(false);
    setTask("");
    setAbortHolding(false);
    setAbortProgress(0);
    setFailHolding(false);
    setFailProgress(0);
    setValidationTimeLeft(60);
    
    // Clear active timer from localStorage
    removeActiveTimer();
  };

  const handleAbortStart = () => {
    setAbortHolding(true);
    setAbortProgress(0);
    
    const interval = setInterval(() => {
      setAbortProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          handleAbortComplete();
          return 100;
        }
        return prev + 5; // 2 second hold time
      });
    }, 100);

    // Clear interval if user releases
    const cleanup = () => {
      clearInterval(interval);
      setAbortHolding(false);
      setAbortProgress(0);
    };

    // Add event listeners for mouse/touch end
    document.addEventListener('mouseup', cleanup, { once: true });
    document.addEventListener('touchend', cleanup, { once: true });
  };

  const handleAbortComplete = () => {
    // Check for pet life insurance from store
    if (useInsurance()) {
      toast({
        title: "Pet Life Insurance activated!",
        description: "Kiki was saved by your insurance policy",
      });
      stopTimerLocal();
      navigate("/home");
    } else {
      navigate("/death", { state: { reason: "CORPORATE EXECUTION: Mission aborted by user. Productivity Agent #4251 recalled for immediate termination. Thank you for your cooperation. - Kiki Corp 🏢💼" } });
    }
  };

  const handleFailStart = () => {
    setFailHolding(true);
    setFailProgress(0);
    
    const interval = setInterval(() => {
      setFailProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          handleFailComplete();
          return 100;
        }
        return prev + 5; // 2 second hold time
      });
    }, 100);

    // Clear interval if user releases
    const cleanup = () => {
      clearInterval(interval);
      setFailHolding(false);
      setFailProgress(0);
    };

    // Add event listeners for mouse/touch end
    document.addEventListener('mouseup', cleanup, { once: true });
    document.addEventListener('touchend', cleanup, { once: true });
  };

  const handleFailComplete = () => {
    handleTaskFailed();
  };

  const handleTaskComplete = () => {
    console.log('handleTaskComplete called - starting task completion process');
    console.log('Current timer state:', timer);
    
    // Save verification ID before clearing state
    const verificationToCleanup = pendingVerification;
    
    // Clear verification state on task completion
    setPendingVerification(null);
    setVerificationUrl(null);
    setPhotoProof(null);
    setShowPhotoUpload(false);
    setShowVerificationModal(false);
    removePendingShareUrl();
    removeVerifications(); // Clear localStorage to prevent reusing old verifications
    // Note: Keep verification in DB - it was successful!
    
    // Clean up specific verification after successful task completion
    // Add delay to ensure status is updated in database first
    if (verificationToCleanup) {
      setTimeout(() => {
        cleanupSpecificVerification(verificationToCleanup).catch(error => {
          console.warn('Cleanup after task completion failed:', error);
        });
      }, 2000); // 2 second delay
    }
    
    // Calculate coin reward based on timer duration
    const timerDuration = timer?.duration || 25; // fallback to 25 minutes
    const coinReward = timerDuration >= 60 ? 150 : 
                      timerDuration >= 45 ? 100 :
                      timerDuration >= 25 ? 75 : 50;
    
    // Reduce reward if paused
    const finalReward = timer?.wasPaused ? Math.floor(coinReward * 0.7) : coinReward;

    // Update pet streak using store
    if (pet) {
      const today = new Date().toDateString();
      const lastTaskDate = pet.lastTaskDate || "";
      
      if (lastTaskDate !== today) {
        // This is the first completed task today - update streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        const { updatePet } = usePetStore.getState();
        
        if (lastTaskDate === yesterdayStr) {
          // Consecutive day - increment streak
          updatePet({ 
            streak: pet.streak + 1,
            lastTaskDate: today 
          });
          console.log('Consecutive day! Streak increased to:', pet.streak + 1);
        } else if (lastTaskDate === "") {
          // First ever task - start streak
          updatePet({ 
            streak: 1,
            lastTaskDate: today 
          });
          console.log('First task ever! Started streak at 1');
        } else {
          // Gap in days - reset streak
          updatePet({ 
            streak: 1,
            lastTaskDate: today 
          });
          console.log('Gap in days detected. Streak reset to 1');
        }
      } else {
        console.log('Already completed a task today - streak unchanged at:', pet.streak);
      }
    }
    
    // Add coins using store
    addCoins(finalReward);

    const message = timer?.wasPaused 
      ? `Task completed, but Kiki noticed the pause... +${finalReward} coins (reduced for pausing)`
      : `Task completed! 🎉 Kiki is so proud! +${finalReward} coins!`;

    toast({
      title: timer?.wasPaused ? "Task completed... barely" : "Task completed! 🎉",
      description: message,
    });

    console.log('Showing success toast and cleaning up...');
    
    // Clear validation state and active timer
    removePendingValidation();
    removeActiveTimer();
    console.log('Cleared localStorage items');
    
    stopTimerLocal();
    console.log('Called stopTimer()');
    
    // Auto-sync to cloud after task completion
    syncOnTaskComplete();
    
    console.log('Navigating to /home');
    navigate("/home");
  };

  const handleTaskFailed = async () => {
    // Save verification ID before clearing state
    const verificationToCleanup = pendingVerification;
    
    // Clear verification state on task failure
    setPendingVerification(null);
    setVerificationUrl(null);
    setPhotoProof(null);
    setShowPhotoUpload(false);
    setShowVerificationModal(false);
    removePendingShareUrl();
    
    // Clean up specific verification files after failed task
    // Add delay to ensure status is updated in database first
    if (verificationToCleanup) {
      setTimeout(() => {
        cleanupSpecificVerification(verificationToCleanup).catch(error => {
          console.warn('Cleanup after task failure failed:', error);
        });
      }, 2000); // 2 second delay
    }
    
    // Clear validation state before navigating to death
    removePendingValidation();
    removeActiveTimer();
    navigate("/death", { state: { reason: "CORPORATE EXECUTION: Productivity Agent #4251 failed verification protocols. Trust metrics compromised. Immediate termination authorized. - Kiki Corp Quality Assurance 🏢📋" } });
  };

  const handlePhotoProof = () => {
    // Check if there's already a pending verification
    const verifications = getVerificationsFromStorage();
    const activeVerification = verifications.find((v: any) => v.status === 'trial');
    
    if (activeVerification) {
      // There's already an active verification - show the share link instead
      setPendingVerification(activeVerification.id);
      
      // Reconstruct verification URL
      let url: string;
      if (activeVerification.reviewToken) {
        url = `${window.location.origin}/review?token=${activeVerification.reviewToken}`;
      } else {
        url = `${window.location.origin}/verify/${activeVerification.id}`;
      }
      setVerificationUrl(url);
      setPendingShareUrlToStorage(url);
      setShowVerificationModal(true);
      
      toast({
        title: "Active verification protocol found",
        description: "You have a pending Corporate Review. Share the existing token with your external validator.",
      });
    }
    
    setShowPhotoUpload(true);
  };

  const compressImage = (file: File, maxWidth = 600, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // More aggressive compression for better performance
        let targetWidth = img.width;
        let targetHeight = img.height;
        
        // Scale down large images more aggressively
        if (img.width > maxWidth || img.height > maxWidth) {
          const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
          targetWidth = Math.floor(img.width * ratio);
          targetHeight = Math.floor(img.height * ratio);
        }
        
        // Further reduce size for very large files
        if (file.size > FILE_SIZE_LIMITS.IMAGE_COMPRESSION_THRESHOLD) { // > 2MB
          targetWidth = Math.floor(targetWidth * 0.7);
          targetHeight = Math.floor(targetHeight * 0.7);
        }
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Improve quality with better smoothing
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        }
        
        // Convert to base64 with optimized compression
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsSelectingFile(true);
      // Add small delay to show loading state
      setTimeout(() => {
        setSelectedFile(file);
        setIsSelectingFile(false);
      }, 300);
    }
  };

  const handleUploadProof = async () => {
    if (!selectedFile) return;
    
    try {
      setIsGenerating(true);
      
      toast({
        title: "Processing image...",
        description: "Compressing for faster upload",
      });
      
      const compressedImage = await compressImage(selectedFile);
      setPhotoProof(compressedImage);
      
      // Calculate compression ratio for user feedback
      const originalSize = selectedFile.size;
      const compressedSize = Math.floor(compressedImage.length * 0.75); // Rough estimate
      const compressionRatio = Math.floor((1 - compressedSize / originalSize) * 100);
      
      toast({
        title: "Image optimized! ⚡",
        description: `Reduced by ~${compressionRatio}% for faster sharing`,
      });

      // Clear selected file after successful upload
      setSelectedFile(null);
      
      // Automatically send to friend after successful compression
      console.log('📸 Photo compressed successfully, calling sendToFriend...');
      await sendToFriend(compressedImage);
    } catch (error) {
      console.error('Compression failed:', error);
      // Fallback to original method with size warning
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fallbackImage = e.target?.result as string;
        setPhotoProof(fallbackImage);
        if (selectedFile.size > FILE_SIZE_LIMITS.IMAGE_WARNING_THRESHOLD) {
          toast({
            title: "Large image detected",
            description: "Upload may be slower due to file size",
            variant: "destructive"
          });
        }
        await sendToFriend(fallbackImage);
      };
      reader.readAsDataURL(selectedFile);
      setSelectedFile(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Show loading state immediately
      setIsGenerating(true);
      
      toast({
        title: "Processing image...",
        description: "Compressing for faster upload",
      });
      
      try {
        const compressedImage = await compressImage(file);
        setPhotoProof(compressedImage);
        
        // Calculate compression ratio for user feedback
        const originalSize = file.size;
        const compressedSize = Math.floor(compressedImage.length * 0.75); // Rough estimate
        const compressionRatio = Math.floor((1 - compressedSize / originalSize) * 100);
        
        toast({
          title: "Image optimized! ⚡",
          description: `Reduced by ~${compressionRatio}% for faster sharing`,
        });
      } catch (error) {
        console.error('Compression failed:', error);
        // Fallback to original method with size warning
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoProof(e.target?.result as string);
          if (file.size > FILE_SIZE_LIMITS.IMAGE_WARNING_THRESHOLD) {
            toast({
              title: "Large image detected",
              description: "Upload may be slower due to file size",
              variant: "destructive"
            });
          }
        };
        reader.readAsDataURL(file);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const canUploadNewPhoto = () => {
    const COOLDOWN_SECONDS = 60; // 1 minute cooldown
    const now = Date.now();
    const timeSinceLastUpload = (now - lastUploadTime) / 1000;
    return timeSinceLastUpload >= COOLDOWN_SECONDS;
  };

  const cleanupSpecificVerification = async (verificationId: string) => {
    try {
      console.log('🧹 Cleaning up specific verification:', verificationId);
      
      // Import supabase for cleanup
      const { supabase } = await import('../lib/supabaseClient');
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session?.user) return;
      
      // Use Edge Function for reliable cleanup
      try {
        const baseUrl = 'https://hwriwdbzervvmfpuzjqj.supabase.co';
        const response = await fetch(
          `${baseUrl}/functions/v1/cleanup-verifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              userId: sessionData.session.user.id,
              verificationIds: [verificationId]
            }),
          }
        );
        
        if (response.status === 404) {
          console.warn('Edge Function not deployed (404) - using direct cleanup');
          await fallbackCleanup([{id: verificationId}], supabase);
          return;
        }
        
        const responseData = await response.json();
        console.log('Edge Function cleanup response:', responseData);
        
        if (responseData?.error || !responseData?.success) {
          console.warn('Edge Function cleanup failed, falling back to direct cleanup:', responseData?.error);
          await fallbackCleanup([{id: verificationId}], supabase);
        } else {
          console.log(`✅ Edge Function cleaned up verification ${verificationId}`);
        }
      } catch (edgeFunctionError) {
        console.warn('Edge Function unavailable, using direct cleanup:', edgeFunctionError);
        await fallbackCleanup([{id: verificationId}], supabase);
      }
      
      // Remove from localStorage
      const verifications = getVerificationsFromStorage();
      const filteredVerifications = verifications.filter((v: any) => v.id !== verificationId);
      setVerificationsToStorage(filteredVerifications);
      
    } catch (error) {
      console.error('Error during specific verification cleanup:', error);
    }
  };

  const cleanupOldVerifications = async () => {
    try {
      // Get current user verifications to cleanup
      const verifications = getVerificationsFromStorage();
      const activeVerifications = verifications.filter((v: any) => 
        v.status === 'trial' || v.status === 'approved' || v.status === 'rejected'
      );
      
      if (activeVerifications.length === 0) return;
      
      // Import supabase for cleanup
      const { supabase } = await import('../lib/supabaseClient');
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session?.user) return;
      
      // Use Edge Function for reliable cleanup
      try {
        const verificationIds = activeVerifications.map(v => v.id);
        
        // Zawsze używaj produkcyjnego URL (lokalny Supabase nie jest skonfigurowany)
        const baseUrl = 'https://hwriwdbzervvmfpuzjqj.supabase.co';
        const response = await fetch(
          `${baseUrl}/functions/v1/cleanup-verifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              userId: sessionData.session.user.id,
              verificationIds: verificationIds
            }),
          }
        );
        
        // Check if Edge Function exists (404 = not deployed)
        if (response.status === 404) {
          console.warn('Edge Function not deployed (404) - using direct cleanup');
          await fallbackCleanup(activeVerifications, supabase);
          return;
        }
        
        const responseData = await response.json();
        console.log('Edge Function response:', responseData);
        
        if (responseData?.error || !responseData?.success) {
          console.warn('Edge Function cleanup failed, falling back to direct cleanup:', responseData?.error);
          // Fallback to direct cleanup
          await fallbackCleanup(activeVerifications, supabase);
        } else {
          console.log(`✅ Edge Function cleaned up ${responseData.cleanedCount} verifications and ${responseData.deletedFiles} files`);
        }
      } catch (edgeFunctionError) {
        console.warn('Edge Function unavailable, using direct cleanup:', edgeFunctionError);
        // Fallback to direct cleanup
        await fallbackCleanup(activeVerifications, supabase);
      }
      
      // Clear localStorage verifications and reset state
      removeVerifications();
      
      // Reset verification state since we just cleaned up
      setPendingVerification(null);
      setVerificationUrl(null);
      setShowVerificationModal(false);
      removePendingShareUrl();
      
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  const fallbackCleanup = async (activeVerifications: any[], supabase: any) => {
    // Direct database cleanup as fallback
    for (const verification of activeVerifications) {
      try {
        // Delete from verifications table (cascade should handle review_tokens)
        const { error: dbError } = await supabase
          .from('verifications')
          .delete()
          .eq('id', verification.id);
        
        if (dbError) {
          console.warn('Failed to delete verification record:', verification.id, dbError);
        }
        
        // Delete file from storage if exists
        if (verification.photo_storage_path) {
          const { error: storageError } = await supabase.storage
            .from('proofs')
            .remove([verification.photo_storage_path]);
          
          if (storageError) {
            console.warn('Failed to delete storage file:', verification.photo_storage_path, storageError);
          }
        }
      } catch (error) {
        console.warn('Error cleaning up verification:', verification.id, error);
      }
    }
    console.log(`🔄 Fallback cleaned up ${activeVerifications.length} verification(s)`);
  };

  const handleNewPhotoUpload = async () => {
    if (!canUploadNewPhoto()) {
      const COOLDOWN_SECONDS = 60;
      const now = Date.now();
      const timeSinceLastUpload = (now - lastUploadTime) / 1000;
      const remainingTime = Math.ceil(COOLDOWN_SECONDS - timeSinceLastUpload);
      
      toast({
        title: "Upload cooldown active",
        description: `Please wait ${remainingTime} seconds before uploading a new photo`,
        variant: "destructive"
      });
      return;
    }

    // Show loading toast during cleanup
    toast({
      title: "Preparing for new upload...",
      description: "Cleaning up old verification data",
    });
    
    // Cleanup old verifications first
    await cleanupOldVerifications();

    // Clear existing verification state and allow new upload
    console.log('🧹 Clearing all verification state for new upload');
    setPendingVerification(null);
    setVerificationUrl(null);
    setPhotoProof(null);
    setSelectedFile(null);
    setIsSelectingFile(false);
    setShowVerificationModal(false);
    setShowPhotoUpload(false); // Close current verification modal first
    removePendingShareUrl();
    
    // Set upload time and cooldown
    const now = Date.now();
    setLastUploadTime(now);
    setUploadCooldown(60); // 60 seconds
    
    toast({
      title: "Ready for new documentation",
      description: "You can now submit a new evidence report",
    });
    
    // Open photo upload modal after a short delay to ensure clean state
    setTimeout(() => {
      setShowPhotoUpload(true);
    }, 100);
  };

  const sendToFriend = async (imageData?: string) => {
    const photo = imageData || photoProof;
    console.log('🚀 sendToFriend called, photo exists:', !!photo);
    
    if (!photo) {
      console.log('❌ No photo - returning early');
      toast({
        title: "Missing photo",
        description: "Please upload a proof photo first",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    // Check for existing verifications and cleanup before creating new one
    const verifications = getVerificationsFromStorage();
    const activeVerifications = verifications.filter((v: any) => v.status === 'trial');
    
    if (activeVerifications.length > 0) {
      toast({
        title: "Cleaning up old verification...",
        description: "Removing previous verification before creating new one",
      });
      await cleanupOldVerifications();
    }
    
    try {
      // Check if user is logged in
      const { supabase } = await import('../lib/supabaseClient');
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session?.user) {
        // Use guest upload flow
        await handleGuestUpload(photo);
        return;
      }

      // Continue with logged-in user flow
      await handleLoggedInUpload(sessionData, photo);
      
    } catch (error: any) {
      console.error('Error creating verification:', error);
      toast({
        title: "Error",
        description: `Failed to generate link: ${error.message || error}`,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGuestUpload = async (photo: string) => {
    try {
      console.log('🔄 Starting guest upload...');
      toast({
        title: "Uploading as guest... 📤",
        description: "Creating verification link for friend review",
      });

      // Import guest upload function
      const { uploadAsGuest } = await import('../lib/guest');
      
      // Convert base64 to File object for guest upload
      const base64Data = photo.replace(/^data:image\/[a-z]+;base64,/, '');
      const mimeType = photo.includes('data:image/png') ? 'image/png' : 'image/jpeg';
      const binaryString = atob(base64Data);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([uint8Array], { type: mimeType });
      const file = new File([blob], 'proof.jpg', { type: mimeType });

      // Upload via guest endpoint
      console.log('🔍 Debug timer state:', timer);
      console.log('📤 Calling uploadAsGuest with file:', {
        fileName: file.name,
        fileSize: file.size,
        taskTitle: timer?.taskId || timer?.task || "Untitled Task",
        timerTask: timer?.task,
        isTimerUndefined: timer === undefined,
        isTaskEmpty: !timer?.task
      });
      
      const result = await uploadAsGuest({
        file: file,
        taskTitle: timer?.taskId || timer?.task || "Untitled Task"
      });

      console.log('💾 Guest upload successful - verification created:', result.verificationId);

      // Save to localStorage for local tracking
      const verificationData = {
        id: result.verificationId,
        task: timer?.task || "",
        timestamp: new Date().toISOString(),
        status: 'trial',
        user_agent: navigator.userAgent,
        photo_storage_path: result.path,
        review_deadline: new Date(Date.now() + 24*60*60*1000).toISOString(),
        reviewToken: result.reviewToken,
        isGuest: true
      };
      
      const existingVerifications = getVerificationsFromStorage();
      existingVerifications.push(verificationData);
      setVerificationsToStorage(existingVerifications);
      
      setPendingVerification(result.verificationId);
      
      // Create review URL
      const url = result.reviewToken 
        ? `${window.location.origin}/review?token=${result.reviewToken}`
        : `${window.location.origin}/verify/${result.verificationId}`;
      setVerificationUrl(url);
      setPendingShareUrlToStorage(url);
      setShowVerificationModal(true);
      
      console.log('✅ Guest upload success - setting states:', {
        verificationUrl: url,
        showVerificationModal: true,
        pendingVerification: result.verificationId
      });
      
      // Set cooldown
      setLastUploadTime(Date.now());
      setUploadCooldown(60);
      
      // Close photo upload modal and show verification modal
      setShowPhotoUpload(false);
      
      toast({
        title: "Guest verification ready! ✅", 
        description: `Share link with friend for review (expires in 24h)`,
      });

    } catch (error: any) {
      console.error('Guest upload error:', error);
      
      if (error.message?.includes('rate-limited') || error.message?.includes('rate limit')) {
        // Reset rate limit for development
        try {
          const { rateLimiter } = await import('@/utils/rateLimiter');
          const { getGuestId } = await import('@/lib/guest');
          rateLimiter.resetLimit('supabase_upload', getGuestId());
          
          toast({
            title: "Upload limit reached - resetting for development",
            description: "Rate limit has been reset. Try uploading again.",
          });
        } catch (resetError) {
          toast({
            title: "Upload limit reached",
            description: "Please wait before uploading again",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Guest upload failed",
          description: error.message || "Please try again",
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const handleLoggedInUpload = async (sessionData: any, photo: string) => {
    console.log('🚀 handleLoggedInUpload called, timer state at start:', {
      timer: timer,
      timerExists: !!timer,
      timerTask: timer?.task,
      timerTaskId: timer?.taskId,
      timerIsRunning: timer?.isRunning
    });
    
    try {

      toast({
        title: "Uploading proof... 📤",
        description: "Saving to secure storage...",
      });

      // Import upload function and premium check
      const { uploadProof } = await import('../services/proofs');
      const { isUserPremium } = await import('../services/premium');
      const { supabase } = await import('../lib/supabaseClient');
      
      // Convert base64 to ArrayBuffer
      const base64Data = photo.replace(/^data:image\/[a-z]+;base64,/, '');
      const binaryString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(binaryString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      
      // Check if user is premium
      const isPremium = await isUserPremium(sessionData.session.user.id);
      
      // Get taskId from timer or fallback to pending validation
      const pendingValidation = getPendingValidationFromStorage();
      const finalTaskId = timer?.taskId || timer?.task || pendingValidation?.taskId || pendingValidation?.task || "";
      
      console.log('🔍 Debug taskId for upload:', {
        timerTaskId: timer?.taskId,
        timerTask: timer?.task,
        pendingTaskId: pendingValidation?.taskId,
        pendingTask: pendingValidation?.task,
        finalTaskId: finalTaskId,
        isEmpty: !finalTaskId
      });
      
      // Upload with verification creation
      const result = await uploadProof({
        userId: sessionData.session.user.id,
        taskId: finalTaskId,
        arrayBuffer: arrayBuffer,
        isPremium: isPremium,
        mime: photo.includes('data:image/png') ? 'image/png' : 'image/jpeg'
      });

      const verificationId = result.verificationId;
      console.log('💾 Upload successful - verification created with ID:', verificationId);

      // Handle different verification statuses
      if (result.status === 'approved') {
        // Auto-approved by AI - complete task immediately
        toast({
          title: "Task Auto-Approved! ✅",
          description: "AI verified your proof - well done!",
        });
        handleTaskComplete();
        return;
      } else if (result.status === 'rejected') {
        // Auto-rejected by heuristics/AI
        toast({
          title: "Proof Rejected ❌",
          description: result.reason || "Image quality too low",
          variant: "destructive"
        });
        handleTaskFailed();
        return;
      }

      // Trial mode - need friend verification
      // Create review token via RPC
      let reviewToken: string;
      try {
        console.log('🎫 Creating review token for verification:', verificationId);
        reviewToken = await createReviewToken(supabase, verificationId, 7*24*60*60); // 7 days
        console.log('✅ Review token created successfully via RPC:', reviewToken);
      } catch (tokenError) {
        console.error('❌ Failed to create review token:', tokenError);
        toast({
          title: "Error",
          description: "Failed to create review link",
          variant: "destructive"
        });
        setIsGenerating(false);
        return;
      }
      
      // Save to localStorage for local access  
      const verificationData = {
        id: verificationId,
        task: timer?.task || "",
        timestamp: new Date().toISOString(),
        status: 'trial', // Always trial for new uploads
        user_agent: navigator.userAgent,
        photo_storage_path: result.path,
        review_deadline: new Date(Date.now() + 24*60*60*1000).toISOString(), // 24h from now
        reviewToken: reviewToken // Store the token we generated
      };
      
      const existingVerifications = getVerificationsFromStorage();
      existingVerifications.push(verificationData);
      setVerificationsToStorage(existingVerifications);
      
      setPendingVerification(verificationId);
      
      // Use token-based review flow
      const url = `${window.location.origin}/review?token=${reviewToken}`;
      setVerificationUrl(url);
      setPendingShareUrlToStorage(url);
      setShowVerificationModal(true);
        
        // Set last upload time for anti-spam cooldown
        setLastUploadTime(Date.now());
        setUploadCooldown(60); // 60 seconds cooldown
        
        // Close photo upload modal and show verification modal
        setShowPhotoUpload(false);
        
        toast({
          title: "Link ready! ✅", 
          description: `Friend has 24h to verify (expires ${new Date(Date.now() + 24*60*60*1000).toLocaleString()})`,
        });
        
    } catch (error) {
      console.error('Logged-in upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to create verification link",
        variant: "destructive"
      });
      throw error;
    }
  };

  const restoreVerificationState = () => {
    // Restore pending verification state after page refresh
    const verifications = getVerificationsFromStorage();
    const activePendingVerification = verifications.find((v: any) => v.status === 'trial');
    
    if (activePendingVerification) {
      console.log('Restoring pending verification state:', activePendingVerification.id);
      setPendingVerification(activePendingVerification.id);
      
      // Show validation screen when there's a pending verification
      setShowValidation(true);
      
      // Restore verification URL if available
      const savedUrl = getPendingShareUrlFromStorage();
      if (savedUrl) {
        setVerificationUrl(savedUrl);
        setShowVerificationModal(true);
      } else if (activePendingVerification.reviewToken) {
        const url = `${window.location.origin}/review?token=${activePendingVerification.reviewToken}`;
        setVerificationUrl(url);
        setShowVerificationModal(true);
      } else {
        const url = `${window.location.origin}/verify/${activePendingVerification.id}`;
        setVerificationUrl(url);
        setShowVerificationModal(true);
      }
    }
  };

  const checkAllPendingVerifications = async () => {
    // Check all pending verifications on mount (friend might have verified while app was closed)
    const verifications = getVerificationsFromStorage();
    const pendingVerifications = verifications.filter((v: any) => v.status === 'trial');
    
    console.log('Checking all pending verifications on mount:', pendingVerifications.length);
    
    for (const verification of pendingVerifications) {
      try {
        // Only check cloud verifications if user is logged in
        if (verification.id.startsWith('local-')) {
          // Local verification - can't check remote status
          continue;
        }
        
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) continue;
        
        const { data, error } = await supabase
          .from('verifications')
          .select('status')
          .eq('id', verification.id)
          .maybeSingle();

        if (data && (data.status === 'approved' || data.status === 'rejected')) {
          console.log(`Found updated verification ${verification.id} with status:`, data.status);
          
          // Update localStorage
          const updatedVerifications = verifications.map((v: any) => 
            v.id === verification.id ? { ...v, status: data.status } : v
          );
          setVerificationsToStorage(updatedVerifications);
          
          // If this is our current pending verification, handle it
          if (pendingVerification === verification.id) {
            if (data.status === 'approved') {
              handleTaskComplete();
            } else if (data.status === 'rejected') {
              handleTaskFailed();
            }
            return; // Exit early if we found our verification
          }
        }
      } catch (error) {
        console.warn('Error checking verification:', verification.id, error);
      }
    }
  };

  const checkVerificationStatus = async () => {
    if (!pendingVerification) return;
    
    // Check localStorage first (faster and more reliable)
    const verifications = getVerificationsFromStorage();
    const verification = verifications.find((v: any) => v.id === pendingVerification);
    
    console.log('Checking verification status:', {
      pendingVerification,
      verificationsCount: verifications.length,
      foundVerification: verification,
      status: verification?.status
    });
    
    if (verification?.status === "approved") {
      console.log('Verification approved - completing task');
      // Clear pending verification to stop checking
      setPendingVerification(null);
      handleTaskComplete();
      return;
    } else if (verification?.status === "rejected") {
      console.log('Verification rejected - failing task');
      // Clear pending verification to stop checking
      setPendingVerification(null);
      handleTaskFailed();
      return;
    }
    
    // If not found in localStorage, check Supabase as backup
    try {
      // Check auth session before query
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      
      console.log('🔍 Querying Supabase for id=', pendingVerification, 'with uid=', uid);
      
      const { data, error } = await supabase
        .from('verifications')
        .select('status')
        .eq('id', pendingVerification)
        .maybeSingle(); // Don't throw on 0 rows

      console.log('📊 Supabase response:', { data, error, hasData: !!data });

      if (error) {
        console.warn('Supabase query error:', error.message);
        return; // Don't retry on error, just wait for next poll
      }

      if (data) {
        console.log('Found verification in Supabase with status:', data.status);
        if (data.status === "approved") {
          console.log('✅ Supabase verification approved - completing task');
          setPendingVerification(null);
          handleTaskComplete();
          return;
        } else if (data.status === "rejected") {
          console.log('❌ Supabase verification rejected - failing task');
          setPendingVerification(null);
          handleTaskFailed();
          return;
        }
      } else {
        console.log('⏳ No verification found in Supabase yet (insert may not have synced)');
        // Continue polling - this is normal if insert hasn't propagated yet
      }
    } catch (error) {
      console.error('❌ Error checking Supabase verification:', error.message);
      // Continue polling on error - don't stop the process
    }
  };

  const copyToClipboard = async () => {
    if (!verificationUrl) return;
    
    try {
      await navigator.clipboard.writeText(verificationUrl);
      toast({
        title: "Link copied!",
        description: "Verification link copied to clipboard",
      });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = verificationUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      
      toast({
        title: "Link copied!",
        description: "Verification link copied to clipboard",
      });
    }
  };

  const shareLink = () => {
    if (!verificationUrl) return;
    
    if (navigator.share) {
      navigator.share({
        title: "Kiki Task Verification",
        text: "Help verify my completed task - Kiki's life depends on it!",
        url: verificationUrl,
      });
    } else {
      copyToClipboard();
    }
  };

  // All timer functions are now provided by useTimerStore

  // getKikiState is now provided by useTimerStore

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">

      <div className="max-w-md mx-auto p-3 space-y-4 flex flex-col justify-center min-h-screen">
        {!timer && !showValidation && (
          <div className="space-y-3">
            <Card className="card-kawaii space-y-3">
              <h2 className="text-lg font-semibold text-center">What are you going to do?</h2>
              
              <div className="space-y-3">
                <Input
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="e.g., Do laundry, Study math, Clean room..."
                  className="text-center"
                />
                
                {availableTasks.length > 0 && (
                  <Button
                    onClick={() => setShowTaskSelector(true)}
                    variant="outline"
                    className="w-full"
                  >
                    📋 Or choose from your task list ({availableTasks.length} pending)
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[15, 25, 45, 60].map((mins) => (
                    <Button
                      key={mins}
                      variant={minutes === mins && seconds === 0 ? "default" : "outline"}
                      onClick={() => {
                        setMinutes(mins);
                        setSeconds(0);
                      }}
                      className="h-12"
                    >
                      {mins}m
                    </Button>
                  ))}
                </div>
                
                {/* Test buttons for seconds */}
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinutes(0);
                      setSeconds(10);
                    }}
                    className="text-xs h-8 bg-orange-100 hover:bg-orange-200"
                  >
                    10s
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinutes(0);
                      setSeconds(30);
                    }}
                    className="text-xs h-8 bg-orange-100 hover:bg-orange-200"
                  >
                    30s
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinutes(1);
                      setSeconds(0);
                    }}
                    className="text-xs h-8 bg-orange-100 hover:bg-orange-200"
                  >
                    1m
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinutes(2);
                      setSeconds(0);
                    }}
                    className="text-xs h-8 bg-orange-100 hover:bg-orange-200"
                  >
                    2m
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Minutes</label>
                    <Input
                      type="number"
                      value={minutes}
                      onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                      min={0}
                      max={120}
                      className="text-center"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Seconds (for testing)</label>
                    <Input
                      type="number"
                      value={seconds}
                      onChange={(e) => setSeconds(parseInt(e.target.value) || 0)}
                      min={0}
                      max={59}
                      className="text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="text-center text-sm text-muted-foreground">
                  Total: {minutes}m {seconds}s
                </div>
              </div>

              <Button onClick={startTimer} className="btn-kawaii w-full h-10">
                <Play className="w-5 h-5 mr-2" />
                Start Timer
              </Button>
            </Card>

          </div>
        )}

        {timer && !showValidation && (
          <div className="space-y-3">
            <Card className="card-kawaii space-y-4 text-center">
              <h2 className="text-xl font-bold">{timer.task}</h2>
              
              {/* Kiki Animation */}
              <div className="flex justify-center">
                <AnimatedKiki 
                  className="w-24 h-24" 
                  state={getKikiState()}
                />
              </div>
              
              <div className="space-y-3">
                <div className="text-4xl font-mono text-primary">
                  {formatTime(timer.duration * 60 - timer.timeElapsed)}
                </div>
                
                <div className="relative">
                  <Progress value={getProgress()} className="w-full h-3" />
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {Math.floor(getProgress())}% complete
                  {timer?.wasPaused && <span className="text-destructive ml-2">(Paused - Kiki is worried)</span>}
                </p>
              </div>

              <div className="flex justify-center space-x-2">
                {timer.isRunning ? (
                  <Button 
                    onClick={pauseTimerLocal} 
                    className="btn-kawaii" 
                    disabled={!canPause()}
                    title={!canPause() ? "Cannot pause now" : "Pause timer (max 3 min)"}
                  >
                    <Pause className="w-5 h-5" />
                    {timer.pauseUsed && pauseTokens === 0 ? " (0 left)" : 
                     timer.pauseUsed && pauseTokens > 0 ? ` (-1)` : ""}
                  </Button>
                ) : (
                  <Button onClick={resumeTimerLocal} className="btn-kawaii">
                    <Play className="w-5 h-5 mr-2" />
                    Resume ({timer.pauseStartTime ? Math.floor((Date.now() - timer.pauseStartTime) / 1000) : 0}s paused)
                  </Button>
                )}
                
                <Button
                  onClick={() => {
                    // Stop timer and show validation
                    stopTimerForValidation();
                    setShowValidation(true);
                    
                    // Clear active timer from localStorage since validation started
                    removeActiveTimer();
                    
                    setPendingValidationToStorage({
                      task: timer.task,
                      taskId: timer.taskId,
                      timestamp: new Date().toISOString(),
                      wasPaused: timer.wasPaused
                    });
                  }}
                  className="btn-success"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Done
                </Button>
                
                <Button
                  onMouseDown={handleAbortStart}
                  onTouchStart={handleAbortStart}
                  className="relative bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  disabled={abortHolding}
                >
                  {abortHolding ? (
                    <>
                      <div className="absolute inset-0 bg-death-red/20 rounded" 
                           style={{ width: `${abortProgress}%` }} />
                      <span className="relative z-10">Giving up... {Math.floor(abortProgress)}%</span>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5 mr-2" />
                      Give up
                    </>
                  )}
                </Button>
              </div>
            </Card>

          </div>
        )}

        {showValidation && (
          <div className="space-y-4">
            <Card className="card-kawaii space-y-4 text-center">
              <h2 className="text-2xl font-bold text-primary">Kiki Corp Notice</h2>
              <p className="text-lg">Employee, submit proof for: <span className="font-semibold">"{timer?.task || 'your task'}"</span></p>
              <p className="text-sm text-muted-foreground">Kiki's job is to help you work. If you fail, Kiki gets "permanently reassigned".</p>
              
              {!pendingVerification && (
                <div className="bg-red-600 text-white rounded-lg p-6 border-4 border-red-500 shadow-lg">
                  <div className="text-center space-y-2">
                    <div className="text-4xl font-bold tabular-nums">
                      {validationTimeLeft}s
                    </div>
                    <div className="text-sm font-medium uppercase tracking-wide">
                      Upload Proof Now
                    </div>
                    <div className="w-full bg-red-800 rounded-full h-2">
                      <div 
                        className="bg-white h-2 rounded-full transition-all duration-1000 ease-linear"
                        style={{ width: `${(validationTimeLeft / 60) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {pendingVerification && (
                <div className="bg-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-blue-600">
                      📤 PENDING: Evidence submitted to Corporate Review Board. External validation required...
                    </p>
                  </div>
                </div>
              )}
              
              <div className="bg-warning/20 rounded-lg p-4">
                <p className="text-sm text-warning-foreground">
                  {timer?.wasPaused 
                    ? "CORPORATE ALERT: Timer interruption detected. Enhanced evidence required! False documentation results in immediate termination."
                    : "CORPORATE POLICY: Submit authentic evidence only. Fraudulent documentation triggers instant termination protocols."
                  }
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handlePhotoProof} 
                  className="btn-success w-full h-12"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mr-2" />
                      Submit Evidence Report {timer?.wasPaused && "(MANDATORY)"}
                    </>
                  )}
                </Button>
                
                <Button className="btn-success w-full h-12">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Answer Questions {timer?.wasPaused && "(LONGER)"}
                </Button>
                
                <Button 
                  onClick={handlePhotoProof} 
                  className="btn-success w-full h-12"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-5 h-5 mr-2" />
                      Send to Friend {timer?.wasPaused && "(REQUIRED)"}
                    </>
                  )}
                </Button>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  onMouseDown={handleFailStart}
                  onTouchStart={handleFailStart}
                  className="relative bg-destructive hover:bg-destructive/90 text-destructive-foreground min-w-[140px]"
                  disabled={failHolding}
                >
                  {failHolding ? (
                    <>
                      <div className="absolute inset-0 bg-death-red/20 rounded" 
                           style={{ width: `${failProgress}%` }} />
                      <span className="relative z-10">Firing Kiki... {Math.floor(failProgress)}%</span>
                    </>
                  ) : (
                    <>
                      ⚡ Hold to Fire Kiki
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {!pendingVerification ? (
              <div className="bg-death-red/10 rounded-lg p-4 text-center">
                <p className="text-sm italic text-death-red">
                  "URGENT: {validationTimeLeft} seconds until Corporate Termination! Submit evidence immediately to prevent decommission! 🚨🏢"
                </p>
              </div>
            ) : (
              <div className="bg-blue-100 rounded-lg p-4 text-center">
                <p className="text-sm italic text-blue-600">
                  "Evidence submitted to Corporate Review Board! External validator will determine employment status... 📊🏢"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Task Selector Modal */}
        {showTaskSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="card-kawaii w-full max-w-md space-y-4 max-h-[80vh] overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Choose a Task</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTaskSelector(false)}
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-2 overflow-y-auto max-h-96">
                {availableTasks.map((taskItem) => (
                  <Button
                    key={taskItem.id}
                    onClick={() => {
                      setTask(taskItem.title);
                      setShowTaskSelector(false);
                      toast({
                        title: "Task selected!",
                        description: `Ready to work on: "${taskItem.title}"`,
                      });
                    }}
                    variant="outline"
                    className="w-full text-left justify-start h-auto p-3"
                  >
                    <div className="flex flex-col items-start space-y-1">
                      <span className="font-medium">{taskItem.title}</span>
                      {taskItem.dueDate && (
                        <span className="text-xs text-muted-foreground">
                          Due: {taskItem.dueDate} {taskItem.dueTime && `at ${taskItem.dueTime}`}
                        </span>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
              
              {availableTasks.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No pending tasks found.</p>
                  <Button
                    onClick={() => navigate("/board")}
                    className="mt-2 btn-kawaii"
                  >
                    Create Tasks
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Photo Upload Modal - TaskBoard Style */}
        {showPhotoUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="card-kawaii w-full max-w-md space-y-6">
              <div className="text-center space-y-2">
                <Camera className="w-12 h-12 mx-auto text-primary" />
                <h3 className="text-xl font-bold">Take Proof Photo</h3>
                <p className="text-muted-foreground text-sm">
                  Take a photo as proof that you completed this task.
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="camera-input"
                  disabled={isGenerating}
                />
                
                {isSelectingFile ? (
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="animate-spin rounded-full h-8 w-8 mx-auto border-2 border-primary border-t-transparent mb-2"></div>
                      <p className="text-sm font-medium">Processing photo...</p>
                      <p className="text-xs text-muted-foreground">Please wait</p>
                    </div>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <CheckCircle className="w-8 h-8 mx-auto text-success mb-2" />
                      <p className="text-sm font-medium">Photo Selected</p>
                      <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Button
                        onClick={handleUploadProof}
                        disabled={isGenerating || isSelectingFile}
                        className="w-full btn-kawaii"
                      >
                        {isGenerating ? (
                          <>
                            <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Proof
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => {
                          setSelectedFile(null);
                          setIsSelectingFile(false);
                        }}
                        variant="outline"
                        className="w-full"
                        disabled={isGenerating || isSelectingFile}
                      >
                        Choose Different Photo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label
                      htmlFor="camera-input"
                      className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg transition-colors ${
                        isGenerating 
                          ? 'cursor-not-allowed opacity-50' 
                          : 'cursor-pointer hover:bg-muted/50'
                      }`}
                      style={{ pointerEvents: isGenerating ? 'none' : 'auto' }}
                    >
                      <Camera className="w-12 h-12 mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-2">Take Photo</p>
                      <p className="text-xs text-muted-foreground text-center">
                        {isGenerating 
                          ? "Please wait - processing current upload..." 
                          : "Tap to open camera or select from gallery"
                        }
                      </p>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    setShowPhotoUpload(false);
                    setSelectedFile(null);
                    setIsSelectingFile(false);
                    // Only reset verification if there's no pending verification
                    if (!pendingVerification) {
                      setPhotoProof(null);
                      setVerificationUrl(null);
                      removePendingShareUrl();
                    }
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={isGenerating || isSelectingFile}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Friend Verification Modal */}
        {showVerificationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="card-kawaii w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Corporate Evidence Submission</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isGenerating}
                  onClick={() => {
                    setShowVerificationModal(false);
                    setShowPhotoUpload(false);
                    // Only reset verification if there's no pending verification (i.e., user hasn't uploaded yet)
                    if (!pendingVerification) {
                      setPhotoProof(null);
                      setVerificationUrl(null);
                      removePendingShareUrl();
                    }
                  }}
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-4">
                {photoProof && (
                  <div className="mt-2">
                    <img 
                      src={photoProof} 
                      alt="Proof" 
                      className="w-full h-32 object-cover rounded"
                    />
                  </div>
                )}

                <div className="text-center space-y-4">
                  <div className="text-lg font-medium">🔗 Share this link with your friend:</div>
                    
                    <div className="bg-muted rounded-lg p-3 text-xs break-all">
                      {isGenerating ? (
                        <div className="flex items-center justify-center space-x-2 py-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                          <span className="text-sm text-muted-foreground">Generating secure link...</span>
                        </div>
                      ) : verificationUrl || (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="animate-pulse bg-gray-300 h-4 w-3/4 rounded"></div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={copyToClipboard} 
                        variant="outline" 
                        className="w-full"
                        disabled={!verificationUrl || isGenerating}
                      >
                        📋 Copy Link
                      </Button>
                      <Button 
                        onClick={shareLink} 
                        className="btn-kawaii w-full"
                        disabled={!verificationUrl || isGenerating}
                      >
                        📤 Share
                      </Button>
                    </div>
                    
                    <div className="text-center space-y-3">
                      {isGenerating ? (
                        <div className="text-sm font-medium text-blue-600">
                          🔐 Creating secure verification token...
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium">⏳ Waiting for friend's decision...</div>
                          <div className="animate-pulse">
                            <div className="h-2 bg-primary/20 rounded-full">
                              <div className="h-2 bg-primary rounded-full w-1/3 animate-bounce"></div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      <div className="border-t pt-3">
                        <Button 
                          onClick={handleNewPhotoUpload}
                          disabled={uploadCooldown > 0 || isGenerating}
                          variant="outline"
                          className="w-full"
                        >
                          {uploadCooldown > 0 ? (
                            <>🔒 Submit New Documentation ({uploadCooldown}s)</>
                          ) : isGenerating ? (
                            <>⏳ Processing current submission...</>
                          ) : (
                            <>📸 Submit New Documentation</>
                          )}
                        </Button>
                        {uploadCooldown > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Corporate submission protocol cooldown active
                          </p>
                        )}
                      </div>
                    </div>
                  
                  {!pendingVerification && (
                    <Button 
                      onClick={sendToFriend} 
                      className="btn-kawaii w-full"
                      disabled={!photoProof || isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          Generate Corporate Review Token
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickTask;