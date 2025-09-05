import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const sampleItems = [
  // Hair items
  {
    name: "Flowing Locks",
    slot_id: "hair",
    rarity: "common",
    price: 100,
    tags: ["long", "wavy"],
    renderProps: { socket: "head", dx: 0, dy: -5, scale: 1.0, base_deg: 0, bias_deg: 0 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/8B5CF6/FFFFFF?text=H1" },
      { kind: "front", url: "https://placehold.co/128x128/8B5CF6/FFFFFF?text=Hair1" }
    ]
  },
  {
    name: "Spiky Style",
    slot_id: "hair",
    rarity: "rare",
    price: 250,
    tags: ["spiky", "edgy"],
    renderProps: { socket: "head", dx: 2, dy: -8, scale: 1.1, base_deg: 0, bias_deg: 5 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/3B82F6/FFFFFF?text=H2" },
      { kind: "front", url: "https://placehold.co/128x128/3B82F6/FFFFFF?text=Hair2" }
    ]
  },
  {
    name: "Rainbow Curls",
    slot_id: "hair",
    rarity: "epic",
    price: 500,
    tags: ["rainbow", "curly", "magical"],
    renderProps: { socket: "head", dx: 0, dy: -3, scale: 1.2, base_deg: 0, bias_deg: 0, extras: { animationType: "sparkle" } },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/EC4899/FFFFFF?text=H3" },
      { kind: "front", url: "https://placehold.co/128x128/EC4899/FFFFFF?text=Hair3" }
    ]
  },

  // Hat items
  {
    name: "Basic Beanie",
    slot_id: "hat",
    rarity: "common",
    price: 150,
    tags: ["warm", "casual"],
    renderProps: { socket: "head", dx: 0, dy: -10, scale: 0.9, base_deg: 0, bias_deg: 0 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/6B7280/FFFFFF?text=B1" },
      { kind: "front", url: "https://placehold.co/128x128/6B7280/FFFFFF?text=Beanie" },
      { kind: "back", url: "https://placehold.co/128x128/6B7280/FFFFFF?text=BeanieB" }
    ]
  },
  {
    name: "Wizard Hat",
    slot_id: "hat",
    rarity: "epic",
    price: 800,
    tags: ["magic", "pointy", "mystical"],
    renderProps: { socket: "head", dx: 0, dy: -15, scale: 1.0, base_deg: 0, bias_deg: 0 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/7C3AED/FFFFFF?text=W1" },
      { kind: "front", url: "https://placehold.co/128x128/7C3AED/FFFFFF?text=Wizard" }
    ]
  },

  // Glasses items
  {
    name: "Reading Glasses",
    slot_id: "glasses",
    rarity: "common",
    price: 75,
    tags: ["smart", "studious"],
    renderProps: { socket: "head", dx: 0, dy: 2, scale: 0.8, base_deg: 0, bias_deg: 0 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/059669/FFFFFF?text=G1" },
      { kind: "front", url: "https://placehold.co/128x128/059669/FFFFFF?text=Glasses" }
    ]
  },
  {
    name: "Cyber Visor",
    slot_id: "glasses",
    rarity: "legendary",
    price: 1200,
    tags: ["futuristic", "glowing", "cyber"],
    renderProps: { socket: "head", dx: 0, dy: 1, scale: 0.9, base_deg: 0, bias_deg: 0, extras: { animationType: "glow" } },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/F59E0B/FFFFFF?text=CV" },
      { kind: "front", url: "https://placehold.co/128x128/F59E0B/FFFFFF?text=Cyber" }
    ]
  },

  // Mask items
  {
    name: "Ninja Mask",
    slot_id: "mask",
    rarity: "rare",
    price: 300,
    tags: ["stealth", "ninja", "black"],
    renderProps: { socket: "head", dx: 0, dy: 5, scale: 0.7, base_deg: 0, bias_deg: 0 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/1F2937/FFFFFF?text=N1" },
      { kind: "front", url: "https://placehold.co/128x128/1F2937/FFFFFF?text=Ninja" }
    ]
  },

  // Shirt items
  {
    name: "Plain Tee",
    slot_id: "shirt",
    rarity: "common",
    price: 50,
    tags: ["basic", "comfortable"],
    renderProps: { socket: "body", dx: 0, dy: 0, scale: 1.0, base_deg: 0, bias_deg: 0 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/EF4444/FFFFFF?text=T1" },
      { kind: "front", url: "https://placehold.co/128x128/EF4444/FFFFFF?text=Tee" }
    ]
  },
  {
    name: "Hero Suit",
    slot_id: "shirt",
    rarity: "legendary",
    price: 1500,
    tags: ["heroic", "cape", "powerful"],
    renderProps: { socket: "body", dx: 0, dy: 0, scale: 1.1, base_deg: 0, bias_deg: 0, extras: { animationType: "heroic" } },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/DC2626/FFFFFF?text=HS" },
      { kind: "front", url: "https://placehold.co/128x128/DC2626/FFFFFF?text=Hero" }
    ]
  },

  // Backpack items
  {
    name: "School Backpack",
    slot_id: "backpack",
    rarity: "common",
    price: 200,
    tags: ["school", "practical"],
    renderProps: { socket: "back", dx: 0, dy: 5, scale: 0.8, base_deg: 0, bias_deg: 0 },
    assets: [
      { kind: "thumb", url: "https://placehold.co/64x64/10B981/FFFFFF?text=BP" },
      { kind: "back", url: "https://placehold.co/128x128/10B981/FFFFFF?text=Backpack" }
    ]
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seed...');

  try {
    // Insert sample items
    console.log('📦 Inserting items...');
    
    for (const item of sampleItems) {
      const { renderProps, assets, ...itemData } = item;
      
      // Insert item
      const { data: insertedItem, error: itemError } = await supabase
        .from('items')
        .insert({ ...itemData, is_published: true })
        .select('id')
        .single();

      if (itemError) throw itemError;

      const itemId = insertedItem.id;
      console.log(`✅ Inserted item: ${item.name} (ID: ${itemId})`);

      // Insert render props
      const { error: propsError } = await supabase
        .from('item_render_props')
        .insert({
          item_id: itemId,
          socket: renderProps.socket,
          dx: renderProps.dx,
          dy: renderProps.dy,
          scale: renderProps.scale,
          base_deg: renderProps.base_deg,
          bias_deg: renderProps.bias_deg,
          pivot_dx: renderProps.pivotDX || 0,
          pivot_dy: renderProps.pivotDY || 0,
          extras: renderProps.extras || {}
        });

      if (propsError) throw propsError;

      // Insert assets
      const assetsToInsert = assets.map(asset => ({
        item_id: itemId,
        kind: asset.kind,
        url: asset.url
      }));

      const { error: assetsError } = await supabase
        .from('item_assets')
        .insert(assetsToInsert);

      if (assetsError) throw assetsError;
    }

    console.log('🎉 Database seeded successfully!');
    console.log(`📊 Inserted ${sampleItems.length} items across ${new Set(sampleItems.map(i => i.slot_id)).size} slots`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run the seed
seedDatabase();