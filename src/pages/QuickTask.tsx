import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, Pause, Square, Camera, MessageSquare, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TaskTimer {
  task: string;
  duration: number; // in minutes
  startTime: number | null;
  isRunning: boolean;
  timeElapsed: number;
}

const QuickTask = () => {
  const [task, setTask] = useState("");
  const [duration, setDuration] = useState(25); // Default pomodoro
  const [timer, setTimer] = useState<TaskTimer | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timer?.isRunning && timer.startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - timer.startTime!) / 1000);
        
        setTimer(prev => prev ? { ...prev, timeElapsed: elapsed } : null);
        
        // Check if time is up
        if (elapsed >= timer.duration * 60) {
          setTimer(prev => prev ? { ...prev, isRunning: false } : null);
          setShowValidation(true);
          toast({
            title: "Time's up!",
            description: "Now prove you actually did the task... Kiki is watching! 👀",
          });
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [timer?.isRunning, timer?.startTime, timer?.duration, toast]);

  const startTimer = () => {
    if (!task.trim()) {
      toast({
        title: "Hold up!",
        description: "What task are you even doing? Kiki needs to know!",
        variant: "destructive"
      });
      return;
    }

    const newTimer: TaskTimer = {
      task,
      duration,
      startTime: Date.now(),
      isRunning: true,
      timeElapsed: 0
    };
    
    setTimer(newTimer);
    toast({
      title: "Timer started!",
      description: `Good luck with "${task}"! Kiki is rooting for you!`,
    });
  };

  const pauseTimer = () => {
    setTimer(prev => prev ? { ...prev, isRunning: false } : null);
  };

  const resumeTimer = () => {
    if (timer) {
      const now = Date.now();
      const adjustedStartTime = now - (timer.timeElapsed * 1000);
      setTimer(prev => prev ? { 
        ...prev, 
        isRunning: true, 
        startTime: adjustedStartTime 
      } : null);
    }
  };

  const stopTimer = () => {
    setTimer(null);
    setShowValidation(false);
    setTask("");
  };

  const handleTaskComplete = () => {
    // Update pet happiness and streak
    const savedPet = localStorage.getItem("kiki-pet");
    if (savedPet) {
      const pet = JSON.parse(savedPet);
      pet.happiness = Math.min(100, pet.happiness + 15);
      pet.streak += 1;
      localStorage.setItem("kiki-pet", JSON.stringify(pet));
    }

    toast({
      title: "Task completed! 🎉",
      description: "Kiki is so proud of you! +15 happiness points!",
    });

    stopTimer();
    navigate("/home");
  };

  const handleTaskFailed = () => {
    navigate("/death", { state: { reason: "Task validation failed" } });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (!timer) return 0;
    return (timer.timeElapsed / (timer.duration * 60)) * 100;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="max-w-md mx-auto flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Quick Task</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {!timer && !showValidation && (
          <div className="space-y-4">
            <Card className="card-kawaii space-y-4">
              <h2 className="text-xl font-semibold text-center">What are you going to do?</h2>
              
              <Input
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g., Do laundry, Study math, Clean room..."
                className="text-center"
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (minutes)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 25, 45, 60].map((mins) => (
                    <Button
                      key={mins}
                      variant={duration === mins ? "default" : "outline"}
                      onClick={() => setDuration(mins)}
                      className="h-12"
                    >
                      {mins}m
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 25)}
                  min={1}
                  max={120}
                  className="text-center"
                />
              </div>

              <Button onClick={startTimer} className="btn-kawaii w-full h-12">
                <Play className="w-5 h-5 mr-2" />
                Start Timer
              </Button>
            </Card>

            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm italic">
                "Kiki is watching... don't you dare think about slacking off! 😤"
              </p>
            </div>
          </div>
        )}

        {timer && !showValidation && (
          <div className="space-y-4">
            <Card className="card-kawaii space-y-6 text-center">
              <h2 className="text-2xl font-bold">{timer.task}</h2>
              
              <div className="space-y-4">
                <div className="text-6xl font-mono text-primary">
                  {formatTime(timer.duration * 60 - timer.timeElapsed)}
                </div>
                
                <Progress value={getProgress()} className="w-full h-4" />
                
                <p className="text-sm text-muted-foreground">
                  {Math.floor(getProgress())}% complete
                </p>
              </div>

              <div className="flex justify-center space-x-3">
                {timer.isRunning ? (
                  <Button onClick={pauseTimer} className="btn-kawaii">
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button onClick={resumeTimer} className="btn-kawaii">
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </Button>
                )}
                
                <Button onClick={stopTimer} variant="destructive">
                  <Square className="w-5 h-5 mr-2" />
                  Stop
                </Button>
              </div>
            </Card>

            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <p className="text-sm italic">
                "You've got this, senpai! Kiki believes in you! 💪"
              </p>
            </div>
          </div>
        )}

        {showValidation && (
          <div className="space-y-4">
            <Card className="card-kawaii space-y-4 text-center">
              <h2 className="text-2xl font-bold text-success">Time's Up!</h2>
              <p className="text-lg">Did you actually complete: <span className="font-semibold">"{timer?.task}"</span>?</p>
              
              <div className="bg-warning/20 rounded-lg p-4">
                <p className="text-sm text-warning-foreground">
                  ⚠️ Choose your proof method. Lying will result in... consequences.
                </p>
              </div>

              <div className="space-y-3">
                <Button className="btn-success w-full h-12">
                  <Camera className="w-5 h-5 mr-2" />
                  Take Photo Proof
                </Button>
                
                <Button className="btn-success w-full h-12">
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Answer Quiz Questions
                </Button>
                
                <Button className="btn-success w-full h-12">
                  <UserCheck className="w-5 h-5 mr-2" />
                  Send to Friend for Approval
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button onClick={handleTaskComplete} className="btn-success">
                  ✅ I Did It!
                </Button>
                <Button onClick={handleTaskFailed} className="btn-death">
                  😔 I Failed...
                </Button>
              </div>
            </Card>

            <div className="bg-death-red/10 rounded-lg p-4 text-center">
              <p className="text-sm italic text-death-red">
                "Please tell me you actually did it... I don't want to become a gravestone! 😭"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickTask;