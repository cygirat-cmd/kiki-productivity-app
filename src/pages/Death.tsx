import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import chainsaw from "@/assets/chainsaw-icon.png";
import kikiCat from "@/assets/kiki-cat-happy.png";
import kikiBunny from "@/assets/kiki-bunny-happy.png";
import kikiPenguin from "@/assets/kiki-penguin-happy.png";

const petImages = {
  cat: kikiCat,
  bunny: kikiBunny,
  penguin: kikiPenguin
};

const deathQuotes = [
  "Kiki didn't make it... but we're sending you a new pet. Don't fail again.",
  "Your procrastination was Kiki's doom. They trusted you...",
  "Another innocent soul lost to your lack of productivity.",
  "Kiki's last words: 'I believed in you, senpai...'",
  "The chainsaw of consequences has spoken.",
  "RIP Kiki. May their sacrifice motivate your future self.",
  "Kiki joins the growing cemetery of your failures."
];

const Death = () => {
  const [showChainsaw, setShowChainsaw] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const [canRevive, setCanRevive] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const reason = location.state?.reason || "Task failure";
  const overdueTasks = location.state?.overdueTasks || [];

  useEffect(() => {
    // Save dead pet to cemetery
    const savedPet = localStorage.getItem("kiki-pet");
    if (savedPet) {
      const pet = JSON.parse(savedPet);
      const cemetery = JSON.parse(localStorage.getItem("kiki-cemetery") || "[]");
      
      cemetery.push({
        ...pet,
        deathDate: new Date().toISOString(),
        deathReason: reason,
        gravestone: `RIP ${pet.name}\n"${reason}"\n${new Date().toLocaleDateString()}`
      });
      
      localStorage.setItem("kiki-cemetery", JSON.stringify(cemetery));
    }

    // Chainsaw animation sequence
    const chainsawTimer = setTimeout(() => {
      setShowChainsaw(false);
      setShowMessage(true);
    }, 2000);

    // Check if user has "Pet Life Insurance" (premium feature)
    const hasInsurance = localStorage.getItem("kiki-insurance") === "true";
    setCanRevive(hasInsurance);

    return () => clearTimeout(chainsawTimer);
  }, [reason]);

  const getNewPet = () => {
    // Create new pet with random type
    const petTypes = ["cat", "bunny", "penguin"];
    const petNames = ["Whiskers", "Bunnington", "Wadsworth"];
    const randomIndex = Math.floor(Math.random() * petTypes.length);
    
    const newPet = {
      type: petTypes[randomIndex],
      name: petNames[randomIndex],
      adoptedAt: new Date().toISOString(),
      happiness: 100,
      streak: 0
    };

    localStorage.setItem("kiki-pet", JSON.stringify(newPet));
    navigate("/home");
  };

  const revivePet = () => {
    // Premium feature - revive the pet
    const savedPet = localStorage.getItem("kiki-pet");
    if (savedPet) {
      const pet = JSON.parse(savedPet);
      pet.happiness = 50; // Revived but traumatized
      localStorage.setItem("kiki-pet", JSON.stringify(pet));
      
      // Remove from cemetery
      const cemetery = JSON.parse(localStorage.getItem("kiki-cemetery") || "[]");
      const updatedCemetery = cemetery.slice(0, -1); // Remove last entry
      localStorage.setItem("kiki-cemetery", JSON.stringify(updatedCemetery));
      
      navigate("/home");
    }
  };

  const watchAdToRevive = () => {
    // Simulate watching a 30-second ad
    // In a real app, this would integrate with an ad provider
    setTimeout(() => {
      revivePet();
    }, 2000); // Simulate ad duration
  };

  if (showChainsaw) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-death-black to-death-red flex items-center justify-center fade-to-black">
        <div className="text-center space-y-8">
          <img 
            src={chainsaw} 
            alt="Chainsaw of doom" 
            className="w-32 h-32 mx-auto animate-bounce shake-death"
          />
          <div className="text-white space-y-2">
            <h1 className="text-4xl font-bold">CHAINSAW TIME!</h1>
            <p className="text-xl opacity-75">The consequences have arrived...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-death-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {showMessage && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-white">Game Over</h1>
              <div className="card-death space-y-4">
                <p className="text-lg text-white">
                  {deathQuotes[Math.floor(Math.random() * deathQuotes.length)]}
                </p>
                
                <div className="bg-death-red/20 rounded-lg p-4">
                  <p className="text-sm text-white">
                    <span className="font-bold">Cause of death:</span> {reason}
                  </p>
                  
                  {overdueTasks.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-white">Overdue tasks:</p>
                      <ul className="text-xs text-white/80 mt-1">
                        {overdueTasks.map((task, index) => (
                          <li key={index}>• {task}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {canRevive && (
                <div className="space-y-2">
                  <Button onClick={revivePet} className="w-full bg-primary hover:bg-primary/90">
                    💎 Use Pet Life Insurance
                  </Button>
                  <p className="text-xs text-white/60">Premium feature - 1 revival per month</p>
                </div>
              )}

              <Button onClick={watchAdToRevive} className="w-full bg-warning hover:bg-warning/90">
                📺 Watch Ad to Revive (30s)
              </Button>

              <Button onClick={getNewPet} className="btn-kawaii w-full">
                Get New Pet
              </Button>

              <Button 
                onClick={() => navigate("/cemetery")} 
                variant="outline"
                className="w-full border-white/30 text-white hover:bg-white/10"
              >
                💀 Visit Cemetery
              </Button>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm text-white/80 italic">
                "Maybe next time you'll actually do your tasks... Kiki's spirit is watching you now. 👻"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Death;