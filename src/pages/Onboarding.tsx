import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import kikiCat from "@/assets/kiki/Kiki.png";
import { TIMER_CONFIG, STORAGE_KEYS, PET_TYPES } from "@/constants";
import { 
  removeActiveTimer,
  removeInsurance,
  getTasksFromStorage,
  setTasksToStorage,
} from "@/utils/helpers";
import { usePetStore } from '@/store';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/components/AuthProvider';
import { downloadKikiFromCloud, uploadKikiToCloud } from '@/services/kikisync';
import { useToast } from '@/hooks/useToast';

const Onboarding = () => {
  const { setPet, pet } = usePetStore();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentScreen, setCurrentScreen] = useState(0);
  const [petName, setPetName] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loadingExistingKiki, setLoadingExistingKiki] = useState(false);
  const [waitingForPet, setWaitingForPet] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasTriggeredLoginSuccess, setHasTriggeredLoginSuccess] = useState(false);
  const navigate = useNavigate();
  
  // Auto-advance from logo screen and check for existing user
  useEffect(() => {
    if (currentScreen === 0) {
      const timer = setTimeout(() => {
        // If user is already logged in, try to load their Kiki
        if (user) {
          handleLoginSuccess();
        } else {
          setCurrentScreen(1);
        }
      }, TIMER_CONFIG.QUOTE_ROTATION_INTERVAL);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, user]);

  // Listen for user login changes - redirect if logged in
  useEffect(() => {
    console.log('Onboarding: User state changed:', { user: !!user, userEmail: user?.email, currentScreen, hasTriggeredLoginSuccess });
    
    // If user just logged in and we haven't triggered login success yet
    if (user && !hasTriggeredLoginSuccess) {
      console.log('Onboarding: User logged in, triggering login success');
      setHasTriggeredLoginSuccess(true);
      handleLoginSuccess();
    }
  }, [user, hasTriggeredLoginSuccess]);

  // Listen for pet changes after login - AuthProvider loads pet automatically
  useEffect(() => {
    if (waitingForPet && pet && user) {
      // Clear timeout since we found the pet
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
      
      // AuthProvider loaded the pet successfully
      toast({
        title: "Welcome back! 👋",
        description: `${pet.name} missed you!`,
      });
      
      setLoadingExistingKiki(false);
      setWaitingForPet(false);
      navigate("/home");
    }
  }, [pet, waitingForPet, user, navigate, toast, loadingTimeout]);

  const handleComplete = async () => {
    // Clear any previous pet state and timers
    removeActiveTimer();
    removeInsurance(); // Insurance is one-time use
    
    // Mark old tasks as belonging to previous Kiki instead of deleting them
    const existingTasks = getTasksFromStorage();
    if (existingTasks.length > 0) {
      const updatedTasks = existingTasks.map((task: any) => ({
        ...task,
        killedKiki: true // Mark that this task killed a Kiki
      }));
      setTasksToStorage(updatedTasks);
    }
    
    // Create new pet data
    const newPet = {
      id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: PET_TYPES.CAT,
      name: petName || "Employee-" + Math.floor(Math.random() * 9999).toString().padStart(4, '0'),
      adoptedAt: new Date().toISOString(),
      streak: 0,
      usedAdRevival: false // New Kiki can use ad revival
    };
    
    // Save to both store and localStorage for compatibility
    setPet(newPet);
    localStorage.setItem("kiki-pet", JSON.stringify(newPet));
    
    // Clear ALL death flags since new pet is alive
    sessionStorage.removeItem("pet-is-dead");
    sessionStorage.removeItem("dead-pet-name");
    sessionStorage.removeItem("death-timestamp");
    localStorage.removeItem("last-pet-death");
    console.log("✨ Created new pet and cleared ALL death flags:", newPet.name);
    
    // If user is logged in, upload the new Kiki to cloud
    if (user) {
      console.log("🔄 Uploading new Kiki to cloud:", newPet.name);
      try {
        const uploadResult = await uploadKikiToCloud();
        if (uploadResult.success) {
          console.log("✅ New Kiki successfully synced to cloud");
          toast({
            title: `${newPet.name} is ready!`,
            description: "Your new Kiki has been saved to the cloud",
          });
        } else {
          console.error("Failed to upload new Kiki:", uploadResult.error);
          toast({
            title: "Sync Warning",
            description: "Your Kiki was created but couldn't sync to cloud. Data is saved locally.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Error uploading new Kiki:", error);
      }
    }
    
    navigate("/home");
  };

  const nextScreen = () => {
    setCurrentScreen(prev => prev + 1);
  };

  const prevScreen = () => {
    setCurrentScreen(prev => Math.max(0, prev - 1));
  };

  const handleLoginSuccess = () => {
    console.log('📧 Onboarding: handleLoginSuccess called');
    setShowAuthModal(false);
    setLoadingExistingKiki(true);
    setWaitingForPet(true);
    
    // Start timeout - if no pet is loaded within 5 seconds, assume user has no Kiki
    const timeout = setTimeout(() => {
      // User is logged in but has no Kiki - continue onboarding
      toast({
        title: "Account ready! ✨",
        description: "Let's create your first Kiki!",
      });
      
      setCurrentScreen(2); // Skip to welcome screen
      setLoadingExistingKiki(false);
      setWaitingForPet(false);
      setLoadingTimeout(null);
    }, 5000);
    
    setLoadingTimeout(timeout);
  };

  const handleContinueAsGuest = () => {
    setCurrentScreen(2);
  };

  // Screen 0: Logo
  if (currentScreen === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-8 text-white">
          <div className="space-y-4">
            <div className="text-6xl font-mono font-bold tracking-wider">
              KIKI CORP
            </div>
            <div className="w-32 h-1 bg-white mx-auto"></div>
            <div className="text-lg font-mono tracking-wide text-gray-300">
              Maximizing productivity since 2042.
            </div>
          </div>
          <div className="animate-pulse text-sm text-gray-500">
            Loading employee orientation...
          </div>
        </div>
      </div>
    );
  }

  // Screen 1: Authentication Choice
  if (currentScreen === 1) {
    return (
      <>
        <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
          <div className="max-w-md mx-auto">
            <div className="bg-white border border-gray-300 shadow-sm">
              {/* Corporate header */}
              <div className="bg-gray-800 text-white p-4 text-center">
                <div className="font-mono text-sm">KIKI CORP | Employee Access</div>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="text-center space-y-4">
                  <img 
                    src={kikiCat} 
                    alt="Kiki" 
                    className="w-24 h-24 mx-auto object-contain"
                  />
                  <h1 className="text-2xl font-bold text-gray-900">
                    Welcome to Kiki Corp
                  </h1>
                  <p className="text-gray-600 font-mono text-sm">
                    Access your existing companion or create a new one
                  </p>
                </div>
                
                {loadingExistingKiki ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto"></div>
                    <p className="mt-4 text-sm text-gray-600 font-mono">
                      Loading your Kiki...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button 
                      onClick={() => setShowAuthModal(true)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white font-mono"
                    >
                      Login to Existing Account
                    </Button>
                    
                    <div className="flex items-center">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <span className="px-4 text-xs text-gray-500 font-mono">OR</span>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>
                    
                    <Button 
                      onClick={handleContinueAsGuest}
                      variant="outline" 
                      className="w-full font-mono"
                    >
                      Continue as Guest
                    </Button>
                    
                    <p className="text-xs text-gray-500 text-center font-mono">
                      Guest progress can be linked to an account later
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleLoginSuccess}
        />
      </>
    );
  }

  // Screen 2: Corporate Welcome
  if (currentScreen === 2) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <div className="bg-white border border-gray-300 shadow-sm">
            {/* Corporate header */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <div className="font-mono text-sm">KIKI CORP | Employee Orientation v2.1</div>
              <div className="text-xs text-gray-400">CONFIDENTIAL</div>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="text-center space-y-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome, employee.
                </h1>
                <p className="text-gray-600 font-mono">
                  You've been assigned a Kiki™ Productivity Companion.
                </p>
              </div>
              
              <div className="flex items-center justify-center space-x-8">
                <div className="text-center">
                  <img 
                    src={kikiCat} 
                    alt="Kiki Productivity Companion" 
                    className="w-24 h-24 mx-auto object-contain"
                  />
                  <div className="mt-2 text-xs text-gray-500 font-mono">
                    MODEL: CAT-2042
                  </div>
                </div>
                <div className="text-4xl text-gray-300">→</div>
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-gray-200 border-2 border-dashed border-gray-400 rounded flex items-center justify-center">
                    <div className="text-2xl">👤</div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    YOU
                  </div>
                </div>
              </div>

              <Button onClick={nextScreen} className="w-full bg-gray-800 hover:bg-gray-700">
                Acknowledge Assignment
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Screen 3: Corporate Regulations
  if (currentScreen === 3) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-2xl mx-auto pt-8">
          <div className="bg-white border border-gray-300 shadow-sm">
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <div className="font-mono text-sm">KIKI CORP | Productivity Guidelines</div>
              <div className="text-xs text-red-400">MANDATORY READING</div>
            </div>
            
            <div className="p-8 space-y-6">
              <h1 className="text-xl font-bold text-gray-900 text-center">
                Employee Productivity Protocol
              </h1>
              
              <div className="space-y-4 font-mono text-sm">
                <div className="flex items-start space-x-3">
                  <div className="text-red-600 font-bold">1.</div>
                  <div>Kiki™ will work alongside you on every task.</div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="text-red-600 font-bold">2.</div>
                  <div>Failure to complete tasks will result in <span className="text-red-600 font-bold">immediate termination</span> of Kiki™.</div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="text-red-600 font-bold">3.</div>
                  <div>Proof of productivity must be uploaded for review.</div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="text-red-600 font-bold">4.</div>
                  <div>Supervisors may approve or reject your performance.</div>
                </div>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="text-sm text-yellow-800 font-mono">
                  <strong>WARNING:</strong> Kiki™ companions are non-replaceable company assets. Handle with extreme care.
                </div>
              </div>

              <div className="flex space-x-3">
                <Button onClick={prevScreen} variant="outline" className="flex-1">
                  Review Previous
                </Button>
                <Button onClick={nextScreen} className="flex-1 bg-gray-800 hover:bg-gray-700">
                  Accept Terms
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Screen 4: Final Warning & Assignment
  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="bg-gray-800 border border-gray-600 shadow-xl">
          <div className="bg-red-800 text-white p-4 text-center">
            <div className="font-mono text-sm font-bold">FINAL NOTICE</div>
          </div>
          
          <div className="p-8 space-y-6 text-center">
            <img 
              src={kikiCat} 
              alt="Kiki" 
              className="w-32 h-32 mx-auto object-contain"
            />
            
            <div className="space-y-4 text-white">
              <p className="font-mono text-sm text-gray-300">
                Your efficiency keeps Kiki™ alive.
              </p>
              <p className="text-lg font-bold text-red-400">
                Don't disappoint the Corporation.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="text-left">
                <label className="block text-sm text-gray-400 font-mono mb-2">
                  Assign Companion Name:
                </label>
                <Input
                  value={petName}
                  onChange={(e) => setPetName(e.target.value)}
                  placeholder="Enter designation..."
                  className="text-center bg-gray-700 border-gray-600 text-white placeholder-gray-500"
                  maxLength={15}
                />
                <div className="text-xs text-gray-500 mt-1 font-mono">
                  {petName ? `"Hello, I am ${petName}. I will serve you well."` : "Auto-assign: Employee-XXXX"}
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={handleComplete}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3"
                >
                  BEGIN ASSIGNMENT
                </Button>
                <Button 
                  onClick={prevScreen}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white text-xs"
                >
                  ← Review Terms
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;