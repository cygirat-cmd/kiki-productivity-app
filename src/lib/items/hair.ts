import { ItemDefinition } from '../itemRegistry';

export const HAIR_ITEMS: ItemDefinition[] = [
  {
    id: 6,
    name: "Hair Style 1",
    slot: 1,
    renderLayer: 'hatFront',
    imagePath: "/assets/items/hair1.png",
    icon: "/assets/items/hair1.png",
    rarity: "common",
    isHair: true,
    isImage: true,
    renderProps: { dx: 7, dy: 70, scale: 0.4, socket: 'head' }
  },
  {
    id: 7,
    name: "Hair Style 2", 
    slot: 1,
    renderLayer: 'hatFront',
    imagePath: "/assets/items/hair2.png",
    icon: "/assets/items/hair2.png",
    rarity: "rare",
    isHair: true,
    isImage: true,
    renderProps: { dx: 7, dy: 50, scale: 0.5, socket: 'head' }
  }
];