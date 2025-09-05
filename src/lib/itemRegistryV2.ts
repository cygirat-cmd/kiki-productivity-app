import { ItemDefinition } from './itemRegistry';

// Lazy loading chunks
const REGISTRY_CHUNKS = {
  hats: () => import('./items/hats').then(m => m.HAT_ITEMS),
  hair: () => import('./items/hair').then(m => m.HAIR_ITEMS),
  accessories: () => import('./items/accessories').then(m => m.ACCESSORY_ITEMS)
};

class ItemRegistryManager {
  private itemsById: Map<number, ItemDefinition> = new Map();
  private itemsBySlot: Map<number, ItemDefinition[]> = new Map();
  private itemsByRarity: Map<string, ItemDefinition[]> = new Map();
  private loadedChunks: Set<string> = new Set();
  private loading: Set<string> = new Set();

  // Initialize with basic items for immediate use
  constructor() {
    this.initializeBasicItems();
  }

  private initializeBasicItems() {
    // Only load essential items immediately (hair for equipped items)
    const basicItems: ItemDefinition[] = [
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

    this.addItems(basicItems);
  }

  private addItems(items: ItemDefinition[]) {
    items.forEach(item => {
      // Indexed storage for O(1) lookups
      this.itemsById.set(item.id, item);
      
      // Group by slot
      if (!this.itemsBySlot.has(item.slot)) {
        this.itemsBySlot.set(item.slot, []);
      }
      this.itemsBySlot.get(item.slot)!.push(item);
      
      // Group by rarity
      if (!this.itemsByRarity.has(item.rarity)) {
        this.itemsByRarity.set(item.rarity, []);
      }
      this.itemsByRarity.get(item.rarity)!.push(item);
    });
  }

  // Lazy load chunk if not already loaded
  private async ensureChunkLoaded(chunkName: keyof typeof REGISTRY_CHUNKS): Promise<void> {
    if (this.loadedChunks.has(chunkName) || this.loading.has(chunkName)) {
      return;
    }

    this.loading.add(chunkName);
    try {
      const items = await REGISTRY_CHUNKS[chunkName]();
      this.addItems(items);
      this.loadedChunks.add(chunkName);
    } catch (error) {
      console.error(`Failed to load chunk ${chunkName}:`, error);
    } finally {
      this.loading.delete(chunkName);
    }
  }

  // O(1) item lookup
  async getItemById(id: number): Promise<ItemDefinition | undefined> {
    // Check loaded items first
    let item = this.itemsById.get(id);
    if (item) return item;

    // Try loading all chunks and check again
    await Promise.all(Object.keys(REGISTRY_CHUNKS).map(chunk => 
      this.ensureChunkLoaded(chunk as keyof typeof REGISTRY_CHUNKS)
    ));
    
    return this.itemsById.get(id);
  }

  // Optimized slot filtering with preloading
  async getItemsBySlot(slot: number): Promise<ItemDefinition[]> {
    // Load relevant chunks based on slot
    const chunksToLoad: (keyof typeof REGISTRY_CHUNKS)[] = [];
    
    switch (slot) {
      case 1: // Head slot
        chunksToLoad.push('hats', 'hair');
        break;
      case 2: // Face slot
      case 4: // Back slot
        chunksToLoad.push('accessories');
        break;
      default:
        chunksToLoad.push('accessories');
    }

    await Promise.all(chunksToLoad.map(chunk => this.ensureChunkLoaded(chunk)));
    
    return this.itemsBySlot.get(slot) || [];
  }

  async getItemsByRarity(rarity: string): Promise<ItemDefinition[]> {
    // Load all chunks for complete rarity filtering
    await Promise.all(Object.keys(REGISTRY_CHUNKS).map(chunk => 
      this.ensureChunkLoaded(chunk as keyof typeof REGISTRY_CHUNKS)
    ));
    
    return this.itemsByRarity.get(rarity) || [];
  }

  async getItemsForLootBox(): Promise<ItemDefinition[]> {
    // Load all chunks for loot boxes
    await Promise.all(Object.keys(REGISTRY_CHUNKS).map(chunk => 
      this.ensureChunkLoaded(chunk as keyof typeof REGISTRY_CHUNKS)
    ));
    
    return Array.from(this.itemsById.values());
  }

  // Preload specific categories for performance
  async preloadCategory(category: 'hats' | 'hair' | 'accessories'): Promise<void> {
    await this.ensureChunkLoaded(category);
  }

  // Get synchronous item if already loaded (for performance-critical rendering)
  getItemByIdSync(id: number): ItemDefinition | undefined {
    return this.itemsById.get(id);
  }

  getItemsBySlotSync(slot: number): ItemDefinition[] {
    return this.itemsBySlot.get(slot) || [];
  }
}

// Global instance
export const itemRegistry = new ItemRegistryManager();

// Backward compatibility helpers
export const getItemById = (id: number) => itemRegistry.getItemByIdSync(id);
export const getItemsBySlot = (slot: number) => itemRegistry.getItemsBySlotSync(slot);
export const getItemsForLootBox = () => Array.from(itemRegistry['itemsById'].values());

// Async versions for new code
export const getItemByIdAsync = (id: number) => itemRegistry.getItemById(id);
export const getItemsBySlotAsync = (slot: number) => itemRegistry.getItemsBySlot(slot);
export const getItemsForLootBoxAsync = () => itemRegistry.getItemsForLootBox();