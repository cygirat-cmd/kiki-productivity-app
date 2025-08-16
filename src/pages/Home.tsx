import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Trophy, Skull } from "lucide-react";
import kikiCat from "@/assets/kiki-cat-happy.png";
import kikiBunny from "@/assets/kiki-bunny-happy.png";
import kikiPenguin from "@/assets/kiki-penguin-happy.png";

interface Pet {
  type: string;
  name: string;
  adoptedAt: string;
  happiness: number;
  streak: number;
}

const petImages = {
  cat: kikiCat,
  bunny: kikiBunny,
  penguin: kikiPenguin
};

const unhingedQuotes = [
  "Senpai... please don't forget about me...",
  "I'm literally dying to see you succeed!",
  "Do something productive or I'm toast!",
  "Your procrastination is my death sentence!",
  "Please... I have so much to live for!",
  "Remember me when you're scrolling TikTok...",
  "I believe in you... don't make me regret it!"
];

const Home = () => {
  const [pet, setPet] = useState<Pet | null>(null);
  const [currentQuote, setCurrentQuote] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const savedPet = localStorage.getItem("kiki-pet");
    if (!savedPet) {
      navigate("/onboarding");
      return;
    }
    setPet(JSON.parse(savedPet));

    // Rotate quotes every 3 seconds
    const interval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % unhingedQuotes.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [navigate]);

  if (!pet) return null;

  const petImage = petImages[pet.type as keyof typeof petImages];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{pet.name}</h1>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-success/20">
                <Trophy className="w-3 h-3 mr-1" />
                {pet.streak} days
              </Badge>
              <Badge variant="outline" className="bg-primary/20">
                Level {Math.floor(pet.streak / 7) + 1}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/cemetery")}
          >
            <Skull className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Pet Display */}
        <div className="card-kawaii text-center space-y-4">
          <div className="relative">
            <img 
              src={petImage} 
              alt={pet.name} 
              className="w-40 h-40 mx-auto object-contain bounce-cute"
            />
            {pet.happiness < 30 && (
              <div className="absolute top-0 right-0 animate-pulse">
                <span className="text-2xl">😰</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Happiness Level</p>
              <Progress 
                value={pet.happiness} 
                className="w-full h-3 mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">{pet.happiness}%</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 min-h-[3rem] flex items-center justify-center">
              <p className="text-sm italic text-center">
                "{unhingedQuotes[currentQuote]}"
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={() => navigate("/quick-task")}
            className="btn-kawaii w-full h-14"
          >
            <Plus className="w-5 h-5 mr-2" />
            Quick Task + Timer
          </Button>

          <Button 
            onClick={() => navigate("/board")}
            variant="outline" 
            className="w-full h-14 border-2 border-accent hover:bg-accent/20"
          >
            <Clock className="w-5 h-5 mr-2" />
            Task Board
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={() => navigate("/shop")}
              variant="outline"
              className="h-12 border-primary/30 hover:bg-primary/10"
            >
              🛍️ Shop
            </Button>
            <Button 
              onClick={() => navigate("/stats")}
              variant="outline"
              className="h-12 border-warning/30 hover:bg-warning/10"
            >
              📊 Stats
            </Button>
          </div>
        </div>

        {/* Warning */}
        {pet.happiness < 50 && (
          <div className="bg-warning/20 border border-warning/30 rounded-lg p-4 text-center">
            <p className="text-sm font-medium text-warning-foreground">
              ⚠️ {pet.name} is getting anxious! Complete some tasks to boost their mood!
            </p>
          </div>
        )}

        {pet.happiness < 20 && (
          <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-4 text-center">
            <p className="text-sm font-bold text-destructive-foreground">
              💀 CRITICAL: {pet.name} is on the verge of... well, you know what happens next!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;