import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Coins, Crown, Shirt, Shield, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "outfits" | "accessories" | "insurance" | "premium";
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  owned?: boolean;
}

const shopItems: ShopItem[] = [
  // Outfits
  { id: "tuxedo", name: "Fancy Tuxedo", description: "For the sophisticated procrastinator", price: 50, category: "outfits", emoji: "🤵", rarity: "common" },
  { id: "superhero", name: "Superhero Cape", description: "+10 confidence when failing tasks", price: 75, category: "outfits", emoji: "🦸", rarity: "rare" },
  { id: "wizard", name: "Wizard Robes", description: "Magical productivity powers (not guaranteed)", price: 100, category: "outfits", emoji: "🧙", rarity: "epic" },
  { id: "ninja", name: "Ninja Outfit", description: "Sneak past your responsibilities", price: 150, category: "outfits", emoji: "🥷", rarity: "legendary" },

  // Accessories  
  { id: "crown", name: "Royal Crown", description: "For the procrastination royalty", price: 30, category: "accessories", emoji: "👑", rarity: "common" },
  { id: "glasses", name: "Smart Glasses", description: "Look smarter while being unproductive", price: 40, category: "accessories", emoji: "🤓", rarity: "common" },
  { id: "headphones", name: "Gaming Headset", description: "Better for ignoring responsibilities", price: 60, category: "accessories", emoji: "🎧", rarity: "rare" },
  { id: "chainsaw_necklace", name: "Tiny Chainsaw Necklace", description: "A reminder of what awaits...", price: 80, category: "accessories", emoji: "⛓️", rarity: "epic" },

  // Insurance & Premium
  { id: "insurance", name: "Pet Life Insurance", description: "Revive 1 pet per month", price: 200, category: "insurance", emoji: "🛡️", rarity: "legendary" },
  { id: "premium", name: "Kiki Premium", description: "No ads, extra pets, exclusive items", price: 500, category: "premium", emoji: "💎", rarity: "legendary" },
];

const Shop = () => {
  const [coins, setCoins] = useState(0);
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Load coins and owned items
    const savedCoins = localStorage.getItem("kiki-coins");
    const savedItems = localStorage.getItem("kiki-owned-items");
    
    setCoins(savedCoins ? parseInt(savedCoins) : 100); // Start with 100 coins
    setOwnedItems(savedItems ? JSON.parse(savedItems) : []);
  }, []);

  const saveCoins = (newCoins: number) => {
    setCoins(newCoins);
    localStorage.setItem("kiki-coins", newCoins.toString());
  };

  const saveOwnedItems = (items: string[]) => {
    setOwnedItems(items);
    localStorage.setItem("kiki-owned-items", JSON.stringify(items));
  };

  const purchaseItem = (item: ShopItem) => {
    if (ownedItems.includes(item.id)) {
      toast({
        title: "Already owned!",
        description: "You already have this item, silly!",
        variant: "destructive"
      });
      return;
    }

    if (coins < item.price) {
      toast({
        title: "Not enough coins!",
        description: "Complete more tasks to earn coins!",
        variant: "destructive"
      });
      return;
    }

    const newCoins = coins - item.price;
    const newOwnedItems = [...ownedItems, item.id];
    
    saveCoins(newCoins);
    saveOwnedItems(newOwnedItems);

    // Special handling for premium items
    if (item.id === "insurance") {
      localStorage.setItem("kiki-insurance", "true");
    }
    if (item.id === "premium") {
      localStorage.setItem("kiki-premium", "true");
    }

    toast({
      title: "Purchase successful! 🎉",
      description: `You bought ${item.name}! Kiki is looking stylish!`,
    });
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "bg-muted text-muted-foreground";
      case "rare": return "bg-primary text-primary-foreground";
      case "epic": return "bg-warning text-warning-foreground";
      case "legendary": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getItemsByCategory = (category: string) => {
    return shopItems.filter(item => item.category === category);
  };

  const earnCoinsForDemo = () => {
    const bonusCoins = 50;
    saveCoins(coins + bonusCoins);
    toast({
      title: "Bonus coins! 🪙",
      description: `Added ${bonusCoins} coins for testing!`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Kiki Shop</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge className="bg-warning text-warning-foreground px-3 py-1">
              <Coins className="w-4 h-4 mr-1" />
              {coins} coins
            </Badge>
            <Button size="sm" onClick={earnCoinsForDemo} className="btn-kawaii">
              +50 Demo Coins
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Dress Up Your Doomed Pet!</h2>
          <p className="text-muted-foreground">
            Make Kiki look fabulous before they inevitably meet their demise!
          </p>
        </div>

        <Tabs defaultValue="outfits" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="outfits" className="flex items-center space-x-2">
              <Shirt className="w-4 h-4" />
              <span>Outfits</span>
            </TabsTrigger>
            <TabsTrigger value="accessories" className="flex items-center space-x-2">
              <Crown className="w-4 h-4" />
              <span>Accessories</span>
            </TabsTrigger>
            <TabsTrigger value="insurance" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Insurance</span>
            </TabsTrigger>
            <TabsTrigger value="premium" className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4" />
              <span>Premium</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outfits">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getItemsByCategory("outfits").map((item) => (
                <Card key={item.id} className="card-kawaii space-y-4">
                  <div className="text-center space-y-2">
                    <div className="text-4xl">{item.emoji}</div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    
                    <div className="flex justify-center">
                      <Badge className={getRarityColor(item.rarity)}>
                        {item.rarity}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Coins className="w-4 h-4 text-warning" />
                      <span className="font-medium">{item.price}</span>
                    </div>
                    
                    <Button
                      onClick={() => purchaseItem(item)}
                      disabled={ownedItems.includes(item.id)}
                      className={ownedItems.includes(item.id) ? "btn-success" : "btn-kawaii"}
                      size="sm"
                    >
                      {ownedItems.includes(item.id) ? "Owned ✓" : "Buy"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="accessories">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getItemsByCategory("accessories").map((item) => (
                <Card key={item.id} className="card-kawaii space-y-4">
                  <div className="text-center space-y-2">
                    <div className="text-4xl">{item.emoji}</div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    
                    <div className="flex justify-center">
                      <Badge className={getRarityColor(item.rarity)}>
                        {item.rarity}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Coins className="w-4 h-4 text-warning" />
                      <span className="font-medium">{item.price}</span>
                    </div>
                    
                    <Button
                      onClick={() => purchaseItem(item)}
                      disabled={ownedItems.includes(item.id)}
                      className={ownedItems.includes(item.id) ? "btn-success" : "btn-kawaii"}
                      size="sm"
                    >
                      {ownedItems.includes(item.id) ? "Owned ✓" : "Buy"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="insurance">
            <div className="space-y-4">
              {getItemsByCategory("insurance").map((item) => (
                <Card key={item.id} className="card-kawaii">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl">{item.emoji}</div>
                      <div>
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <p className="text-muted-foreground">{item.description}</p>
                        <Badge className={getRarityColor(item.rarity)}>
                          {item.rarity}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div className="flex items-center space-x-1">
                        <Coins className="w-5 h-5 text-warning" />
                        <span className="font-bold text-lg">{item.price}</span>
                      </div>
                      
                      <Button
                        onClick={() => purchaseItem(item)}
                        disabled={ownedItems.includes(item.id)}
                        className={ownedItems.includes(item.id) ? "btn-success" : "btn-kawaii"}
                      >
                        {ownedItems.includes(item.id) ? "Active ✓" : "Purchase"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <p className="text-sm text-destructive-foreground">
                  <span className="font-bold">Warning:</span> Insurance only works once per month. 
                  Don't rely on it too much - Kiki deserves better than constant near-death experiences!
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="premium">
            <div className="space-y-4">
              {getItemsByCategory("premium").map((item) => (
                <Card key={item.id} className="card-kawaii">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl">{item.emoji}</div>
                      <div>
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <p className="text-muted-foreground">{item.description}</p>
                        <Badge className={getRarityColor(item.rarity)}>
                          {item.rarity}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div className="flex items-center space-x-1">
                        <Coins className="w-5 h-5 text-warning" />
                        <span className="font-bold text-lg">{item.price}</span>
                      </div>
                      
                      <Button
                        onClick={() => purchaseItem(item)}
                        disabled={ownedItems.includes(item.id)}
                        className={ownedItems.includes(item.id) ? "btn-success" : "btn-kawaii"}
                      >
                        {ownedItems.includes(item.id) ? "Premium ✓" : "Upgrade"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-2">
                <h4 className="font-bold">Premium Benefits:</h4>
                <ul className="text-sm space-y-1">
                  <li>• No ads during pet revival</li>
                  <li>• Access to exclusive pets and outfits</li>
                  <li>• Advanced task analytics</li>
                  <li>• Priority customer support (for your dying pets)</li>
                  <li>• Seasonal battle pass access</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-8 py-6">
          <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm italic text-muted-foreground">
              "Remember: No amount of fancy clothes can save Kiki from your procrastination. 
              But they'll look fabulous while dying!"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;