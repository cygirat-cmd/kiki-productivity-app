import React, { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, X } from 'lucide-react';

type FlowState = 'idle' | 'when' | 'timer' | 'later' | 'category' | 'task-name' | 'confirm';

interface StartTaskFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTimer?: (options: { minutes: number; category?: string; taskName?: string }) => void;
  onSchedule?: (options: { offset: 'tomorrow' | 'in3d' | 'in1w'; category?: string; taskName?: string }) => void;
}

interface FlowData {
  when?: 'now' | 'later';
  minutes?: number;
  offset?: 'tomorrow' | 'in3d' | 'in1w';
  category?: string;
  taskName?: string;
}

const CATEGORIES = [
  { icon: '📚', label: 'Study', value: 'study' },
  { icon: '🧹', label: 'Chores', value: 'chores' },
  { icon: '💻', label: 'Work', value: 'work' },
  { icon: '🎨', label: 'Create', value: 'create' },
  { icon: '➕', label: 'Custom', value: 'custom' }
];

const TIMER_PRESETS = [15, 25, 45];
const DEADLINE_OPTIONS = [
  { label: 'Tomorrow', value: 'tomorrow' as const },
  { label: '~3 days', value: 'in3d' as const },
  { label: '~1 week', value: 'in1w' as const }
];

export const StartTaskFlow: React.FC<StartTaskFlowProps> = ({
  isOpen,
  onClose,
  onStartTimer,
  onSchedule
}) => {
  const [state, setState] = useState<FlowState>('when');
  const [data, setData] = useState<FlowData>({});
  const [customMinutes, setCustomMinutes] = useState('');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [taskNameInput, setTaskNameInput] = useState('');
  const [extendedTimerMode, setExtendedTimerMode] = useState(false);

  const resetFlow = () => {
    setState('when');
    setData({});
    setCustomMinutes('');
    setCustomCategoryName('');
    setTaskNameInput('');
    setExtendedTimerMode(false);
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const handleBack = () => {
    switch (state) {
      case 'when':
        handleClose();
        break;
      case 'timer':
      case 'later':
        setState('when');
        break;
      case 'category':
        setState(data.when === 'now' ? 'timer' : 'later');
        break;
      case 'task-name':
        setState('category');
        break;
      case 'confirm':
        setState('task-name');
        break;
    }
  };

  const handleWhenSelect = (when: 'now' | 'later') => {
    setData(prev => ({ 
      ...prev, 
      when,
      // Set default timer to 25 minutes when selecting "now"
      minutes: when === 'now' ? 25 : prev.minutes
    }));
    setState(when === 'now' ? 'timer' : 'later');
  };

  const handleTimerSelect = (minutes: number) => {
    setData(prev => ({ ...prev, minutes }));
    setState('category');
  };


  const handleDeadlineSelect = (offset: 'tomorrow' | 'in3d' | 'in1w') => {
    setData(prev => ({ ...prev, offset }));
    setState('category');
  };

  const handleCategorySelect = (category: string) => {
    setData(prev => ({ ...prev, category }));
    setState('task-name');
  };

  const handleCustomCategorySubmit = () => {
    if (customCategoryName.trim()) {
      setData(prev => ({ ...prev, category: customCategoryName.trim() }));
      setState('task-name');
    }
  };

  const handleSkipCategory = () => {
    setState('task-name');
  };

  const handleTaskNameSubmit = () => {
    if (taskNameInput.trim()) {
      setData(prev => ({ ...prev, taskName: taskNameInput.trim() }));
    }
    setState('confirm');
  };

  const handleSkipTaskName = () => {
    setState('confirm');
  };

  const handleStart = () => {
    if (data.when === 'now' && data.minutes) {
      onStartTimer?.({ minutes: data.minutes, category: data.category, taskName: data.taskName });
    } else if (data.when === 'later' && data.offset) {
      onSchedule?.({ offset: data.offset, category: data.category, taskName: data.taskName });
    }
    handleClose();
  };

  const renderStep = () => {
    switch (state) {
      case 'when':
        return (
          <div className="space-y-6" role="main" aria-labelledby="when-heading">
            <div className="text-center space-y-2">
              <h2 id="when-heading" className="text-xl font-bold">When?</h2>
            </div>
            <div className="space-y-4" role="group" aria-labelledby="when-heading">
              <Button
                onClick={() => handleWhenSelect('now')}
                variant="outline"
                size="lg"
                className="w-full h-16 text-lg font-semibold active:scale-95 transition-transform"
                aria-describedby="now-description"
              >
                Now
                <span id="now-description" className="sr-only">Start task immediately with a timer</span>
              </Button>
              <Button
                onClick={() => handleWhenSelect('later')}
                variant="outline"
                size="lg"
                className="w-full h-16 text-lg font-semibold active:scale-95 transition-transform"
                aria-describedby="later-description"
              >
                Later
                <span id="later-description" className="sr-only">Schedule task for later with soft deadline</span>
              </Button>
            </div>
          </div>
        );

      case 'timer':
        return (
          <div className="space-y-6" role="main" aria-labelledby="timer-heading">
            <div className="text-center space-y-2">
              <h2 id="timer-heading" className="text-xl font-bold">Timer</h2>
            </div>
            
            {/* Circular Dial Picker */}
            <div className="flex flex-col items-center space-y-6">
              <div 
                className="relative w-64 h-64"
                onPointerDown={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  
                  const handleMove = (e: PointerEvent) => {
                    const deltaX = e.clientX - centerX;
                    const deltaY = e.clientY - centerY;
                    
                    // Calculate angle from center (start at 12 o'clock)
                    let angle = Math.atan2(deltaY, deltaX) + Math.PI / 2;
                    if (angle < 0) angle += 2 * Math.PI;
                    
                    if (extendedTimerMode) {
                      // Extended mode: 0-2π = 0-360min (6 hours)
                      let minutes = Math.round((angle / (2 * Math.PI)) * 360);
                      if (minutes === 0) minutes = 360;
                      
                      // Snap to 15-minute intervals in extended mode
                      minutes = Math.round(minutes / 15) * 15;
                      if (minutes === 0) minutes = 360;
                      
                      setData(prev => ({ ...prev, minutes }));
                    } else {
                      // Normal mode: 0-2π = 0-60min (1 hour)
                      let minutes = Math.round((angle / (2 * Math.PI)) * 60);
                      if (minutes === 0) minutes = 60;
                      
                      // Snap to 5-minute intervals in normal mode
                      minutes = Math.round(minutes / 5) * 5;
                      if (minutes === 0) minutes = 60;
                      
                      setData(prev => ({ ...prev, minutes }));
                    }
                  };
                  
                  const handleEnd = () => {
                    document.removeEventListener('pointermove', handleMove);
                    document.removeEventListener('pointerup', handleEnd);
                  };
                  
                  // Handle initial click
                  handleMove(e.nativeEvent);
                  
                  document.addEventListener('pointermove', handleMove);
                  document.addEventListener('pointerup', handleEnd);
                }}
              >
                {/* Outer ring background */}
                <div className="absolute inset-0 rounded-full border-8 border-muted/20 bg-gradient-to-br from-background to-muted/5"></div>
                
                {/* Progress track */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/30"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-primary transition-all duration-300"
                    strokeDasharray={`${((data.minutes || 25) / (extendedTimerMode ? 360 : 60)) * 264} 264`}
                  />
                </svg>
                
                
                {/* Center value display */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    {(() => {
                      const totalMinutes = data.minutes || 25;
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = totalMinutes % 60;
                      
                      if (totalMinutes < 1) {
                        // Less than 1 minute: show seconds
                        const seconds = Math.round(totalMinutes * 60);
                        return (
                          <>
                            <div className="text-3xl font-bold text-primary">{seconds}</div>
                            <div className="text-sm text-muted-foreground">sec</div>
                          </>
                        );
                      } else if (extendedTimerMode && totalMinutes >= 60) {
                        // Extended mode: always show as "1h 30min" format for consistency
                        return (
                          <div className="text-2xl font-bold text-primary">
                            {hours > 0 && `${hours}h`}
                            {hours > 0 && minutes > 0 && ' '}
                            {minutes > 0 && `${minutes}min`}
                            {minutes === 0 && hours > 0 && ''}
                          </div>
                        );
                      } else {
                        // Normal mode: just minutes
                        return (
                          <>
                            <div className="text-3xl font-bold text-primary">{totalMinutes}</div>
                            <div className="text-sm text-muted-foreground">min</div>
                          </>
                        );
                      }
                    })()}
                  </div>
                </div>
                
                {/* Draggable handle at end of progress track */}
                <div 
                  className="absolute w-6 h-6 bg-primary rounded-full border-4 border-background shadow-lg cursor-grab active:cursor-grabbing transition-transform hover:scale-110 active:scale-95 z-20 pointer-events-none"
                  style={{
                    left: '50%',
                    top: '50%',
                    // Match SVG strokeDashoffset direction: goes from 12 o'clock clockwise
                    transform: `translate(-50%, -50%) translate(${108 * Math.cos(((data.minutes || 25) / (extendedTimerMode ? 360 : 60)) * 2 * Math.PI - Math.PI / 2)}px, ${108 * Math.sin(((data.minutes || 25) / (extendedTimerMode ? 360 : 60)) * 2 * Math.PI - Math.PI / 2)}px)`
                  }}
                ></div>
              </div>
              
              {/* Preset buttons */}
              <div className="space-y-2">
                <div className="flex gap-2 justify-center">
                  {/* Dev option: 2 second timer */}
                  {process.env.NODE_ENV === 'development' && (
                    <Button
                      onClick={() => handleTimerSelect(0.033)} // 2 seconds = 0.033 minutes
                      variant={data.minutes === 0.033 ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                    >
                      2s
                    </Button>
                  )}
                  {TIMER_PRESETS.map(minutes => (
                    <Button
                      key={minutes}
                      onClick={() => handleTimerSelect(minutes)}
                      variant={data.minutes === minutes ? "default" : "outline"}
                      size="sm"
                      className="text-sm"
                    >
                      {minutes}m
                    </Button>
                  ))}
                </div>
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      const newExtendedMode = !extendedTimerMode;
                      setExtendedTimerMode(newExtendedMode);
                      
                      // If switching to normal mode and current time > 60min, cap it at 60min
                      if (!newExtendedMode && (data.minutes || 25) > 60) {
                        setData(prev => ({ ...prev, minutes: 60 }));
                      }
                    }}
                    variant={extendedTimerMode ? "default" : "outline"}
                    size="sm"
                    className="text-sm"
                  >
                    More...
                  </Button>
                </div>
              </div>
              
            </div>
            
            {/* Continue button */}
            <Button
              onClick={() => setState('category')}
              className="w-full h-12 mt-6"
              disabled={!data.minutes}
            >
              Continue
            </Button>
          </div>
        );

      case 'later':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Soft deadline</h2>
              <p className="text-sm text-muted-foreground">
                We'll ping you during your free time window
              </p>
            </div>
            <div className="space-y-4">
              {DEADLINE_OPTIONS.map(option => (
                <Button
                  key={option.value}
                  onClick={() => handleDeadlineSelect(option.value)}
                  variant="outline"
                  size="lg"
                  className="w-full h-16 text-lg font-semibold"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'category':
        return (
          <div className="space-y-6" role="main" aria-labelledby="category-heading">
            <div className="text-center space-y-2">
              <h2 id="category-heading" className="text-xl font-bold">Category</h2>
              <button
                onClick={handleSkipCategory}
                className="text-sm text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
                aria-label="Skip category selection"
              >
                Skip
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4" role="group" aria-labelledby="category-heading">
              {CATEGORIES.map(category => (
                <Button
                  key={category.value}
                  onClick={() => handleCategorySelect(category.value)}
                  variant="outline"
                  className="h-20 flex-col space-y-2 text-center hover:bg-accent/50 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label={`Select ${category.label} category`}
                >
                  <div className="text-2xl" aria-hidden="true">{category.icon}</div>
                  <span className="text-sm font-medium">{category.label}</span>
                </Button>
              ))}
            </div>
          </div>
        );

      case 'task-name':
        return (
          <div className="space-y-6" role="main" aria-labelledby="task-name-heading">
            <div className="text-center space-y-2">
              <h2 id="task-name-heading" className="text-xl font-bold">Task Name</h2>
            </div>
            
            <div className="space-y-3">
              <Input
                placeholder="e.g., Finish math homework, Clean kitchen..."
                value={taskNameInput}
                onChange={(e) => setTaskNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTaskNameSubmit();
                  }
                }}
                className="text-center"
                autoFocus
              />
              
              <Button
                onClick={handleTaskNameSubmit}
                className="w-full"
                disabled={!taskNameInput.trim()}
              >
                Continue
              </Button>
              
              <Button
                onClick={handleSkipTaskName}
                variant="outline"
                className="w-full"
              >
                Skip
              </Button>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-xl font-bold">Are you ready?</h2>
              <p className="text-muted-foreground">Don't let Kiki down.</p>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
              {data.when && (
                <div className="bg-accent/20 px-3 py-1 rounded-full text-sm">
                  {data.when === 'now' ? (
                    data.minutes && data.minutes < 1 
                      ? `${Math.round(data.minutes * 60)}sec`
                      : `${data.minutes}min`
                  ) : data.offset?.replace('in', '').replace('d', ' days').replace('w', ' week')}
                </div>
              )}
              {data.category && (
                <div className="bg-accent/20 px-3 py-1 rounded-full text-sm">
                  {CATEGORIES.find(c => c.value === data.category)?.label || data.category}
                </div>
              )}
              {data.taskName && (
                <div className="bg-primary/20 px-3 py-1 rounded-full text-sm font-medium">
                  "{data.taskName}"
                </div>
              )}
            </div>
            
            <Button
              onClick={handleStart}
              size="lg"
              className="w-full h-16 text-lg font-bold bg-primary hover:bg-primary/90"
            >
              START
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent 
        side="bottom"
        className="h-auto max-h-[85vh] p-0 border-0 rounded-t-3xl [&>button]:focus:ring-0 [&>button]:focus:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-primary"
      >
        <div className="w-full">
          {/* Header */}
          <div className="relative flex items-center justify-between p-4 pb-2">
            {state !== 'when' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="absolute left-4 top-4 rounded-full w-10 h-10"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="px-6 pb-8 pt-2 sm:pb-6 pb-safe">
            {renderStep()}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};