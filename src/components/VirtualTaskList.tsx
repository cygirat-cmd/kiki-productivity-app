import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Trash2 } from "lucide-react";
import { TASK_STATUS } from "@/constants";
import { setupScrollWillChange } from "@/utils/performanceUtils";

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

interface VirtualTaskListProps {
  tasks: Task[];
  onTaskStatusUpdate: (taskId: string, status: Task["status"]) => void;
  onTaskDelete: (taskId: string) => void;
  itemHeight?: number;
  containerHeight?: number;
  className?: string;
}

const VirtualTaskList: React.FC<VirtualTaskListProps> = ({
  tasks,
  onTaskStatusUpdate,
  onTaskDelete,
  itemHeight = 120, // Default height per task item
  containerHeight = 400, // Default container height
  className = ""
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate visible items based on scroll position
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      tasks.length
    );
    
    return {
      startIndex: Math.max(0, startIndex),
      endIndex: Math.max(0, endIndex),
      visibleTasks: tasks.slice(
        Math.max(0, startIndex),
        Math.max(0, endIndex)
      )
    };
  }, [tasks, scrollTop, itemHeight, containerHeight]);

  // Setup performance-optimized scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const cleanup = setupScrollWillChange(container, 'scroll-position');
    return cleanup;
  }, []);

  // Handle scroll events with throttling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Utility functions
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

  // Total height needed for scrollbar
  const totalHeight = tasks.length * itemHeight;
  
  // Offset for items that are rendered but not at the top
  const offsetY = visibleItems.startIndex * itemHeight;

  if (tasks.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-muted-foreground">No tasks found</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Virtual container that creates proper scrollbar */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items container */}
        <div 
          style={{ 
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          <div className="space-y-3">
            {visibleItems.visibleTasks.map((task, index) => (
              <Card 
                key={task.id}
                className={`p-4 cursor-pointer hover:shadow-lg transition-all ${
                  isOverdue(task.dueDate) ? "ring-2 ring-destructive" : ""
                } ${task.killedKiki ? "bg-red-950/20 border-red-600/30" : ""}`}
                style={{ height: itemHeight }}
                onClick={() => {
                  const nextStatus = task.status === TASK_STATUS.TODO ? TASK_STATUS.DOING : 
                                   task.status === TASK_STATUS.DOING ? TASK_STATUS.DONE : 
                                   TASK_STATUS.TODO;
                  onTaskStatusUpdate(task.id, nextStatus);
                }}
              >
                <div className="space-y-2 h-full flex flex-col">
                  <div className="flex items-start justify-between">
                    <h3 className={`font-medium text-sm flex items-center gap-1 ${
                      task.status === TASK_STATUS.DONE ? "line-through opacity-75" : ""
                    }`}>
                      {task.killedKiki && <span className="text-red-400">💀</span>}
                      <span className="truncate">{task.title}</span>
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskDelete(task.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 flex-grow">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between mt-auto">
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

                  {/* Status indicator */}
                  <div className="flex items-center space-x-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${
                      task.status === TASK_STATUS.TODO ? "bg-gray-400" :
                      task.status === TASK_STATUS.DOING ? "bg-warning" :
                      "bg-success"
                    }`} />
                    <span className="text-muted-foreground capitalize">
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
      
      {/* Scroll indicator for better UX */}
      {tasks.length > Math.ceil(containerHeight / itemHeight) && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
          {visibleItems.startIndex + 1}-{Math.min(visibleItems.endIndex, tasks.length)} of {tasks.length}
        </div>
      )}
    </div>
  );
};

export default VirtualTaskList;