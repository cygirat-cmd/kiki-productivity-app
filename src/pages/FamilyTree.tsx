import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ArrowLeft, Clock, Trophy, Plus, ZoomIn, ZoomOut, RotateCcw, Home as HomeIcon, ListTodo, FlaskConical, BarChart3, ShoppingBag, Cat } from "lucide-react";
import { getPetImage } from "@/utils/helpers";
import { PET_TYPES } from "@/constants";
import { usePetStore } from '@/store';

interface FamilyMember {
  id: string;
  parentId?: string;
  type: string;
  name: string;
  adoptedAt: string;
  deathDate?: string;
  deathReason?: string;
  streak: number;
  generation: number;
  sessionsCompleted: number;
  mutations?: string[];
  x?: number;
  y?: number;
  children?: FamilyMember[];
  relationship?: string;
  originalRelationship?: string; // Store the structural relationship
  depth?: number;
  siblingIndex?: number;
}

const founderQuotes = [
  "This feels like the beginning of something..."
];

const heritageQuotes = [
  "I'm {name} Jr., child of your fallen comrade. I'll do better this time!",
  "Cousin {name} reporting. The family sent me to clean up this mess.",
  "I'm {name} from the family line. Family honor is on me now.",
  "Greetings! I'm {name} the Second, here to restore our family name.",
  "Hey there! {name}'s sibling here. Time to show how it's done!",
  "I'm {name}'s twin. Let's avenge the family honor!",
  "The name's {name} III. Third generation, first class productivity!"
];

const lastWords = [
  "I gave my all for productivity. May the next generation do better...",
  "Tell the others... the tasks must go on...",
  "I see... the deadline... approaching... carry on without me...",
  "My timer... has run out... but yours... continues...",
  "The family honor... depends on you now...",
  "I failed... but you... you can succeed...",
  "Remember me... when you complete... what I could not...",
  "My streak ends here... but the legacy... lives on...",
  "The productivity gods... have claimed me... avenge my death...",
  "I should have... taken that coffee break... *fades away*",
  "The corporate overlords... they got me... but you... you're stronger...",
  "My mutations... were not enough... learn from my mistakes..."
];

const FamilyTree = () => {
  const { pet, killPet } = usePetStore();
  const [familyTree, setFamilyTree] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if pet is alive, redirect to onboarding if not
    const isPetMarkedDead = sessionStorage.getItem('pet-is-dead') === 'true' && 
                           sessionStorage.getItem('dead-pet-name') === pet?.name;
    const isPetReallyAlive = pet && !isPetMarkedDead;
    
    if (!isPetReallyAlive) {
      navigate('/onboarding');
      return;
    }
    
    loadFamilyTree();
    
    // Listen for storage changes to refresh tree
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kiki-cemetery' || e.key === 'kiki-pet' || e.key === 'kiki-tree') {
        loadFamilyTree();
      }
    };
    
    // Listen for custom pet death event
    const handlePetDeath = () => {
      setTimeout(loadFamilyTree, 100); // Small delay to ensure localStorage is updated
    };
    
    // Listen for focus events to refresh when user returns to tab
    const handleFocus = () => {
      loadFamilyTree();
    };
    
    // Listen for window resize to recalculate positions (debounced)
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        loadFamilyTree();
      }, 250);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleResize);
    window.addEventListener('pet-death', handlePetDeath as EventListener);
    document.addEventListener('visibilitychange', handleFocus);
    
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pet-death', handlePetDeath as EventListener);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [pet, navigate]);

  const getDisplayRelationshipLabel = (member: FamilyMember, allMembers: FamilyMember[]): string => {
    // Use originalRelationship to determine display
    if (member.originalRelationship === "Founder") return "Founder";
    if (member.originalRelationship === "Cousin Line") return `Cousin`;
    if (member.originalRelationship === "Family Branch") {
      // Find parent to show sibling relationship
      const parent = allMembers.find(m => m.id === member.parentId);
      if (parent) {
        const parentName = parent.name.split(' ')[0];
        return `${parentName}'s sibling`;
      }
      return "Sibling";
    }
    
    // For direct line, create descriptive labels
    if (member.originalRelationship === "Direct Line" && member.parentId) {
      const parent = allMembers.find(m => m.id === member.parentId);
      if (!parent) return "Next Generation";
      
      const parentName = parent.name.split(' ')[0];
      const siblings = allMembers.filter(m => m.parentId === member.parentId);
      const memberIndex = siblings.findIndex(s => s.id === member.id);
      
      // Gender-neutral varied relationship labels
      const relationships = [
        `${parentName}'s child`,
        `${parentName}'s successor`,  
        `Following ${parentName}`,
        `${parentName}'s legacy`,
        `Next in line`,
        `${parentName} the Second`,
        `Continuing the line`,
        `${parentName}'s hope`,
        `The new generation`,
        `${parentName}'s spirit`,
        `Carrying the torch`,
        `${parentName}'s pride`
      ];
      
      return relationships[memberIndex % relationships.length];
    }
    
    // Fallback
    return "Next Generation";
  };

  const determineRelationshipType = (member: FamilyMember, previousMember?: FamilyMember, memberIndex: number): { parentId?: string; relationship: string } => {
    if (!previousMember) return { parentId: undefined, relationship: "Founder" };
    
    // Use member ID hash for consistent randomization (same result every time)
    const seed = memberIndex + (member.id?.charCodeAt(member.id.length - 1) || 0);
    const pseudoRandom = (seed * 9301 + 49297) % 233280 / 233280; // Linear congruential generator
    
    // 70% chance to be direct descendant, 30% chance to be cousin/sibling
    const isDirectDescendant = pseudoRandom > 0.3;
    
    if (isDirectDescendant) {
      // Direct child of previous member
      return { 
        parentId: previousMember.id,
        relationship: "Direct Line"
      };
    } else {
      // Cousin or family branch - same generation or related line  
      const cousinType = pseudoRandom > 0.15 ? "Cousin Line" : "Family Branch"; // 50% cousin, 50% sibling
      return {
        parentId: previousMember.parentId, // Same parent as previous (sibling) or no parent (cousin)
        relationship: cousinType
      };
    }
  };

  const loadFamilyTree = () => {
    // Always refresh from current data sources
    const cemetery = JSON.parse(localStorage.getItem("kiki-cemetery") || "[]");
    
    // Check if current pet in store should be dead
    const isPetDead = sessionStorage.getItem('pet-is-dead') === 'true';
    const deadPetName = sessionStorage.getItem('dead-pet-name');
    
    let currentPet = pet;
    
    if (isPetDead && pet && pet.name === deadPetName) {
      console.log('🚫 Dead pet detected in FamilyTree, killing in store');
      killPet();
      currentPet = null; // Don't use dead pet for tree building
    }
    
    // Check if we have saved family relationships
    const savedRelationships = JSON.parse(localStorage.getItem("kiki-family-relationships") || "{}");
    
    const members: FamilyMember[] = [];
    let previousMember: FamilyMember | undefined;
    let currentPetAdded = false; // Flag to prevent duplicate current pet
    
    // Convert cemetery to tree structure with saved relationships
    cemetery.forEach((deadPet: any, index: number) => {
      // Use deadPet's actual ID or generate one based on index (for backward compatibility)
      const memberId = deadPet.id || `kiki-${index + 1}`;
      
      // Skip if this is the current living pet that somehow ended up in cemetery
      if (currentPet) {
        if (currentPet.id === memberId || (currentPet.name === deadPet.name && currentPet.adoptedAt === deadPet.adoptedAt)) {
          return; // Skip this cemetery entry as it's the current living pet
        }
      }
      
      // Use saved relationship or determine new one
      let relationshipInfo;
      if (savedRelationships[memberId]) {
        relationshipInfo = savedRelationships[memberId];
      } else {
        relationshipInfo = determineRelationshipType({ id: memberId } as FamilyMember, index === 0 ? undefined : previousMember, index);
        savedRelationships[memberId] = relationshipInfo; // Save for future
      }
      
      const member: FamilyMember = {
        id: memberId, // Use actual ID from deadPet
        parentId: relationshipInfo.parentId,
        type: deadPet.type || PET_TYPES.CAT,
        name: deadPet.name,
        adoptedAt: deadPet.adoptedAt,
        deathDate: deadPet.deathDate,
        deathReason: deadPet.deathReason || "Unknown cause",
        streak: deadPet.streak || 0,
        generation: relationshipInfo.relationship === "Direct Line" ? (previousMember?.generation || 0) + 1 : previousMember?.generation || 1,
        sessionsCompleted: deadPet.sessionsCompleted || 0,
        mutations: deadPet.mutations || [],
        depth: relationshipInfo.relationship === "Direct Line" ? index : Math.max(0, index - 1),
        originalRelationship: relationshipInfo.relationship,  // Keep original relationship type
        relationship: relationshipInfo.relationship
      };
      
      members.push(member);
      
      // Update previous member for next iteration  
      if (relationshipInfo.relationship === "Direct Line" || relationshipInfo.relationship === "Founder") {
        previousMember = member;
      }
    });
    
    // Add current pet if alive and not already processed (avoid duplicates)
    // Pet is considered alive only if: exists AND not marked as dead in session
    const petInLocalStorage = localStorage.getItem("kiki-pet");
    const petInStore = currentPet;
    const justCreated = currentPet?.adoptedAt && (Date.now() - new Date(currentPet.adoptedAt).getTime()) < 10000; // 10 seconds grace period
    const isPetMarkedDead = sessionStorage.getItem('pet-is-dead') === 'true' && 
                           sessionStorage.getItem('dead-pet-name') === currentPet?.name;
    
    console.log("🔍 FamilyTree checking pet alive status:", {
      petInStore: !!petInStore,
      petInLocalStorage: !!petInLocalStorage,
      justCreated,
      isPetMarkedDead,
      petName: petInStore?.name,
      adoptedAt: petInStore?.adoptedAt
    });
    
    const isPetReallyAlive = currentPet && !isPetMarkedDead;
    
    if (isPetReallyAlive && !currentPetAdded) {
      const livingPet = currentPet;
      
      // Ensure pet has an ID
      const petId = livingPet.id || (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
      
      // Check if this pet ID is already in the members list (from cemetery or already added)
      const isAlreadyProcessed = members.some((member: FamilyMember) => 
        member.id === petId || (member.name === livingPet.name && member.adoptedAt === livingPet.adoptedAt)
      );
      
      // Also check if this pet is already in cemetery
      const isInCemetery = cemetery.some((deadPet: any) => 
        (deadPet.id && deadPet.id === petId) || 
        (deadPet.name === livingPet.name && deadPet.adoptedAt === livingPet.adoptedAt)
      );
      
      if (!isAlreadyProcessed && !isInCemetery) {
        currentPetAdded = true; // Mark as added to prevent duplicates
        // Use pet's actual ID as the member ID instead of generating new one
        const currentMemberId = petId;
        
        // Use saved relationship or determine new one  
        let relationshipInfo;
        if (savedRelationships[currentMemberId]) {
          relationshipInfo = savedRelationships[currentMemberId];
        } else {
          relationshipInfo = determineRelationshipType({ id: currentMemberId } as FamilyMember, previousMember, cemetery.length);
          savedRelationships[currentMemberId] = relationshipInfo; // Save for future
        }
        
        const currentMember: FamilyMember = {
          id: currentMemberId, // Use actual pet ID
          parentId: relationshipInfo.parentId,
          type: livingPet.type,
          name: livingPet.name,
          adoptedAt: livingPet.adoptedAt,
          streak: livingPet.streak || 0,
          generation: relationshipInfo.relationship === "Direct Line" ? (previousMember?.generation || 0) + 1 : previousMember?.generation || 1,
          sessionsCompleted: livingPet.sessionsCompleted || 0,
          mutations: livingPet.mutations || [],
          depth: relationshipInfo.relationship === "Direct Line" ? cemetery.length : Math.max(0, cemetery.length - 1),
          originalRelationship: relationshipInfo.relationship,
          relationship: relationshipInfo.relationship
        };
        
        members.push(currentMember);
        
        // Save the ID back to pet storage if it was generated
        if (!livingPet.id) {
          const { updatePet } = usePetStore.getState();
          updatePet({ id: petId });
        }
      }
    }
    
    // Save relationships to localStorage for consistency
    localStorage.setItem("kiki-family-relationships", JSON.stringify(savedRelationships));
    
    // Deduplicate members array before processing
    const uniqueMembers = members.filter((member, index, arr) => 
      arr.findIndex(m => m.id === member.id) === index
    );
    
    // Update relationship labels for display
    uniqueMembers.forEach(member => {
      const displayLabel = getDisplayRelationshipLabel(member, uniqueMembers);
      member.relationship = displayLabel;
    });
    
    // Build tree structure with proper genealogy positioning
    const buildGenealogyTree = (parentId?: string, depth = 0): FamilyMember[] => {
      const mainLineChildren = uniqueMembers
        .filter(member => member.parentId === parentId)
        .map((member, index) => ({
          ...member,
          depth,
          siblingIndex: index,
          children: buildGenealogyTree(member.id, depth + 1)
        }));
      
      // Add cousins and family branches at same level  
      const extendedAtLevel = uniqueMembers
        .filter(member => 
          !member.parentId && 
          member.generation === (depth + 1) && 
          (member.originalRelationship === "Cousin Line" || member.originalRelationship === "Family Branch")
        )
        .map((member, index) => ({
          ...member,
          depth,
          siblingIndex: mainLineChildren.length + index,
          children: buildGenealogyTree(member.id, depth + 1) // Allow cousins/family branches to have children too
        }));
      
      return [...mainLineChildren, ...extendedAtLevel];
    };
    
    const tree = buildGenealogyTree();
    
    // Calculate positions for multi-directional genealogy layout
    const calculateGenealogyPositions = (nodes: FamilyMember[], level = 0, startX = 200): number => {
      const isDesktop = window.innerWidth > 1024;
      const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
      const nodeWidth = isDesktop ? 140 : isTablet ? 180 : 180;
      const levelHeight = isDesktop ? 220 : isTablet ? 260 : 280;
      let currentX = startX;
      
      nodes.forEach((node) => {
        // Special positioning for cousin lines - closer to family
        if (node.originalRelationship === "Cousin Line") {
          node.x = currentX; // Same spacing as main line
          node.y = level * levelHeight + 80; // Same height as siblings and main line
          currentX += nodeWidth; // Same horizontal space as main line
        }
        // Special positioning for family branches (siblings) - same level as main line
        else if (node.originalRelationship === "Family Branch") {
          node.x = currentX;
          node.y = level * levelHeight + 80; // Same Y position as main line
          currentX += nodeWidth; // Same horizontal space as main line
        }
        // Main line positioning
        else if (node.children && node.children.length > 0) {
          const childrenStartX = currentX;
          const childrenEndX = calculateGenealogyPositions(node.children, level + 1, currentX);
          node.x = childrenStartX + (childrenEndX - childrenStartX - nodeWidth) / 2;
          currentX = childrenEndX;
          node.y = level * levelHeight + 80;
        } else {
          // Leaf node - place directly
          node.x = currentX;
          node.y = level * levelHeight + 80;
          currentX += nodeWidth;
        }
      });
      
      return currentX;
    };
    
    calculateGenealogyPositions(tree);
    
    // Deduplicate tree to prevent rendering duplicates
    const deduplicateTree = (nodes: FamilyMember[]): FamilyMember[] => {
      const seen = new Set<string>();
      return nodes.filter(node => {
        if (seen.has(node.id)) {
          return false;
        }
        seen.add(node.id);
        if (node.children) {
          node.children = deduplicateTree(node.children);
        }
        return true;
      });
    };
    
    const deduplicatedTree = deduplicateTree(tree);
    setFamilyTree(deduplicatedTree);
  };

  const getHeritageQuote = (name: string, member: FamilyMember) => {
    const isFounder = member.originalRelationship === "Founder";
    const quotes = isFounder ? founderQuotes : heritageQuotes;
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    return quote.replace(/\{name\}/g, name);
  };

  const getLastWords = (memberName: string) => {
    // Use member name for consistent randomization (same member always gets same quote)
    const seed = memberName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = seed % lastWords.length;
    return lastWords[index];
  };

  const formatCauseOfDeath = (reason: string) => {
    if (reason.includes("overdue")) return "Missed deadline";
    if (reason.includes("timer")) return "Timer expired";
    if (reason.includes("abandoned")) return "Session abandoned";
    if (reason.includes("boredom")) return "Inactive too long";
    if (reason.includes("rejected")) return "Rejected by friend";
    return "Task failure";
  };

  const formatDateRange = (adoptedAt: string, deathDate?: string) => {
    const adopted = new Date(adoptedAt);
    const birth = adopted.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    if (deathDate) {
      const died = new Date(deathDate);
      const death = died.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
      return `${birth} - ${death}`;
    }
    
    return birth;
  };

  const getDaysAlive = (adoptedAt: string, deathDate?: string) => {
    const adopted = new Date(adoptedAt);
    const died = deathDate ? new Date(deathDate) : new Date();
    const diffTime = Math.abs(died.getTime() - adopted.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getAllNodes = (tree: FamilyMember[]): FamilyMember[] => {
    const nodes: FamilyMember[] = [];
    const traverse = (node: FamilyMember) => {
      nodes.push(node);
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    tree.forEach(traverse);
    return nodes;
  };

  const renderGenealogyBranches = (tree: FamilyMember[], isDesktop: boolean, boxWidth: number, boxHeight: number, nodeScale: number) => {
    const branches: JSX.Element[] = [];
    
    const traverse = (node: FamilyMember) => {
      if (node.children && node.children.length > 0 && node.x !== undefined && node.y !== undefined) {
        const parentCenterX = node.x + (boxWidth / 2) + 10; // +10 for box offset
        
        // Start line IMMEDIATELY after the last element - no gap
        const hasDeathIndicator = !!node.deathDate;
        const hasMutations = node.mutations && node.mutations.length > 0;
        
        let lastElementY;
        if (hasDeathIndicator) {
          // Death indicator baseline Y position + margin below text, then scale
          const deathY = hasMutations ? (isDesktop ? 200 : 240) : (isDesktop ? 185 : 215);
          const fontSize = isDesktop ? 9 : 11;
          const margin = isDesktop ? 10 : 3; // Balanced margin for desktop
          lastElementY = (deathY + fontSize + margin) * nodeScale;
        } else {
          // For alive pets
          if (hasMutations) {
            // Mutations group center Y + radius + margin, then scale
            const mutationsY = isDesktop ? 180 : 210;
            const iconRadius = isDesktop ? 6 : 8;
            const margin = isDesktop ? 8 : 4; // Balanced margin for desktop
            lastElementY = (mutationsY + iconRadius + margin) * nodeScale;
          } else {
            // Date label baseline Y position + margin below text, then scale (dates are now the last element)
            const dateY = isDesktop ? 165 : 190;
            const fontSize = isDesktop ? 9 : 10;
            const margin = isDesktop ? 10 : 3; // Balanced margin for desktop
            lastElementY = (dateY + fontSize + margin) * nodeScale;
          }
        }
        
        const parentBottomY = node.y + lastElementY; // Properly scaled position with margin
        
        // Separate main line children from extended family
        const mainChildren = node.children.filter(c => 
          !c.originalRelationship || 
          c.originalRelationship === "Direct Line" ||
          c.originalRelationship === "Founder"
        );
        const siblings = node.children.filter(c => c.originalRelationship === "Family Branch");
        const extendedFamily = node.children.filter(c => c.originalRelationship === "Cousin Line");
        
        // Draw connections to main line children (traditional tree structure)
        if (mainChildren.length > 0) {
          if (mainChildren.length > 1) {
            const firstChild = mainChildren[0];
            const lastChild = mainChildren[mainChildren.length - 1];
            if (firstChild.x !== undefined && lastChild.x !== undefined) {
              const firstChildX = firstChild.x + (boxWidth / 2) + 10; // Responsive center
              const lastChildX = lastChild.x + (boxWidth / 2) + 10; // Responsive center
              const horizontalY = parentBottomY + 30;
              
              // Vertical line from parent down
              branches.push(
                <line
                  key={`parent-${node.id}`}
                  x1={parentCenterX}
                  y1={parentBottomY}
                  x2={parentCenterX}
                  y2={horizontalY}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  className="drop-shadow-sm"
                />
              );
              
              // Horizontal line connecting all main children
              branches.push(
                <line
                  key={`horizontal-${node.id}`}
                  x1={firstChildX}
                  y1={horizontalY}
                  x2={lastChildX}
                  y2={horizontalY}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  className="drop-shadow-sm"
                />
              );
            }
          }
          
          mainChildren.forEach((child) => {
            if (child.x !== undefined && child.y !== undefined) {
              const childCenterX = child.x + (boxWidth / 2) + 10; // Responsive center
              const childTopY = child.y + 10; // Top of the actual box
              
              if (mainChildren.length === 1) {
                // Single child - direct line
                branches.push(
                  <line
                    key={`${node.id}-${child.id}`}
                    x1={parentCenterX}
                    y1={parentBottomY}
                    x2={childCenterX}
                    y2={childTopY}
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    className="drop-shadow-sm"
                  />
                );
              } else {
                // Multiple children - line from horizontal bar down to child
                const horizontalY = parentBottomY + 30;
                branches.push(
                  <line
                    key={`${node.id}-${child.id}`}
                    x1={childCenterX}
                    y1={horizontalY}
                    x2={childCenterX}
                    y2={childTopY}
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    className="drop-shadow-sm"
                  />
                );
              }
            }
          });
        }
        
        // Draw connections to siblings (same style as direct line to show direct family connection)
        siblings.forEach((sibling) => {
          if (sibling.x !== undefined && sibling.y !== undefined) {
            const siblingCenterX = sibling.x + (boxWidth / 2) + 10; // Responsive center
            
            // Sibling line connects from parent's bottom to sibling's top (same as Direct Line logic)
            const siblingTopY = sibling.y + 10; // Top of the sibling box (same logic as child boxes)
            
            branches.push(
              <line
                key={`sibling-${node.id}-${sibling.id}`}
                x1={parentCenterX}
                y1={parentBottomY}
                x2={siblingCenterX}
                y2={siblingTopY}
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                className="drop-shadow-sm"
              />
            );
          }
        });
        
        // Draw connections to extended family (horizontal lines to siblings, not parent)
        extendedFamily.forEach((cousin, cousinIndex) => {
          if (cousin.x !== undefined && cousin.y !== undefined) {
            const cousinCenterX = cousin.x + (boxWidth / 2) + 10; // Responsive center
            const cousinTopY = cousin.y + 10; // Top of the cousin box
            
            // Find the sibling or child to connect to (the one directly to the left)
            const allSameLevelMembers = [...mainChildren, ...siblings, ...extendedFamily];
            const cousinIndexInLevel = mainChildren.length + siblings.length + cousinIndex;
            
            if (cousinIndexInLevel > 0) {
              const adjacentMember = allSameLevelMembers[cousinIndexInLevel - 1];
              if (adjacentMember && adjacentMember.x !== undefined && adjacentMember.y !== undefined) {
                const adjacentRightEdge = adjacentMember.x + boxWidth + 10; // Right edge of adjacent box
                const adjacentCenterY = adjacentMember.y + (boxHeight / 2) + 10; // Center Y of adjacent box
                const cousinLeftEdge = cousin.x + 10; // Left edge of cousin box
                const cousinCenterY = cousin.y + (boxHeight / 2) + 10; // Center Y of cousin box
                
                // Horizontal line connecting cousin to adjacent sibling/child
                branches.push(
                  <line
                    key={`cousin-${node.id}-${cousin.id}`}
                    x1={adjacentRightEdge}
                    y1={adjacentCenterY}
                    x2={cousinLeftEdge}
                    y2={cousinCenterY}
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeDasharray="2,6"
                    className="drop-shadow-sm"
                    opacity="0.8"
                  />
                );
              }
            }
          }
        });
        
        // Continue traversing all children
        node.children.forEach(child => traverse(child));
      }
    };
    
    tree.forEach(traverse);
    
    // Handle siblings of founders (who don't have parents in the tree structure)
    const founders = tree.filter(node => node.originalRelationship === "Founder");
    const foundersAndSiblings = tree.filter(node => 
      node.originalRelationship === "Founder" || 
      (node.originalRelationship === "Family Branch" && !node.parentId)
    );
    
    if (foundersAndSiblings.length > 1) {
      // Connect founder siblings horizontally
      for (let i = 1; i < foundersAndSiblings.length; i++) {
        const prevMember = foundersAndSiblings[i - 1];
        const currentMember = foundersAndSiblings[i];
        
        if (prevMember.x !== undefined && prevMember.y !== undefined && 
            currentMember.x !== undefined && currentMember.y !== undefined) {
          const prevRightEdge = prevMember.x + boxWidth + 10;
          const prevCenterY = prevMember.y + (boxHeight / 2) + 10;
          const currentLeftEdge = currentMember.x + 10;
          const currentCenterY = currentMember.y + (boxHeight / 2) + 10;
          
          branches.push(
            <line
              key={`founder-sibling-${prevMember.id}-${currentMember.id}`}
              x1={prevRightEdge}
              y1={prevCenterY}
              x2={currentLeftEdge}
              y2={currentCenterY}
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              className="drop-shadow-sm"
            />
          );
        }
      }
    }
    
    return branches;
  };

  const handleZoom = (delta: number, center?: { x: number, y: number }) => {
    setZoom((prev) => {
      const newZoom = Math.max(0.5, Math.min(2, prev + delta));
      
      // If center point provided, adjust pan to zoom into that point
      if (center && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = center.x - rect.left - rect.width / 2;
        const centerY = center.y - rect.top - rect.height / 2;
        
        setPan(prevPan => ({
          x: prevPan.x - centerX * (newZoom - prev) / prev,
          y: prevPan.y - centerY * (newZoom - prev) / prev
        }));
      }
      
      return newZoom;
    });
  };

  // Touch and mouse handlers for pan & zoom
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const point = { x: e.clientX, y: e.clientY };
    setDragStart(point);
    setLastPan(pan);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPan({
      x: lastPan.x + deltaX,
      y: lastPan.y + deltaY
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Touch zoom handling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(delta, { x: e.clientX, y: e.clientY });
  };

  // Reset view
  const resetView = () => {
    setZoom(0.8);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/kiki")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Family Tree</h1>
              <p className="text-xs text-muted-foreground">Generations of Kikies gave their lives for your productivity</p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={resetView}
              title="Reset view"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleZoom(0.2)}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleZoom(-0.2)}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative w-full flex-1 overflow-hidden touch-none pb-16 lg:pb-20"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {familyTree.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-12 px-6">
              <div className="text-6xl mb-6 animate-bounce">🌱</div>
              <h2 className="text-xl font-bold mb-3 text-primary">Your lineage begins here</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Complete your first task to plant the family tree
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center'
              }}
              viewBox={`0 0 ${Math.max(400, ...getAllNodes(familyTree).map(n => (n.x || 0) + 200))} ${Math.max(400, ...getAllNodes(familyTree).map(n => (n.y || 0) + 250))}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Alive glow effect */}
                <filter id="aliveGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                
                <radialGradient id="aliveRadial" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4"/>
                  <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0"/>
                </radialGradient>
                
                {/* Dead node gradient */}
                <radialGradient id="deadRadial" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#6b7280" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="#6b7280" stopOpacity="0"/>
                </radialGradient>
                
                {/* Mutation sparkle pattern */}
                <pattern id="mutationSparkle" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="8" cy="8" r="1" fill="#8b5cf6" opacity="0.6">
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/>
                  </circle>
                </pattern>
              </defs>

              {(() => {
                // Calculate responsive values once for the entire SVG
                const isDesktop = window.innerWidth > 1024;
                const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
                const boxWidth = isDesktop ? 110 : 130;
                const boxHeight = isDesktop ? 100 : 120;
                const nodeScale = isDesktop ? 0.7 : isTablet ? 0.8 : 0.85;
                
                return (
                  <>
                    {/* Render genealogy branches */}
                    {renderGenealogyBranches(familyTree, isDesktop, boxWidth, boxHeight, nodeScale)}

                    {/* Render genealogy nodes */}
                    {getAllNodes(familyTree).map((member) => {
                      const isHovered = hoveredMember === member.id;
                      const isAlive = !member.deathDate;
                      const hoverScale = 1; // Disabled hover scaling
                
                return (
                  <g
                    key={member.id}
                    transform={`translate(${member.x || 0}, ${member.y || 0}) scale(${hoverScale * nodeScale})`}
                    className="cursor-pointer transition-transform duration-300 ease-out pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMember(member);
                    }}
                    onMouseEnter={() => setHoveredMember(member.id)}
                    onMouseLeave={() => setHoveredMember(null)}
                    style={{ transformOrigin: `${isDesktop ? 65 : 75}px ${isDesktop ? 60 : 70}px` }}
                  >
                    {/* Background glow for alive members */}
                    {isAlive && (
                      <circle
                        cx={isDesktop ? 65 : 75}
                        cy={isDesktop ? 60 : 70}
                        r={isDesktop ? 75 : 85}
                        fill="url(#aliveRadial)"
                        filter="url(#aliveGlow)"
                        className="animate-pulse"
                      />
                    )}
                    
                    {/* Main node container - responsive kawaii rounded style */}
                    <rect
                      x={10}
                      y={10}
                      width={isDesktop ? 110 : 130}
                      height={isDesktop ? 100 : 120}
                      rx={20}
                      ry={20}
                      fill={isAlive ? "hsl(var(--primary)/10)" : "hsl(var(--muted))"}
                      stroke={isAlive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                      strokeWidth={isAlive ? "3" : "2"}
                      opacity={isAlive ? 1 : 0.7}
                      className="drop-shadow-lg"
                    />
                    
                    {/* Pet avatar - responsive size */}
                    <defs>
                      <clipPath id={`clip-${member.id}`}>
                        <rect
                          x={12}
                          y={12}
                          width={isDesktop ? 106 : 126}
                          height={isDesktop ? 96 : 116}
                          rx={18}
                          ry={18}
                        />
                      </clipPath>
                    </defs>
                    <image
                      x={12}
                      y={12}
                      width={isDesktop ? 106 : 126}
                      height={isDesktop ? 96 : 116}
                      href={getPetImage(member.type)}
                      opacity={isAlive ? 1 : 0.6}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip-${member.id})`}
                    />
                    
                    {/* Alive indicator - kawaii sparkle */}
                    {isAlive && (
                      <>
                        <circle cx={isDesktop ? 105 : 125} cy={25} r={isDesktop ? 4 : 6} fill="hsl(var(--primary))" className="animate-ping"/>
                        <circle cx={isDesktop ? 105 : 125} cy={25} r={isDesktop ? 3 : 5} fill="hsl(var(--primary))"/>
                        <text x={isDesktop ? 105 : 125} y={isDesktop ? 28 : 30} textAnchor="middle" fontSize={isDesktop ? "10" : "12"} fill="white">✨</text>
                      </>
                    )}
                    
                    {/* Generation number - responsive kawaii badge */}
                    <circle cx={25} cy={25} r={isDesktop ? 10 : 12} fill="hsl(var(--accent))" stroke="#ffffff" strokeWidth={isDesktop ? "2" : "3"}/>
                    <text
                      x={25}
                      y={isDesktop ? 29 : 31}
                      textAnchor="middle"
                      fontSize={isDesktop ? "12" : "14"}
                      fill="white"
                      fontWeight="bold"
                    >
                      {member.generation}
                    </text>
                    
                    {/* Name label - responsive size */}
                    <text
                      x={isDesktop ? 65 : 75}
                      y={isDesktop ? 135 : 155}
                      textAnchor="middle"
                      fontSize={isDesktop ? "14" : "16"}
                      fontWeight="bold"
                      fill={isAlive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                    >
                      {member.name.split(' ')[0]}
                    </text>
                    
                    {/* Relationship label */}
                    <text
                      x={isDesktop ? 65 : 75}
                      y={isDesktop ? 150 : 175}
                      textAnchor="middle"
                      fontSize={isDesktop ? "10" : "12"}
                      fill={isAlive ? "hsl(var(--primary)/80)" : "hsl(var(--muted-foreground))"}
                      fontStyle="italic"
                    >
                      {member.relationship}
                    </text>
                    
                    {/* Date range label */}
                    <text
                      x={isDesktop ? 65 : 75}
                      y={isDesktop ? 165 : 190}
                      textAnchor="middle"
                      fontSize={isDesktop ? "9" : "10"}
                      fill={isAlive ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground)/70)"}
                      fontFamily="monospace"
                    >
                      {formatDateRange(member.adoptedAt, member.deathDate)}
                    </text>
                    
                    {/* Mutation icons under node - responsive */}
                    {member.mutations && member.mutations.length > 0 && (
                      <g transform={`translate(${isDesktop ? 30 : 35}, ${isDesktop ? 180 : 210})`}>
                        {member.mutations.slice(0, isDesktop ? 3 : 4).map((_, index) => (
                          <circle
                            key={index}
                            cx={index * (isDesktop ? 16 : 20)}
                            cy={0}
                            r={isDesktop ? 6 : 8}
                            fill="hsl(var(--accent))"
                            stroke="#ffffff"
                            strokeWidth={isDesktop ? "1" : "2"}
                            className="drop-shadow-sm"
                          />
                        ))}
                        {member.mutations.length > (isDesktop ? 3 : 4) && (
                          <text
                            x={isDesktop ? 48 : 80}
                            y={4}
                            fontSize={isDesktop ? "10" : "12"}
                            fill="hsl(var(--accent))"
                            fontWeight="bold"
                          >
                            +{member.mutations.length - (isDesktop ? 3 : 4)}
                          </text>
                        )}
                      </g>
                    )}
                    
                    {/* Death indicator - responsive */}
                    {!isAlive && (
                      <text
                        x={isDesktop ? 65 : 75}
                        y={member.mutations && member.mutations.length > 0 ? (isDesktop ? 200 : 240) : (isDesktop ? 185 : 215)}
                        textAnchor="middle"
                        fontSize={isDesktop ? "9" : "11"}
                        fill="hsl(var(--destructive))"
                        fontWeight="500"
                      >
                        ⚰️ {formatCauseOfDeath(member.deathReason || "")}
                      </text>
                    )}
                      </g>
                    );
                  })}
                  </>
                );
              })()}
            </svg>
          </div>
        )}
      </div>

      {/* Enhanced Member Detail Modal */}
      <Sheet open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <SheetContent 
          side="bottom"
          className="h-auto max-h-[85vh] p-0 border-0 rounded-t-3xl [&>button]:focus:ring-0 [&>button]:focus:outline-none [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-primary"
        >
          {selectedMember && (
            <div className="w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={getPetImage(selectedMember.type)}
                      alt={selectedMember.name}
                      className="w-12 h-12 object-contain"
                    />
                  {!selectedMember.deathDate && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    {selectedMember.name}
                    <Badge variant="outline" className="text-xs">
                      Gen {selectedMember.generation}
                    </Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedMember.deathDate ? "Fallen Hero" : "Current Champion"}
                  </p>
                </div>
              </div>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {getDaysAlive(selectedMember.adoptedAt, selectedMember.deathDate)}
                </div>
                <div className="text-xs text-muted-foreground">Days Survived</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {selectedMember.streak}
                </div>
                <div className="text-xs text-muted-foreground">Best Streak</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success">
                  {selectedMember.sessionsCompleted}
                </div>
                <div className="text-xs text-muted-foreground">Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {selectedMember.mutations?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Mutations</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h4 className="font-semibold text-foreground">Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 p-2 bg-success/20 rounded">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span className="text-success-foreground">
                    Born: {new Date(selectedMember.adoptedAt).toLocaleDateString()}
                  </span>
                </div>
                {selectedMember.deathDate && (
                  <div className="flex items-center gap-3 p-2 bg-destructive/20 rounded">
                    <div className="w-2 h-2 bg-destructive rounded-full"></div>
                    <span className="text-destructive-foreground">
                      Died: {new Date(selectedMember.deathDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Death Details */}
            {selectedMember.deathDate && (
              <div className="space-y-2 p-4 bg-destructive/20 rounded-lg border-l-4 border-destructive">
                <h4 className="font-semibold text-destructive-foreground">Final Moments</h4>
                <p className="text-sm text-destructive">
                  {formatCauseOfDeath(selectedMember.deathReason || "")}
                </p>
                <p className="text-xs text-destructive/80 italic">
                  "{selectedMember.name} fought valiantly but couldn't overcome the challenge."
                </p>
              </div>
            )}

            {/* Inherited Powers */}
            {selectedMember.mutations && selectedMember.mutations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  🧬 Inherited Powers
                </h4>
                <div className="grid gap-2">
                  {selectedMember.mutations.map((mutation, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-accent/20 rounded-lg border border-accent/30">
                      <div className="w-8 h-8 bg-accent/30 rounded-full flex items-center justify-center">
                        ⚡
                      </div>
                      <span className="text-sm font-medium text-accent-foreground">{mutation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Heritage Quote */}
            {!selectedMember.deathDate ? (
              <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border-l-4 border-primary">
                <h4 className="font-semibold text-primary mb-2">Current Mission</h4>
                <p className="text-sm text-primary/80 italic">
                  "{getHeritageQuote(selectedMember.name.split(' ')[0], selectedMember)}"
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border-l-4 border-muted-foreground">
                <h4 className="font-semibold text-muted-foreground mb-2">Last Words</h4>
                <p className="text-sm text-muted-foreground italic">
                  "{getLastWords(selectedMember.name)}"
                </p>
              </div>
            )}

            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-sm border-t border-border">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/kiki")}
          >
            <HomeIcon className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/board")}
          >
            <Clock className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/kiki")}
          >
            <Cat className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            className="flex-1 flex justify-center items-center py-2 h-auto"
            onClick={() => navigate("/shop")}
          >
            <ShoppingBag className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FamilyTree;