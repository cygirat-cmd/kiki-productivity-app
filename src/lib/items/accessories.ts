import { Sparkles, Crown } from 'lucide-react';
import { ItemDefinition } from '../itemRegistry';

export const ACCESSORY_ITEMS: ItemDefinition[] = [
  // Face slot items
  {
    id: 3,
    name: "Sparkle Bow",
    slot: 2,
    renderLayer: 'accessory',
    imagePath: "/assets/items/bow1.png",
    icon: Sparkles,
    rarity: "common",
    renderProps: { dx: 0, dy: 0, socket: 'head' }
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
    renderProps: { dx: 0, dy: 0, socket: 'body' }
  },
  {
    id: 5,
    name: "Fairy Wings",
    slot: 4,
    renderLayer: 'shirt', 
    imagePath: "/assets/items/wings1.png",
    icon: Sparkles,
    rarity: "epic",
    renderProps: { dx: 0, dy: 0, socket: 'body' }
  }
];