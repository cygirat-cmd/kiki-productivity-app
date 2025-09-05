import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { AuthModal } from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Cloud, Heart, Zap } from 'lucide-react';
import kikiCat from '@/assets/kiki/Kiki.png';

const Welcome = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartGame = () => {
    // Mark that user has seen welcome screen
    localStorage.setItem('kiki-has-seen-welcome', 'true');
    navigate('/onboarding');
  };

  const handleLoginFirst = () => {
    setShowAuthModal(true);
  };

  const handleAuthComplete = () => {
    setShowAuthModal(false);
    // After login, proceed to game
    handleStartGame();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          {/* Logo/Hero */}
          <div className="relative">
            <img 
              src={kikiCat} 
              alt="Kiki" 
              className="w-32 h-32 mx-auto object-contain bounce-cute"
            />
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Kiki or Bust!
            </h1>
            <p className="text-lg text-muted-foreground">
              Twój wirtualny towarzysz produktywności
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="flex flex-col items-center space-y-1">
              <Heart className="w-6 h-6 text-red-400" />
              <span className="text-xs text-muted-foreground">Opiekuj się Kiki</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <Zap className="w-6 h-6 text-yellow-400" />
              <span className="text-xs text-muted-foreground">Wykonuj zadania</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <Cloud className="w-6 h-6 text-blue-400" />
              <span className="text-xs text-muted-foreground">Zapisz w chmurze</span>
            </div>
            <div className="flex flex-col items-center space-y-1">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <span className="text-xs text-muted-foreground">Buduj streak</span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm">
              🐱 <strong>Adoptuj swojego Kiki</strong> - wirtualnego towarzysza, który motywuje Cię do produktywności
            </p>
            <p className="text-xs text-muted-foreground">
              Wykonuj zadania na czas, żeby utrzymać Kiki przy życiu. Zaniedbaj obowiązki... i pożegnaj się z nim na zawsze! 💀
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {user ? (
            <div className="space-y-3">
              <Badge variant="secondary" className="mb-2">
                ✅ Zalogowany jako {user.email}
              </Badge>
              <Button 
                onClick={handleStartGame}
                className="w-full btn-kawaii h-12"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Rozpocznij przygodę!
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button 
                onClick={handleLoginFirst}
                className="w-full btn-kawaii h-12"
              >
                <Cloud className="w-4 h-4 mr-2" />
                Zaloguj się i rozpocznij
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">lub</span>
                </div>
              </div>

              <Button 
                onClick={handleStartGame}
                variant="outline"
                className="w-full h-12"
              >
                Graj bez konta (tylko lokalnie)
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Bez konta postęp zostanie zapisany tylko na tym urządzeniu
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Czy jesteś gotowy na wyzwanie produktywności? 🚀
          </p>
        </div>
      </Card>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthComplete}
      />
    </div>
  );
};

export default Welcome;