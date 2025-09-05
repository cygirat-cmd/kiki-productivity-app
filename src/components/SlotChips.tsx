import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SlotChip {
  id: string;
  name: string;
  icon: string;
}

interface SlotChipsProps {
  selectedSlots: string[];
  onSlotToggle: (slotId: string) => void;
  className?: string;
}

const SLOT_CHIPS: SlotChip[] = [
  { id: 'all', name: 'All', icon: '👕' },
  { id: 'hair', name: 'Hair', icon: '💇' },
  { id: 'hat', name: 'Hat', icon: '🎩' },
  { id: 'glasses', name: 'Glasses', icon: '👓' },
  { id: 'mask', name: 'Mask', icon: '😷' },
  { id: 'shirt', name: 'Shirt', icon: '👕' },
  { id: 'jacket', name: 'Jacket', icon: '🧥' },
  { id: 'backpack', name: 'Backpack', icon: '🎒' },
  { id: 'cape', name: 'Cape', icon: '🦸' },
  { id: 'wings', name: 'Wings', icon: '🪽' }
];

export default function SlotChips({ selectedSlots, onSlotToggle, className = "" }: SlotChipsProps) {
  const isSelected = (slotId: string) => selectedSlots.includes(slotId);
  const isAllSelected = selectedSlots.includes('all');
  
  const handleChipClick = (slotId: string) => {
    if (slotId === 'all') {
      // Toggle all: if all is selected, deselect everything, otherwise select all
      if (isAllSelected) {
        onSlotToggle('all');
      } else {
        onSlotToggle('all');
      }
    } else {
      // If all is currently selected and we click a specific slot, deselect all first
      if (isAllSelected) {
        onSlotToggle('all'); // This will deselect all
        setTimeout(() => onSlotToggle(slotId), 0); // Then select the specific slot
      } else {
        onSlotToggle(slotId);
      }
    }
  };
  
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide ${className}`}>
      {SLOT_CHIPS.map((chip) => {
        const selected = isSelected(chip.id);
        const disabled = chip.id !== 'all' && isAllSelected;
        
        return (
          <Button
            key={chip.id}
            variant={selected ? "default" : "outline"}
            size="sm"
            onClick={() => handleChipClick(chip.id)}
            disabled={disabled}
            className={`flex-shrink-0 flex items-center gap-2 transition-all duration-200 ${
              selected 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'hover:bg-accent/50'
            } ${disabled ? 'opacity-50' : ''}`}
          >
            <span className="text-base">{chip.icon}</span>
            <span className="text-sm font-medium">{chip.name}</span>
            {selected && chip.id !== 'all' && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                ✓
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}