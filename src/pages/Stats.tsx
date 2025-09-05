import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trophy, Target, Clock, CheckCircle, Camera, Skull, Home as HomeIcon, FlaskConical, BarChart3, ShoppingBag, Cat } from "lucide-react";
import { TASK_STATUS } from "@/constants";
import { 
  getActiveTimerFromStorage,
  getCemeteryFromStorage
} from "@/utils/helpers";
import { usePetStore, useTaskStore, useTimerStore } from '@/store';

interface Task {
  id: string;
  title: string;
  status: typeof TASK_STATUS[keyof typeof TASK_STATUS];
  createdAt: string;
  priority: "low" | "medium" | "high";
  completionPhoto?: string;
  dueDate?: string;
  dueTime?: string;
}

interface Pet {
  type: string;
  name: string;
  adoptedAt: string;
  streak: number;
  happiness?: number;
}

const Stats = () => {
  const { pet } = usePetStore();
  const { tasks } = useTaskStore();
  const { timer, sessionStats } = useTimerStore();
  const [cemetery, setCemetery] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for active timer first - redirect to timer if found
    if (timer?.isRunning) {
      navigate("/quick-task");
      return;
    }

    // Check if no pet - redirect to onboarding
    if (!pet) {
      navigate("/onboarding");
      return;
    }

    // Load cemetery from localStorage (not in store yet)
    const savedCemetery = getCemeteryFromStorage();
    if (savedCemetery && savedCemetery.length > 0) setCemetery(savedCemetery);
  }, [navigate, timer, pet]);

  // Loading state while pet data is being fetched
  if (!pet) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const completedTasks = tasks.filter(task => task.status === TASK_STATUS.DONE);
  const tasksWithPhotos = completedTasks.filter(task => task.completionPhoto && task.completionPhoto !== "no-photo");
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  const tasksByPriority = {
    high: tasks.filter(t => t.priority === "high").length,
    medium: tasks.filter(t => t.priority === "medium").length,
    low: tasks.filter(t => t.priority === "low").length,
  };

  const currentPetAge = Math.floor((Date.now() - new Date(pet.adoptedAt).getTime()) / (1000 * 60 * 60 * 24));
  const totalDeaths = cemetery.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Statistics</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Current Pet Stats */}
        <Card className="card-kawaii space-y-4">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Current Pet: {pet.name}</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-success/10 rounded-lg">
              <div className="text-2xl font-bold text-success">{pet.streak}</div>
              <div className="text-sm text-muted-foreground">Streak Days</div>
            </div>
            <div className="text-center p-3 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">{pet.sessionsCompleted || 0}</div>
              <div className="text-sm text-muted-foreground">Sessions</div>
            </div>
            <div className="text-center p-3 bg-warning/10 rounded-lg">
              <div className="text-2xl font-bold text-warning">{currentPetAge}</div>
              <div className="text-sm text-muted-foreground">Days Old</div>
            </div>
            <div className="text-center p-3 bg-accent/10 rounded-lg">
              <div className="text-2xl font-bold text-accent">{pet.happiness || 100}</div>
              <div className="text-sm text-muted-foreground">Happiness</div>
            </div>
          </div>
        </Card>

        {/* Task Statistics */}
        <Card className="card-kawaii space-y-4">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Task Performance</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{totalTasks}</div>
              <div className="text-sm text-muted-foreground">Total Tasks</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{completionRate}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{tasksWithPhotos.length}</div>
              <div className="text-sm text-muted-foreground">With Photos</div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Tasks by Priority</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center justify-between p-2 bg-destructive/10 rounded">
                <span className="text-sm">High</span>
                <Badge className="bg-destructive text-destructive-foreground">{tasksByPriority.high}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-warning/10 rounded">
                <span className="text-sm">Medium</span>
                <Badge className="bg-warning text-warning-foreground">{tasksByPriority.medium}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-success/10 rounded">
                <span className="text-sm">Low</span>
                <Badge className="bg-success text-success-foreground">{tasksByPriority.low}</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Completed Tasks with Photos */}
        {tasksWithPhotos.length > 0 && (
          <Card className="card-kawaii space-y-4">
            <div className="flex items-center space-x-2">
              <Camera className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Photo Evidence</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasksWithPhotos.slice(-6).map((task) => (
                <div key={task.id} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium">{task.title}</span>
                  </div>
                  {task.completionPhoto && task.completionPhoto !== "no-photo" && (
                    <img 
                      src={task.completionPhoto} 
                      alt={`Proof of ${task.title}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  )}
                  <div className="text-xs text-muted-foreground">
                    Completed: {new Date(task.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Memorial Section */}
        {totalDeaths > 0 && (
          <Card className="card-kawaii space-y-4 bg-muted/30">
            <div className="flex items-center space-x-2">
              <Skull className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-bold">Memorial</h2>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-muted-foreground">{totalDeaths}</div>
              <div className="text-sm text-muted-foreground">
                {totalDeaths === 1 ? "Pet has been lost" : "Pets have been lost"}
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                "In memory of those who trusted you..."
              </p>
              <Button 
                variant="ghost" 
                onClick={() => navigate("/family-tree")}
                className="mt-2 text-muted-foreground hover:text-foreground"
              >
                View Family Tree
              </Button>
            </div>
          </Card>
        )}

        {/* Achievements */}
        <Card className="card-kawaii space-y-4">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Achievements</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-3 rounded-lg border-2 ${completedTasks.length >= 1 ? 'bg-success/10 border-success' : 'bg-muted/10 border-muted'}`}>
              <div className="flex items-center space-x-2">
                <CheckCircle className={`w-4 h-4 ${completedTasks.length >= 1 ? 'text-success' : 'text-muted-foreground'}`} />
                <span className="font-medium">First Task</span>
              </div>
              <p className="text-xs text-muted-foreground">Complete your first task</p>
            </div>
            
            <div className={`p-3 rounded-lg border-2 ${pet.streak >= 7 ? 'bg-success/10 border-success' : 'bg-muted/10 border-muted'}`}>
              <div className="flex items-center space-x-2">
                <Trophy className={`w-4 h-4 ${pet.streak >= 7 ? 'text-success' : 'text-muted-foreground'}`} />
                <span className="font-medium">Week Warrior</span>
              </div>
              <p className="text-xs text-muted-foreground">Maintain a 7-day streak</p>
            </div>
            
            <div className={`p-3 rounded-lg border-2 ${tasksWithPhotos.length >= 5 ? 'bg-success/10 border-success' : 'bg-muted/10 border-muted'}`}>
              <div className="flex items-center space-x-2">
                <Camera className={`w-4 h-4 ${tasksWithPhotos.length >= 5 ? 'text-success' : 'text-muted-foreground'}`} />
                <span className="font-medium">Photographer</span>
              </div>
              <p className="text-xs text-muted-foreground">Complete 5 tasks with photos</p>
            </div>
            
            <div className={`p-3 rounded-lg border-2 ${completionRate >= 80 ? 'bg-success/10 border-success' : 'bg-muted/10 border-muted'}`}>
              <div className="flex items-center space-x-2">
                <Target className={`w-4 h-4 ${completionRate >= 80 ? 'text-success' : 'text-muted-foreground'}`} />
                <span className="font-medium">Reliable</span>
              </div>
              <p className="text-xs text-muted-foreground">80%+ completion rate</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/kiki")}
          >
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/board")}
          >
            <Clock className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/kiki")}
          >
            <Cat className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/shop")}
          >
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Stats;