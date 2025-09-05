import { STORAGE_KEYS } from "@/constants";
import { 
  setLastActivityToStorage, 
  getLastActivityFromStorage,
  getInactivityTimeoutsFromStorage,
  setInactivityTimeoutsToStorage,
  removeInactivityTimeouts
} from "@/utils/helpers";

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      // Mobile browsers may require user gesture
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.log('Notification permission request failed:', error);
      return false;
    }
  }

  return false;
};

export const showNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        silent: false, // Ensure notification makes sound on mobile
        ...options
      });
      
      // Auto close after 5 seconds (longer on mobile for visibility)
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const closeDelay = isMobile ? 8000 : 5000;
      setTimeout(() => notification.close(), closeDelay);
      
      return notification;
    } catch (error) {
      console.log('Failed to show notification:', error);
      return null;
    }
  }
  return null;
};

export const scheduleTaskReminders = (task: { id: string; title: string; dueDate?: string; dueTime?: string }) => {
  if (!task.dueDate) return;
  const now = new Date();
  let dueDateTime: Date;
  
  if (task.dueTime) {
    dueDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
  } else {
    dueDateTime = new Date(task.dueDate);
    dueDateTime.setHours(23, 59, 59, 999);
  }

  // Don't schedule if task is already overdue
  if (dueDateTime <= now) return;

  // Calculate reminder times
  const oneHourBefore = new Date(dueDateTime.getTime() - 60 * 60 * 1000);
  const thirtyMinBefore = new Date(dueDateTime.getTime() - 30 * 60 * 1000);
  const tenMinBefore = new Date(dueDateTime.getTime() - 10 * 60 * 1000);

  // Schedule 1 hour reminder
  if (oneHourBefore > now) {
    const timeout1h = oneHourBefore.getTime() - now.getTime();
    setTimeout(() => {
      showNotification(`🕐 Task Due in 1 Hour!`, {
        body: `"${task.title}" - Kiki is counting on you!`,
        tag: `reminder-1h-${task.id}`
      });
    }, timeout1h);
  }

  // Schedule 30 min reminder
  if (thirtyMinBefore > now) {
    const timeout30m = thirtyMinBefore.getTime() - now.getTime();
    setTimeout(() => {
      showNotification(`⏰ Task Due in 30 Minutes!`, {
        body: `"${task.title}" - Kiki is getting nervous...`,
        tag: `reminder-30m-${task.id}`
      });
    }, timeout30m);
  }

  // Schedule 10 min reminder
  if (tenMinBefore > now) {
    const timeout10m = tenMinBefore.getTime() - now.getTime();
    setTimeout(() => {
      showNotification(`🚨 URGENT: 10 Minutes Left!`, {
        body: `"${task.title}" - Kiki's life is in your hands!`,
        tag: `reminder-10m-${task.id}`,
        requireInteraction: true
      });
    }, timeout10m);
  }

  // Schedule overdue notification
  const timeoutOverdue = dueDateTime.getTime() - now.getTime();
  setTimeout(() => {
    showNotification(`💀 TASK OVERDUE - KIKI IS DYING!`, {
      body: `"${task.title}" - You failed Kiki... They're fading away...`,
      tag: `overdue-${task.id}`,
      requireInteraction: true
    });
  }, timeoutOverdue);
};

export const cancelTaskReminders = (taskId: string) => {
  // Note: This is a simplified implementation
  // In a real app, you'd want to track timeout IDs and clear them
  console.log(`Cancelling reminders for task ${taskId}`);
};

export const scheduleInactivityReminders = () => {
  const now = new Date().getTime();
  setLastActivityToStorage(now.toString());

  // Clear any existing inactivity reminders
  cancelInactivityReminders();

  // Schedule reminders for different inactivity periods
  const reminders = [
    { delay: 2 * 60 * 60 * 1000, message: "Kiki is getting bored... Maybe it's time for a productive task? 🥱" }, // 2 hours
    { delay: 6 * 60 * 60 * 1000, message: "Kiki is really missing you! He's been waiting for 6 hours... 😢" }, // 6 hours
    { delay: 12 * 60 * 60 * 1000, message: "Kiki is starting to worry... 12 hours without tasks! Don't let him die of boredom! 😰" }, // 12 hours
    { delay: 24 * 60 * 60 * 1000, message: "🚨 URGENT: Kiki hasn't had anything to do for 24 hours! He might die of boredom soon! 💀" }, // 24 hours
  ];

  reminders.forEach((reminder, index) => {
    const timeoutId = setTimeout(() => {
      const lastActivity = getLastActivityFromStorage();
      if (lastActivity) {
        const timeSinceActivity = Date.now() - parseInt(lastActivity);
        
        // Only show reminder if user hasn't been active since this reminder was scheduled
        if (timeSinceActivity >= reminder.delay) {
          showNotification("Kiki misses you! 🐾", {
            body: reminder.message,
            tag: `inactivity-${index}`,
            requireInteraction: index >= 2 // Require interaction for 12h and 24h reminders
          });
        }
      }
    }, reminder.delay);

    // Store timeout ID for potential cancellation
    const timeoutIds = getInactivityTimeoutsFromStorage();
    timeoutIds.push(timeoutId);
    setInactivityTimeoutsToStorage(timeoutIds);
  });
};

export const cancelInactivityReminders = () => {
  const timeoutIds = getInactivityTimeoutsFromStorage();
  timeoutIds.forEach((id: number) => clearTimeout(id));
  removeInactivityTimeouts();
};

export const updateLastActivity = () => {
  const now = new Date().getTime();
  setLastActivityToStorage(now.toString());
  
  // Reschedule inactivity reminders
  scheduleInactivityReminders();
};

export const checkForBoredomDeath = (): boolean => {
  const lastActivity = getLastActivityFromStorage();
  if (!lastActivity) return false;

  const timeSinceActivity = Date.now() - parseInt(lastActivity);
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 days

  return timeSinceActivity > threeDaysInMs;
};