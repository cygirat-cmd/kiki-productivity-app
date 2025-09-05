import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useAuth } from './AuthProvider';
import { X, Mail, Lock, User, Grip } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  required?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, required = false }) => {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('signin');
  const [isExpanded, setIsExpanded] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Handle opening animation
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame for smooth entrance
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
    } else {
      // Reset animation state when closed
      setIsAnimating(true);
    }
  }, [isOpen]);

  // Handle keyboard and resize events
  useEffect(() => {
    const handleResize = () => {
      if (isExpanded && window.innerHeight < 600) {
        setIsExpanded(true);
      }
    };

    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !required) {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('resize', handleResize);
      window.addEventListener('keydown', handleKeyboard);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyboard);
    };
  }, [isOpen, isExpanded]);

  // Touch/drag handlers for swipe to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const y = e.touches[0].clientY;
    const deltaY = y - startY;
    
    if (deltaY > 0) { // Only allow downward swipes
      setCurrentY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (currentY > 100) { // Threshold for dismissing
      handleClose();
    }
    setCurrentY(0);
    setIsDragging(false);
  };

  // Animated close handler
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300); // Match the animation duration
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current && !required) {
      handleClose();
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message);
      } else {
        // OAuth will redirect, so we don't need to handle success here
        // The user will be redirected back and logged in automatically
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };


  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent, isSignUp: boolean) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 AuthModal: Attempting to', isSignUp ? 'signUp' : 'signIn', 'with email:', email);
      const { error } = isSignUp 
        ? await signUp(email, password)
        : await signIn(email, password);

      console.log('🔐 AuthModal: Auth result:', { error: error?.message, success: !error });

      if (error) {
        setError(error.message);
      } else {
        console.log('🔐 AuthModal: Login successful, calling callbacks...');
        onClose();
        setEmail('');
        setPassword('');
        onSuccess?.();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Animation states
  const getSheetTransform = () => {
    if (isDragging) return `translateY(${currentY}px)`;
    if (isClosing) return 'translateY(100%)';
    if (isAnimating) return 'translateY(100%)';
    return 'translateY(0)';
  };

  const getBackdropOpacity = () => {
    if (isClosing) return 'opacity-0';
    if (isAnimating) return 'opacity-0';
    return 'opacity-100';
  };

  const sheetHeight = isExpanded ? 'h-screen' : 'h-[60vh]';

  return (
    <div 
      ref={backdropRef}
      className={`fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-6 pb-0 sm:p-8 sm:pb-0 transition-opacity duration-300 ease-out ${getBackdropOpacity()}`}
      onClick={handleBackdropClick}
      style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
    >
      <div 
        ref={sheetRef}
        className={`w-full max-w-md sm:max-w-lg bg-background rounded-t-3xl shadow-xl transition-all duration-300 ease-out ${sheetHeight} flex flex-col`}
        style={{ 
          transform: getSheetTransform(),
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
        onTouchStart={!required ? handleTouchStart : undefined}
        onTouchMove={!required ? handleTouchMove : undefined}
        onTouchEnd={!required ? handleTouchEnd : undefined}
      >
        {/* Drag Handle */}
        {!required && (
          <div className="flex justify-center py-3 px-6">
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full cursor-grab active:cursor-grabbing" />
          </div>
        )}

        {/* Header */}
        <div className={`flex justify-between items-center px-6 pb-4 ${required ? 'pt-6' : ''}`}>
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {required ? "Zaloguj się aby kontynuować" : "Dołącz do Kiki or Bust!"}
            </h2>
          </div>
          {!required && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="h-11 w-11 -mr-2 flex-shrink-0"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="space-y-6">
            {/* Value Proposition */}
            <div className="text-center space-y-3">
              <div className="text-3xl">☁️</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {required 
                  ? "Konto jest wymagane aby kontynuować korzystanie z aplikacji."
                  : "Zapisz postęp swojego Kiki w chmurze i uzyskaj dostęp z każdego miejsca!"
                }
              </p>
              {!required && (
                <Badge variant="secondary" className="text-xs px-3 py-1">
                  Darmowe zapisy • Synchronizacja
                </Badge>
              )}
            </div>

            {/* Google Sign In */}
            <div className="space-y-3">
              <Button 
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm"
                style={{ fontSize: '16px' }}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? 'Łączenie...' : 'Kontynuuj z Google'}
              </Button>
              
              <div className="flex items-center space-x-4">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-muted-foreground">lub</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-12 p-1">
                <TabsTrigger 
                  value="signin" 
                  className="h-10 text-base font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Zaloguj
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="h-10 text-base font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Zarejestruj
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-base font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="twoj@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 pl-11 text-base"
                        style={{ fontSize: '16px' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-base font-medium">
                      Hasło
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="Twoje hasło"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 pl-11 text-base"
                        style={{ fontSize: '16px' }}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-base font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="twoj@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 pl-11 text-base"
                        style={{ fontSize: '16px' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-base font-medium">
                      Hasło
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Wybierz silne hasło (min. 6 znaków)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 pl-11 text-base"
                        style={{ fontSize: '16px' }}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Continue Without Account */}
            {!required && (
              <div className="text-center pt-2">
                <Button 
                  variant="ghost" 
                  onClick={handleClose}
                  className="h-11 text-sm text-muted-foreground hover:text-foreground px-4"
                >
                  Kontynuuj bez konta (tylko lokalnie)
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="p-6 pt-4 border-t bg-background">
          <Button 
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as any, activeTab === 'signup');
            }}
            className="w-full h-14 text-base font-semibold btn-kawaii"
            disabled={loading || !email || !password}
            style={{ fontSize: '16px' }}
          >
            {loading 
              ? (activeTab === 'signup' ? 'Tworzenie konta...' : 'Logowanie...') 
              : (activeTab === 'signup' ? 'Utwórz konto' : 'Zaloguj się')
            }
          </Button>
          
          <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">
            {required 
              ? "Logowanie jest wymagane aby kontynuować"
              : "Postęp zostanie zsynchronizowany z chmurą"
            }
          </p>
        </div>
      </div>
    </div>
  );
};