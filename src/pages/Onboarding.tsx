import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import kikiCat from "@/assets/kiki-cat-happy.png";
import kikiBunny from "@/assets/kiki-bunny-happy.png";
import kikiPenguin from "@/assets/kiki-penguin-happy.png";

const pets = [
  { id: "cat", name: "Whiskers", image: kikiCat, description: "A playful cat who loves productivity!" },
  { id: "bunny", name: "Bunnington", image: kikiBunny, description: "A royal bunny who demands excellence!" },
  { id: "penguin", name: "Wadsworth", image: kikiPenguin, description: "A cool penguin who chills until deadlines!" }
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [selectedPet, setSelectedPet] = useState("");
  const [petName, setPetName] = useState("");
  const navigate = useNavigate();

  const handlePetSelect = (petId: string) => {
    setSelectedPet(petId);
    const defaultName = pets.find(p => p.id === petId)?.name || "";
    setPetName(defaultName);
  };

  const handleComplete = () => {
    // Save pet data to localStorage
    localStorage.setItem("kiki-pet", JSON.stringify({
      type: selectedPet,
      name: petName,
      adoptedAt: new Date().toISOString(),
      happiness: 100,
      streak: 0
    }));
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 p-4">
      <div className="max-w-md mx-auto pt-8">
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-foreground">Welcome to Kiki!</h1>
              <p className="text-lg text-muted-foreground">
                Your unhinged productivity companion who <span className="font-semibold text-destructive">literally</span> depends on you getting stuff done.
              </p>
            </div>
            
            <div className="card-kawaii space-y-4">
              <h2 className="text-2xl font-semibold">Choose Your Victim... I Mean Pet!</h2>
              <div className="grid gap-4">
                {pets.map((pet) => (
                  <Card 
                    key={pet.id}
                    className={`p-4 cursor-pointer transition-all duration-200 hover:scale-105 ${
                      selectedPet === pet.id 
                        ? "ring-2 ring-primary shadow-[var(--shadow-kawaii)]" 
                        : "hover:shadow-lg"
                    }`}
                    onClick={() => handlePetSelect(pet.id)}
                  >
                    <div className="flex items-center space-x-4">
                      <img src={pet.image} alt={pet.name} className="w-16 h-16 object-contain bounce-cute" />
                      <div className="text-left">
                        <h3 className="font-semibold text-lg">{pet.name}</h3>
                        <p className="text-sm text-muted-foreground">{pet.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {selectedPet && (
                <Button 
                  onClick={() => setStep(2)}
                  className="btn-kawaii w-full"
                >
                  Adopt {pets.find(p => p.id === selectedPet)?.name}!
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <img 
                src={pets.find(p => p.id === selectedPet)?.image} 
                alt="Selected pet" 
                className="w-32 h-32 mx-auto object-contain bounce-cute"
              />
              <h2 className="text-3xl font-bold">Name Your New Friend</h2>
              <p className="text-muted-foreground">
                Choose wisely... you'll be seeing their name on their gravestone if you fail them.
              </p>
            </div>

            <div className="card-kawaii space-y-4">
              <Input
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="Enter pet name..."
                className="text-center text-lg"
                maxLength={15}
              />
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>"Hi, I'm {petName || "..."}! Please don't let me die..."</p>
                <p className="text-destructive font-medium">
                  "Seriously though, I'm counting on you, senpai!"
                </p>
              </div>

              <Button 
                onClick={handleComplete}
                disabled={!petName.trim()}
                className="btn-kawaii w-full"
              >
                Start Our Journey Together!
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;