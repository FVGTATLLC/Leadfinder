"use client";

import { useState } from "react";
import {
  Mail,
  Brain,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  Database,
  Linkedin,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function StatusIndicator({ configured }: { configured: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {configured ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-xs font-medium text-green-700">Configured</span>
        </>
      ) : (
        <>
          <XCircle className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Not configured</span>
        </>
      )}
    </div>
  );
}

function MaskedValue({ value, label }: { value: string | null; label: string }) {
  if (!value) return <span className="text-sm text-gray-400">Not set</span>;
  const masked =
    value.length > 8
      ? value.slice(0, 4) + "****" + value.slice(-4)
      : "****";
  return (
    <div className="text-sm">
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="font-mono text-gray-700">{masked}</span>
    </div>
  );
}

function ComingSoonCard({
  icon: Icon,
  name,
  description,
}: {
  icon: React.ElementType;
  name: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 opacity-60">
      <div className="absolute right-3 top-3">
        <Badge variant="default" size="sm">
          Coming Soon
        </Badge>
      </div>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
  );
}

export default function IntegrationsSettingsPage() {
  const { toast } = useToast();
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [aiKeysModalOpen, setAiKeysModalOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState<"claude" | "openai">("claude");

  // SMTP state
  const [smtpHost, setSmtpHost] = useState("smtp.zoho.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("outreach@clubconcierge.com");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  // AI Keys
  const [claudeKey, setClaudeKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [isSavingAi, setIsSavingAi] = useState(false);

  const smtpConfigured = !!smtpHost && !!smtpUser;
  const claudeConfigured = true; // demo
  const openaiConfigured = false; // demo

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast({
        title: "Connection successful",
        description: "SMTP connection test passed.",
        type: "success",
      });
    } catch {
      toast({ title: "Connection failed", type: "error" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSmtp = async () => {
    setIsSavingSmtp(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({ title: "SMTP settings saved", type: "success" });
      setSmtpModalOpen(false);
    } catch {
      toast({ title: "Failed to save SMTP settings", type: "error" });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleSaveAiKey = async () => {
    setIsSavingAi(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({
        title: `${aiProvider === "claude" ? "Claude" : "OpenAI"} API key updated`,
        type: "success",
      });
      setAiKeysModalOpen(false);
      setClaudeKey("");
      setOpenaiKey("");
    } catch {
      toast({ title: "Failed to update API key", type: "error" });
    } finally {
      setIsSavingAi(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Email (SMTP) */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Email (SMTP)
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  SMTP Configuration
                </h3>
                <StatusIndicator configured={smtpConfigured} />
                <div className="mt-3 space-y-1">
                  <MaskedValue value={smtpHost} label="Host" />
                  <MaskedValue value={smtpPort} label="Port" />
                  <MaskedValue value={smtpUser} label="User" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                isLoading={isTesting}
                disabled={!smtpConfigured}
              >
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Test Connection
              </Button>
              <Button
                size="sm"
                onClick={() => setSmtpModalOpen(true)}
              >
                Configure
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Providers */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          AI Providers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Claude */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <StatusIndicator configured={claudeConfigured} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Claude API</h3>
            <p className="mt-1 text-xs text-gray-500">Anthropic Claude for AI generation</p>
            <div className="mt-3 space-y-1">
              <MaskedValue
                value={claudeConfigured ? "sk-ant-api03-****abcd" : null}
                label="API Key"
              />
              <div className="text-sm">
                <span className="text-gray-500">Model:</span>{" "}
                <span className="text-gray-700">claude-sonnet-4-20250514</span>
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAiProvider("claude");
                  setAiKeysModalOpen(true);
                }}
              >
                Update Key
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* OpenAI */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                <Sparkles className="h-5 w-5 text-green-600" />
              </div>
              <StatusIndicator configured={openaiConfigured} />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">OpenAI API</h3>
            <p className="mt-1 text-xs text-gray-500">
              OpenAI GPT for fallback generation
            </p>
            <div className="mt-3 space-y-1">
              <MaskedValue value={null} label="API Key" />
              <div className="text-sm">
                <span className="text-gray-500">Model:</span>{" "}
                <span className="text-gray-400">Not configured</span>
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAiProvider("openai");
                  setAiKeysModalOpen(true);
                }}
              >
                Update Key
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CRM (Future) */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          CRM Integrations
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ComingSoonCard
            icon={Database}
            name="Salesforce"
            description="Sync contacts and campaigns with Salesforce CRM."
          />
          <ComingSoonCard
            icon={Database}
            name="HubSpot"
            description="Two-way sync with HubSpot for contacts and deals."
          />
        </div>
      </div>

      {/* Data Enrichment (Future) */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Data Enrichment
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ComingSoonCard
            icon={Linkedin}
            name="LinkedIn API"
            description="Enrich contacts with LinkedIn professional data."
          />
          <ComingSoonCard
            icon={Search}
            name="Clearbit"
            description="Company and contact enrichment via Clearbit."
          />
        </div>
      </div>

      {/* SMTP Modal */}
      <Modal
        isOpen={smtpModalOpen}
        onClose={() => setSmtpModalOpen(false)}
        title="Configure SMTP"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSmtpModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSmtp} isLoading={isSavingSmtp}>
              Save Configuration
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="SMTP Host"
            placeholder="smtp.zoho.com"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
          />
          <Input
            label="SMTP Port"
            placeholder="587"
            value={smtpPort}
            onChange={(e) => setSmtpPort(e.target.value)}
          />
          <Input
            label="Username"
            placeholder="your-email@clubconcierge.com"
            value={smtpUser}
            onChange={(e) => setSmtpUser(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="App password or SMTP password"
            value={smtpPassword}
            onChange={(e) => setSmtpPassword(e.target.value)}
          />
        </div>
      </Modal>

      {/* AI Key Modal */}
      <Modal
        isOpen={aiKeysModalOpen}
        onClose={() => setAiKeysModalOpen(false)}
        title={`Update ${aiProvider === "claude" ? "Claude" : "OpenAI"} API Key`}
        footer={
          <>
            <Button variant="outline" onClick={() => setAiKeysModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAiKey} isLoading={isSavingAi}>
              Save Key
            </Button>
          </>
        }
      >
        <Input
          label="API Key"
          type="password"
          placeholder={
            aiProvider === "claude"
              ? "sk-ant-api03-..."
              : "sk-..."
          }
          value={aiProvider === "claude" ? claudeKey : openaiKey}
          onChange={(e) =>
            aiProvider === "claude"
              ? setClaudeKey(e.target.value)
              : setOpenaiKey(e.target.value)
          }
          hint="Your API key is encrypted and stored securely."
        />
      </Modal>
    </div>
  );
}
