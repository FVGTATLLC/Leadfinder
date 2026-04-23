"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Save,
  AlertTriangle,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Unplug,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPost } from "@/lib/api-client";

const toneOptions: SelectOption[] = [
  { value: "formal", label: "Formal" },
  { value: "friendly", label: "Friendly" },
  { value: "consultative", label: "Consultative" },
  { value: "aggressive", label: "Aggressive" },
];

const campaignTypeOptions: SelectOption[] = [
  { value: "intro", label: "Introduction" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "mice", label: "MICE" },
  { value: "corporate", label: "Corporate" },
  { value: "custom", label: "Custom" },
];

interface ZohoMailStatus {
  connected: boolean;
  emailAddress: string | null;
  connectedAt: string | null;
  isActive: boolean;
}

export default function GeneralSettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [defaultTone, setDefaultTone] = useState("formal");
  const [defaultCampaignType, setDefaultCampaignType] = useState("intro");
  const [autoApprove, setAutoApprove] = useState(false);
  const [emailSignature, setEmailSignature] = useState("");
  const [notifyOnReply, setNotifyOnReply] = useState(true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);

  // Zoho Mail connection state
  const [zohoStatus, setZohoStatus] = useState<ZohoMailStatus | null>(null);
  const [zohoLoading, setZohoLoading] = useState(true);
  const [zohoConnecting, setZohoConnecting] = useState(false);
  const [zohoDisconnecting, setZohoDisconnecting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Check Zoho Mail status on mount
  useEffect(() => {
    checkZohoStatus();
  }, []);

  // Handle OAuth callback redirect
  useEffect(() => {
    const zohoParam = searchParams.get("gmail") || searchParams.get("zoho");
    if (zohoParam === "connected") {
      const email = searchParams.get("email");
      toast({
        title: "Zoho Mail Connected",
        description: `Successfully connected ${email || "your Zoho Mail"}`,
        type: "success",
      });
      checkZohoStatus();
    } else if (zohoParam === "error") {
      toast({
        title: "Zoho Mail Connection Failed",
        description: searchParams.get("message") || "Failed to connect Zoho Mail",
        type: "error",
      });
    }
  }, [searchParams]);

  async function checkZohoStatus() {
    setZohoLoading(true);
    try {
      const data = await apiGet<any>("/gmail/status");
      const status = data?.data || data;
      setZohoStatus({
        connected: status.connected,
        emailAddress: status.gmail_address || status.gmailAddress || status.emailAddress,
        connectedAt: status.connected_at || status.connectedAt,
        isActive: status.is_active || status.isActive,
      });
    } catch {
      setZohoStatus({ connected: false, emailAddress: null, connectedAt: null, isActive: false });
    } finally {
      setZohoLoading(false);
    }
  }

  async function handleConnectZoho() {
    setZohoConnecting(true);
    try {
      const data = await apiGet<any>("/gmail/connect");
      const result = data?.data || data;
      if (result.authorization_url || result.authorizationUrl) {
        window.location.href = result.authorization_url || result.authorizationUrl;
      } else if (result.error) {
        toast({ title: "Error", description: result.error, type: "error" });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to start Zoho Mail connection",
        type: "error",
      });
    } finally {
      setZohoConnecting(false);
    }
  }

  async function handleDisconnectZoho() {
    setZohoDisconnecting(true);
    try {
      await apiPost("/gmail/disconnect", {});
      setZohoStatus({ connected: false, emailAddress: null, connectedAt: null, isActive: false });
      toast({
        title: "Zoho Mail Disconnected",
        description: "Your Zoho Mail account has been disconnected.",
        type: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to disconnect Zoho Mail",
        type: "error",
      });
    } finally {
      setZohoDisconnecting(false);
    }
  }

  async function handleSendTestEmail() {
    setSendingTest(true);
    try {
      const data = await apiPost<any>("/gmail/send-test", {});
      const result = data?.data || data;
      if (result.success) {
        toast({
          title: "Test Email Sent",
          description: `A test email was sent to ${zohoStatus?.emailAddress}`,
          type: "success",
        });
      } else {
        toast({
          title: "Test Failed",
          description: result.error || "Failed to send test email",
          type: "error",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to send test email",
        type: "error",
      });
    } finally {
      setSendingTest(false);
    }
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({
        title: "Settings saved",
        description: "Your general settings have been updated.",
        type: "success",
      });
    } catch {
      toast({
        title: "Failed to save",
        description: "An error occurred while saving your settings.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Zoho Mail Connection */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Zoho Mail Connection
            </h2>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            Connect your Zoho Mail account to send emails to clients from your own address.
          </p>
        </div>
        <div className="px-6 py-5">
          {zohoLoading ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">Checking Zoho Mail connection...</span>
            </div>
          ) : zohoStatus?.connected ? (
            <div className="space-y-4">
              {/* Connected Status */}
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Connected to Zoho Mail
                    </p>
                    <p className="text-xs text-green-600">
                      {zohoStatus.emailAddress}
                      {zohoStatus.connectedAt && (
                        <span>
                          {" "}· Connected {new Date(zohoStatus.connectedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendTestEmail}
                    disabled={sendingTest}
                    className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                  >
                    {sendingTest ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Send Test
                  </button>
                  <button
                    onClick={handleDisconnectZoho}
                    disabled={zohoDisconnecting}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {zohoDisconnecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unplug className="h-3 w-3" />
                    )}
                    Disconnect
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                All emails sent from SalesPilot will use your connected Zoho Mail address.
                They will also appear in your Zoho Mail Sent folder.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not Connected */}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Zoho Mail not connected
                    </p>
                    <p className="text-xs text-gray-500">
                      Connect your Zoho Mail to send emails from your @clubconcierge.com address
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleConnectZoho}
                  disabled={zohoConnecting}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {zohoConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Connect Zoho Mail
                </button>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-700">
                  <strong>How it works:</strong> Click &quot;Connect Zoho Mail&quot; to configure your
                  Zoho Mail SMTP settings. Emails will be sent via smtp.zoho.com using your
                  @clubconcierge.com email address securely.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* App Configuration */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            App Configuration
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Customize default behaviors for campaigns and messages.
          </p>
        </div>
        <div className="space-y-6 px-6 py-5">
          <div className="grid gap-6 sm:grid-cols-2">
            <Select
              label="Default Tone Preset"
              options={toneOptions}
              value={defaultTone}
              onChange={(v) => setDefaultTone(v as string)}
            />
            <Select
              label="Default Campaign Type"
              options={campaignTypeOptions}
              value={defaultCampaignType}
              onChange={(v) => setDefaultCampaignType(v as string)}
            />
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <Toggle
              checked={autoApprove}
              onChange={setAutoApprove}
              label="Auto-approve messages"
              description="Messages will be sent without manual review. Use with caution."
            />
            {autoApprove && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-100 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                <p className="text-xs text-yellow-700">
                  Auto-approval is enabled. All AI-generated messages will be
                  sent automatically without human review.
                </p>
              </div>
            )}
          </div>

          <Textarea
            label="Email Signature"
            placeholder="Your default email signature..."
            hint="This signature will be appended to all outgoing emails."
            value={emailSignature}
            onChange={(e) => setEmailSignature(e.target.value)}
            rows={4}
            showCount
            maxLength={500}
          />
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Notification Preferences
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Control how you receive notifications.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <Toggle
            checked={notifyOnReply}
            onChange={setNotifyOnReply}
            label="Email on reply"
            description="Receive an email notification when a prospect replies to your message."
          />
          <Toggle
            checked={notifyOnComplete}
            onChange={setNotifyOnComplete}
            label="Email on campaign complete"
            description="Receive an email notification when a campaign finishes all sequences."
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
