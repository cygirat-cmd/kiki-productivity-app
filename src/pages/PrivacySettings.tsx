import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Download, 
  Trash2, 
  Shield, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Lock,
  FileText,
  Database,
  Cloud
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { exportUserData, deleteAllUserData, downloadDataExport, generatePrivacyReport, UserDataExport } from "@/utils/gdpr";
import { migrateToEncryptedStorage, secureStorage } from "@/utils/encryption";
import { rateLimiter } from "@/utils/rateLimiter";

const PrivacySettings = () => {
  const [exportData, setExportData] = useState<UserDataExport | null>(null);
  const [showDeletionForm, setShowDeletionForm] = useState(false);
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [showPrivacyReport, setShowPrivacyReport] = useState(false);
  const [privacyReport, setPrivacyReport] = useState('');
  
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
  });

  const handleDataExport = async () => {
    // Check rate limit
    const rateCheck = rateLimiter.checkLimit('data_export');
    if (!rateCheck.allowed) {
      toast({
        title: "Export Limited",
        description: `Please wait ${Math.ceil((rateCheck.retryAfter || 0) / 60000)} minutes before exporting again`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      toast({
        title: "Exporting Data",
        description: "Gathering all your data..."
      });

      const data = await exportUserData();
      setExportData(data);
      
      toast({
        title: "Export Ready!",
        description: "Your data has been prepared for download"
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: "Could not export your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadExport = () => {
    if (exportData) {
      downloadDataExport(exportData);
      toast({
        title: "Download Started",
        description: "Your data export file is being downloaded"
      });
    }
  };

  const handleDataDeletion = async () => {
    // Check rate limit
    const rateCheck = rateLimiter.checkLimit('data_deletion');
    if (!rateCheck.allowed) {
      toast({
        title: "Deletion Limited",
        description: "Data deletion is limited to prevent accidental loss",
        variant: "destructive"
      });
      return;
    }

    if (deletionConfirmation !== 'DELETE ALL MY DATA') {
      toast({
        title: "Invalid Confirmation",
        description: "Please type exactly: DELETE ALL MY DATA",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      toast({
        title: "Deleting Data",
        description: "Removing all your data... This cannot be undone!"
      });

      const result = await deleteAllUserData(deletionConfirmation);
      
      if (result.success) {
        toast({
          title: "Data Deleted Successfully",
          description: "All your data has been permanently removed"
        });
        
        // Redirect to home after successful deletion
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        toast({
          title: "Partial Deletion",
          description: `Some data may remain. Errors: ${result.errors.join(', ')}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Deletion failed:', error);
      toast({
        title: "Deletion Failed", 
        description: "Could not delete all data. Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnableEncryption = async () => {
    setIsProcessing(true);
    try {
      toast({
        title: "Enabling Encryption",
        description: "Migrating sensitive data to encrypted storage..."
      });

      await migrateToEncryptedStorage();
      setEncryptionEnabled(true);
      
      toast({
        title: "Encryption Enabled!",
        description: "Your sensitive data is now encrypted locally"
      });
    } catch (error) {
      console.error('Encryption migration failed:', error);
      toast({
        title: "Encryption Failed",
        description: "Could not enable encryption. Your data remains unencrypted.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsProcessing(true);
    try {
      const report = await generatePrivacyReport();
      setPrivacyReport(report);
      setShowPrivacyReport(true);
    } catch (error) {
      console.error('Report generation failed:', error);
      toast({
        title: "Report Failed",
        description: "Could not generate privacy report",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadReport = () => {
    if (privacyReport) {
      const blob = new Blob([privacyReport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kiki-privacy-report-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

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
                <h1 className="text-xl font-bold">Privacy & Data</h1>
                <p className="text-sm text-muted-foreground">Manage your data and privacy settings</p>
              </div>
            </div>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>GDPR Compliant</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-4 space-y-6">
        {/* Data Encryption */}
        <Card className="card-kawaii space-y-4">
          <div className="flex items-center space-x-3">
            <Lock className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Data Encryption</h2>
              <p className="text-sm text-muted-foreground">Secure your sensitive data with local encryption</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {encryptionEnabled ? (
                <>
                  <Eye className="w-4 h-4 text-success" />
                  <span className="text-success font-medium">Encryption Enabled</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-warning" />
                  <span className="text-warning font-medium">Encryption Disabled</span>
                </>
              )}
            </div>

            {!encryptionEnabled && (
              <Button
                onClick={handleEnableEncryption}
                disabled={isProcessing}
                className="btn-kawaii"
              >
                {isProcessing ? "Enabling..." : "Enable Encryption"}
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Encryption protects: Pet data, statistics, coins, pause tokens, and other sensitive information
          </div>
        </Card>

        {/* Data Export */}
        <Card className="card-kawaii space-y-4">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Export Your Data</h2>
              <p className="text-sm text-muted-foreground">Download all your data in JSON format (GDPR Article 20)</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={handleDataExport}
                disabled={isProcessing}
                className="btn-kawaii"
              >
                {isProcessing ? "Exporting..." : "Prepare Data Export"}
              </Button>

              {exportData && (
                <Button
                  onClick={handleDownloadExport}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Export</span>
                </Button>
              )}
            </div>

            {exportData && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                <p><strong>Export ready:</strong> {Object.keys(exportData.gameData).length} data categories, created {new Date(exportData.exportDate).toLocaleString()}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Privacy Report */}
        <Card className="card-kawaii space-y-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Privacy Report</h2>
              <p className="text-sm text-muted-foreground">Learn what data we collect and how it's used</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                onClick={handleGenerateReport}
                disabled={isProcessing}
                variant="outline"
              >
                {isProcessing ? "Generating..." : "Generate Report"}
              </Button>

              {showPrivacyReport && (
                <Button
                  onClick={downloadReport}
                  variant="outline"
                >
                  Download Report
                </Button>
              )}
            </div>

            {showPrivacyReport && (
              <div className="bg-muted/50 p-4 rounded border text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                {privacyReport}
              </div>
            )}
          </div>
        </Card>

        {/* Data Deletion */}
        <Card className="card-kawaii space-y-4 border-destructive/30">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <div>
              <h2 className="text-lg font-semibold text-destructive">Delete All Data</h2>
              <p className="text-sm text-muted-foreground">Permanently remove all your data (GDPR Article 17)</p>
            </div>
          </div>

          {!showDeletionForm ? (
            <Button
              onClick={() => setShowDeletionForm(true)}
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              Request Data Deletion
            </Button>
          ) : (
            <div className="space-y-4 border border-destructive/30 p-4 rounded bg-destructive/5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">⚠️ WARNING: This action cannot be undone!</p>
                <p className="text-xs text-muted-foreground">
                  This will permanently delete:
                  • All local game data (pet, tasks, statistics)
                  • All cloud data (verifications, images)
                  • Your account and authentication data
                  • All preferences and settings
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type <code className="bg-muted px-1 rounded">DELETE ALL MY DATA</code> to confirm:</label>
                <Input
                  value={deletionConfirmation}
                  onChange={(e) => setDeletionConfirmation(e.target.value)}
                  placeholder="DELETE ALL MY DATA"
                  className="border-destructive/30"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleDataDeletion}
                  disabled={isProcessing || deletionConfirmation !== 'DELETE ALL MY DATA'}
                  variant="destructive"
                  className="flex-1"
                >
                  {isProcessing ? "Deleting..." : "Permanently Delete All Data"}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeletionForm(false);
                    setDeletionConfirmation('');
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Legal Information */}
        <Card className="card-kawaii space-y-4 bg-muted/30">
          <div className="text-center space-y-2">
            <h3 className="font-semibold">Your Privacy Rights</h3>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>Right to Access:</strong> Export all your data</p>
              <p>• <strong>Right to Erasure:</strong> Delete all your data</p>
              <p>• <strong>Right to Portability:</strong> Download data in standard format</p>
              <p>• <strong>Right to Security:</strong> Data encryption and secure storage</p>
            </div>
            <div className="text-xs text-muted-foreground">
              Kiki App complies with GDPR and respects your privacy rights.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PrivacySettings;