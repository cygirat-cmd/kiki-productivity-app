import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUserItemsStore } from '@/store/userItemsStore';
import { useToast } from '@/hooks/useToast';
import { Save, Shirt, Trash2, Plus } from 'lucide-react';
import { type UserOutfit } from '@/lib/userItems';

type OutfitManagerProps = {
  className?: string;
};

export function OutfitManager({ className = '' }: OutfitManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newOutfitName, setNewOutfitName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const {
    outfits,
    isAuthenticated,
    saveCurrentOutfit,
    loadOutfit,
    deleteOutfit,
    refreshOutfits
  } = useUserItemsStore();

  useEffect(() => {
    if (isAuthenticated && isOpen) {
      refreshOutfits();
    }
  }, [isAuthenticated, isOpen, refreshOutfits]);

  const handleSaveOutfit = async () => {
    if (!newOutfitName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your outfit",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);
      await saveCurrentOutfit(newOutfitName.trim());
      setNewOutfitName('');
      
      toast({
        title: "Outfit saved!",
        description: `"${newOutfitName}" has been saved to your collection`,
      });
    } catch (error) {
      toast({
        title: "Failed to save outfit",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadOutfit = async (outfit: UserOutfit) => {
    try {
      await loadOutfit(outfit.id);
      setIsOpen(false);
      
      toast({
        title: "Outfit loaded!",
        description: `"${outfit.name}" is now equipped`,
      });
    } catch (error) {
      toast({
        title: "Failed to load outfit",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleDeleteOutfit = async (outfit: UserOutfit) => {
    if (!confirm(`Delete outfit "${outfit.name}"?`)) return;

    try {
      await deleteOutfit(outfit.id);
      
      toast({
        title: "Outfit deleted",
        description: `"${outfit.name}" has been removed`,
      });
    } catch (error) {
      toast({
        title: "Failed to delete outfit",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={className}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Shirt className="w-4 h-4" />
            Outfits
          </Button>
        </DialogTrigger>
        
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="w-5 h-5" />
              Outfit Manager
            </DialogTitle>
          </DialogHeader>

          {/* Save Current Outfit */}
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Save Current Look</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Outfit name..."
                  value={newOutfitName}
                  onChange={(e) => setNewOutfitName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveOutfit()}
                />
                <Button 
                  onClick={handleSaveOutfit}
                  disabled={isSaving || !newOutfitName.trim()}
                  size="sm"
                >
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Saved Outfits */}
            <div className="space-y-2">
              <h4 className="font-medium">Saved Outfits ({outfits.length})</h4>
              
              {outfits.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Shirt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No saved outfits yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {outfits.map((outfit) => (
                    <Card key={outfit.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm truncate">{outfit.name}</h5>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-gray-500">
                              {Object.keys(outfit.items).length} items
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {new Date(outfit.created_at).toLocaleDateString()}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoadOutfit(outfit)}
                            className="h-8 px-2"
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteOutfit(outfit)}
                            className="h-8 px-2 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}