import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from './AuthProvider';
import { saveKikiToCloud, loadKikiFromCloud } from '@/lib/supabaseClient';
import { 
  getLastCloudSyncFromStorage,
  getPetFromStorage,
  getTasksFromStorage,
  getCemeteryFromStorage,
  getCoinsFromStorage,
  getPauseTokensFromStorage,
  getOwnedItemsFromStorage,
  getSessionStatsFromStorage,
  setLastCloudSyncToStorage,
  setPetToStorage,
  setTasksToStorage,
  setCemeteryToStorage,
  setCoinsToStorage,
  setPauseTokensToStorage,
  setOwnedItemsToStorage,
  setSessionStatsToStorage
} from '@/utils/helpers';
import { User, Download, Upload, LogOut, Cloud, AlertTriangle } from 'lucide-react';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { user, signOut } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    // Check for last sync time
    const savedData = getLastCloudSyncFromStorage();
    if (savedData) {
      setLastSync(savedData);
    }
  }, []);

  if (!isOpen || !user) return null;

  const handleSignOut = async () => {
    console.log('🚪 UserProfile: handleSignOut clicked');
    try {
      console.log('🚪 Calling signOut...');
      await signOut();
      console.log('🚪 SignOut completed, closing modal');
      onClose(); // Close the modal after signing out
    } catch (error) {
      console.error('🚪 Error signing out:', error);
    }
  };

  const handleSaveToCloud = async () => {
    setSyncing(true);
    setSyncError('');

    try {
      // Gather all save data
      const saveData = {
        pet_data: getPetFromStorage(),
        tasks_data: getTasksFromStorage(),
        cemetery_data: getCemeteryFromStorage(),
        coins: getCoinsFromStorage(),
        pause_tokens: getPauseTokensFromStorage(),
        owned_items: getOwnedItemsFromStorage(),
        session_stats: getSessionStatsFromStorage()
      };

      const { error } = await saveKikiToCloud(saveData);
      
      if (error) {
        setSyncError(`Save failed: ${error.message}`);
      } else {
        const now = new Date().toISOString();
        setLastSync(now);
        setLastCloudSyncToStorage(now);
      }
    } catch (err) {
      setSyncError('Failed to save to cloud');
    } finally {
      setSyncing(false);
    }
  };

  const handleLoadFromCloud = async () => {
    setSyncing(true);
    setSyncError('');

    try {
      const { data, error } = await loadKikiFromCloud();
      
      if (error) {
        setSyncError(`Load failed: ${error.message}`);
      } else if (data) {
        // Restore all save data
        if (data.pet_data) {
          setPetToStorage(data.pet_data);
        }
        if (data.tasks_data) {
          setTasksToStorage(data.tasks_data);
        }
        if (data.cemetery_data) {
          setCemeteryToStorage(data.cemetery_data);
        }
        setCoinsToStorage(data.coins || 50);
        setPauseTokensToStorage(data.pause_tokens || 0);
        if (data.owned_items) {
          setOwnedItemsToStorage(data.owned_items);
        }
        if (data.session_stats) {
          setSessionStatsToStorage(data.session_stats);
        }

        const syncTime = data.last_sync || new Date().toISOString();
        setLastSync(syncTime);
        setLastCloudSyncToStorage(syncTime);

        // Refresh the page to load the restored data
        window.location.reload();
      } else {
        setSyncError('No cloud save found');
      }
    } catch (err) {
      setSyncError('Failed to load from cloud');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Cloud Profile</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Cloud className="w-4 h-4" />
              <span className="text-sm font-medium">Cloud Sync</span>
              <Badge variant="secondary" className="text-xs">
                {lastSync ? 'Synced' : 'Not synced'}
              </Badge>
            </div>

            {lastSync && (
              <p className="text-xs text-muted-foreground">
                Last sync: {formatDate(lastSync)}
              </p>
            )}

            {syncError && (
              <div className="bg-destructive/20 text-destructive p-2 rounded text-xs flex items-center space-x-2">
                <AlertTriangle className="w-3 h-3" />
                <span>{syncError}</span>
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleSaveToCloud}
                disabled={syncing}
              >
                <Upload className="w-3 h-3 mr-1" />
                {syncing ? 'Saving...' : 'Save to Cloud'}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleLoadFromCloud}
                disabled={syncing}
              >
                <Download className="w-3 h-3 mr-1" />
                {syncing ? 'Loading...' : 'Load from Cloud'}
              </Button>
            </div>
          </div>

          <div className="text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Your Kiki saves are backed up securely in the cloud
            </p>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={handleSignOut}
              className="w-full"
            >
              <LogOut className="w-3 h-3 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};