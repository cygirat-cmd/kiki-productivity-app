import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Coins, Shirt, Shield, Sparkles, Home as HomeIcon, Clock, ShoppingBag, Cat } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { usePetStore } from "@/store";
import { useUserItemsStore } from "@/store/userItemsStore";
import { useGuestStore } from "@/store/guestStore";
import { useOwnedItems } from "@/hooks/useOwnedItems";
import { supabase } from "@/lib/supabaseClient";
import { ShopGrid } from "@/components/ShopGrid";
import { type NormalizedItem } from "@/lib/supaShop";

interface ShopItem {
  id: number; // Changed to number for consistency with Supabase
  name: string;
  description: string;
  price: number;
  category: "lootboxes" | "insurance" | "premium" | "tokens";
  emoji: string;
  rarity?: "common" | "rare" | "epic" | "legendary";
  owned?: boolean;
}

interface LootBoxItem {
  id: number; // Changed to number for consistency
  name: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  type: "outfit" | "accessory" | "boost" | "currency" | "cosmetic";
  slot?: number; // For cosmetic items
}

// Legacy loot box items for animation fallback
const lootBoxPools: LootBoxItem[] = [
  // Legacy Outfits & Accessories
  { id: 1001, name: "Fancy Tuxedo", emoji: "🤵", rarity: "common", type: "outfit" },
  { id: 1002, name: "Superhero Cape", emoji: "🦸", rarity: "rare", type: "outfit" },
  { id: 1003, name: "Wizard Robes", emoji: "🧙", rarity: "epic", type: "outfit" },
  { id: 1004, name: "Ninja Outfit", emoji: "🥷", rarity: "legendary", type: "outfit" },
  { id: 1005, name: "Smart Glasses", emoji: "🤓", rarity: "common", type: "accessory" },
  { id: 1006, name: "Gaming Headset", emoji: "🎧", rarity: "rare", type: "accessory" },
  
  // Boosts & Currency
  { id: 1007, name: "Extra Pause Token", emoji: "⏸️", rarity: "epic", type: "boost" },
  { id: 1008, name: "100 Coins", emoji: "🪙", rarity: "common", type: "currency" },
  { id: 1009, name: "250 Coins", emoji: "💰", rarity: "rare", type: "currency" },
  { id: 1010, name: "500 Coins", emoji: "💎", rarity: "epic", type: "currency" },
];

const shopItems: ShopItem[] = [
  // Loot Boxes
  { id: 2001, name: "Ad Loot Box", description: "Free box for watching 30s ad - basic rewards only", price: 0, category: "lootboxes", emoji: "📺" },
  { id: 2002, name: "Basic Loot Box", description: "Common items, small chance for rare", price: 100, category: "lootboxes", emoji: "📦" },
  { id: 2003, name: "Premium Loot Box", description: "Higher chance for rare & epic items", price: 300, category: "lootboxes", emoji: "🎁" },
  { id: 2004, name: "Legendary Loot Box", description: "Guaranteed epic or legendary item", price: 750, category: "lootboxes", emoji: "💝" },
  
  // Tokens & Utility
  { id: 2005, name: "5x Pause Tokens", description: "Extra pauses for future tasks", price: 200, category: "tokens", emoji: "⏸️" },
  
  // Insurance & Premium
  { id: 2006, name: "Life Insurance", description: "Revive 1 companion per month", price: 800, category: "insurance", emoji: "🛡️", rarity: "legendary" },
  { id: 2007, name: "Kiki Premium", description: "No ads, extra loot boxes, exclusive items", price: 2000, category: "premium", emoji: "💎", rarity: "legendary" },
];

const Shop = () => {
  const { pet, coins, setCoins, addCoins, pauseTokens, setPauseTokens, equippedItems, equipItem } = usePetStore();
  const [showLootBox, setShowLootBox] = useState<{open: boolean, item: LootBoxItem | null}>({open: false, item: null});
  const [boxAnimation, setBoxAnimation] = useState<{active: boolean, items: LootBoxItem[], finalItem: LootBoxItem | null, currentIndex: number}>({
    active: false, 
    items: [], 
    finalItem: null, 
    currentIndex: 0
  });
  const [lastAdBoxTime, setLastAdBoxTime] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Use unified store system instead of legacy localStorage
  const { ownedSet, isAuthenticated } = useOwnedItems();
  const { isAuthenticated: storeAuth, purchaseItem: purchaseUserItem } = useUserItemsStore();
  const { 
    addProvisionalItem,
    addProvisionalReceipt,
    checkProvisionalOwnership 
  } = useGuestStore();

  useEffect(() => {
    // Check if pet exists - redirect to onboarding if not
    if (!pet) {
      navigate('/onboarding');
      return;
    }

    // Check for active timer first - redirect to timer if found
    const activeTimer = localStorage.getItem("kiki-active-timer");
    if (activeTimer) {
      const timer = JSON.parse(activeTimer);
      const now = Date.now();
      const timeSinceStart = (now - timer.startTime) / 1000;
      
      // If timer is still valid and running, redirect to timer
      if (timer.isRunning && timeSinceStart <= timer.duration * 60) {
        navigate("/quick-task");
        return;
      }
    }

    // Load last ad box time (keep this for ad cooldown)
    const savedAdTime = localStorage.getItem("kiki-last-ad-box");
    setLastAdBoxTime(savedAdTime ? parseInt(savedAdTime) : 0);
  }, [pet, navigate]);

  // Helper function to check if item is owned using unified system
  const isItemOwned = (itemId: number) => {
    return isAuthenticated ? ownedSet.has(itemId) : checkProvisionalOwnership(itemId);
  };

  const getLootBoxDropRates = (boxId: number) => {
    switch (boxId) {
      case 2001: // ad_box
        return { common: 90, rare: 10, epic: 0, legendary: 0 }; // Very basic rewards
      case 2002: // basic_box
        return { common: 70, rare: 25, epic: 4, legendary: 1 };
      case 2003: // premium_box
        return { common: 40, rare: 40, epic: 15, legendary: 5 };
      case 2004: // legendary_box
        return { common: 0, rare: 0, epic: 60, legendary: 40 };
      default:
        return { common: 100, rare: 0, epic: 0, legendary: 0 };
    }
  };

  const openSupabaseCrate = async (crateId: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('sign-roll', {
        body: { crateId }
      });

      if (error) throw error;

      // Get the item details for animation
      const { data: itemData } = await supabase
        .from('items')
        .select(`
          id, name, slot, rarity,
          item_assets!inner(thumb)
        `)
        .eq('id', data.itemId)
        .single();

      if (!itemData) throw new Error('Failed to fetch item details');

      // Convert to LootBoxItem format for animation
      const lootBoxItem: LootBoxItem = {
        id: itemData.id,
        name: itemData.name,
        emoji: "💇", // Default emoji for now
        rarity: itemData.rarity as "common" | "rare" | "epic" | "legendary",
        type: "cosmetic",
        slot: itemData.slot
      };

      // Add to provisional state
      if (isAuthenticated) {
        await purchaseUserItem(data.itemId, 'crate');
      } else {
        addProvisionalItem(data.itemId);
        addProvisionalReceipt('crate', data.token);
      }

      // Start animation
      startBoxAnimation(lootBoxItem);

    } catch (error) {
      toast({
        title: "Failed to open crate",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const openLootBox = (boxId: number) => {
    // Map shop box IDs to Supabase crate IDs
    const crateIdMap: Record<number, number> = {
      2002: 1, // basic_box
      2003: 2, // premium_box 
      2004: 3, // legendary_box
      2001: 4  // ad_box - Special ad crate
    };

    const crateId = crateIdMap[boxId];
    if (crateId) {
      openSupabaseCrate(crateId);
      return;
    }

    // Fallback to legacy system for unknown box types
    const dropRates = getLootBoxDropRates(boxId);
    const rand = Math.random() * 100;
    
    let selectedRarity: "common" | "rare" | "epic" | "legendary" = "common";
    if (rand <= dropRates.legendary) selectedRarity = "legendary";
    else if (rand <= dropRates.legendary + dropRates.epic) selectedRarity = "epic";
    else if (rand <= dropRates.legendary + dropRates.epic + dropRates.rare) selectedRarity = "rare";
    
    const availableItems = lootBoxPools.filter(item => 
      item.rarity === selectedRarity && !isItemOwned(item.id)
    );
    
    let finalItem: LootBoxItem;
    
    if (availableItems.length === 0) {
      // Fallback to coins if no items available
      let coinAmount;
      if (boxId === 2001) { // ad_box
        coinAmount = selectedRarity === "rare" ? 25 : 15;
      } else {
        coinAmount = selectedRarity === "legendary" ? 400 : 
                    selectedRarity === "epic" ? 200 : 
                    selectedRarity === "rare" ? 100 : 50;
      }
      setCoins(coins + coinAmount);
      finalItem = {
        id: 9999, // Special fallback ID
        name: `${coinAmount} Coins`, 
        emoji: "🪙", 
        rarity: selectedRarity, 
        type: "currency"
      };
    } else {
      finalItem = availableItems[Math.floor(Math.random() * availableItems.length)];
      
      // Handle different item types
      if (finalItem.type === "currency") {
        const amount = finalItem.id === 1008 ? 100 : // coins_small
                      finalItem.id === 1009 ? 250 :   // coins_medium 
                      500;                             // coins_large
        setCoins(coins + amount);
      } else if (finalItem.type === "boost") {
        if (finalItem.id === 1007) { // pause_token
          setPauseTokens(pauseTokens + 1);
        }
      } else {
        // Add cosmetic and other items using unified system
        if (isAuthenticated) {
          // This should use purchaseUserItem but for fallback items it's complex
          // For now just add to guest store - this is legacy fallback anyway
          addProvisionalItem(finalItem.id);
        } else {
          addProvisionalItem(finalItem.id);
        }
      }
    }
    
    // Start CS:GO style animation
    startBoxAnimation(finalItem);
  };

  const startBoxAnimation = (finalItem: LootBoxItem) => {
    // Generate animation sequence - final item will be at center (index 15)
    const animationItems: LootBoxItem[] = [];
    
    // Add random items before final item  
    for (let i = 0; i < 15; i++) {
      const randomItem = lootBoxPools[Math.floor(Math.random() * lootBoxPools.length)];
      animationItems.push(randomItem);
    }
    
    // Add the final winning item at center position
    animationItems.push(finalItem);
    
    // Add random items after final item
    for (let i = 0; i < 14; i++) {
      const randomItem = lootBoxPools[Math.floor(Math.random() * lootBoxPools.length)];
      animationItems.push(randomItem);
    }
    
    setBoxAnimation({
      active: true,
      items: animationItems,
      finalItem,
      currentIndex: 0
    });

    // Optimized animation using requestAnimationFrame
    let startTime: number | null = null;
    const duration = 6000;
    const centerPosition = 15; // Final item is at index 15
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress >= 1) {
        // Ensure we land exactly on the winning item (index 15)
        setBoxAnimation(prev => ({ ...prev, currentIndex: 15 }));
        setTimeout(() => {
          setBoxAnimation(prev => ({ ...prev, active: false }));
          setShowLootBox({open: true, item: finalItem});
        }, 500); // Give more time to see the final result
        return;
      }
      
      // Smooth easing with precise landing at position 15
      const eased = 1 - Math.pow(1 - progress, 4);
      const position = eased * 15; // Always animate to position 15 where our final item is
      
      setBoxAnimation(prev => ({ ...prev, currentIndex: position }));
      
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  };

  const canOpenAdBox = () => {
    const now = Date.now();
    const hoursSinceLastAd = (now - lastAdBoxTime) / (1000 * 60 * 60);
    return hoursSinceLastAd >= 4; // 4 hours cooldown
  };

  const getAdBoxCooldownText = () => {
    const now = Date.now();
    const hoursSinceLastAd = (now - lastAdBoxTime) / (1000 * 60 * 60);
    const hoursRemaining = Math.ceil(4 - hoursSinceLastAd);
    
    if (hoursRemaining <= 0) return "Available now!";
    return `${hoursRemaining}h remaining`;
  };

  const watchAdForBox = () => {
    if (!canOpenAdBox()) {
      toast({
        title: "Ad box on cooldown!",
        description: `Please wait ${getAdBoxCooldownText()}`,
        variant: "destructive"
      });
      return;
    }

    // Simulate watching a 30-second ad
    toast({
      title: "Loading ad...",
      description: "Please wait 3 seconds (simulated ad)",
    });

    setTimeout(() => {
      const now = Date.now();
      setLastAdBoxTime(now);
      localStorage.setItem("kiki-last-ad-box", now.toString());
      
      openLootBox(2001); // ad_box ID
      
      toast({
        title: "Thanks for watching!",
        description: "Opening your free ad box...",
      });
    }, 3000);
  };

  const handleItemPurchase = async (item: NormalizedItem) => {
    if (coins < item.price) {
      toast({
        title: "Not enough coins!",
        description: "Complete more tasks to earn coins!",
        variant: "destructive"
      });
      return;
    }

    try {
      if (isAuthenticated) {
        // Use unified purchase system for authenticated users
        await purchaseUserItem(item.id, 'shop');
      } else {
        // Guest purchase
        addProvisionalItem(item.id);
        addProvisionalReceipt('purchase', `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      }

      // Deduct coins
      setCoins(coins - item.price);

      toast({
        title: "Item purchased! 🎉",
        description: `You bought ${item.name}!`,
      });
    } catch (error) {
      toast({
        title: "Purchase failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const purchaseItem = useCallback((item: ShopItem) => {
    // Handle ad box separately
    if (item.id === 2001) { // ad_box
      watchAdForBox();
      return;
    }

    if (item.category !== "lootboxes" && isItemOwned(item.id)) {
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

    setCoins(coins - item.price);

    // Handle different item types
    if (item.category === "lootboxes") {
      openLootBox(item.id);
    } else if (item.category === "tokens") {
      if (item.id === 2005) { // pause_tokens
        setPauseTokens(pauseTokens + 5);
        toast({
          title: "Tokens purchased! 🎉",
          description: "You now have 5 extra pause tokens!",
        });
      }
    } else {
      // Regular items - use unified system
      try {
        if (isAuthenticated) {
          // For non-item purchases like insurance/premium, we just mark as owned locally
          // These don't go through the item system
          addProvisionalItem(item.id); // Add to provisional for now
        } else {
          addProvisionalItem(item.id);
        }

        // Special handling for premium items
        if (item.id === 2006) { // insurance
          localStorage.setItem("kiki-insurance", "true");
        }
        if (item.id === 2007) { // premium
          localStorage.setItem("kiki-premium", "true");
        }

        toast({
          title: "Purchase successful! 🎉",
          description: `You bought ${item.name}!`,
        });
      } catch (error) {
        toast({
          title: "Purchase failed",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive"
        });
      }
    }
  }, [coins, isItemOwned, pauseTokens, toast, isAuthenticated, addProvisionalItem, setCoins, setPauseTokens]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "bg-muted text-muted-foreground";
      case "rare": return "bg-primary text-primary-foreground";
      case "epic": return "bg-warning text-warning-foreground";
      case "legendary": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getItemsByCategory = useCallback((category: string) => {
    const filtered = shopItems.filter(item => item.category === category);
    return filtered.length > 0 ? filtered : [];
  }, []);

  const earnCoinsForDemo = useCallback(() => {
    const bonusCoins = 50;
    addCoins(bonusCoins);
    toast({
      title: "Bonus coins! 🪙",
      description: `Added ${bonusCoins} coins for testing!`,
    });
  }, [addCoins, toast]);

  // Don't render if no pet exists
  if (!pet) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex flex-col">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          {/* Mobile-first responsive header */}
          <div className="flex items-center justify-between mb-4 sm:mb-0">
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Kiki Shop</h1>
            </div>
          </div>
          
          {/* Mobile-optimized stats row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge className="bg-warning text-warning-foreground px-2 py-1 text-xs sm:px-3 sm:text-sm">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                {coins}
              </Badge>
              <Badge className="bg-primary text-primary-foreground px-2 py-1 text-xs sm:px-3 sm:text-sm">
                ⏸️ {pauseTokens}
              </Badge>
            </div>
            <Button size="sm" onClick={earnCoinsForDemo} className="btn-kawaii text-xs sm:text-sm">
              +50 Demo
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-3 sm:p-4 pb-6">
        <div className="text-center mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Gamble for Kiki's Style!</h2>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Open loot boxes to get random items - because RNG is fun when it's not your life on the line!
          </p>
        </div>

        <Tabs defaultValue="items" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 gap-1 h-auto">
            <TabsTrigger value="items" className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm p-2 sm:p-3">
              <Shirt className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Items</span>
              <span className="sm:hidden">👕</span>
            </TabsTrigger>
            <TabsTrigger value="lootboxes" className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm p-2 sm:p-3">
              <span>📦</span>
              <span className="hidden sm:inline">Loot Boxes</span>
              <span className="sm:hidden">Boxes</span>
            </TabsTrigger>
            <TabsTrigger value="tokens" className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm p-2 sm:p-3">
              <span>⏸️</span>
              <span>Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="insurance" className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm p-2 sm:p-3">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Insurance</span>
              <span className="sm:hidden">🛡️</span>
            </TabsTrigger>
            <TabsTrigger value="premium" className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm p-2 sm:p-3">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Premium</span>
              <span className="sm:hidden">💎</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Direct Purchase Items</h3>
                <p className="text-sm text-muted-foreground">
                  Buy items directly with your coins - no gambling required!
                </p>
              </div>
              
              <ShopGrid 
                onItemSelect={handleItemPurchase}
                showFilters={true}
                className="mb-8"
              />
            </div>
          </TabsContent>

          <TabsContent value="lootboxes">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
              {getItemsByCategory("lootboxes").map((item) => {
                const isAdBox = item.id === 2001; // ad_box
                const canOpen = isAdBox ? canOpenAdBox() : coins >= item.price;
                const isDisabled = isAdBox ? !canOpenAdBox() : coins < item.price;
                
                return (
                  <Card 
                    key={item.id} 
                    className={`relative overflow-hidden cursor-pointer group ${
                      isDisabled ? "opacity-60" : "hover:shadow-lg active:scale-[0.98] transition-all duration-150"
                    } ${
                      item.id === 2001 ? "border-green-400 bg-green-50" : // ad_box
                      item.id === 2002 ? "border-gray-400 bg-gray-50" :   // basic_box
                      item.id === 2003 ? "border-blue-400 bg-blue-50" :   // premium_box
                      "border-yellow-400 bg-yellow-50"                     // legendary_box
                    }`}
                    onClick={() => !isDisabled && purchaseItem(item)}
                  >
                    {/* Rarity Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className={`text-xs ${
                        item.id === 2001 ? "bg-green-500 text-white" :  // ad_box
                        item.id === 2002 ? "bg-gray-500 text-white" :   // basic_box
                        item.id === 2003 ? "bg-blue-500 text-white" :   // premium_box
                        "bg-yellow-500 text-white"                       // legendary_box
                      }`}>
                        {item.id === 2001 ? "FREE" :      // ad_box
                         item.id === 2002 ? "BASIC" :     // basic_box
                         item.id === 2003 ? "PREMIUM" :   // premium_box
                         "LEGENDARY"}                       // legendary_box
                      </Badge>
                    </div>

                    {/* Simple shine effect only for legendary */}
                    {item.id === 2004 && ( // legendary_box
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-2 right-2 w-1 h-1 bg-yellow-400 rounded-full opacity-80"></div>
                        <div className="absolute bottom-3 left-3 w-0.5 h-0.5 bg-yellow-300 rounded-full opacity-60"></div>
                      </div>
                    )}

                    <div className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 relative z-10">
                      {/* Box Icon */}
                      <div className="text-center">
                        <div className={`text-4xl sm:text-5xl lg:text-6xl mb-2 ${
                          isDisabled ? "" : "group-hover:scale-105 transition-transform duration-150"
                        }`}>
                          {item.emoji}
                        </div>
                        <h3 className="font-bold text-sm sm:text-base lg:text-lg mb-1">{item.name}</h3>
                        <p className="text-xs text-muted-foreground leading-tight">{item.description}</p>
                      </div>

                      {/* Drop Rates */}
                      <div className="bg-white/50 rounded-lg p-2 sm:p-3 space-y-1">
                        <div className="text-xs font-medium text-center mb-1 sm:mb-2">Drop Rates:</div>
                        {item.id === 2001 && ( // ad_box
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Common</span>
                              <span className="font-medium">90%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Rare</span>
                              <span className="font-medium text-blue-600">10%</span>
                            </div>
                          </div>
                        )}
                        {item.id === 2002 && ( // basic_box
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Common</span>
                              <span className="font-medium">70%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Rare</span>
                              <span className="font-medium text-blue-600">25%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Epic</span>
                              <span className="font-medium text-purple-600">4%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Legendary</span>
                              <span className="font-medium text-yellow-600">1%</span>
                            </div>
                          </div>
                        )}
                        {item.id === 2003 && ( // premium_box
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Common</span>
                              <span className="font-medium">40%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Rare</span>
                              <span className="font-medium text-blue-600">40%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Epic</span>
                              <span className="font-medium text-purple-600">15%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Legendary</span>
                              <span className="font-medium text-yellow-600">5%</span>
                            </div>
                          </div>
                        )}
                        {item.id === 2004 && ( // legendary_box
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Epic</span>
                              <span className="font-medium text-purple-600">60%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span>Legendary</span>
                              <span className="font-medium text-yellow-600">40%</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Price/Status */}
                      <div className="text-center">
                        {isAdBox ? (
                          <div className="space-y-2">
                            <div className={`text-lg font-bold ${
                              canOpenAdBox() ? "text-green-600" : "text-orange-600"
                            }`}>
                              {canOpenAdBox() ? "📺 FREE" : `⏰ ${getAdBoxCooldownText()}`}
                            </div>
                            <Button
                              className={`w-full ${
                                canOpenAdBox() 
                                  ? "bg-green-500 hover:bg-green-600 text-white" 
                                  : "bg-gray-400 cursor-not-allowed"
                              }`}
                              disabled={!canOpenAdBox()}
                            >
                              {canOpenAdBox() ? "Watch Ad" : "On Cooldown"}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center space-x-2">
                              <Coins className="w-5 h-5 text-yellow-500" />
                              <span className="text-xl font-bold">{item.price}</span>
                            </div>
                            <Button
                              className={`w-full ${
                                canOpen 
                                  ? "btn-kawaii" 
                                  : "bg-gray-400 cursor-not-allowed text-gray-600"
                              }`}
                              disabled={!canOpen}
                            >
                              {canOpen ? "Open Box!" : "Not Enough Coins"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="tokens">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {getItemsByCategory("tokens").map((item) => (
                <Card key={item.id} className="card-kawaii space-y-3 sm:space-y-4 p-4">
                  <div className="text-center space-y-2">
                    <div className="text-3xl sm:text-4xl">{item.emoji}</div>
                    <h3 className="font-semibold text-sm sm:text-base">{item.name}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{item.description}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Coins className="w-4 h-4 text-warning" />
                      <span className="font-medium text-sm sm:text-base">{item.price}</span>
                    </div>
                    
                    <Button
                      onClick={() => purchaseItem(item)}
                      className="btn-kawaii text-xs sm:text-sm"
                      size="sm"
                    >
                      Buy
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="insurance">
            <div className="space-y-3 sm:space-y-4">
              {getItemsByCategory("insurance").map((item) => (
                <Card key={item.id} className="card-kawaii p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1">
                      <div className="text-2xl sm:text-3xl">{item.emoji}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base sm:text-lg">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        <Badge className={`${getRarityColor(item.rarity)} text-xs mt-1`}>
                          {item.rarity}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-2 w-full sm:w-auto">
                      <div className="flex items-center space-x-1">
                        <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                        <span className="font-bold text-base sm:text-lg">{item.price}</span>
                      </div>
                      
                      <Button
                        onClick={() => purchaseItem(item)}
                        disabled={isItemOwned(item.id)}
                        className={`${isItemOwned(item.id) ? "btn-success" : "btn-kawaii"} text-xs sm:text-sm`}
                        size="sm"
                      >
                        {isItemOwned(item.id) ? "Active ✓" : "Purchase"}
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
            <div className="space-y-3 sm:space-y-4">
              {getItemsByCategory("premium").map((item) => (
                <Card key={item.id} className="card-kawaii p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 flex-1">
                      <div className="text-2xl sm:text-3xl">{item.emoji}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-base sm:text-lg">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                        <Badge className={`${getRarityColor(item.rarity)} text-xs mt-1`}>
                          {item.rarity}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-2 w-full sm:w-auto">
                      <div className="flex items-center space-x-1">
                        <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                        <span className="font-bold text-base sm:text-lg">{item.price}</span>
                      </div>
                      
                      <Button
                        onClick={() => purchaseItem(item)}
                        disabled={isItemOwned(item.id)}
                        className={`${isItemOwned(item.id) ? "btn-success" : "btn-kawaii"} text-xs sm:text-sm`}
                        size="sm"
                      >
                        {isItemOwned(item.id) ? "Premium ✓" : "Upgrade"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 sm:p-4 space-y-2">
                <h4 className="font-bold text-sm sm:text-base">Premium Benefits:</h4>
                <ul className="text-xs sm:text-sm space-y-1">
                  <li>• No ads during companion revival</li>
                  <li>• Access to exclusive companions and outfits</li>
                  <li>• Advanced task analytics</li>
                  <li>• Priority customer support (for your dying companions)</li>
                  <li>• Seasonal battle pass access</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-center mt-6 sm:mt-8 py-4 sm:py-6 mb-12">
          <div className="bg-muted/50 rounded-lg p-3 sm:p-4 max-w-sm sm:max-w-md mx-auto">
            <p className="text-xs sm:text-sm italic text-muted-foreground">
              "Remember: No amount of loot box items can save Kiki from your procrastination. 
              But the gambling addiction might distract you from actually doing tasks!"
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* CS:GO Style Box Animation */}
      {boxAnimation.active && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="w-full max-w-4xl">
            <div className="text-center mb-4 sm:mb-8">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">Opening Loot Box...</h2>
              <p className="text-white/70 text-sm sm:text-base">🎰 Rolling for your prize! 🎰</p>
            </div>
            
            {/* Roulette Container */}
            <div className="relative bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-3 sm:p-4 lg:p-6 overflow-hidden">
              {/* Selection Indicator */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
                <div className="w-1 h-12 sm:h-16 lg:h-20 bg-yellow-400 rounded-full shadow-lg"></div>
                <div className="w-0 h-0 border-l-2 border-r-2 border-t-4 sm:border-l-4 sm:border-r-4 sm:border-t-8 border-transparent border-t-yellow-400 mx-auto"></div>
              </div>
              
              {/* Items Roulette */}
              <div className="flex" 
                   style={{
                     transform: `translateX(calc(50% - ${boxAnimation.currentIndex * 72}px - 36px))`, // 72px per item, 36px to center
                     transition: boxAnimation.currentIndex >= 15 ? 'transform 0.3s ease-out' : 'none'
                   }}>
                {boxAnimation.items.map((item, index) => (
                  <div 
                    key={`${item.id}-${index}`}
                    className={`flex-shrink-0 w-16 h-20 sm:w-20 sm:h-24 lg:w-28 lg:h-32 mx-1 rounded-lg border-2 flex flex-col items-center justify-center text-center ${
                      item.rarity === "legendary" ? "border-yellow-400 bg-yellow-400/20" :
                      item.rarity === "epic" ? "border-purple-400 bg-purple-400/20" :
                      item.rarity === "rare" ? "border-blue-400 bg-blue-400/20" :
                      "border-gray-400 bg-gray-400/20"
                    }`}
                  >
                    <div className="text-lg sm:text-xl lg:text-2xl mb-1">{item.emoji}</div>
                    <Badge className={`text-xs mt-1 ${getRarityColor(item.rarity)} hidden sm:block`}>
                      {item.rarity.substring(0, 3)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="text-center mt-4 sm:mt-6">
              <p className="text-white/60 text-xs sm:text-sm">
                "The suspense is killing me... and possibly Kiki too!" 😰
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loot Box Result Modal */}
      {showLootBox.open && showLootBox.item && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4">
          <Card className="card-kawaii w-full max-w-sm sm:max-w-md space-y-4 sm:space-y-6 text-center p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold">🎉 Box Opened! 🎉</h2>
              
              <div className="relative">
                <div className={`text-4xl sm:text-5xl lg:text-6xl animate-bounce ${
                  showLootBox.item.rarity === "legendary" ? "animate-pulse" : ""
                }`}>
                  {showLootBox.item.emoji}
                </div>
                
                <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2">
                  <Badge className={`${getRarityColor(showLootBox.item.rarity)} text-xs`}>
                    {showLootBox.item.rarity}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-1 sm:space-y-2">
                <p className="text-xs sm:text-sm text-muted-foreground capitalize">
                  {showLootBox.item.type} • {showLootBox.item.rarity} rarity
                </p>
              </div>

              {showLootBox.item.rarity === "legendary" && (
                <div className="bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-lg p-2 sm:p-3">
                  <p className="text-xs sm:text-sm font-bold text-yellow-600">
                    ✨ LEGENDARY DROP! ✨
                  </p>
                </div>
              )}
            </div>

            <Button 
              onClick={() => setShowLootBox({open: false, item: null})} 
              className="btn-kawaii w-full text-sm sm:text-base"
            >
              Awesome! 🎊
            </Button>
          </Card>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/home")}>
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/board")}>
            <Clock className="w-6 h-6" />
          </Button>
          <Button variant="ghost" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/kiki")}>
            <Cat className="w-6 h-6" />
          </Button>
          <Button variant="default" className="flex-1 flex justify-center items-center py-2 h-auto" onClick={() => navigate("/shop")}>
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Shop;