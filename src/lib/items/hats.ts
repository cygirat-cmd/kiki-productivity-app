import { Crown, Star } from 'lucide-react';
import { ItemDefinition } from '../itemRegistry';

export const HAT_ITEMS: ItemDefinition[] = [
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
  }
];