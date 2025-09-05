import { useEffect, useState } from 'react';
import { type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

export function useAuthBoot() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let unsub = () => {};
    
    const initAuth = () => {
      try {
        console.log('useAuthBoot: Getting session from localStorage directly...');
        
        // Direct localStorage access to bypass hanging Supabase calls
        const authKey = `sb-hwriwdbzervvmfpuzjqj-auth-token`;
        const authData = localStorage.getItem(authKey);
        
        if (authData) {
          const parsed = JSON.parse(authData);
          console.log('useAuthBoot: Found auth data:', parsed);
          
          // Check if token is not expired
          if (parsed.expires_at && parsed.expires_at > Date.now() / 1000) {
            // Create session-like object from localStorage data
            const mockSession = {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
              user: parsed.user,
              expires_at: parsed.expires_at
            };
            console.log('useAuthBoot: Setting session from localStorage:', mockSession);
            setSession(mockSession as any);
          } else {
            console.log('useAuthBoot: Token expired');
            setSession(null);
          }
        } else {
          console.log('useAuthBoot: No auth data in localStorage');
          setSession(null);
        }
        
        setReady(true);
        
        // Try to set up auth change listener (with timeout to prevent hanging)
        const timeoutId = setTimeout(() => {
          console.log('useAuthBoot: Auth listener setup timeout');
        }, 2000);
        
        supabase.auth.onAuthStateChange((event, session) => {
          clearTimeout(timeoutId);
          console.log('useAuthBoot: Auth state change:', { event, session });
          setSession(session);
        });
        
      } catch (error) {
        console.error('useAuthBoot: Error in initAuth:', error);
        setSession(null);
        setReady(true);
      }
    };
    
    initAuth();
    
    return () => unsub();
  }, []);

  return { ready, session, user: session?.user || null };
}