import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, ArrowLeft, AlertTriangle, Upload } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/lib/supabaseClient";

interface BuddyReviewData {
  verification_id: string;
  task: string;
  status: 'pending' | 'trial' | 'approved' | 'rejected';
  review_deadline: string | null;
  token_expires_at: string;
  photo_storage_path: string | null;
  signedUrl?: string;
}

const BuddyReview = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState<BuddyReviewData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [terminateHolding, setTerminateHolding] = useState(false);
  const [terminateProgress, setTerminateProgress] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Extract token from query params
  const params = new URLSearchParams(location.search);
  const token = params.get('token');

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid Link",
        description: "This review link is missing required parameters.",
        variant: "destructive"
      });
      navigate("/");
      return;
    }

    loadReviewData();
    loadImageUrl();
  }, [token]);

  const loadImageUrl = async () => {
    if (!token) return;

    try {
      const response = await fetch(
        `https://hwriwdbzervvmfpuzjqj.supabase.co/functions/v1/review-image/${token}`
      );
      
      if (!response.ok) {
        if (response.status === 401) {
          setImgError('unauthorized');
        } else if (response.status === 404) {
          setImgError('invalid token');
        } else if (response.status === 410) {
          setImgError('expired');
        } else {
          setImgError('fetch failed');
        }
        return;
      }

      const { data, error } = await response.json();

      if (error) {
        // Map API errors to user-friendly messages
        switch (error) {
          case 'Invalid token':
          case 'Missing token':
          case 'Invalid token format':
            setImgError('invalid token');
            break;
          case 'Token expired':
            setImgError('expired');
            break;
          case 'Verification not found':
            setImgError('not found');
            break;
          case 'Not accessible':
            setImgError('not accessible');
            break;
          case 'No photo':
            setImgError('no image');
            break;
          case 'Failed to generate signed URL':
            setImgError('sign failed');
            break;
          default:
            setImgError('unknown');
        }
        return;
      }

      if (data?.signedUrl) {
        setImgSrc(data.signedUrl);
        setImgError(null);
      } else {
        setImgError('no url');
      }
    } catch (error) {
      console.error('Failed to fetch image URL:', error);
      setImgError('network error');
    }
  };

  const loadReviewData = async () => {
    if (!token) return;

    try {
      // Call RPC to get review data using token (no authentication required)
      const { data, error } = await supabase.rpc('get_review_data', { 
        p_token: token  // string (TEXT in DB)
      });
      
      if (error) {
        console.error('Failed to load review data:', error);
        toast({
          title: "Review Unavailable",
          description: "This review link has expired or is invalid.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      // data might be array or single row - use first element if array
      const row = Array.isArray(data) ? data[0] : data;
      
      if (!row) {
        toast({
          title: "Invalid Token",
          description: "This review token is invalid or has expired.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const reviewData: BuddyReviewData = {
        verification_id: row.verification_id,
        task: row.task,
        status: row.status,
        review_deadline: row.review_deadline,
        token_expires_at: row.token_expires_at,
        photo_storage_path: row.photo_storage_path || null
      };

      console.log('Review data loaded:', {
        verification_id: row.verification_id,
        status: row.status,
        fullRow: row
      });

      // Check if token has expired
      const tokenExpiry = new Date(row.token_expires_at);
      const now = new Date();
      
      if (tokenExpiry < now) {
        toast({
          title: "Token Expired ⏰",
          description: "This review link has expired. Ask your friend for a new link.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      setReviewData(reviewData);
      
      // Check if this verification is already completed (approved or rejected)
      if (reviewData.status === 'approved' || reviewData.status === 'rejected') {
        setCompleted(true);
        setDecision(reviewData.status === 'approved' ? 'approve' : 'reject');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading review data:', error);
      toast({
        title: "Error",
        description: "Failed to load review data. Please try again.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImgSrc(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;

    setUploading(true);
    setUploadError(null);

    try {
      const SUPABASE_URL = 'https://hwriwdbzervvmfpuzjqj.supabase.co';

      const fd = new FormData();
      fd.append('token', token);
      fd.append('file', selectedFile);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-proof-upload`, { 
        method: 'POST', 
        body: fd 
      });
      
      const json = await res.json().catch(() => ({}));
      
      if (!res.ok || !json.ok) {
        const errorMessage = json.error || `Upload failed (${res.status})`;
        
        // Map specific errors to user-friendly messages
        switch (errorMessage) {
          case 'invalid token':
          case 'missing token':
            setUploadError('Invalid token');
            break;
          case 'token expired':
            setUploadError('Token expired');
            break;
          case 'file too large':
            setUploadError('File too large');
            break;
          case 'invalid mime':
            setUploadError('Wrong file type');
            break;
          case 'rate-limited':
            setUploadError('Too many uploads, wait 15 minutes');
            break;
          default:
            setUploadError(errorMessage);
        }
        return;
      }

      // Show preview if signed URL exists
      if (json.preview) {
        setImgSrc(json.preview);
      }

      toast({
        title: "Photo uploaded!",
        description: "Proof has been submitted successfully.",
      });

      // Refresh review data to get updated status
      await loadReviewData();

    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleTerminateStart = () => {
    setTerminateHolding(true);
    setTerminateProgress(0);
    
    const interval = setInterval(() => {
      setTerminateProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          handleTerminateComplete();
          return 100;
        }
        return prev + 5; // 2 second hold time
      });
    }, 100);

    // Clear interval if user releases
    const cleanup = () => {
      clearInterval(interval);
      setTerminateHolding(false);
      setTerminateProgress(0);
    };

    // Add event listeners for mouse/touch end
    document.addEventListener('mouseup', cleanup, { once: true });
    document.addEventListener('touchend', cleanup, { once: true });
  };

  const handleTerminateComplete = () => {
    handleDecision('reject');
  };

  const handleDecision = async (reviewDecision: 'approve' | 'reject') => {
    if (!token || processing) return;

    setProcessing(true);
    
    try {
      // Call RPC to submit review decision
      const { error } = await supabase.rpc('review_verification', { 
        p_token: token,  // string (TEXT in DB)
        p_decision: reviewDecision  // 'approve' | 'reject'
      });

      if (error) {
        console.error('Review submission failed:', error);
        toast({
          title: "Review Failed",
          description: error.message || "Failed to submit review. Please try again.",
          variant: "destructive"
        });
        setProcessing(false);
        return;
      }

      // Success - only set UI status after successful RPC call
      setDecision(reviewDecision);
      setCompleted(true);
      
      // Clean up photo from storage after decision
      await cleanupCurrentVerification();
      
      toast({
        title: reviewDecision === 'approve' ? "Kiki survives. Efficiency certified." : "Kiki terminated. Replacement unit scheduled.",
        description: reviewDecision === 'approve' 
          ? "Task approved successfully." 
          : "Task rejected. New Kiki will be deployed.",
      });

    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: "Error",
        description: (error as any)?.message ?? "Review failed. Try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };


  const cleanupCurrentVerification = async () => {
    try {
      if (!reviewData?.verification_id) return;

      console.log('🧹 Cleaning up verification after review:', reviewData.verification_id);
      
      // For review page, we need to get the original verification owner's userId
      // Edge Function will authenticate with Service Role Key for cleanup
      try {
        const baseUrl = 'https://hwriwdbzervvmfpuzjqj.supabase.co';
        
        // RPC only cleans database, we need to clean storage manually
        const { error: cleanupError } = await supabase.rpc('cleanup_approved_verification', {
          p_token: token
        });
        
        if (cleanupError) {
          console.warn('RPC cleanup failed:', cleanupError);
        } else {
          console.log('✅ RPC cleaned up verification from database');
        }
        
        // Use edge function with service role for storage deletion
        if (reviewData?.photo_storage_path) {
          try {
            const cleanupResponse = await fetch(
              `${baseUrl}/functions/v1/cleanup-verification`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  token: token
                }),
              }
            );
            
            if (!cleanupResponse.ok) {
              console.warn('Edge function cleanup failed, trying fallback');
              await fallbackCleanup();
            } else {
              console.log('✅ Photo deleted via edge function');
            }
          } catch (error) {
            console.warn('Edge function error, trying fallback:', error);
            await fallbackCleanup();
          }
        }
      } catch (edgeFunctionError) {
        console.warn('Edge Function unavailable, using direct cleanup:', edgeFunctionError);
        await fallbackCleanup();
      }
      
    } catch (error) {
      console.error('Failed to cleanup verification:', error);
      // Don't throw error - cleanup is best effort
    }
  };

  const fallbackCleanup = async () => {
    try {
      if (reviewData?.photo_storage_path) {
        console.log('🗑️ Attempting to delete storage file:', reviewData.photo_storage_path);
        
        // List files in the user folder to find the exact file
        const pathParts = reviewData.photo_storage_path.split('/');
        const userFolder = pathParts[0]; // e.g., "8d3bf5c8-c819-46cd-9412-461be7277790"
        const fileName = pathParts[1]; // e.g., "task_fdsfdasfds_1756941566334.jpg"
        
        console.log('📁 Checking folder:', userFolder, 'for file:', fileName);
        
        const { data: listResult, error: listError } = await supabase.storage
          .from('proofs')
          .list(userFolder);
        console.log('📁 File list check:', { listResult, listError });
        
        // Now try to delete using the full path
        const { data: storageResult, error: storageError } = await supabase.storage
          .from('proofs')
          .remove([reviewData.photo_storage_path]);
        
        if (storageError) {
          console.error('❌ Storage deletion failed:', storageError);
        } else {
          console.log('✅ Storage deletion response:', storageResult);
          
          // Verify deletion worked
          const { data: verifyDownload, error: verifyError } = await supabase.storage
            .from('proofs')
            .download(reviewData.photo_storage_path);
          console.log('🔍 Post-deletion verification:', { 
            stillExists: !verifyError,
            verifyError: verifyError?.message 
          });
        }
      } else {
        console.log('⚠️ No photo_storage_path found in reviewData');
      }

      console.log('🗑️ Attempting to delete verification record:', reviewData.verification_id);
      const { data: dbResult, error: dbError } = await supabase
        .from('verifications')
        .delete()
        .eq('id', reviewData.verification_id);

      if (dbError) {
        console.error('❌ Database deletion failed:', dbError);
      } else {
        console.log('✅ Database record deleted:', dbResult);
      }

      console.log('✅ Fallback cleanup completed');
    } catch (error) {
      console.error('Fallback cleanup failed:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeRemaining = () => {
    if (!reviewData?.review_deadline) return null;
    
    const deadline = new Date(reviewData.review_deadline);
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();
    
    if (remaining <= 0) return "EXPIRED";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex items-center justify-center p-4">
        <Card className="card-kawaii max-w-md w-full text-center space-y-4">
          <div className="animate-spin w-8 h-8 mx-auto border-4 border-primary border-t-transparent rounded-full"></div>
          <p>Loading review...</p>
        </Card>
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex items-center justify-center p-4">
        <Card className="card-kawaii max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold text-destructive">Review Unavailable</h1>
          <p>This review link has expired or is no longer valid.</p>
          <Button onClick={() => navigate("/")} className="btn-kawaii">
            Go to Kiki Home
          </Button>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex items-center justify-center p-4">
        <Card className="card-kawaii max-w-md w-full text-center space-y-6">
          {decision === 'approve' ? (
            <CheckCircle className="w-16 h-16 mx-auto text-success" />
          ) : (
            <XCircle className="w-16 h-16 mx-auto text-destructive" />
          )}
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              {decision === 'approve' ? 'Kiki survives' : 'Kiki terminated'}
            </h1>
            <p className="text-muted-foreground">
              {decision === 'approve' 
                ? 'Efficiency certified.'
                : 'Replacement unit scheduled.'
              }
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm">
              <strong>Task:</strong> {reviewData.task}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Review submitted
            </p>
          </div>

          <Button onClick={() => navigate("/")} className="btn-kawaii w-full">
            Done
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">Welcome, Auditor.</h1>
          <p className="text-sm text-gray-600">Review the proof. Should we keep Kiki or terminate it?</p>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        <Card className="bg-white p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-medium mb-2">{reviewData.task}</h2>
            {reviewData.review_deadline && (
              <div className="text-sm text-gray-500">
                {getTimeRemaining()}
              </div>
            )}
          </div>

          {/* Image Display or Upload */}
          <div className="border rounded-lg overflow-hidden bg-gray-50">
            {imgSrc ? (
              <img 
                src={imgSrc}
                alt="Task proof"
                className="w-full h-auto max-h-80 object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const parent = img.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="p-8 text-center text-gray-500">Failed to load image</div>';
                  }
                }}
              />
            ) : imgError === 'no image' ? (
              // Upload interface when no image exists
              <div className="p-6 text-center space-y-4">
                <p className="text-gray-600">Upload proof photo</p>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="photo-upload"
                />
                <label 
                  htmlFor="photo-upload"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors"
                >
                  Take Photo
                </label>
                {selectedFile && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Selected: {selectedFile.name}
                    </p>
                    <Button 
                      onClick={handleUpload}
                      disabled={uploading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </Button>
                  </div>
                )}
                {uploadError && (
                  <div className="text-red-600 text-sm">
                    {uploadError}
                  </div>
                )}
              </div>
            ) : imgError ? (
              <div className="p-8 text-center text-gray-500">
                {imgError === 'expired' ? 'Image link expired' : 
                 imgError === 'not found' ? 'Image not found' :
                 'Failed to load image'}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin w-6 h-6 mx-auto border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="mt-2">Loading...</p>
              </div>
            )}
          </div>

          {/* Decision Buttons */}
          {imgSrc && !imgError && (
            <div className="space-y-3">
              <Button 
                onClick={() => handleDecision('approve')}
                disabled={processing}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
              >
                {processing ? "Processing..." : "Keep Kiki"}
              </Button>
              
              <Button 
                onMouseDown={handleTerminateStart}
                onTouchStart={handleTerminateStart}
                disabled={processing || terminateHolding}
                className="relative w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium overflow-hidden"
              >
                {/* Progress bar background */}
                <div 
                  className="absolute inset-0 bg-red-800 transition-all duration-100 ease-linear"
                  style={{ 
                    width: `${terminateProgress}%`,
                    opacity: terminateHolding ? 0.3 : 0 
                  }}
                />
                {/* Button text */}
                <span className="relative z-10">
                  {processing ? "Processing..." : 
                   terminateHolding ? "Hold to Terminate..." : 
                   "Terminate Kiki"}
                </span>
              </Button>
            </div>
          )}

          {!imgSrc && imgError === 'no image' && (
            <div className="text-center text-sm text-gray-500">
              Upload a photo to enable review options
            </div>
          )}

          {reviewData.review_deadline && (
            <div className="text-center text-xs text-gray-500">
              Link expires: {formatDate(reviewData.token_expires_at)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default BuddyReview;