import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import kikiCat from "@/assets/kiki-cat-happy.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user already has a pet
    const savedPet = localStorage.getItem("kiki-pet");
    if (savedPet) {
      navigate("/home");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/10 to-accent/20 flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-8">
        <div className="space-y-4">
          <img 
            src={kikiCat} 
            alt="Kiki mascot" 
            className="w-32 h-32 mx-auto object-contain bounce-cute"
          />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Kiki
          </h1>
          <h2 className="text-2xl font-bold text-foreground">
            Your Unhinged Productivity App
          </h2>
          <p className="text-lg text-muted-foreground">
            A kawaii virtual pet that <span className="font-bold text-destructive">literally dies</span> if you don't complete your tasks. 
            No pressure! 😅
          </p>
        </div>

        <div className="card-kawaii space-y-4">
          <h3 className="text-xl font-semibold">How it works:</h3>
          <div className="space-y-2 text-sm text-left">
            <p>✨ Adopt a cute virtual pet</p>
            <p>📝 Create tasks with timers</p>
            <p>📸 Prove you completed them</p>
            <p>💀 Fail and watch Kiki meet their doom</p>
            <p>🪦 Visit their grave and feel guilty</p>
          </div>
        </div>

        <Button 
          onClick={() => navigate("/onboarding")}
          className="btn-kawaii w-full h-14 text-lg"
        >
          Adopt Your First Pet
        </Button>

        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-sm text-destructive-foreground">
            ⚠️ <span className="font-bold">Warning:</span> This app uses guilt, shame, and cartoon violence to motivate productivity. 
            Side effects may include: actually getting stuff done.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
