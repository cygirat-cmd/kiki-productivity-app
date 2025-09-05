import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TASK_STATUS } from '@/constants'

export interface Task {
  id: string
  title: string
  description?: string
  status: typeof TASK_STATUS[keyof typeof TASK_STATUS]
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  dueTime?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  estimatedMinutes?: number
  actualMinutes?: number
  category?: string
  tags?: string[]
  subtasks?: Subtask[]
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

export interface Category {
  id: string
  name: string
  color: string
  icon?: string
  createdAt: string
}

interface TaskState {
  // State
  tasks: Task[]
  categories: Category[]
  activeTaskId: string | null
  
  // Actions
  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  completeTask: (id: string) => void
  setTaskStatus: (id: string, status: Task['status']) => void
  setActiveTask: (id: string | null) => void
  
  // Categories
  addCategory: (category: Omit<Category, 'id' | 'createdAt'>) => string
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void
  
  // Subtasks
  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  
  // Getters
  getTasksByStatus: (status: Task['status']) => Task[]
  getTasksByCategory: (categoryId: string) => Task[]
  getActiveTask: () => Task | null
  getTaskStats: () => {
    total: number
    completed: number
    inProgress: number
    todo: number
  }
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      // Initial state
      tasks: [],
      categories: [],
      activeTaskId: null,
      
      // Task actions
      addTask: (taskData) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        
        const newTask: Task = {
          ...taskData,
          id,
          createdAt: now,
          updatedAt: now,
        }
        
        set((state) => ({
          tasks: [...state.tasks, newTask]
        }))
        
        return id
      },
      
      updateTask: (id, updates) => {
        const now = new Date().toISOString()
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id 
              ? { ...task, ...updates, updatedAt: now }
              : task
          )
        }))
      },
      
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(task => task.id !== id),
        activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
      })),
      
      completeTask: (id) => {
        const now = new Date().toISOString()
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id 
              ? { 
                  ...task, 
                  status: TASK_STATUS.DONE,
                  completedAt: now,
                  updatedAt: now
                }
              : task
          )
        }))
      },
      
      setTaskStatus: (id, status) => {
        const now = new Date().toISOString()
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === id 
              ? { 
                  ...task, 
                  status,
                  completedAt: status === TASK_STATUS.DONE ? now : undefined,
                  updatedAt: now
                }
              : task
          )
        }))
      },
      
      setActiveTask: (id) => set({ activeTaskId: id }),
      
      // Category actions
      addCategory: (categoryData) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        
        const newCategory: Category = {
          ...categoryData,
          id,
          createdAt: now,
        }
        
        set((state) => ({
          categories: [...state.categories, newCategory]
        }))
        
        return id
      },
      
      updateCategory: (id, updates) => set((state) => ({
        categories: state.categories.map(category =>
          category.id === id 
            ? { ...category, ...updates }
            : category
        )
      })),
      
      deleteCategory: (id) => set((state) => ({
        categories: state.categories.filter(category => category.id !== id),
        // Remove category from tasks
        tasks: state.tasks.map(task => ({
          ...task,
          category: task.category === id ? undefined : task.category
        }))
      })),
      
      // Subtask actions
      addSubtask: (taskId, title) => {
        const subtask: Subtask = {
          id: crypto.randomUUID(),
          title,
          completed: false,
          createdAt: new Date().toISOString(),
        }
        
        set((state) => ({
          tasks: state.tasks.map(task =>
            task.id === taskId 
              ? { 
                  ...task, 
                  subtasks: [...(task.subtasks || []), subtask],
                  updatedAt: new Date().toISOString()
                }
              : task
          )
        }))
      },
      
      toggleSubtask: (taskId, subtaskId) => set((state) => ({
        tasks: state.tasks.map(task =>
          task.id === taskId 
            ? { 
                ...task, 
                subtasks: task.subtasks?.map(subtask =>
                  subtask.id === subtaskId
                    ? { ...subtask, completed: !subtask.completed }
                    : subtask
                ),
                updatedAt: new Date().toISOString()
              }
            : task
        )
      })),
      
      deleteSubtask: (taskId, subtaskId) => set((state) => ({
        tasks: state.tasks.map(task =>
          task.id === taskId 
            ? { 
                ...task, 
                subtasks: task.subtasks?.filter(subtask => subtask.id !== subtaskId),
                updatedAt: new Date().toISOString()
              }
            : task
        )
      })),
      
      // Getters
      getTasksByStatus: (status) => {
        return get().tasks.filter(task => task.status === status)
      },
      
      getTasksByCategory: (categoryId) => {
        return get().tasks.filter(task => task.category === categoryId)
      },
      
      getActiveTask: () => {
        const { tasks, activeTaskId } = get()
        return tasks.find(task => task.id === activeTaskId) || null
      },
      
      getTaskStats: () => {
        const tasks = get().tasks
        return {
          total: tasks.length,
          completed: tasks.filter(task => task.status === TASK_STATUS.DONE).length,
          inProgress: tasks.filter(task => task.status === TASK_STATUS.IN_PROGRESS).length,
          todo: tasks.filter(task => task.status === TASK_STATUS.TODO).length,
        }
      },
    }),
    {
      name: 'kiki-task-store',
    }
  )
)