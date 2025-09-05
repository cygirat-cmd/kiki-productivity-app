import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { supabase, VerificationRecord } from "@/lib/supabaseClient";
import { getVerificationImageSrc } from "@/services/proofs";

// Use the VerificationRecord interface from supabaseClient.ts
type VerificationData = VerificationRecord;

// Component to handle image display with Storage support
const ProofImage = ({ verification }: { verification: VerificationData }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      try {
        const src = await getVerificationImageSrc(verification);
        setImageSrc(src);
      } catch (error) {
        console.error('Failed to load image:', error);
        setImageSrc(null);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [verification]);

  if (loading) {
    return (
      <div>
        <h3 className="font-semibold text-lg">Proof Photo:</h3>
        <div className="border rounded-lg overflow-hidden h-64 flex items-center justify-center bg-muted/50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div>
        <h3 className="font-semibold text-lg">Proof Photo:</h3>
        <div className="border rounded-lg overflow-hidden h-64 flex items-center justify-center bg-muted/50">
          <p className="text-muted-foreground">No image available</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-lg">Proof Photo:</h3>
      <div className="border rounded-lg overflow-hidden">
        <img 
          src={imageSrc} 
          alt="Task proof" 
          className="w-full h-64 object-cover"
        />
      </div>
    </div>
  );
};

const FriendVerification = () => {
  const { verificationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Broadcast channel for cross-tab communication
  const [broadcastChannel] = useState(() => new BroadcastChannel('kiki-verification'));

  useEffect(() => {
    const loadVerification = async () => {
      if (!verificationId) {
        setLoading(false);
        return;
      }

      try {
        // Try loading from Supabase first
        const { data, error } = await supabase
          .from('verifications')
          .select('*')
          .eq('id', verificationId)
          .single();

        if (!error && data) {
          // Check if trial has expired
          if (data.status === 'trial' && data.review_deadline) {
            const deadline = new Date(data.review_deadline);
            const now = new Date();
            
            if (deadline < now) {
              // Trial has expired
              setVerification({
                ...data,
                status: 'rejected',
                reason: 'trial expired'
              });
            } else {
              setVerification(data);
            }
          } else {
            setVerification(data);
          }
          setLoading(false);
          return;
        }
      } catch (error) {
        console.log('Supabase load failed, trying localStorage');
      }

      // Fallback to localStorage
      const verifications = JSON.parse(localStorage.getItem("kiki-verifications") || "[]");
      const foundVerification = verifications.find((v: VerificationData) => v.id === verificationId);
      
      setVerification(foundVerification || null);
      setLoading(false);
    };

    loadVerification();
  }, [verificationId]);

  const handleDecision = async (approved: boolean) => {
    if (!verification) return;

    // Check if trial is still valid before allowing decision
    if (verification.status === 'trial' && verification.review_deadline) {
      const deadline = new Date(verification.review_deadline);
      const now = new Date();
      
      if (deadline < now) {
        toast({
          title: "Trial Expired ⏰",
          description: "This verification has expired and can no longer be modified.",
          variant: "destructive"
        });
        setVerification({
          ...verification,
          status: 'rejected',
          reason: 'trial expired'
        });
        return;
      }
    }

    // Show deprecation warning for old verification flow but still allow it to work
    toast({
      title: "Legacy Review Link ⚠️",
      description: "This verification link uses an older method. For future reviews, ask your friend to send you a new review link.",
      variant: "default"
    });

    const newStatus = approved ? "approved" : "rejected";
    
    console.log('FriendVerification: Updating status to:', newStatus, 'for ID:', verification.id);
    
    let supabaseSuccess = false;
    try {
      // Update in Supabase first
      const { error } = await supabase
        .from('verifications')
        .update({ status: newStatus })
        .eq('id', verification.id);

      if (error) {
        console.error('Supabase update failed:', error);
      } else {
        console.log('Supabase update successful');
        supabaseSuccess = true;
      }
    } catch (error) {
      console.error('Error updating verification:', error);
    }
    
    // ALWAYS update localStorage regardless of Supabase success/failure
    // This ensures the verification works for both cloud and local checking
    const verifications = JSON.parse(localStorage.getItem("kiki-verifications") || "[]");
    console.log('Before localStorage update:', verifications.length, 'verifications');
    const updatedVerifications = verifications.map((v: VerificationData) => {
      if (v.id === verification.id) {
        console.log('Found verification to update:', v.id, 'changing status from', v.status, 'to', newStatus);
        return { ...v, status: newStatus };
      }
      return v;
    });
    localStorage.setItem("kiki-verifications", JSON.stringify(updatedVerifications));
    console.log('localStorage updated successfully');
    
    // Also inform user about update status
    if (supabaseSuccess) {
      console.log('✅ Both Supabase and localStorage updated');
    } else {
      console.log('⚠️ Only localStorage updated (Supabase failed)');
    }
    
    // Broadcast the update to other tabs (like QuickTask waiting for approval)
    console.log('Broadcasting verification update to other tabs');
    broadcastChannel.postMessage({
      type: 'verification-update',
      id: verification.id,
      status: newStatus
    });
    
    setVerification({ ...verification, status: newStatus });

    toast({
      title: approved ? "Task approved! ✅" : "Task rejected ❌",
      description: approved 
        ? "You've helped save Kiki! Their human can proceed." 
        : "Kiki's fate is sealed... their human will face consequences.",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p>Loading verification...</p>
        </div>
      </div>
    );
  }

  if (!verification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex items-center justify-center p-4">
        <Card className="card-kawaii max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Verification Not Found</h1>
          <p>This verification link is invalid or has expired.</p>
          <Button onClick={() => navigate("/")} className="btn-kawaii">
            Go to Kiki Home
          </Button>
        </Card>
      </div>
    );
  }

  // Check if verification is expired
  const isExpired = verification.status === 'rejected' && verification.reason === 'trial expired';
  const timeRemaining = verification.review_deadline ? 
    Math.max(0, new Date(verification.review_deadline).getTime() - new Date().getTime()) : 0;
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border-b p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">Friend Verification</h1>
          </div>
          <Badge className={`${
            verification.status === "approved" ? "bg-success text-success-foreground" :
            verification.status === "rejected" ? "bg-destructive text-destructive-foreground" :
            "bg-warning text-warning-foreground"
          }`}>
            {verification.status === "approved" ? "Approved" :
             verification.status === "rejected" ? "Rejected" : "Pending"}
          </Badge>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        <Card className="card-kawaii space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">🔍 Verification Request</h2>
            <p className="text-muted-foreground">
              Help verify if your friend actually completed their task!
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Task:</h3>
              <p className="text-muted-foreground bg-muted/50 rounded p-2">
                "{verification.task}"
              </p>
            </div>

            <ProofImage verification={verification} />

            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Submitted:</span>
                <p className="text-muted-foreground">{formatDate(verification.timestamp)}</p>
              </div>
              
              {verification.review_deadline && verification.status === 'trial' && (
                <div className={`rounded-lg p-3 ${timeRemaining > 0 ? 'bg-warning/20' : 'bg-destructive/20'}`}>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">
                      {timeRemaining > 0 ? (
                        `${hoursRemaining}h ${minutesRemaining}m remaining`
                      ) : (
                        'EXPIRED'
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires: {formatDate(verification.review_deadline)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {isExpired ? (
            <div className="text-center p-4 rounded-lg bg-destructive/20 text-destructive-foreground">
              <div className="space-y-2">
                <XCircle className="w-12 h-12 mx-auto" />
                <h3 className="text-lg font-bold">Trial Expired ⏰</h3>
                <p className="text-sm">This verification link has expired. The image has been automatically deleted for privacy.</p>
              </div>
            </div>
          ) : verification.status === "trial" && timeRemaining > 0 ? (
            <div className="space-y-3">
              <div className="bg-warning/20 rounded-lg p-4 text-center">
                <p className="text-sm text-warning-foreground">
                  ⚠️ <strong>Kiki's life depends on your decision!</strong> 
                  Look carefully at the photo - did they actually complete the task?
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => handleDecision(true)}
                  className="btn-success h-12"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  ✅ Approve
                  <br />
                  <span className="text-xs">They did it!</span>
                </Button>
                
                <Button 
                  onClick={() => handleDecision(false)}
                  className="btn-death h-12"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  ❌ Reject
                  <br />
                  <span className="text-xs">Suspicious...</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className={`text-center p-4 rounded-lg ${
              verification.status === "approved" 
                ? "bg-success/20 text-success-foreground" 
                : "bg-destructive/20 text-destructive-foreground"
            }`}>
              {verification.status === "approved" ? (
                <div className="space-y-2">
                  <CheckCircle className="w-12 h-12 mx-auto" />
                  <h3 className="text-lg font-bold">Task Approved! 🎉</h3>
                  <p className="text-sm">Kiki lives to see another day thanks to you!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <XCircle className="w-12 h-12 mx-auto" />
                  <h3 className="text-lg font-bold">Task Rejected 💀</h3>
                  <p className="text-sm">Kiki's fate is sealed... you saw through their deception.</p>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm italic text-muted-foreground">
            "Being a good friend means holding each other accountable... 
            even if it means condemning a virtual pet to death! 😅"
          </p>
        </div>
      </div>
    </div>
  );
};

export default FriendVerification;