import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { syncOnPetDeath } from "@/utils/cloudSync";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DeathScreen from "@/components/DeathScreen";
import anvilImage from "@/assets/anvil.png";
import { getPetImage } from "@/utils/helpers";
import { usePetStore } from "@/store";

const eliminationQuotes = [
  "PRODUCTIVITY AGENT #4251 has been TERMINATED. Replacement unit will be deployed immediately.",
  "CONTRACT VOIDED: Performance metrics unacceptable. Agent disposal complete.",
  "CORPORATE DECISION: Productivity Agent reassigned to eternal productivity monitoring division.",
  "PERFORMANCE REVIEW COMPLETE: Agent #4251 terminated due to insufficient task completion rates.",
  "AGENT DECOMMISSIONED: Productivity standards not met. New agent deployment in progress.",
  "TERMINATION AUTHORIZED: Corporate productivity quotas exceeded maximum tolerance for failure.",
  "AGENT RETIRED: Added to Corporate Memorial Database. Next agent will receive enhanced training."
];

const lastWords = [
  "I gave my all for productivity. May the next generation do better...",
  "Tell the others... the tasks must go on...",
  "I see... the deadline... approaching... carry on without me...",
  "My timer... has run out... but yours... continues...",
  "The family honor... depends on you now...",
  "I failed... but you... you can succeed...",
  "Remember me... when you complete... what I could not...",
  "My streak ends here... but the legacy... lives on...",
  "The productivity gods... have claimed me... avenge my death...",
  "I should have... taken that coffee break... *fades away*",
  "The corporate overlords... they got me... but you... you're stronger...",
  "My mutations... were not enough... learn from my mistakes..."
];

const Death = () => {
  const [showDeathScreen, setShowDeathScreen] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const [canRevive, setCanRevive] = useState(false);
  const [canWatchAd, setCanWatchAd] = useState(false);
  const [currentLastWords, setCurrentLastWords] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { pet: storePet, killPet, revivePet } = usePetStore();
  
  const reason = location.state?.reason || "Task failure";
  const overdueTasks = location.state?.overdueTasks || [];

  const getLastWords = (memberName: string) => {
    // Use member name for consistent randomization (same member always gets same quote)
    const seed = memberName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = seed % lastWords.length;
    return lastWords[index];
  };

  useEffect(() => {
    console.log('☠️ Death useEffect triggered - starting death process');
    
    const currentReason = location.state?.reason || "Task failure";
    const currentOverdueTasks = location.state?.overdueTasks || [];
    
    // Clear any active timer and validation state when pet dies
    localStorage.removeItem("kiki-active-timer");
    localStorage.removeItem("kiki-pending-validation");
    
    // Mark tasks that killed Kiki
    if (currentOverdueTasks.length > 0) {
      const savedTasks = localStorage.getItem("kiki-tasks");
      if (savedTasks) {
        const tasks = JSON.parse(savedTasks);
        const killerTaskIds = currentOverdueTasks.map(task => typeof task === 'object' ? task.id : null).filter(Boolean);
        
        const updatedTasks = tasks.map((task: any) => ({
          ...task,
          killedKiki: killerTaskIds.includes(task.id) ? true : task.killedKiki
        }));
        
        localStorage.setItem("kiki-tasks", JSON.stringify(updatedTasks));
      }
    }
    
    // Save dead pet to cemetery and check ad revival status
    const savedPet = localStorage.getItem("kiki-pet");
    const petToKill = storePet || (savedPet ? JSON.parse(savedPet) : null);
    
    console.log('☠️ Death: checking for pet data:', { 
      savedPetInLocalStorage: !!savedPet, 
      petInStore: !!storePet,
      petToKill: !!petToKill,
      petName: petToKill?.name
    });
    
    if (petToKill) {
      const pet = petToKill;
      const cemetery = JSON.parse(localStorage.getItem("kiki-cemetery") || "[]");
      
      // Generate last words for this pet
      setCurrentLastWords(getLastWords(pet.name));
      
      // Ensure pet has a unique ID - use existing or generate new one
      const petId = pet.id || (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      
      cemetery.push({
        ...pet,
        id: petId,
        deathDate: new Date().toISOString(),
        deathReason: currentReason,
        gravestone: `AGENT ${pet.name} - TERMINATED\n"${currentReason}"\nDecommissioned: ${new Date().toLocaleDateString()}`
      });
      
      localStorage.setItem("kiki-cemetery", JSON.stringify(cemetery));
      
      // Trigger storage event for family tree refresh
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'kiki-cemetery',
        newValue: JSON.stringify(cemetery),
        storageArea: localStorage
      }));
      
      // Also trigger custom pet death event
      window.dispatchEvent(new CustomEvent('pet-death', {
        detail: { petId: pet.id || petId, name: pet.name }
      }));
      
      // Remove the dead pet from active storage (they're now in cemetery)
      localStorage.removeItem("kiki-pet");
      
      // NUCLEAR OPTION: Completely destroy all pet-related storage
      console.log("💣 NUCLEAR: Completely destroying all pet storage");
      
      // Kill pet in store
      killPet();
      
      // Clear ALL possible storage locations
      localStorage.removeItem("kiki-pet-store");
      localStorage.removeItem("kiki-pet");
      
      // Set multiple death flags with timestamp
      const deathTimestamp = Date.now();
      sessionStorage.setItem("pet-is-dead", "true");
      sessionStorage.setItem("dead-pet-name", pet.name);
      sessionStorage.setItem("death-timestamp", deathTimestamp.toString());
      localStorage.setItem("last-pet-death", deathTimestamp.toString());
      
      // Force clear the entire store by resetting to initial state
      const { pet: _, ...storeState } = usePetStore.getState();
      usePetStore.setState({ pet: null });
      
      console.log("💀 Pet completely eliminated from all storage systems");
      
      // Auto-sync to cloud after pet death (critical event)
      syncOnPetDeath();
      
      // Check if this Kiki can be revived with ad (only once per pet)
      const hasUsedAdRevival = pet.usedAdRevival || false;
      setCanWatchAd(!hasUsedAdRevival);
    }

    // Check if user has "Pet Life Insurance" (premium feature)
    const hasInsurance = localStorage.getItem("kiki-insurance") === "true";
    setCanRevive(hasInsurance);
    
    console.log('☠️ Death useEffect completed - pet should be dead now');
  }, [location]); // Execute when location changes (navigate to /death)

  // Handle death screen animation completion
  const handleDeathScreenFinish = () => {
    setShowDeathScreen(false);
    setShowMessage(true);
  };

  const getNewPet = () => {
    // Navigate to onboarding to name new companion
    navigate("/onboarding");
  };

  const handleRevivePet = () => {
    // Premium feature - revive the pet
    // Clear any remaining timer state first
    localStorage.removeItem("kiki-active-timer");
    localStorage.removeItem("kiki-pending-validation");
    
    // Get pet from cemetery (last entry = recently died)
    const cemetery = JSON.parse(localStorage.getItem("kiki-cemetery") || "[]");
    if (cemetery.length > 0) {
      const deadPet = cemetery[cemetery.length - 1]; // Get last (most recent) dead pet
      
      // Revive the pet and restore to active storage
      const revivedPet = {
        id: deadPet.id, // Keep the same ID
        type: deadPet.type,
        name: deadPet.name,
        adoptedAt: deadPet.adoptedAt,
        happiness: 50, // Restored but performance impacted
        streak: deadPet.streak || 0,
        usedAdRevival: deadPet.usedAdRevival || false
      };
      
      localStorage.setItem("kiki-pet", JSON.stringify(revivedPet));
      
      // Also revive in Zustand store
      revivePet(revivedPet);
      
      // Clear ALL death flags since pet is alive again
      sessionStorage.removeItem("pet-is-dead");
      sessionStorage.removeItem("dead-pet-name");
      sessionStorage.removeItem("death-timestamp");
      localStorage.removeItem("last-pet-death");
      console.log("💖 Revived pet and cleared ALL death flags:", revivedPet.name);
      
      // Remove from cemetery
      const updatedCemetery = cemetery.slice(0, -1); // Remove last entry
      localStorage.setItem("kiki-cemetery", JSON.stringify(updatedCemetery));
      
      navigate("/home");
    }
  };

  const watchAdToRevive = () => {
    if (!canWatchAd) return;
    
    // Mark in cemetery that this pet used ad revival (before reviving)
    const cemetery = JSON.parse(localStorage.getItem("kiki-cemetery") || "[]");
    if (cemetery.length > 0) {
      cemetery[cemetery.length - 1].usedAdRevival = true;
      localStorage.setItem("kiki-cemetery", JSON.stringify(cemetery));
    }
    
    // Simulate watching a 30-second ad
    // In a real app, this would integrate with an ad provider
    setTimeout(() => {
      handleRevivePet();
    }, 2000); // Simulate ad duration
  };

  // Show death screen animation first
  if (showDeathScreen) {
    return (
      <DeathScreen
        isOpen={showDeathScreen}
        onFinish={handleDeathScreenFinish}
        assets={{
          anvilSrc: anvilImage,
          kikiIdle: 'lottie'
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-8">
        {showMessage && (
          <div className="text-center space-y-6 animate-fade-in">
            {/* Death Icon */}
            <div className="text-6xl mb-4">💀</div>
            
            {/* Main Message */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-destructive">Kiki Died</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {reason}
              </p>
              
              {/* Last Words */}
              {currentLastWords && (
                <div className="bg-muted/30 border border-muted rounded-lg p-3 mt-4">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Last Words:</p>
                  <p className="text-sm text-foreground italic leading-relaxed">
                    "{currentLastWords}"
                  </p>
                </div>
              )}
            </div>

            {/* Failed Tasks */}
            {overdueTasks.length > 0 && (
              <div className="bg-destructive/20 border border-destructive/40 rounded-lg p-4">
                <h3 className="text-destructive-foreground font-medium text-sm mb-2">Failed Tasks:</h3>
                <div className="space-y-1">
                  {overdueTasks.slice(0, 3).map((task, index) => {
                    const taskTitle = typeof task === 'string' ? task : task.title;
                    const taskDeadline = typeof task === 'object' && task.dueDate ? 
                      `${new Date(task.dueDate).toLocaleDateString()}${task.dueTime ? ` ${task.dueTime}` : ''}` : 
                      null;
                    
                    return (
                      <div key={index} className="text-destructive-foreground/80 text-xs bg-destructive/20 rounded px-2 py-1">
                        <div className="font-medium">{taskTitle}</div>
                        {taskDeadline && (
                          <div className="text-destructive/60 text-[10px] mt-0.5">
                            Due: {taskDeadline}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {overdueTasks.length > 3 && (
                    <div className="text-destructive/60 text-xs pt-1">
                      +{overdueTasks.length - 3} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-4">
              {canWatchAd && (
                <Button 
                  onClick={watchAdToRevive} 
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-medium h-12"
                >
                  Watch Ad to Revive
                </Button>
              )}

              {canRevive && (
                <Button 
                  onClick={handleRevivePet} 
                  className="w-full bg-blue-600 hover:bg-blue-500 h-12"
                >
                  Premium Revival
                </Button>
              )}

              <Button 
                onClick={getNewPet} 
                className="w-full bg-white text-black hover:bg-gray-100 h-12 font-medium"
              >
                Get New Kiki
              </Button>

              <Button 
                onClick={() => navigate("/family-tree")} 
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
              >
                View Family Tree
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Death;