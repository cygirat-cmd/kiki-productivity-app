import React, { useMemo, useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar } from "lucide-react";
import { TASK_STATUS } from "@/constants";

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

interface VirtualCalendarProps {
  tasks: Task[];
  currentMonth: Date;
  onDayClick: (date: Date) => void;
  onTaskClick: (taskId: string, newDate: Date) => void;
  onDrop: (e: React.DragEvent, targetDate: Date) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTaskStatusUpdate: (taskId: string, status: Task["status"]) => void;
  cellHeight?: number;
  maxTasksPerCell?: number;
}

const VirtualCalendar: React.FC<VirtualCalendarProps> = ({
  tasks,
  currentMonth,
  onDayClick,
  onTaskClick,
  onDrop,
  onDragOver,
  onDragLeave,
  onDragStart,
  onDragEnd,
  onTaskStatusUpdate,
  cellHeight = 120,
  maxTasksPerCell = 4
}) => {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

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

  // Memoize days to prevent recalculation
  const calendarDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  // Virtualized task rendering for cells with many tasks
  const VirtualTaskList = ({ tasks, maxVisible }: { tasks: Task[], maxVisible: number }) => {
    const [showAll, setShowAll] = useState(false);
    const visibleTasks = showAll ? tasks : tasks.slice(0, maxVisible);
    const remainingCount = tasks.length - maxVisible;

    return (
      <div className="space-y-1 max-h-20 overflow-hidden">
        {visibleTasks.map(task => (
          <div
            key={task.id}
            draggable
            className={`text-xs p-1 rounded cursor-move truncate transition-all ${
              task.status === TASK_STATUS.DONE ? "bg-success/20 text-success line-through" :
              task.status === TASK_STATUS.DOING ? "bg-warning/20 text-warning" :
              task.killedKiki ? "bg-red-900/30 text-red-300 border border-red-600/50" :
              "bg-primary/20 text-primary hover:bg-primary/30"
            } active:scale-95`}
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            onClick={(e) => {
              e.stopPropagation();
              const nextStatus = task.status === TASK_STATUS.TODO ? TASK_STATUS.DOING : 
                               task.status === TASK_STATUS.DOING ? TASK_STATUS.DONE : 
                               TASK_STATUS.TODO;
              onTaskStatusUpdate(task.id, nextStatus);
            }}
            title={`${task.description || task.title} - ${task.killedKiki ? 'This task killed a Kiki 💀' : 'Drag to move'}`}
          >
            <span className="flex items-center gap-1">
              {task.killedKiki && <span className="text-red-400">💀</span>}
              <span className="block truncate max-w-full">
                {task.title.length > (task.killedKiki ? 8 : 12) ? 
                 task.title.substring(0, (task.killedKiki ? 8 : 12)) + '...' : 
                 task.title}
              </span>
            </span>
          </div>
        ))}
        
        {!showAll && remainingCount > 0 && (
          <button
            className="text-xs text-muted-foreground hover:text-primary w-full text-left p-1 rounded hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(true);
            }}
          >
            +{remainingCount} more...
          </button>
        )}
        
        {showAll && tasks.length > maxVisible && (
          <button
            className="text-xs text-muted-foreground hover:text-primary w-full text-left p-1 rounded hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(false);
            }}
          >
            Show less
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* Days of week header */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
          <div key={day} className="p-2 text-center text-xs sm:text-sm font-medium text-muted-foreground">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][index]}</span>
          </div>
        ))}
      </div>
      
      {/* Calendar days - Virtualized grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date, index) => {
          const cellId = date ? date.toISOString() : `empty-${index}`;
          const dayTasks = date ? getTasksForDate(date) : [];
          const isToday = date && date.toDateString() === new Date().toDateString();
          const isHovered = hoveredCell === cellId;
          
          return (
            <div
              key={cellId}
              className={`border-r border-b last:border-r-0 p-1 sm:p-2 transition-all duration-200 ${
                date ? "bg-background hover:bg-accent/30 cursor-pointer" : "bg-muted/10"
              } ${isHovered ? "ring-2 ring-primary/50" : ""} relative group`}
              style={{ minHeight: cellHeight }}
              onDrop={(e) => {
                if (date) {
                  onDrop(e, date);
                  const target = e.currentTarget as HTMLElement;
                  target.classList.remove('border-primary', 'bg-primary/5');
                  setHoveredCell(null);
                }
              }}
              onDragOver={(e) => {
                onDragOver(e);
                setHoveredCell(cellId);
              }}
              onDragLeave={(e) => {
                onDragLeave(e);
                setHoveredCell(null);
              }}
              onClick={() => date && onDayClick(date)}
            >
              {date && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <div className={`text-xs sm:text-sm font-medium transition-all ${
                      isToday 
                        ? "text-primary font-bold bg-primary/10 rounded px-1" 
                        : "text-muted-foreground"
                    }`}>
                      {date.getDate()}
                    </div>
                    <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
                  </div>
                  
                  {/* Tasks for this date - Virtual scrolling for many tasks */}
                  {dayTasks.length > 0 && (
                    <VirtualTaskList 
                      tasks={dayTasks} 
                      maxVisible={maxTasksPerCell}
                    />
                  )}
                  
                  {/* Task count badge for cells with many tasks */}
                  {dayTasks.length > maxTasksPerCell && (
                    <Badge 
                      variant="secondary" 
                      className="absolute top-1 right-1 text-xs px-1 py-0 h-4 min-w-4"
                    >
                      {dayTasks.length}
                    </Badge>
                  )}
                  
                  {/* Drop zone indicator */}
                  {isHovered && (
                    <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/50 rounded flex items-center justify-center">
                      <span className="text-xs text-primary font-medium">Drop here</span>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualCalendar;