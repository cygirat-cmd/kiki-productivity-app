import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Lock, Clock, Trophy, Plus, Home as HomeIcon, FlaskConical, BarChart3, ShoppingBag, Cat, Dna, X } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { usePetStore } from '@/store';

interface Mutation {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  tier: number;
  purchased: boolean;
  repeatable?: boolean;
  maxPurchases?: number;
  currentPurchases?: number;
}

const mutations: Mutation[] = [
  // Tier 1 - Starter (1-2 DNA)
  {
    id: "coffee_break",
    name: "Coffee Break",
    icon: "☕",
    description: "+1 free pause per timer session",
    cost: 1,
    tier: 1,
    purchased: false
  },
  {
    id: "lenient_judge",
    name: "Lenient Judge",
    icon: "👓",
    description: "AI proof check is more tolerant",
    cost: 2,
    tier: 1,
    purchased: false
  },
  {
    id: "deadline_extension",
    name: "Deadline Extension",
    icon: "⏳",
    description: "90s (not 60s) to upload proof after Stop",
    cost: 2,
    tier: 1,
    purchased: false
  },

  // Tier 2 - Mid-game (3-5 DNA)
  {
    id: "hint_system",
    name: "Hint System",
    icon: "💡",
    description: "Shows helpful focus tips during sessions",
    cost: 3,
    tier: 2,
    purchased: false
  },
  {
    id: "family_heirloom",
    name: "Family Heirloom",
    icon: "📦",
    description: "One chosen mutation always passes to next Kiki",
    cost: 4,
    tier: 2,
    purchased: false
  },
  {
    id: "corporate_slack",
    name: "Corporate Slack",
    icon: "🔔",
    description: "Postpone task deadline by 1 day (once per day)",
    cost: 5,
    tier: 2,
    purchased: false
  },

  // Tier 3 - Advanced (6-8 DNA)
  {
    id: "ancestors_closet",
    name: "Ancestor's Closet",
    icon: "👕",
    description: "Cosmetics persist across deaths",
    cost: 6,
    tier: 3,
    purchased: false
  },
  {
    id: "nine_lives",
    name: "Nine Lives Contract",
    icon: "📜",
    description: "New Kiki inherits 2 random mutations instead of 1",
    cost: 7,
    tier: 3,
    purchased: false
  },
  {
    id: "second_opinion",
    name: "Second Opinion",
    icon: "🩺",
    description: "30% chance to re-check rejected proof",
    cost: 8,
    tier: 3,
    purchased: false
  },

  // Tier 4 - Legacy (9-12+ DNA)
  {
    id: "dynasty_memory",
    name: "Dynasty Memory",
    icon: "🌌",
    description: "Special family cosmetics as ancestry grows",
    cost: 9,
    tier: 4,
    purchased: false
  },
  {
    id: "golden_lineage",
    name: "The Golden Lineage",
    icon: "👑",
    description: "Choose 1 mutation to inherit each generation",
    cost: 10,
    tier: 4,
    purchased: false,
    repeatable: true,
    maxPurchases: 10,
    currentPurchases: 0
  },
  {
    id: "corporate_sponsorship",
    name: "Corporate Sponsorship",
    icon: "💼",
    description: "+1 DNA per week from HQ",
    cost: 12,
    tier: 4,
    purchased: false
  }
];

const Lab = () => {
  const [activeTab, setActiveTab] = useState<"mutations">("mutations");
  const { dna, spendDna } = usePetStore();
  const [mutationList, setMutationList] = useState<Mutation[]>(mutations);
  const [selectedMutation, setSelectedMutation] = useState<Mutation | null>(null);
  const [showDnaInfo, setShowDnaInfo] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load purchased mutations
    const savedMutations = localStorage.getItem("kiki-mutations");
    if (savedMutations) {
      const purchased = JSON.parse(savedMutations);
      const updatedMutations = mutations.map(mutation => ({
        ...mutation,
        purchased: purchased.includes(mutation.id),
        currentPurchases: mutation.repeatable ? 
          purchased.filter((p: string) => p === mutation.id).length : 0
      }));
      setMutationList(updatedMutations);
    }
  }, []);

  const purchaseMutation = (mutation: Mutation) => {
    if (dna < mutation.cost) {
      toast({
        title: "Not enough DNA",
        description: `Need ${mutation.cost} DNA, you have ${dna}`,
        variant: "destructive"
      });
      return;
    }

    if (mutation.purchased && !mutation.repeatable) {
      toast({
        title: "Already purchased",
        description: "This mutation is already active",
        variant: "destructive"
      });
      return;
    }

    if (mutation.repeatable && 
        mutation.maxPurchases && 
        (mutation.currentPurchases || 0) >= mutation.maxPurchases) {
      toast({
        title: "Maximum purchases reached",
        description: `Can only purchase ${mutation.maxPurchases} times`,
        variant: "destructive"
      });
      return;
    }

    // Update DNA count
    spendDna(mutation.cost);

    // Save purchase
    const savedMutations = JSON.parse(localStorage.getItem("kiki-mutations") || "[]");
    savedMutations.push(mutation.id);
    localStorage.setItem("kiki-mutations", JSON.stringify(savedMutations));

    // Update mutation list
    const updatedMutations = mutationList.map(m => {
      if (m.id === mutation.id) {
        return {
          ...m,
          purchased: true,
          currentPurchases: m.repeatable ? (m.currentPurchases || 0) + 1 : 1
        };
      }
      return m;
    });
    setMutationList(updatedMutations);

    toast({
      title: "Mutation purchased!",
      description: `${mutation.name} is now active`,
    });

    setSelectedMutation(null);
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1: return "bg-success/20 text-success-foreground border-success/30";
      case 2: return "bg-primary/20 text-primary-foreground border-primary/30";
      case 3: return "bg-accent/20 text-accent-foreground border-accent/30";
      case 4: return "bg-warning/20 text-warning-foreground border-warning/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const canPurchase = (mutation: Mutation) => {
    if (dna < mutation.cost) return false;
    if (mutation.purchased && !mutation.repeatable) return false;
    if (mutation.repeatable && 
        mutation.maxPurchases && 
        (mutation.currentPurchases || 0) >= mutation.maxPurchases) return false;
    return true;
  };

  const groupedMutations = mutationList.reduce((acc, mutation) => {
    const tier = `Tier ${mutation.tier}`;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(mutation);
    return acc;
  }, {} as Record<string, Mutation[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 pb-24">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b safe-top">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/kiki")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Lab</h1>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDnaInfo(true)}
            className="flex items-center space-x-1 h-auto p-2 hover:bg-primary/5"
          >
            <Dna className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{dna}</span>
          </Button>
        </div>

      </div>

      {/* Content */}
      <div className="p-4">
        <div className="space-y-6">
          {Object.entries(groupedMutations).map(([tierName, tierMutations]) => (
            <div key={tierName}>
              <h2 className="text-lg font-semibold mb-3 text-foreground">{tierName}</h2>
              <div className="space-y-3">
                {tierMutations.map((mutation) => (
                    <Card
                      key={mutation.id}
                      className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                        mutation.purchased ? "bg-green-50 border-green-200" : ""
                      } ${!canPurchase(mutation) && !mutation.purchased ? "opacity-60" : ""}`}
                      onClick={() => setSelectedMutation(mutation)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{mutation.icon}</div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm">{mutation.name}</h3>
                            {mutation.purchased && (
                              <Check className="w-4 h-4 text-success" />
                            )}
                            {!canPurchase(mutation) && !mutation.purchased && (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{mutation.description}</p>
                          <div className="flex items-center justify-between">
                            <Badge className={getTierColor(mutation.tier)}>
                              <div className="flex items-center gap-1">
                                <span>{mutation.cost}</span>
                                <Dna className="w-3 h-3" />
                              </div>
                            </Badge>
                            {mutation.repeatable && mutation.currentPurchases && (
                              <div className="text-xs text-muted-foreground">
                                {mutation.currentPurchases}/{mutation.maxPurchases}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Purchase Modal */}
      {selectedMutation && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
          onClick={() => setSelectedMutation(null)}
        >
          <Card 
            className="bg-card border-border rounded-2xl shadow-xl p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">{selectedMutation.name}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMutation(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-6xl mb-4">{selectedMutation.icon}</div>
              <p className="text-muted-foreground mb-4">{selectedMutation.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>Cost:</span>
                  <div className="flex items-center gap-1 font-medium">
                    <span>{selectedMutation.cost}</span>
                    <Dna className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Your DNA:</span>
                  <div className="flex items-center gap-1 font-medium">
                    <span>{dna}</span>
                    <Dna className="w-4 h-4 text-primary" />
                  </div>
                </div>
                {selectedMutation.repeatable && (
                  <div className="flex justify-between text-sm">
                    <span>Purchases:</span>
                    <span className="font-medium">
                      {selectedMutation.currentPurchases}/{selectedMutation.maxPurchases}
                    </span>
                  </div>
                )}
              </div>

              {selectedMutation.purchased && !selectedMutation.repeatable ? (
                <Badge className="bg-success/20 text-success-foreground">
                  Already Purchased
                </Badge>
              ) : (
                <Button
                  onClick={() => purchaseMutation(selectedMutation)}
                  disabled={!canPurchase(selectedMutation)}
                  className="w-full"
                >
                  {canPurchase(selectedMutation) ? (
                    selectedMutation.repeatable ? "Purchase Again" : "Purchase"
                  ) : (
                    "Not enough DNA"
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* DNA Info Modal */}
      {showDnaInfo && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
          onClick={() => setShowDnaInfo(false)}
        >
          <Card 
            className="bg-card border-border rounded-2xl shadow-xl p-6 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto">
                <Dna className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold">DNA Points</h3>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Keep your streak alive to unlock DNA rewards
                </p>
                <p className="text-sm text-muted-foreground">
                  Use DNA to evolve your Kiki with special abilities
                </p>
              </div>
              <Button 
                onClick={() => setShowDnaInfo(false)}
                className="w-full"
              >
                Got it
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/kiki")}>
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/board")}>
            <Clock className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/kiki")}>
            <Cat className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/shop")}>
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Lab;