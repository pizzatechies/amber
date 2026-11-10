"use client";

import { useTransition } from "react";
import {
  Award,
  BookOpen,
  GraduationCap,
  Heart,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import {
  Dropdown,
  DropdownButton,
  DropdownLabel,
  DropdownLink,
  DropdownSeparator,
} from "@/components/ui/dropdown";
import { signOutAction } from "@/server/actions/auth";

export type MenuUser = {
  name: string;
  email: string;
  avatarAssetId: string | null;
  isInstructor: boolean;
  isAdmin: boolean;
};

export function UserMenu({ user }: { user: MenuUser }) {
  const [, startTransition] = useTransition();
  return (
    <Dropdown
      label="Account menu"
      triggerClassName="flex rounded-full"
      trigger={<Avatar name={user.name} assetId={user.avatarAssetId} size={36} />}
    >
      <DropdownLabel>
        <p className="truncate font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </DropdownLabel>
      <DropdownSeparator />
      <DropdownLink href="/my-learning">
        <BookOpen /> My learning
      </DropdownLink>
      <DropdownLink href="/wishlist">
        <Heart /> Wishlist
      </DropdownLink>
      <DropdownLink href="/my-learning/certificates">
        <Award /> Certificates
      </DropdownLink>
      <DropdownLink href="/account/purchases">
        <Receipt /> Purchase history
      </DropdownLink>
      <DropdownSeparator />
      {user.isInstructor ? (
        <DropdownLink href="/instructor">
          <LayoutDashboard /> Instructor studio
        </DropdownLink>
      ) : (
        <DropdownLink href="/teach">
          <GraduationCap /> Teach on this platform
        </DropdownLink>
      )}
      {user.isAdmin ? (
        <DropdownLink href="/admin">
          <ShieldCheck /> Admin console
        </DropdownLink>
      ) : null}
      <DropdownLink href="/account">
        <Settings /> Account settings
      </DropdownLink>
      <DropdownSeparator />
      <DropdownButton onSelect={() => startTransition(() => signOutAction())}>
        <LogOut /> Sign out
      </DropdownButton>
    </Dropdown>
  );
}
