import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useUserItemsStore } from '@/store/userItemsStore';
import { usePetStore } from '@/store';
import { migrateGuestToUser, shouldMigrateGuest, initializeGuestSession } from '@/lib/guestMigration';
import { uploadKikiToCloud, downloadKikiFromCloud } from '@/services/kikisync';
import { useToast } from '@/hooks/useToast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const migrationRunRef = useRef(false);

  useEffect(() => {
    // Initialize guest session on app start
    initializeGuestSession();

    // Get initial session with OAuth hash processing
    const initSession = async () => {
      try {
        // If we have OAuth hash, extract tokens and set session manually
        if (window.location.hash.includes('access_token')) {
          console.log('OAuth hash detected, processing...');
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          console.log('Extracted tokens:', { hasAccessToken: !!accessToken, tokenLength: accessToken?.length });
          
          if (accessToken) {
            // Try Supabase setSession with timeout, then fallback
            try {
              const setSessionPromise = supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
              });
              
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), 1000)
              );
              
              const { data, error } = await Promise.race([setSessionPromise, timeoutPromise]);
              
              if (data.session?.user && !error) {
                setUser(data.session.user);
                setLoading(false);
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
              }
            } catch (err) {
              console.log('setSession failed, using fallback method');
              
              // Fallback: decode JWT and set user manually (temporary fix)
              try {
                const payload = JSON.parse(atob(accessToken.split('.')[1]));
                const user = {
                  id: payload.sub,
                  email: payload.email,
                  user_metadata: payload.user_metadata || {},
                  app_metadata: payload.app_metadata || {},
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                
                setUser(user as any);
                setLoading(false);
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
              } catch (jwtError) {
                console.error('Fallback JWT decode failed:', jwtError);
              }
            }
          }
        }
        
        // Fallback to regular session check
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session?.user && !error) {
          setUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
        
        // Initialize user items store
        if (session?.user) {
          // Check if we need to migrate guest data
          if (shouldMigrateGuest() && !migrationRunRef.current) {
            try {
              migrationRunRef.current = true;
              setLoading(true);
              const migrationResult = await migrateGuestToUser();
              
              if (migrationResult.errors.length > 0) {
                toast({
                  title: "Migration completed with warnings",
                  description: `${migrationResult.tokensRedeemed + migrationResult.itemsAdded} items synced, ${migrationResult.errors.length} errors`,
                  variant: "destructive"
                });
              } else {
                toast({
                  title: "Guest progress synced!",
                  description: `${migrationResult.tokensRedeemed + migrationResult.itemsAdded} items added to your account`
                });
              }
            } catch (error) {
              toast({
                title: "Failed to sync guest progress",
                description: error instanceof Error ? error.message : "Unknown error",
                variant: "destructive"
              });
            } finally {
              setLoading(false);
            }
          } else {
            useUserItemsStore.getState().loadUserState();
          }
        } else {
          useUserItemsStore.getState().clearUserState();
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        setUser(null);
        setLoading(false);
        useUserItemsStore.getState().clearUserState();
      }
    };
    
    initSession();

    // Set up auth change listener
    const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          setUser(session?.user ?? null);
          setLoading(false);
          
          // Update user items store on auth changes
          if (session?.user && event === 'SIGNED_IN') {
            // Download existing Kiki data from cloud first
            try {
              console.log('🔽 Downloading existing Kiki data from cloud...');
              const downloadResult = await downloadKikiFromCloud();
              
              if (downloadResult.success && downloadResult.data?.pet) {
                console.log('✅ Cloud Kiki data found and loaded:', downloadResult.data.pet.name);
                toast({
                  title: `Welcome back! ${downloadResult.data.pet.name} is ready to work`,
                  description: "Your Kiki data has been restored from the cloud",
                });
              } else {
                console.log('ℹ️ No cloud Kiki data found, checking for local data...');
                
                // Check if we have local Kiki data to upload
                const petState = usePetStore.getState();
                if (petState.pet) {
                  console.log('🔄 Found local Kiki data, uploading to cloud:', petState.pet.name);
                  try {
                    const uploadResult = await uploadKikiToCloud();
                    if (uploadResult.success) {
                      console.log('✅ Local Kiki data successfully synced to cloud');
                      toast({
                        title: `Welcome! ${petState.pet.name} is now synced to your account`,
                        description: "Your local Kiki data has been saved to the cloud",
                      });
                    } else {
                      console.error('Failed to upload local Kiki to cloud:', uploadResult.error);
                      toast({
                        title: "Sync Warning",
                        description: "Your Kiki is loaded but couldn't sync to cloud. Data is still saved locally.",
                        variant: "destructive"
                      });
                    }
                  } catch (uploadError) {
                    console.error('Error uploading local Kiki:', uploadError);
                    toast({
                      title: "Sync Warning", 
                      description: "Your Kiki is loaded but couldn't sync to cloud. Data is still saved locally.",
                      variant: "destructive"
                    });
                  }
                } else {
                  console.log('ℹ️ No local or cloud Kiki data found');
                }
              }
            } catch (error) {
              console.error('Failed to download Kiki data:', error);
            }
            
            // Handle guest migration on sign in
            if (shouldMigrateGuest() && !migrationRunRef.current) {
              try {
                migrationRunRef.current = true;
                setLoading(true);
                const migrationResult = await migrateGuestToUser();
                
                if (migrationResult.errors.length > 0) {
                  toast({
                    title: "Migration completed with warnings",
                    description: `${migrationResult.tokensRedeemed + migrationResult.itemsAdded} items synced, ${migrationResult.errors.length} errors`,
                    variant: "destructive"
                  });
                } else {
                  toast({
                    title: "Guest progress synced!",
                    description: `${migrationResult.tokensRedeemed + migrationResult.itemsAdded} items added to your account`
                  });
                }
              } catch (error) {
                toast({
                  title: "Failed to sync guest progress",
                  description: error instanceof Error ? error.message : "Unknown error",
                  variant: "destructive"
                });
              } finally {
                setLoading(false);
              }
            } else {
              useUserItemsStore.getState().loadUserState();
            }
          } else if (!session?.user) {
            // Upload current Kiki data before logout
            try {
              console.log('🔄 Uploading Kiki data before logout...');
              const uploadResult = await uploadKikiToCloud();
              if (uploadResult.success) {
                console.log('✅ Kiki data saved to cloud before logout');
              }
            } catch (error) {
              console.error('Failed to save Kiki data before logout:', error);
            }
            
            useUserItemsStore.getState().clearUserState();
            // Re-initialize guest session after logout
            initializeGuestSession();
          }
        }
      );

    return () => {
      data.subscription.unsubscribe();
    };
  }, [toast]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔄 Attempting signIn with email:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log('📧 SignIn result:', { hasUser: !!data?.user, hasSession: !!data?.session, error: error?.message });
    
    // Check if session is immediately available after login
    setTimeout(async () => {
      const { data: sessionCheck } = await supabase.auth.getSession();
      console.log('🔍 Post-login session check:', { hasSession: !!sessionCheck.session, hasUser: !!sessionCheck.session?.user });
    }, 100);
    
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname  // Stay on current page
      }
    });
    return { error };
  };

  const signOut = async () => {
    console.log('🚪 AuthProvider: signOut called');
    
    // Always clear local state first
    setUser(null);
    console.log('🚪 Local user state cleared');
    
    // Force clear all possible Supabase storage locations
    const clearAllSupabaseStorage = () => {
      console.log('🚪 Clearing all Supabase storage locations...');
      
      // Clear localStorage
      const localKeys = Object.keys(localStorage).filter(key => 
        key.includes('supabase') || 
        key.includes('sb-') ||
        key.startsWith('supabase')
      );
      
      console.log('🚪 LocalStorage keys to clear:', localKeys);
      localKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🚪 Removed from localStorage: ${key}`);
      });
      
      // Clear sessionStorage
      const sessionKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('supabase') || 
        key.includes('sb-') ||
        key.startsWith('supabase')
      );
      
      console.log('🚪 SessionStorage keys to clear:', sessionKeys);
      sessionKeys.forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`🚪 Removed from sessionStorage: ${key}`);
      });
      
      // Clear any cookies that might contain auth data
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name.includes('supabase') || name.includes('sb-')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          console.log(`🚪 Cleared cookie: ${name}`);
        }
      });
    };
    
    // Clear storage immediately
    clearAllSupabaseStorage();
    
    try {
      console.log('🚪 Attempting Supabase signOut with timeout...');
      
      // Try Supabase signOut with short timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SignOut timeout')), 3000)
      );
      
      const signOutPromise = supabase.auth.signOut();
      
      await Promise.race([signOutPromise, timeoutPromise]);
      console.log('🚪 Supabase signOut completed successfully');
      
    } catch (error) {
      console.warn('🚪 Supabase signOut failed:', error);
      // Continue with forced logout since we already cleared storage
    }
    
    // Final cleanup - clear storage again to be absolutely sure
    clearAllSupabaseStorage();
    
    // Force reload to ensure clean state
    console.log('🚪 Forcing page reload to ensure clean session...');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};