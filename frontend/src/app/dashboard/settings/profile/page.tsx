"use client";

import { useState } from "react";
import {
  Save,
  Lock,
  Eye,
  EyeOff,
  Clock,
  Shield,
  Mail,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/use-auth";
import { getInitials, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

function PasswordStrength({ password }: { password: string }) {
  const getStrength = (): { level: string; percent: number; color: string } => {
    if (!password) return { level: "", percent: 0, color: "bg-gray-200" };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: "Weak", percent: 33, color: "bg-red-500" };
    if (score <= 3) return { level: "Medium", percent: 66, color: "bg-yellow-500" };
    return { level: "Strong", percent: 100, color: "bg-green-500" };
  };

  const strength = getStrength();
  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500">Password strength</span>
        <span
          className={cn(
            "text-xs font-medium",
            strength.percent <= 33 && "text-red-600",
            strength.percent > 33 && strength.percent <= 66 && "text-yellow-600",
            strength.percent > 66 && "text-green-600"
          )}
        >
          {strength.level}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={cn("h-full rounded-full transition-all duration-300", strength.color)}
          style={{ width: `${strength.percent}%` }}
        />
      </div>
    </div>
  );
}

const demoActivityLog = [
  { action: "Updated email signature", timestamp: "2025-03-18T10:30:00Z" },
  { action: "Changed notification preferences", timestamp: "2025-03-17T16:45:00Z" },
  { action: "Created campaign 'Q1 Outreach'", timestamp: "2025-03-17T09:15:00Z" },
  { action: "Approved 12 messages", timestamp: "2025-03-16T14:20:00Z" },
  { action: "Added 5 contacts to strategy", timestamp: "2025-03-15T11:00:00Z" },
  { action: "Logged in", timestamp: "2025-03-15T08:30:00Z" },
];

export default function ProfileSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [fullName, setFullName] = useState(user?.name || "Admin User");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const email = user?.email || "user@clubconcierge.com";
  const role = user?.role || "admin";

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({ title: "Profile updated", type: "success" });
    } catch {
      toast({ title: "Failed to update profile", type: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please make sure both passwords are the same.",
        type: "error",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        type: "error",
      });
      return;
    }
    setIsSavingPassword(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({ title: "Password changed", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast({ title: "Failed to change password", type: "error" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Your Profile
          </h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-2xl font-bold text-primary-700">
              {getInitials(fullName)}
            </div>
            <div className="flex-1 space-y-4">
              <Input
                label="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                iconLeft={<User className="h-4 w-4" />}
              />
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500">
                  <Mail className="h-4 w-4 text-gray-400" />
                  {email}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-gray-500">Role:</span>{" "}
                  <Badge variant="primary" dot>
                    {role.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Team:</span>{" "}
                  <span className="text-sm font-medium text-gray-700">
                    Sales Team Alpha
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  isLoading={isSavingProfile}
                  size="sm"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  Save Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">
              Change Password
            </h2>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="max-w-md space-y-4">
            <div className="relative">
              <Input
                label="Current Password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                iconLeft={<Lock className="h-4 w-4" />}
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
              />
            </div>
            <div>
              <Input
                label="New Password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                iconLeft={<Lock className="h-4 w-4" />}
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
              />
              <PasswordStrength password={newPassword} />
            </div>
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              iconLeft={<Lock className="h-4 w-4" />}
              error={
                confirmPassword && confirmPassword !== newPassword
                  ? "Passwords do not match"
                  : undefined
              }
            />
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSavePassword}
                isLoading={isSavingPassword}
                size="sm"
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                <Shield className="mr-1.5 h-4 w-4" />
                Update Password
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">
              Recent Activity
            </h2>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {demoActivityLog.map((entry, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-6 py-3"
            >
              <span className="text-sm text-gray-700">{entry.action}</span>
              <span className="text-xs text-gray-400">
                {formatDateTime(entry.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
