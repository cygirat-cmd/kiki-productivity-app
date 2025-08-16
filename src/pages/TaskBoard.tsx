import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Calendar, Clock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  dueDate?: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
}

const TaskBoard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", dueDate: "", priority: "medium" as const });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const savedTasks = localStorage.getItem("kiki-tasks");
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }

    // Check for overdue tasks
    checkOverdueTasks();
  }, []);

  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    localStorage.setItem("kiki-tasks", JSON.stringify(updatedTasks));
  };

  const checkOverdueTasks = () => {
    const savedTasks = localStorage.getItem("kiki-tasks");
    if (!savedTasks) return;

    const tasks: Task[] = JSON.parse(savedTasks);
    const now = new Date();
    const overdueTasks = tasks.filter(task => 
      task.status !== "done" && 
      task.dueDate && 
      new Date(task.dueDate) < now
    );

    if (overdueTasks.length > 0) {
      // Navigate to death screen for overdue tasks
      navigate("/death", { 
        state: { 
          reason: `${overdueTasks.length} overdue task(s)`,
          overdueTasks: overdueTasks.map(t => t.title)
        } 
      });
    }
  };

  const addTask = () => {
    if (!newTask.title.trim()) {
      toast({
        title: "Task name required!",
        description: "Kiki needs to know what you're planning to do!",
        variant: "destructive"
      });
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      status: "todo",
      dueDate: newTask.dueDate || undefined,
      createdAt: new Date().toISOString(),
      priority: newTask.priority
    };

    const updatedTasks = [...tasks, task];
    saveTasks(updatedTasks);
    
    setNewTask({ title: "", description: "", dueDate: "", priority: "medium" });
    setShowAddTask(false);
    
    toast({
      title: "Task added!",
      description: "Kiki is excited to see you complete this!",
    });
  };

  const updateTaskStatus = (taskId: string, newStatus: Task["status"]) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    );
    saveTasks(updatedTasks);

    if (newStatus === "done") {
      // Update pet happiness
      const savedPet = localStorage.getItem("kiki-pet");
      if (savedPet) {
        const pet = JSON.parse(savedPet);
        pet.happiness = Math.min(100, pet.happiness + 10);
        localStorage.setItem("kiki-pet", JSON.stringify(pet));
      }

      toast({
        title: "Task completed! 🎉",
        description: "Kiki is dancing with joy! +10 happiness!",
      });
    }
  };

  const deleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    saveTasks(updatedTasks);
    
    toast({
      title: "Task deleted",
      description: "Kiki hopes you didn't give up... 😔",
    });
  };

  const getTasksByStatus = (status: Task["status"]) => {
    return tasks.filter(task => task.status === status);
  };

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      case "low": return "bg-success text-success-foreground";
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Task Board</h1>
          </div>
          <Button onClick={() => setShowAddTask(true)} className="btn-kawaii">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Add Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="card-kawaii w-full max-w-md space-y-4">
              <h3 className="text-xl font-bold">Add New Task</h3>
              
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title..."
              />
              
              <Input
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description (optional)..."
              />
              
              <Input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {["low", "medium", "high"].map((priority) => (
                    <Button
                      key={priority}
                      variant={newTask.priority === priority ? "default" : "outline"}
                      onClick={() => setNewTask(prev => ({ ...prev, priority: priority as any }))}
                      className="capitalize"
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <Button onClick={addTask} className="btn-kawaii flex-1">
                  Add Task
                </Button>
                <Button onClick={() => setShowAddTask(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* To Do Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full status-todo"></div>
              <h2 className="text-lg font-semibold">To Do</h2>
              <Badge variant="secondary">{getTasksByStatus("todo").length}</Badge>
            </div>
            
            <div className="space-y-3">
              {getTasksByStatus("todo").map((task) => (
                <Card 
                  key={task.id} 
                  className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
                    isOverdue(task.dueDate) ? "ring-2 ring-destructive" : ""
                  }`}
                  onClick={() => updateTaskStatus(task.id, "doing")}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm">{task.title}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTask(task.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                      
                      {task.dueDate && (
                        <div className={`flex items-center space-x-1 text-xs ${
                          isOverdue(task.dueDate) ? "text-destructive" : "text-muted-foreground"
                        }`}>
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(task.dueDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Doing Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full status-doing"></div>
              <h2 className="text-lg font-semibold">Doing</h2>
              <Badge variant="secondary">{getTasksByStatus("doing").length}</Badge>
            </div>
            
            <div className="space-y-3">
              {getTasksByStatus("doing").map((task) => (
                <Card key={task.id} className="p-4 ring-2 ring-warning/50">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm">{task.title}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-muted-foreground">{task.description}</p>
                    )}
                    
                    <div className="flex space-x-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateTaskStatus(task.id, "todo")}
                        className="flex-1 text-xs"
                      >
                        ← To Do
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateTaskStatus(task.id, "done")}
                        className="flex-1 text-xs btn-success"
                      >
                        Done ✓
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Done Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full status-done"></div>
              <h2 className="text-lg font-semibold">Done</h2>
              <Badge variant="secondary">{getTasksByStatus("done").length}</Badge>
            </div>
            
            <div className="space-y-3">
              {getTasksByStatus("done").map((task) => (
                <Card key={task.id} className="p-4 bg-success/10 border-success/30">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm line-through opacity-75">{task.title}</h3>
                      <span className="text-lg">✅</span>
                    </div>
                    
                    {task.description && (
                      <p className="text-xs text-muted-foreground opacity-75">{task.description}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-16">
            <div className="space-y-4">
              <p className="text-2xl">📝</p>
              <h3 className="text-xl font-semibold">No tasks yet!</h3>
              <p className="text-muted-foreground">Add some tasks to keep Kiki happy and motivated!</p>
              <Button onClick={() => setShowAddTask(true)} className="btn-kawaii">
                Create Your First Task
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskBoard;