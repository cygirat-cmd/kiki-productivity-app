import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Calendar, Clock, Trash2, CalendarDays, LayoutGrid, RotateCcw, Trophy, Home as HomeIcon, ListTodo, BarChart3, ShoppingBag, FlaskConical, Copy, ExternalLink, CheckCircle, Camera, Upload, Cat } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { TASK_STATUS } from "@/constants";
import VirtualTaskList from "@/components/VirtualTaskList";
import VirtualCalendar from "@/components/VirtualCalendar";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: typeof TASK_STATUS[keyof typeof TASK_STATUS];
  dueDate?: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
  killedKiki?: boolean;
}

type ViewMode = "board" | "calendar";

const TaskBoard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", dueDate: "", priority: "medium" as const });
  const [pendingDoneVerification, setPendingDoneVerification] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const savedTasks = localStorage.getItem("kiki-tasks");
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }

    // Check for overdue tasks
    checkOverdueTasks();
    
    // Clean up old verifications on component mount
    cleanupVerificationData();
  }, []);

  // Periodic cleanup every hour
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupVerificationData();
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  const saveTasks = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
    localStorage.setItem("kiki-tasks", JSON.stringify(updatedTasks));
  };

  const switchView = (newMode: ViewMode) => {
    if (newMode === viewMode || isTransitioning) return;
    
    setIsTransitioning(true);
    setViewMode(newMode);
    
    // Reset transition state after animation completes
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  // Calendar utility functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(task => task.dueDate === dateStr);
  };

  const getUnscheduledTasks = () => {
    return tasks.filter(task => !task.dueDate);
  };

  const handleCalendarTaskClick = (taskId: string, newDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (newDate < today) {
      toast({
        title: "Invalid date!",
        description: "Kiki can't schedule tasks in the past!",
        variant: "destructive"
      });
      return;
    }
    
    const newDueDate = newDate.toISOString().split('T')[0];
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, dueDate: newDueDate } : task
    );
    saveTasks(updatedTasks);
    
    toast({
      title: "Task rescheduled!",
      description: `Task moved to ${newDate.toLocaleDateString()}`,
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const openAddTaskWithDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      toast({
        title: "Invalid date!",
        description: "Kiki can't create tasks for past dates!",
        variant: "destructive"
      });
      return;
    }
    
    const dateStr = date.toISOString().split('T')[0];
    setNewTask(prev => ({ ...prev, dueDate: dateStr }));
    setShowAddTask(true);
  };

  // Drag & Drop functions
  const handleDragStart = (event: React.DragEvent, taskId: string) => {
    event.dataTransfer.setData("text/plain", taskId);
    event.dataTransfer.effectAllowed = "move";
    // Add visual feedback
    const target = event.target as HTMLElement;
    target.style.opacity = "0.5";
  };

  const handleDragEnd = (event: React.DragEvent) => {
    const target = event.target as HTMLElement;
    target.style.opacity = "1";
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    // Add visual feedback to drop zones
    const target = event.currentTarget as HTMLElement;
    target.classList.add('border-primary');
    target.classList.add('bg-primary/5');
  };

  const handleDragLeave = (event: React.DragEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('border-primary');
    target.classList.remove('bg-primary/5');
  };

  const handleCalendarDrop = (event: React.DragEvent, targetDate: Date) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (targetDate < today) {
        toast({
          title: "Invalid date!",
          description: "Kiki can't schedule tasks in the past!",
          variant: "destructive"
        });
        return;
      }
      
      const newDueDate = targetDate.toISOString().split('T')[0];
      const updatedTasks = tasks.map(t => 
        t.id === taskId ? { ...t, dueDate: newDueDate } : t
      );
      saveTasks(updatedTasks);
      
      toast({
        title: "Task rescheduled!",
        description: `"${task.title}" moved to ${targetDate.toLocaleDateString()}`,
      });
    }
  };

  const handleRemoveFromCalendar = (event: React.DragEvent) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
      const updatedTasks = tasks.map(t => 
        t.id === taskId ? { ...t, dueDate: undefined } : t
      );
      saveTasks(updatedTasks);
      
      toast({
        title: "Due date removed!",
        description: `"${task.title}" moved to unscheduled tasks`,
      });
    }
  };

  const checkOverdueTasks = () => {
    const savedTasks = localStorage.getItem("kiki-tasks");
    if (!savedTasks) return;

    const tasks: Task[] = JSON.parse(savedTasks);
    const currentPet = JSON.parse(localStorage.getItem("kiki-pet") || "{}");
    const now = new Date();
    
    const overdueTasks = tasks.filter(task => {
      if (task.status === TASK_STATUS.DONE) return false;
      
      // Only check tasks created after current pet was adopted
      if (currentPet.adoptedAt && new Date(task.createdAt) < new Date(currentPet.adoptedAt)) {
        return false;
      }
      
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(23, 59, 59, 999);
        return dueDate < now;
      }
      
      return false;
    });

    if (overdueTasks.length > 0) {
      // Navigate to death screen for overdue tasks
      navigate("/death", { 
        state: { 
          reason: `${overdueTasks.length} overdue task(s)`,
          overdueTasks: overdueTasks.map(t => ({
            title: t.title,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            id: t.id
          }))
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

    // Validate due date is not in the past
    if (newTask.dueDate) {
      const selectedDate = new Date(newTask.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
      
      if (selectedDate < today) {
        toast({
          title: "Invalid due date!",
          description: "Kiki can't travel back in time! Please select a future date.",
          variant: "destructive"
        });
        return;
      }
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      status: TASK_STATUS.TODO,
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

  const updateTaskStatus = async (taskId: string, newStatus: Task["status"]) => {
    // If trying to mark as done, require verification
    if (newStatus === TASK_STATUS.DONE) {
      await handleMarkAsDone(taskId);
      return;
    }

    // Prevent moving done tasks back
    const task = tasks.find(t => t.id === taskId);
    if (task?.status === TASK_STATUS.DONE) {
      toast({
        title: "Cannot Move Done Task",
        description: "Tasks marked as done cannot be moved back to todo or doing",
        variant: "destructive"
      });
      return;
    }

    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    );
    saveTasks(updatedTasks);

    toast({
      title: "Task Updated",
      description: `Task moved to ${newStatus}`,
    });
  };

  const handleMarkAsDone = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setPendingDoneVerification(taskId);
    setShowCameraModal(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadProof = async () => {
    if (!selectedFile || !pendingDoneVerification) return;

    const task = tasks.find(t => t.id === pendingDoneVerification);
    if (!task) return;

    try {
      setIsUploading(true);
      
      // Clean up old verifications before creating new one
      await cleanupVerificationData();
      
      // Create verification through guest upload
      const { uploadAsGuest } = await import('../lib/guest');

      const result = await uploadAsGuest({
        file: selectedFile,
        taskTitle: `Board Task: ${task.title}`
      });

      if (result.reviewToken) {
        const url = `${window.location.origin}/review?token=${result.reviewToken}`;
        setVerificationUrl(url);
        setShowCameraModal(false);
        setShowVerificationModal(true);
        
        toast({
          title: "Photo Uploaded!",
          description: "Verification link created. Share it with someone to verify your task.",
        });
      }
    } catch (error) {
      console.error('Failed to create verification:', error);
      toast({
        title: "Upload Failed",
        description: "Could not upload photo. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerificationApproved = (taskId: string) => {
    const updatedTasks = tasks.map(task => 
      task.id === taskId ? { ...task, status: TASK_STATUS.DONE } : task
    );
    saveTasks(updatedTasks);

    // Update pet happiness (only if pet is alive)
    const savedPet = localStorage.getItem("kiki-pet");
    const isDead = sessionStorage.getItem('pet-is-dead') === 'true';
    const deadPetName = sessionStorage.getItem('dead-pet-name');
    
    if (savedPet && !isDead) {
      const pet = JSON.parse(savedPet);
      // Double check pet name doesn't match dead pet
      if (pet.name !== deadPetName) {
        pet.happiness = Math.min(100, pet.happiness + 10);
        pet.lastFed = new Date().toISOString();
        localStorage.setItem("kiki-pet", JSON.stringify(pet));
      }
    }

    // Clean up verification data after approval
    cleanupVerificationData();

    setPendingDoneVerification(null);
    setVerificationUrl(null);
    setShowVerificationModal(false);

    toast({
      title: "Task Verified & Completed! 🎉",
      description: "Kiki is dancing with joy! +10 happiness!",
    });
  };

  const handleVerificationRejected = (taskId: string) => {
    // Task stays in current status, just clean up verification
    cleanupVerificationData();

    setPendingDoneVerification(null);
    setVerificationUrl(null);
    setShowVerificationModal(false);

    toast({
      title: "Verification Rejected",
      description: "Task was not approved. Try again with better proof.",
      variant: "destructive"
    });
  };

  const copyVerificationLink = () => {
    if (verificationUrl) {
      navigator.clipboard.writeText(verificationUrl);
      toast({
        title: "Link Copied!",
        description: "Share this link with someone to verify your task completion",
      });
    }
  };

  const closeVerificationModal = () => {
    setPendingDoneVerification(null);
    setVerificationUrl(null);
    setShowVerificationModal(false);
  };

  const closeCameraModal = () => {
    setPendingDoneVerification(null);
    setSelectedFile(null);
    setShowCameraModal(false);
  };

  const cleanupVerificationData = async () => {
    try {
      // Clean up old verifications for current user only
      const { cleanupOldVerifications } = await import('../services/proofs');
      await cleanupOldVerifications(7);
      console.log('User verification cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup verifications:', error);
    }
  };

  const cleanupAfterVerification = async (verificationId?: string) => {
    try {
      if (verificationId) {
        // Clean up specific verification if we have the ID
        const { supabase } = await import('../lib/supabaseClient');
        
        // Get storage path before deletion
        const { data: verification } = await supabase
          .from('verifications')
          .select('photo_storage_path')
          .eq('id', verificationId)
          .single();

        if (verification?.photo_storage_path) {
          // Delete from storage
          await supabase.storage
            .from('proofs')
            .remove([verification.photo_storage_path]);
        }

        // Delete verification record
        await supabase
          .from('verifications')
          .delete()
          .eq('id', verificationId);

        console.log(`Cleaned up verification: ${verificationId}`);
      }

      // Also run general cleanup
      await cleanupVerificationData();
    } catch (error) {
      console.error('Failed to cleanup after verification:', error);
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
      {/* Mobile-First Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-3 sm:p-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-3 sm:mb-0">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10"></div>
              <h1 className="text-lg sm:text-xl font-bold">Task Board</h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:hidden">
              <Button onClick={() => setShowAddTask(true)} size="sm" className="btn-kawaii">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="hidden sm:flex items-center space-x-3">
              <Button onClick={() => setShowAddTask(true)} className="btn-kawaii">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-center">
            <div className="flex items-center rounded-lg border p-1.5 bg-background shadow-sm">
              <Button
                variant={viewMode === "board" ? "default" : "ghost"}
                size="default"
                onClick={() => switchView("board")}
                disabled={isTransitioning}
                className="px-4 py-2 text-sm sm:px-6 sm:py-2.5 sm:text-base transition-all duration-200 font-medium"
              >
                <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                <span>Board</span>
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="default"
                onClick={() => switchView("calendar")}
                disabled={isTransitioning}
                className="px-4 py-2 text-sm sm:px-6 sm:py-2.5 sm:text-base transition-all duration-200 font-medium"
              >
                <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                <span>Calendar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-3 sm:p-4 lg:p-6 pb-24">
        <div className="relative overflow-hidden">
          <div className={`transition-all duration-300 ease-out transform ${
            isTransitioning 
              ? 'opacity-0 translate-y-1' 
              : 'opacity-100 translate-y-0'
          }`}>
          
          {/* Calendar View */}
          {viewMode === "calendar" && (
            <div className="space-y-4 lg:space-y-6">
              {/* Calendar Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <h2 className="text-xl sm:text-2xl font-bold text-center sm:text-left">
                  {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </h2>
                <div className="flex justify-center sm:justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                  >
                    <span>←</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                    className="text-xs sm:text-sm px-2 sm:px-3"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3"
                  >
                    <span>→</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                {/* Virtual Calendar Grid */}
                <div className="flex-1">
                  <VirtualCalendar
                    tasks={tasks}
                    currentMonth={currentMonth}
                    onDayClick={openAddTaskWithDate}
                    onTaskClick={handleCalendarTaskClick}
                    onDrop={handleCalendarDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onTaskStatusUpdate={updateTaskStatus}
                    cellHeight={128} // Responsive height
                    maxTasksPerCell={3}
                  />
                </div>

                {/* Unscheduled Tasks Sidebar */}
                <div className="w-full lg:w-80">
                  <div className="bg-card rounded-lg border p-3 sm:p-4">
                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center">
                      <span>Unscheduled Tasks</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {getUnscheduledTasks().length}
                      </Badge>
                    </h3>
                    
                    <div 
                      className="p-2 border-2 border-dashed border-transparent transition-colors"
                      onDrop={(e) => {
                        handleRemoveFromCalendar(e);
                        const target = e.currentTarget as HTMLElement;
                        target.classList.remove('border-primary', 'bg-primary/5');
                      }}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                    >
                      <div className="text-xs text-muted-foreground mb-2 text-center">
                        Drag here to remove due date
                      </div>
                      <VirtualTaskList
                        tasks={getUnscheduledTasks()}
                        onTaskStatusUpdate={(taskId, status) => updateTaskStatus(taskId, status)}
                        onTaskDelete={deleteTask}
                        itemHeight={100}
                        containerHeight={350}
                        className="border rounded"
                      />
                    </div>
                    
                    {getUnscheduledTasks().length === 0 && (
                      <div className="text-center py-6 sm:py-8 text-muted-foreground">
                        <Calendar className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">All tasks have due dates</p>
                        <p className="text-xs">Add a new task without due date</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Board View */}
          {viewMode === "board" && (
            <div>
        {/* Kanban Board - Mobile First */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* To Do Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full status-todo"></div>
              <h2 className="text-lg font-semibold">To Do</h2>
              <Badge variant="secondary">{getTasksByStatus("todo").length}</Badge>
            </div>
            
            <div 
              className="min-h-32 p-2 rounded border-2 border-dashed border-transparent transition-colors"
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) updateTaskStatus(taskId, "todo");
                const target = e.currentTarget as HTMLElement;
                target.classList.remove('border-primary', 'bg-primary/5');
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <VirtualTaskList
                tasks={getTasksByStatus("todo")}
                onTaskStatusUpdate={(taskId, status) => updateTaskStatus(taskId, "doing")}
                onTaskDelete={deleteTask}
                itemHeight={130}
                containerHeight={Math.max(300, getTasksByStatus("todo").length * 135)}
                className=""
              />
            </div>
          </div>

          {/* Doing Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full status-doing"></div>
              <h2 className="text-lg font-semibold">Doing</h2>
              <Badge variant="secondary">{getTasksByStatus("doing").length}</Badge>
            </div>
            
            <div 
              className="min-h-32 p-2 rounded border-2 border-dashed border-transparent transition-colors"
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) updateTaskStatus(taskId, "doing");
                const target = e.currentTarget as HTMLElement;
                target.classList.remove('border-primary', 'bg-primary/5');
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <VirtualTaskList
                tasks={getTasksByStatus("doing")}
                onTaskStatusUpdate={updateTaskStatus}
                onTaskDelete={deleteTask}
                itemHeight={140}
                containerHeight={Math.max(300, getTasksByStatus("doing").length * 145)}
                className=""
              />
            </div>
          </div>

          {/* Done Column */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full status-done"></div>
              <h2 className="text-lg font-semibold">Done</h2>
              <Badge variant="secondary">{getTasksByStatus("done").length}</Badge>
            </div>
            
            <div 
              className="min-h-32 p-2 rounded border-2 border-dashed border-transparent transition-colors"
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) updateTaskStatus(taskId, "done");
                const target = e.currentTarget as HTMLElement;
                target.classList.remove('border-primary', 'bg-primary/5');
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <VirtualTaskList
                tasks={getTasksByStatus("done")}
                onTaskStatusUpdate={updateTaskStatus}
                onTaskDelete={deleteTask}
                itemHeight={120}
                containerHeight={Math.max(300, getTasksByStatus("done").length * 125)}
                className=""
              />
            </div>
          </div>
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-12 sm:py-16">
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xl sm:text-2xl">📝</p>
              <h3 className="text-lg sm:text-xl font-semibold">No tasks yet!</h3>
              <p className="text-muted-foreground text-sm sm:text-base">Add some tasks to keep Kiki happy and motivated!</p>
              <Button onClick={() => setShowAddTask(true)} className="btn-kawaii">
                Create Your First Task
              </Button>
            </div>
          </div>
        )}
        </div>
          )}
          </div>
        </div>
        
        {/* Add Task Modal - Available in both views */}
        {showAddTask && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
            <Card className="card-kawaii w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-bold">Add New Task</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAddTask(false)}
                  className="touch-manipulation"
                >
                  ✕
                </Button>
              </div>
              
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Task title..."
                className="text-base"
                autoFocus={false}
              />
              
              <Input
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description (optional)..."
                className="text-base"
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Due Date</label>
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="text-base"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Due Time</label>
                  <Input
                    type="time"
                    value={newTask.dueTime}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueTime: e.target.value }))}
                    className="text-base"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {["low", "medium", "high"].map((priority) => (
                    <Button
                      key={priority}
                      variant={newTask.priority === priority ? "default" : "outline"}
                      onClick={() => setNewTask(prev => ({ ...prev, priority: priority as any }))}
                      className="capitalize"
                      size="sm"
                    >
                      {priority}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-2">
                <Button onClick={addTask} className="btn-kawaii flex-1 touch-manipulation">
                  Add Task
                </Button>
                <Button onClick={() => setShowAddTask(false)} variant="outline" className="flex-1 touch-manipulation">
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Camera Modal */}
        {showCameraModal && (
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
                />
                
                {selectedFile ? (
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
                        disabled={isUploading}
                        className="w-full btn-kawaii"
                      >
                        {isUploading ? (
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
                        onClick={() => setSelectedFile(null)}
                        variant="outline"
                        className="w-full"
                        disabled={isUploading}
                      >
                        Choose Different Photo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label
                      htmlFor="camera-input"
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Camera className="w-12 h-12 mb-4 text-muted-foreground" />
                      <p className="text-sm font-medium mb-2">Take Photo</p>
                      <p className="text-xs text-muted-foreground text-center">
                        Tap to open camera or select from gallery
                      </p>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={closeCameraModal}
                  variant="outline"
                  className="flex-1"
                  disabled={isUploading}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Verification Modal */}
        {showVerificationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="card-kawaii w-full max-w-md space-y-6">
              <div className="text-center space-y-2">
                <CheckCircle className="w-12 h-12 mx-auto text-success" />
                <h3 className="text-xl font-bold">Verification Link Ready!</h3>
                <p className="text-muted-foreground text-sm">
                  Share this link with someone to verify your task completion.
                </p>
              </div>

              {verificationUrl ? (
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg border-2 border-dashed">
                    <p className="text-xs text-muted-foreground mb-2">Verification Link:</p>
                    <div className="bg-background p-2 rounded border text-xs font-mono break-all">
                      {verificationUrl}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      onClick={copyVerificationLink}
                      className="w-full btn-kawaii"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                    
                    <Button 
                      onClick={() => window.open(verificationUrl, '_blank')}
                      variant="outline"
                      className="w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in New Tab
                    </Button>
                  </div>

                  <div className="text-center text-xs text-muted-foreground">
                    Send this link to someone who can verify your task completion
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="animate-spin w-8 h-8 mx-auto border-4 border-primary border-t-transparent rounded-full"></div>
                  <p className="text-sm text-muted-foreground">
                    Creating verification link...
                  </p>
                </div>
              )}

              <div className="flex space-x-3">
                <Button 
                  onClick={closeVerificationModal}
                  variant="outline" 
                  className="flex-1"
                  disabled={!verificationUrl}
                >
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/home")}>
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button variant="default" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/board")}>
            <Clock className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/kiki")}>
            <Cat className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/shop")}>
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TaskBoard;