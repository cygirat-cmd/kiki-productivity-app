import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Skull, Flower } from "lucide-react";

interface DeadPet {
  type: string;
  name: string;
  adoptedAt: string;
  deathDate: string;
  deathReason: string;
  gravestone: string;
  streak: number;
}

const Cemetery = () => {
  const [deadPets, setDeadPets] = useState<DeadPet[]>([]);
  const [selectedGrave, setSelectedGrave] = useState<DeadPet | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const cemetery = JSON.parse(localStorage.getItem("kiki-cemetery") || "[]");
    setDeadPets(cemetery);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getLifespan = (adoptedAt: string, deathDate: string) => {
    const adopted = new Date(adoptedAt);
    const died = new Date(deathDate);
    const diffTime = Math.abs(died.getTime() - adopted.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const payRespects = (pet: DeadPet) => {
    // Add flower emoji animation or save respect count
    const respects = JSON.parse(localStorage.getItem("kiki-respects") || "{}");
    respects[pet.name] = (respects[pet.name] || 0) + 1;
    localStorage.setItem("kiki-respects", JSON.stringify(respects));
    setSelectedGrave(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted via-background to-secondary/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center space-x-2">
            <Skull className="w-6 h-6" />
            <h1 className="text-xl font-bold">Pet Cemetery</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {deadPets.length === 0 ? (
          <div className="text-center py-16 space-y-6">
            <div className="text-6xl opacity-50">🌱</div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">No Fallen Pets Yet</h2>
              <p className="text-muted-foreground">
                Your current pet is still alive! Keep completing tasks to maintain their happiness.
              </p>
            </div>
            <Button onClick={() => navigate("/home")} className="btn-kawaii">
              Return to Your Living Pet
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Hall of Fallen Companions</h2>
              <p className="text-muted-foreground">
                Remember those who perished due to your... productivity challenges.
              </p>
              <Badge variant="destructive" className="text-lg px-4 py-1">
                {deadPets.length} pets lost
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deadPets.map((pet, index) => (
                <Card 
                  key={index}
                  className="card-death cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedGrave(pet)}
                >
                  <div className="text-center space-y-4">
                    <div className="text-4xl">🪦</div>
                    
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white">{pet.name}</h3>
                      <p className="text-sm text-white/80 capitalize">{pet.type}</p>
                      
                      <div className="space-y-1 text-xs text-white/60">
                        <p>Born: {formatDate(pet.adoptedAt)}</p>
                        <p>Died: {formatDate(pet.deathDate)}</p>
                        <p>Lived: {getLifespan(pet.adoptedAt, pet.deathDate)} days</p>
                        <p>Best streak: {pet.streak} days</p>
                      </div>

                      <div className="bg-death-red/30 rounded p-2">
                        <p className="text-xs text-white/90 italic">
                          "{pet.deathReason}"
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="text-center py-8">
              <div className="bg-muted/50 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-sm italic text-muted-foreground">
                  "Each gravestone represents a failure... but also a lesson. 
                  Don't let their sacrifice be in vain."
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  - The Kiki Memorial Foundation
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gravestone Detail Modal */}
      {selectedGrave && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="card-death w-full max-w-md space-y-6">
            <div className="text-center space-y-4">
              <div className="text-6xl">🪦</div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">{selectedGrave.name}</h2>
                <p className="text-white/80 capitalize">{selectedGrave.type}</p>
                
                <div className="bg-death-red/30 rounded-lg p-4 text-white">
                  <p className="whitespace-pre-line text-sm">
                    {selectedGrave.gravestone}
                  </p>
                </div>

                <div className="text-sm text-white/60 space-y-1">
                  <p>Adopted: {formatDate(selectedGrave.adoptedAt)}</p>
                  <p>Passed: {formatDate(selectedGrave.deathDate)}</p>
                  <p>Lifespan: {getLifespan(selectedGrave.adoptedAt, selectedGrave.deathDate)} days</p>
                  <p>Best streak: {selectedGrave.streak} days</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => payRespects(selectedGrave)}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <Flower className="w-4 h-4 mr-2" />
                Pay Respects (F)
              </Button>
              
              <Button 
                onClick={() => setSelectedGrave(null)}
                variant="outline"
                className="w-full border-white/30 text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>

            <div className="text-center">
              <p className="text-xs text-white/50 italic">
                "Gone but not forgotten... until you forget to do your tasks again."
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Cemetery;