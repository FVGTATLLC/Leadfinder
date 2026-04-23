"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  MoreHorizontal,
  Mail,
  Calendar,
  Shield,
  Trash2,
  ChevronDown,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDate, getInitials } from "@/lib/utils";
import { UserRole } from "@/types/models";

const roleOptions: SelectOption[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "sales_rep", label: "Sales Rep" },
  { value: "viewer", label: "Viewer" },
];

const roleBadgeVariant: Record<string, "primary" | "success" | "info" | "default"> = {
  admin: "primary",
  manager: "success",
  sales_rep: "info",
  viewer: "default",
};

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  joinedAt: string;
}

// Demo data
const demoTeam = {
  id: "team-1",
  name: "Sales Team Alpha",
  description: "Primary outbound sales team",
  memberCount: 4,
  createdAt: "2024-10-15T00:00:00Z",
};

const demoMembers: TeamMember[] = [
  {
    id: "1",
    fullName: "Admin User",
    email: "admin@clubconcierge.com",
    role: UserRole.ADMIN,
    joinedAt: "2024-10-15T00:00:00Z",
  },
  {
    id: "2",
    fullName: "Sarah Chen",
    email: "sarah@clubconcierge.com",
    role: UserRole.MANAGER,
    joinedAt: "2024-11-01T00:00:00Z",
  },
  {
    id: "3",
    fullName: "James Wilson",
    email: "james@clubconcierge.com",
    role: UserRole.SALES_REP,
    joinedAt: "2024-12-05T00:00:00Z",
  },
  {
    id: "4",
    fullName: "Maria Lopez",
    email: "maria@clubconcierge.com",
    role: UserRole.VIEWER,
    joinedAt: "2025-01-10T00:00:00Z",
  },
];

export default function TeamSettingsPage() {
  const { toast } = useToast();
  const [team] = useState(demoTeam);
  const [members, setMembers] = useState<TeamMember[]>(demoMembers);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("sales_rep");
  const [isInviting, setIsInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [roleDropdownId, setRoleDropdownId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState(demoTeam.name);
  const [teamDescription, setTeamDescription] = useState(demoTeam.description);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({
        title: "Invitation sent",
        description: `Invited ${inviteEmail} as ${inviteRole}.`,
        type: "success",
      });
      setInviteEmail("");
      setInviteRole("sales_rep");
      setInviteModalOpen(false);
    } catch {
      toast({ title: "Failed to send invitation", type: "error" });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setMembers((prev) => prev.filter((m) => m.id !== removeTarget.id));
    toast({
      title: "Member removed",
      description: `${removeTarget.fullName} has been removed from the team.`,
      type: "success",
    });
    setRemoveTarget(null);
  };

  const handleChangeRole = (memberId: string, newRole: UserRole) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    setRoleDropdownId(null);
    toast({ title: "Role updated", type: "success" });
  };

  if (!team) {
    return (
      <EmptyState
        icon={Building2}
        title="No team yet"
        description="Create a team to collaborate with your colleagues."
        action={{ label: "Create Team", onClick: () => setEditTeamOpen(true) }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Info Card */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {team.name}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">{team.description}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditTeamOpen(true)}
          >
            Edit
          </Button>
        </div>
        <div className="flex gap-8 px-6 py-4">
          <div>
            <p className="text-xs text-gray-500">Members</p>
            <p className="text-sm font-semibold text-gray-900">
              {members.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatDate(team.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">
              Team Members
            </h2>
          </div>
          <Button size="sm" onClick={() => setInviteModalOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Invite Member
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                      {getInitials(member.fullName)}
                    </div>
                    <span className="font-medium text-gray-900">
                      {member.fullName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Mail className="h-3.5 w-3.5" />
                    {member.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={roleBadgeVariant[member.role] ?? "default"}
                    dot
                  >
                    {member.role.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(member.joinedAt)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {/* Role Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setRoleDropdownId(
                            roleDropdownId === member.id ? null : member.id
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Change Role
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {roleDropdownId === member.id && (
                        <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          {roleOptions.map((opt) => (
                            <button
                              key={opt.value}
                              className={cn(
                                "block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50",
                                member.role === opt.value
                                  ? "font-medium text-primary-600"
                                  : "text-gray-700"
                              )}
                              onClick={() =>
                                handleChangeRole(
                                  member.id,
                                  opt.value as UserRole
                                )
                              }
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setRemoveTarget(member)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Team Member"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              isLoading={isInviting}
              disabled={!inviteEmail}
            >
              <Mail className="mr-1.5 h-4 w-4" />
              Send Invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="colleague@clubconcierge.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            iconLeft={<Mail className="h-4 w-4" />}
          />
          <Select
            label="Role"
            options={roleOptions}
            value={inviteRole}
            onChange={(v) => setInviteRole(v as string)}
          />
        </div>
      </Modal>

      {/* Edit Team Modal */}
      <Modal
        isOpen={editTeamOpen}
        onClose={() => setEditTeamOpen(false)}
        title="Edit Team"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditTeamOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast({ title: "Team updated", type: "success" });
                setEditTeamOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <Input
            label="Description"
            value={teamDescription}
            onChange={(e) => setTeamDescription(e.target.value)}
          />
        </div>
      </Modal>

      {/* Remove Confirmation */}
      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${removeTarget?.fullName} from the team? They will lose access to all team resources.`}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
