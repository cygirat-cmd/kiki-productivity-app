import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FlaskConical, TreePine, BarChart3, Cat, Clock, ShoppingBag, Home as HomeIcon, ChevronRight, Crown, Sparkles, Star, X, Plus, Dna } from 'lucide-react';
import AnimatedKiki from '@/components/AnimatedKiki';
import { usePetStore } from '@/store';
import { useUserItemsStore } from '@/store/userItemsStore';
import { useGuestStore } from '@/store/guestStore';
import { useShopItems } from '@/hooks/useShopItems';
import { useEquippedSync } from '@/hooks/useEquippedSync';
import { ITEM_REGISTRY, getItemsBySlot } from '@/lib/itemRegistry';
import { type NormalizedItem } from '@/lib/supaShop';

// Socket types
const SOCKET_TYPES = {
  1: { name: 'Head', label: 'Head slot' },
  2: { name: 'Face', label: 'Face slot' },
  3: { name: 'Body', label: 'Body slot' },
  4: { name: 'Back', label: 'Back slot' }
};

type InventoryType = 'hats' | 'masks' | 'clothes' | 'backpacks' | null;

const Kiki = () => {
  const navigate = useNavigate();
  const { pet, equippedItems, equipItem, removeItem, dna } = usePetStore();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // Changed to string for slot names
  const [activeInventory, setActiveInventory] = useState<InventoryType>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showDnaInfo, setShowDnaInfo] = useState(false);
  
  // New Supabase system
  const { 
    isAuthenticated, 
    checkOwnership, 
    equipItem: equipSupabaseItem,
    equipped: supabaseEquipped 
  } = useUserItemsStore();
  
  const { 
    checkProvisionalOwnership,
    equipProvisionalItem,
    equippedLocal: guestEquipped 
  } = useGuestStore();
  
  // Load owned items from Supabase
  const { items: ownedItems } = useShopItems({ 
    limit: 100, 
    page: 1, 
    search: '',
    owned: true // This filter would need to be added to useShopItems
  });
  
  // Sync Supabase equipped items with legacy petStore
  useEquippedSync();

  if (!pet) {
    navigate('/onboarding');
    return null;
  }

  const handleSlotClick = (slotNumber: number) => {
    // Redirect to closet for item management with new Supabase system
    navigate('/closet');
  };

  const handleInventoryOpen = (inventoryType: InventoryType) => {
    // Redirect to closet for item management
    navigate('/closet');
  };

  const handleInventoryClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setActiveInventory(null);
      setIsClosing(false);
    }, 300);
  };

  const handleEquipItem = async (item: NormalizedItem) => {
    if (!selectedSlot) return;
    
    try {
      if (isAuthenticated) {
        await equipSupabaseItem(selectedSlot as any, item.id);
      } else {
        equipProvisionalItem(selectedSlot as any, item.id);
      }
    } catch (error) {
      console.error('Failed to equip item:', error);
    }
  };

  const handleRemoveItem = () => {
    if (selectedSlot === null) return;
    removeItem(selectedSlot);
    handleCloseModal();
  };

  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedSlot(null);
      setIsClosing(false);
    }, 300);
  };

  const handleEquipAndClose = (item: typeof COSMETIC_ITEMS[0]) => {
    handleEquipItem(item);
    handleCloseModal();
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-gray-500';
      case 'rare': return 'bg-blue-500';
      case 'epic': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4 safe-top">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="w-10 h-10"></div>
          <div className="text-center">
            <h1 className="text-xl font-bold">{pet.name}</h1>
            <p className="text-sm text-muted-foreground">
              {(() => {
                const ageMs = Date.now() - new Date(pet.adoptedAt).getTime();
                const minutes = Math.floor(ageMs / (1000 * 60));
                const hours = Math.floor(ageMs / (1000 * 60 * 60));
                const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
                
                if (days >= 1) {
                  return `${days} days old`;
                } else if (hours >= 1) {
                  return `${hours} hours old`;
                } else {
                  return `${Math.max(1, minutes)} minutes old`;
                }
              })()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              console.log('DNA button clicked in Kiki');
              setShowDnaInfo(true);
            }}
            className="flex items-center space-x-1 h-auto p-2 hover:bg-primary/5"
          >
            <Dna className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{dna}</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4 pb-20 h-[calc(100vh-140px)] flex flex-col">
        {/* Kiki Section */}
        <div className="relative flex items-center justify-center h-48 mb-4">
          {/* Cosmetic Slots - Right Side */}
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-10">
            {[1, 2, 3, 4].map((slot) => {
              const equippedItem = equippedItems[slot];
              const itemDef = equippedItem ? ITEM_REGISTRY.find(item => item.id === equippedItem.id) : null;
              
              return (
                <div
                  key={slot}
                  className="w-12 h-12 sm:w-10 sm:h-10 rounded-full border-2 border-dashed border-border bg-muted/50 flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-primary/10 hover:border-primary active:scale-95"
                  title={`${SOCKET_TYPES[slot as keyof typeof SOCKET_TYPES].name} slot`}
                  onClick={() => handleSlotClick(slot)}
                >
                  {equippedItem && itemDef ? (
                    itemDef.isImage ? (
                      <img 
                        src={itemDef.icon as string} 
                        alt={equippedItem.name}
                        className="w-8 h-8 sm:w-6 sm:h-6 object-contain"
                      />
                    ) : itemDef.icon ? (
                      <itemDef.icon className="w-6 h-6 sm:w-5 sm:h-5" />
                    ) : null
                  ) : (
                    <Plus className="w-5 h-5 sm:w-4 sm:h-4 text-muted-foreground" />
                  )}
                </div>
              );
            })}
          </div>


          {/* Animated Kiki */}
          <div className="flex justify-center items-center relative z-0">
            <AnimatedKiki />
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 gap-3 relative z-20 mt-2">
          <div 
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/5 transition-colors duration-200"
            onClick={() => {
              console.log('Lab card clicked');
              navigate('/lab');
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FlaskConical className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Lab</h3>
                  <p className="text-sm text-muted-foreground">Upgrade your Kiki with streak rewards</p>
                  <Badge variant="secondary" className="mt-1 text-xs pointer-events-none">2 new</Badge>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          <div 
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/5 transition-colors duration-200"
            onClick={() => navigate('/family-tree')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <TreePine className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Family Tree</h3>
                  <p className="text-sm text-muted-foreground">View lineage & heirlooms</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          <div 
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-accent/5 transition-colors duration-200"
            onClick={() => navigate('/stats')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Stats</h3>
                  <p className="text-sm text-muted-foreground">Sessions, survival rate, longest streak</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate('/home')}
          >
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate('/board')}
          >
            <Clock className="w-6 h-6" />
          </Button>
          <Button
            variant="default"
            className="flex-1 flex justify-center items-center py-2 h-auto"
          >
            <Cat className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate('/shop')}
          >
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Item Selection Modal */}
      {selectedSlot !== null && (
        <div 
          className={`fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-6 pb-0 transition-opacity duration-300 ease-out ${
            isClosing || isAnimating ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={handleCloseModal}
        >
          <div 
            className="w-full max-w-md bg-background rounded-t-3xl shadow-xl p-6 transition-all duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              paddingBottom: 'env(safe-area-inset-bottom)',
              transform: isClosing || isAnimating ? 'translateY(100%)' : 'translateY(0)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                Choose Item for {SOCKET_TYPES[selectedSlot as keyof typeof SOCKET_TYPES].name}
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleCloseModal}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
              {(() => {
                const availableItems = getItemsBySlot(selectedSlot);
                
                if (availableItems.length === 0) {
                  return (
                    <div className="col-span-2 text-center py-8 space-y-3">
                      <div className="text-4xl">🛍️</div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-muted-foreground">No items available</h4>
                        <p className="text-sm text-muted-foreground">
                          Visit the shop to get new items for {pet.name}!
                        </p>
                      </div>
                      <Button 
                        onClick={() => {
                          handleCloseModal();
                          navigate('/shop');
                        }}
                        className="mt-4"
                      >
                        Go to Shop
                      </Button>
                    </div>
                  );
                }
                
                return availableItems.map((item) => {
                  const Icon = item.icon;
                  const isEquipped = selectedSlot && equippedItems[selectedSlot]?.id === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors duration-200 ${
                        isEquipped 
                          ? 'border-destructive bg-destructive/5 hover:bg-destructive/10' 
                          : 'border-border hover:bg-accent/5'
                      }`}
                      onClick={() => isEquipped ? handleRemoveItem() : handleEquipAndClose(item)}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="p-2 bg-muted/50 rounded-lg">
                          {item.isImage ? (
                            <img 
                              src={item.icon as string} 
                              alt={item.name}
                              className="w-10 h-10 object-contain"
                            />
                          ) : (
                            <Icon className="w-6 h-6" />
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium">{item.name}</div>
                          {isEquipped ? (
                            <Badge variant="destructive" className="text-xs mt-1">
                              Remove
                            </Badge>
                          ) : (
                            <Badge 
                              variant="outline" 
                              className={`text-xs mt-1 ${getRarityColor(item.rarity)} text-white border-none`}
                            >
                              {item.rarity}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Modals */}
      {activeInventory && (
        <div 
          className={`fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center transition-opacity duration-300 ease-out ${
            isClosing || isAnimating ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={handleInventoryClose}
        >
          <div 
            className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-xl p-6 transition-all duration-300 ease-out max-h-[80vh] sm:max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              paddingBottom: 'env(safe-area-inset-bottom)',
              transform: isClosing || isAnimating ? 'translateY(100%)' : 'translateY(0)'
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {activeInventory === 'hats' && 'Hats Inventory'}
                {activeInventory === 'masks' && 'Masks Inventory'}
                {activeInventory === 'clothes' && 'Clothes Inventory'}
                {activeInventory === 'backpacks' && 'Backpacks Inventory'}
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleInventoryClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {(() => {
                // Filter items based on inventory type using registry
                let inventoryItems = [];
                
                switch (activeInventory) {
                  case 'hats':
                    inventoryItems = getItemsBySlot(1);
                    break;
                  case 'masks':
                    inventoryItems = getItemsBySlot(2);
                    break;
                  case 'clothes':
                    inventoryItems = getItemsBySlot(3);
                    break;
                  case 'backpacks':
                    inventoryItems = getItemsBySlot(4);
                    break;
                }
                
                if (inventoryItems.length === 0) {
                  return (
                    <div className="col-span-2 text-center py-8 space-y-3">
                      <div className="text-4xl">
                        {activeInventory === 'hats' && '🎩'}
                        {activeInventory === 'masks' && '🎭'}
                        {activeInventory === 'clothes' && '👕'}
                        {activeInventory === 'backpacks' && '🎒'}
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-muted-foreground">No items available</h4>
                        <p className="text-sm text-muted-foreground">
                          Visit the shop to get new {activeInventory} for {pet.name}!
                        </p>
                      </div>
                      <Button 
                        onClick={() => {
                          handleInventoryClose();
                          navigate('/shop');
                        }}
                        className="mt-4"
                      >
                        Go to Shop
                      </Button>
                    </div>
                  );
                }
                
                return inventoryItems.map((item) => {
                  const Icon = item.icon;
                  const targetSlot = item.slot;
                  const isEquipped = equippedItems[targetSlot]?.id === item.id;
                  
                  return (
                    <div
                      key={item.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors duration-200 ${
                        isEquipped 
                          ? 'border-destructive bg-destructive/5 hover:bg-destructive/10' 
                          : 'border-border hover:bg-accent/5'
                      }`}
                      onClick={() => {
                        if (isEquipped) {
                          removeItem(targetSlot);
                        } else {
                          equipItem(targetSlot, { 
                            id: item.id, 
                            name: item.name, 
                            icon: typeof item.icon === 'string' ? item.icon : item.icon.name || 'Star', 
                            rarity: item.rarity 
                          });
                        }
                        handleInventoryClose();
                      }}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <div className="p-2 bg-muted/50 rounded-lg">
                          {item.isImage ? (
                            <img 
                              src={item.icon as string} 
                              alt={item.name}
                              className="w-10 h-10 object-contain"
                            />
                          ) : (
                            <Icon className="w-6 h-6" />
                          )}
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium">{item.name}</div>
                          {isEquipped ? (
                            <Badge variant="destructive" className="text-xs mt-1">
                              Remove
                            </Badge>
                          ) : (
                            <Badge 
                              variant="outline" 
                              className={`text-xs mt-1 ${getRarityColor(item.rarity)} text-white border-none`}
                            >
                              {item.rarity}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* DNA Info Modal */}
      {showDnaInfo && (
        <div 
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-6"
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
                  Use DNA to evolve {pet.name} with special abilities
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
    </div>
  );
};

export default Kiki;