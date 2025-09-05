import { Crown, Star, Sparkles } from 'lucide-react';

export interface ItemDefinition {
  id: number;
  name: string;
  slot: number;
  renderLayer: 'hatBack' | 'hatFront' | 'shirt' | 'accessory';
  imagePath: string;
  icon?: any; // Lucide icon component
  rarity: "common" | "rare" | "epic" | "legendary";
  isHair?: boolean; // Legacy - will be replaced by animationType
  isImage?: boolean; // For UI display
  renderProps?: {
    dx?: number;
    dy?: number; 
    scale?: number;
    socket?: 'head' | 'body';
    // Animation properties
    animationType?: 'static' | 'physics' | 'floating' | 'rotate' | 'pulse';
    physics?: {
      follow?: number; // How much to follow socket rotation (0-1)
      damping?: number; // Smoothing factor (0-1) 
      bias?: number; // Static rotation offset in degrees
      invert?: boolean; // Invert rotation direction
    };
    floating?: {
      amplitude?: number; // Floating distance in pixels
      frequency?: number; // Floating speed multiplier
      phase?: number; // Starting phase offset
    };
    rotation?: {
      speed?: number; // Degrees per second
      axis?: 'x' | 'y' | 'z'; // Rotation axis
    };
    pulse?: {
      minScale?: number; // Minimum scale
      maxScale?: number; // Maximum scale  
      frequency?: number; // Pulse speed
    };
  };
}

export const ITEM_REGISTRY: ItemDefinition[] = [
  // Head slot items
  {
    id: 1,
    name: "Golden Crown",
    slot: 1,
    renderLayer: 'hatBack',
    imagePath: "/assets/items/hat_back1.png",
    icon: Crown,
    rarity: "epic",
    renderProps: { dx: 0, dy: -8, socket: 'head' }
  },
  {
    id: 2,
    name: "Magic Hat", 
    slot: 1,
    renderLayer: 'hatBack',
    imagePath: "/assets/items/hat_back2.png",
    icon: Star,
    rarity: "rare",
    renderProps: { dx: 0, dy: -8, socket: 'head' }
  },
  {
    id: 6,
    name: "Hair Style 1",
    slot: 1,
    renderLayer: 'hatFront',
    imagePath: "/assets/items/hair1.png",
    icon: "/assets/items/hair1.png",
    rarity: "common",
    isHair: true, // Legacy compatibility
    isImage: true,
    renderProps: { 
      dx: 6.8, dy: 70, scale: 0.4, socket: 'head',
      animationType: 'physics',
      physics: {
        follow: 1.0,
        damping: 0.20,
        bias: 3,
        invert: false
      }
    }
  },
  {
    id: 7,
    name: "Hair Style 2", 
    slot: 1,
    renderLayer: 'hatFront',
    imagePath: "/assets/items/hair2.png",
    icon: "/assets/items/hair2.png",
    rarity: "rare",
    isHair: true, // Legacy compatibility
    isImage: true,
    renderProps: { 
      dx: 7, dy: 50, scale: 0.32, socket: 'head',
      animationType: 'physics',
      physics: {
        follow: 1.0,
        damping: 0.20,
        bias: 3,
        invert: false
      }
    }
  },
  {
    id: 8,
    name: "Hair Style 3", 
    slot: 1,
    renderLayer: 'hatFront',
    imagePath: "/assets/items/hair3.png",
    icon: "/assets/items/hair3.png",
    rarity: "epic",
    isHair: true, // Legacy compatibility
    isImage: true,
    renderProps: { 
      dx: 6.8, dy: 75, scale: 0.36, socket: 'head',
      animationType: 'physics',
      physics: {
        follow: 1.0,
        damping: 0.20,
        bias: 3,
        invert: false
      }
    }
  },
  
  // Face slot items
  {
    id: 3,
    name: "Sparkle Bow",
    slot: 2,
    renderLayer: 'accessory',
    imagePath: "/assets/items/bow1.png",
    icon: Sparkles,
    rarity: "common",
    renderProps: { 
      dx: 0, dy: 0, socket: 'head',
      animationType: 'pulse',
      pulse: {
        minScale: 0.9,
        maxScale: 1.1,
        frequency: 2.0
      }
    }
  },
  
  // Back slot items
  {
    id: 4,
    name: "Royal Cape",
    slot: 4,
    renderLayer: 'shirt',
    imagePath: "/assets/items/cape1.png",
    icon: Crown,
    rarity: "rare", 
    renderProps: { 
      dx: 0, dy: 0, socket: 'body',
      animationType: 'physics',
      physics: {
        follow: 0.3,
        damping: 0.15,
        bias: -2,
        invert: true
      }
    }
  },
  {
    id: 5,
    name: "Fairy Wings",
    slot: 4,
    renderLayer: 'shirt', 
    imagePath: "/assets/items/wings1.png",
    icon: Sparkles,
    rarity: "epic",
    renderProps: { 
      dx: 0, dy: 0, socket: 'body',
      animationType: 'floating',
      floating: {
        amplitude: 3,
        frequency: 1.5,
        phase: 0
      }
    }
  },
];

// Helper functions
export const getItemById = (id: number): ItemDefinition | undefined => {
  return ITEM_REGISTRY.find(item => item.id === id);
};

export const getItemsBySlot = (slot: number): ItemDefinition[] => {
  return ITEM_REGISTRY.filter(item => item.slot === slot);
};

export const getItemsByRarity = (rarity: string): ItemDefinition[] => {
  return ITEM_REGISTRY.filter(item => item.rarity === rarity);
};

export const getItemsForLootBox = (): ItemDefinition[] => {
  return ITEM_REGISTRY; // All items can be in loot boxes
};