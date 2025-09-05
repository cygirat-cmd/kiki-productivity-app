/**
 * Utility to fix invalid UUID formats in existing data
 */

export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function generateValidUuid(): string {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function fixPetIdIfNeeded(pet: Record<string, unknown>): Record<string, unknown> {
  if (!pet) return pet;
  
  // If pet has an invalid UUID, generate a new one
  if (pet.id && typeof pet.id === 'string' && !isValidUuid(pet.id)) {
    console.log(`Fixing invalid pet ID: ${pet.id}`);
    return {
      ...pet,
      id: generateValidUuid()
    };
  }
  
  return pet;
}

export function fixPetDataInStorage(): void {
  try {
    // Fix pet data in localStorage
    const petData = localStorage.getItem('kiki-pet');
    if (petData) {
      const pet = JSON.parse(petData);
      const fixedPet = fixPetIdIfNeeded(pet);
      if (fixedPet !== pet) {
        localStorage.setItem('kiki-pet', JSON.stringify(fixedPet));
        console.log('Fixed pet ID in localStorage');
      }
    }

    // Fix cemetery data
    const cemeteryData = localStorage.getItem('kiki-cemetery');
    if (cemeteryData) {
      const cemetery = JSON.parse(cemeteryData);
      let changed = false;
      const fixedCemetery = cemetery.map((pet: Record<string, unknown>) => {
        const fixed = fixPetIdIfNeeded(pet);
        if (fixed !== pet) changed = true;
        return fixed;
      });
      
      if (changed) {
        localStorage.setItem('kiki-cemetery', JSON.stringify(fixedCemetery));
        console.log('Fixed cemetery IDs in localStorage');
      }
    }

    // Fix Zustand pet store if it has invalid ID
    const petStoreData = localStorage.getItem('kiki-pet-store');
    if (petStoreData) {
      const storeData = JSON.parse(petStoreData);
      if (storeData.state?.pet) {
        const fixedPet = fixPetIdIfNeeded(storeData.state.pet);
        if (fixedPet !== storeData.state.pet) {
          storeData.state.pet = fixedPet;
          localStorage.setItem('kiki-pet-store', JSON.stringify(storeData));
          console.log('Fixed pet ID in Zustand store');
        }
      }
    }
  } catch (error) {
    console.error('Error fixing pet IDs in storage:', error);
  }
}