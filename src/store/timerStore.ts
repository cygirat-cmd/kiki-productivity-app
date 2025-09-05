import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TaskTimer {
  task: string
  taskId?: string
  duration: number // in minutes
  startTime: number | null
  isRunning: boolean
  timeElapsed: number
  pauseUsed: boolean
  pauseTimeUsed: number // in seconds
  wasPaused: boolean
  pauseStartTime: number | null
  totalSessionTime: number // total time since session started
}

export interface SessionStats {
  totalSessions: number
  pausesUsed: number
  totalFocusTime: number // in minutes
  averageSessionLength: number
  longestSession: number
  tasksCompleted: number
  lastSessionDate?: string
}

interface ValidationState {
  isValidating: boolean
  validationTimeLeft: number
  validationStartTime: number | null
  pendingTask: string | null
  pendingWasPaused: boolean
}

interface TimerState {
  // Timer state
  timer: TaskTimer | null
  sessionStats: SessionStats
  validation: ValidationState
  
  // Actions
  // Timer management
  startTimer: (task: string, duration: number, taskId?: string) => void
  pauseTimer: () => void
  resumeTimer: () => void
  stopTimer: () => void
  stopTimerForValidation: () => void
  resetTimer: () => void
  restoreTimer: (timerData: TaskTimer) => void
  
  // Timer updates
  updateTimeElapsed: (elapsed: number) => void
  updateTotalSessionTime: (total: number) => void
  
  // Validation
  startValidation: (task: string, wasPaused: boolean) => void
  stopValidation: () => void
  updateValidationTime: (timeLeft: number) => void
  
  // Session stats
  incrementSessions: () => void
  incrementPauses: () => void
  addFocusTime: (minutes: number) => void
  completeTask: (sessionLength: number) => void
  updateSessionStats: (updates: Partial<SessionStats>) => void
  
  // Getters
  getProgress: () => number
  getRemainingTime: () => number
  isInNoPauseZone: () => boolean
  canPause: () => boolean
  getKikiState: () => 'welcome' | 'idle' | 'anxious'
  formatTime: (seconds: number) => string
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      // Initial state
      timer: null,
      sessionStats: {
        totalSessions: 0,
        pausesUsed: 0,
        totalFocusTime: 0,
        averageSessionLength: 0,
        longestSession: 0,
        tasksCompleted: 0,
      },
      validation: {
        isValidating: false,
        validationTimeLeft: 60,
        validationStartTime: null,
        pendingTask: null,
        pendingWasPaused: false,
      },
      
      // Timer management
      startTimer: (task, duration, taskId) => {
        const now = Date.now()
        const newTimer: TaskTimer = {
          task,
          taskId,
          duration,
          startTime: now,
          isRunning: true,
          timeElapsed: 0,
          pauseUsed: false,
          pauseTimeUsed: 0,
          wasPaused: false,
          pauseStartTime: null,
          totalSessionTime: 0,
        }
        
        set((state) => ({
          timer: newTimer,
          sessionStats: {
            ...state.sessionStats,
            totalSessions: state.sessionStats.totalSessions + 1,
            lastSessionDate: new Date().toISOString(),
          }
        }))
      },
      
      pauseTimer: () => {
        const now = Date.now()
        set((state) => ({
          timer: state.timer ? {
            ...state.timer,
            isRunning: false,
            pauseUsed: true,
            wasPaused: true,
            pauseStartTime: now,
          } : null,
          sessionStats: {
            ...state.sessionStats,
            pausesUsed: state.sessionStats.pausesUsed + 1,
          }
        }))
      },
      
      resumeTimer: () => {
        const now = Date.now()
        set((state) => {
          if (!state.timer || !state.timer.pauseStartTime) return state
          
          const pauseTime = Math.floor((now - state.timer.pauseStartTime) / 1000)
          const adjustedStartTime = now - (state.timer.timeElapsed * 1000)
          
          return {
            timer: {
              ...state.timer,
              isRunning: true,
              startTime: adjustedStartTime,
              pauseStartTime: null,
              pauseTimeUsed: state.timer.pauseTimeUsed + pauseTime,
            }
          }
        })
      },
      
      stopTimer: () => set({
        timer: null,
        validation: {
          isValidating: false,
          validationTimeLeft: 60,
          validationStartTime: null,
          pendingTask: null,
          pendingWasPaused: false,
        }
      }),
      
      stopTimerForValidation: () => set((state) => ({
        timer: state.timer ? {
          ...state.timer,
          isRunning: false,
          startTime: null
        } : null
      })),
      
      resetTimer: () => set({
        timer: null,
        validation: {
          isValidating: false,
          validationTimeLeft: 60,
          validationStartTime: null,
          pendingTask: null,
          pendingWasPaused: false,
        }
      }),
      
      restoreTimer: (timerData: TaskTimer) => set((state) => ({
        timer: timerData,
      })),
      
      // Timer updates
      updateTimeElapsed: (elapsed) => set((state) => ({
        timer: state.timer ? {
          ...state.timer,
          timeElapsed: elapsed,
        } : null
      })),
      
      updateTotalSessionTime: (total) => set((state) => ({
        timer: state.timer ? {
          ...state.timer,
          totalSessionTime: total,
        } : null
      })),
      
      // Validation
      startValidation: (task, wasPaused) => {
        const now = Date.now()
        set((state) => ({
          validation: {
            isValidating: true,
            validationTimeLeft: 60,
            validationStartTime: now,
            pendingTask: task,
            pendingWasPaused: wasPaused,
          },
          timer: state.timer ? {
            ...state.timer,
            isRunning: false,
          } : null
        }))
      },
      
      stopValidation: () => set((state) => ({
        validation: {
          ...state.validation,
          isValidating: false,
          pendingTask: null,
        }
      })),
      
      updateValidationTime: (timeLeft) => set((state) => ({
        validation: {
          ...state.validation,
          validationTimeLeft: timeLeft,
        }
      })),
      
      // Session stats
      incrementSessions: () => set((state) => ({
        sessionStats: {
          ...state.sessionStats,
          totalSessions: state.sessionStats.totalSessions + 1,
        }
      })),
      
      incrementPauses: () => set((state) => ({
        sessionStats: {
          ...state.sessionStats,
          pausesUsed: state.sessionStats.pausesUsed + 1,
        }
      })),
      
      addFocusTime: (minutes) => set((state) => ({
        sessionStats: {
          ...state.sessionStats,
          totalFocusTime: state.sessionStats.totalFocusTime + minutes,
          averageSessionLength: (state.sessionStats.totalFocusTime + minutes) / Math.max(1, state.sessionStats.totalSessions),
          longestSession: Math.max(state.sessionStats.longestSession, minutes),
        }
      })),
      
      completeTask: (sessionLength) => set((state) => ({
        sessionStats: {
          ...state.sessionStats,
          tasksCompleted: state.sessionStats.tasksCompleted + 1,
          totalFocusTime: state.sessionStats.totalFocusTime + sessionLength,
          averageSessionLength: (state.sessionStats.totalFocusTime + sessionLength) / Math.max(1, state.sessionStats.totalSessions),
          longestSession: Math.max(state.sessionStats.longestSession, sessionLength),
        }
      })),
      
      updateSessionStats: (updates) => set((state) => ({
        sessionStats: {
          ...state.sessionStats,
          ...updates,
        }
      })),
      
      // Getters
      getProgress: () => {
        const { timer } = get()
        if (!timer) return 0
        return (timer.timeElapsed / (timer.duration * 60)) * 100
      },
      
      getRemainingTime: () => {
        const { timer } = get()
        if (!timer) return 0
        return timer.duration * 60 - timer.timeElapsed
      },
      
      isInNoPauseZone: () => {
        const { timer } = get()
        if (!timer) return false
        const elapsed = timer.timeElapsed
        const total = timer.duration * 60
        return elapsed < 300 || elapsed > (total - 300) // First or last 5 minutes
      },
      
      canPause: () => {
        const { timer, sessionStats } = get()
        if (!timer) return false
        if (timer.duration < 15) return false // No pause for sessions under 15 minutes
        if (timer.timeElapsed < 300) return false // First 5 minutes
        if (timer.timeElapsed > (timer.duration * 60 - 300)) return false // Last 5 minutes
        
        // Anti-cheat: Check pause frequency
        const pauseFrequency = sessionStats.pausesUsed / Math.max(1, sessionStats.totalSessions)
        if (pauseFrequency > 0.7) return false
        
        return true
      },
      
      getKikiState: () => {
        const progress = get().getProgress()
        if (progress >= 90) return 'anxious' // >90% = <10% time remaining
        if (progress > 0) return 'idle'
        return 'welcome'
      },

      formatTime: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      },
    }),
    {
      name: 'kiki-timer-store',
      partialize: (state) => ({
        sessionStats: state.sessionStats,
        validation: state.validation.isValidating ? state.validation : {
          isValidating: false,
          validationTimeLeft: 60,
          validationStartTime: null,
          pendingTask: null,
          pendingWasPaused: false,
        },
        // Timer is intentionally not persisted - it should be restored from localStorage if needed
      }),
    }
  )
)