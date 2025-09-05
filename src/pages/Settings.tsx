import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Shield, 
  Bell, 
  Palette, 
  Volume2, 
  Globe, 
  Smartphone,
  Database,
  Lock,
  Eye,
  EyeOff,
  ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { secureStorage } from "@/utils/encryption";

const Settings = () => {
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check encryption status on mount
  useState(() => {
    const checkEncryption = async () => {
      try {
        const testData = await secureStorage.getItem('kiki-pet');
        setEncryptionEnabled(!!testData || !!localStorage.getItem('kiki-secure-kiki-pet'));
      } catch {
        setEncryptionEnabled(false);
      }
    };
    checkEncryption();

    // Check notification permission
    if ('Notification' in window) {
      setNotifications(Notification.permission === 'granted');
    }

    // Check sound settings from localStorage
    const soundSetting = localStorage.getItem('kiki-sound-enabled');
    setSoundEnabled(soundSetting !== 'false');
  });

  const handleNotificationToggle = async () => {
    if (!notifications) {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotifications(true);
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive task reminders and updates"
        });
      } else {
        toast({
          title: "Notifications Blocked",
          description: "Enable notifications in your browser settings",
          variant: "destructive"
        });
      }
    } else {
      // Cannot programmatically disable, show instruction
      toast({
        title: "Disable Notifications",
        description: "Go to browser settings to disable notifications for this site",
      });
    }
  };

  const handleSoundToggle = () => {
    const newSoundState = !soundEnabled;
    setSoundEnabled(newSoundState);
    localStorage.setItem('kiki-sound-enabled', newSoundState.toString());
    
    toast({
      title: newSoundState ? "Sound Effects Enabled" : "Sound Effects Disabled",
      description: newSoundState ? "Kiki will make sounds again" : "Kiki will be silent"
    });
  };

  const settingsSections = [
    {
      title: "Notifications & Sound",
      icon: Bell,
      items: [
        {
          title: "Push Notifications",
          description: notifications ? "Enabled" : "Disabled",
          icon: Bell,
          action: handleNotificationToggle,
          toggle: true,
          toggleValue: notifications
        },
        {
          title: "Sound Effects",
          description: soundEnabled ? "Enabled" : "Disabled", 
          icon: Volume2,
          action: handleSoundToggle,
          toggle: true,
          toggleValue: soundEnabled
        }
      ]
    },
    {
      title: "Appearance",
      icon: Palette,
      items: [
        {
          title: "Theme",
          description: "Light, dark, or system theme",
          icon: Palette,
          action: () => {
            toast({
              title: "Coming Soon",
              description: "Theme customization will be available soon"
            });
          }
        },
        {
          title: "Language",
          description: "Choose your preferred language",
          icon: Globe,
          action: () => {
            toast({
              title: "Coming Soon", 
              description: "Multiple languages will be supported soon"
            });
          }
        }
      ]
    },
    {
      title: "Advanced",
      icon: Smartphone,
      items: [
        {
          title: "Data Storage",
          description: "Local storage and cloud sync settings",
          icon: Database,
          action: () => {
            toast({
              title: "Coming Soon",
              description: "Advanced storage settings will be available soon"
            });
          }
        },
        {
          title: "About Kiki",
          description: "App version and information",
          icon: Eye,
          action: () => {
            toast({
              title: "Kiki App v1.0.0",
              description: "Your productivity companion with heart ❤️"
            });
          }
        }
      ]
    },
    {
      title: "Privacy & Security",
      icon: Shield,
      items: [
        {
          title: "Privacy Settings",
          description: "Data export, deletion, and encryption",
          icon: Lock,
          action: () => navigate('/privacy'),
          badge: encryptionEnabled ? "🔒 Encrypted" : "🔓 Unencrypted",
          badgeColor: encryptionEnabled ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-sm text-muted-foreground">Customize your Kiki experience</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-4 space-y-6">
        {settingsSections.map((section, sectionIndex) => (
          <Card key={sectionIndex} className="card-kawaii">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <section.icon className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">{section.title}</h2>
              </div>
              
              <div className="space-y-3">
                {section.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={item.action}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium text-sm">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {item.badge && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${item.badgeColor || 'bg-muted/50'}`}
                        >
                          {item.badge}
                        </Badge>
                      )}
                      
                      {item.toggle ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-14 p-0 ${
                            item.toggleValue 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {item.toggleValue ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </Button>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}

      </div>
    </div>
  );
};

export default Settings;