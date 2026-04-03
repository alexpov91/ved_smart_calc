"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserMenu() {
  const { signOut } = useAuthActions();
  const profile = useQuery(api.userProfiles.getMine);
  const router = useRouter();

  // Loading state
  if (profile === undefined) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-slate-700" />
    );
  }

  const initials = profile?.name ? getInitials(profile.name) : "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none ring-offset-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
        <Avatar className="h-8 w-8 cursor-pointer">
          <AvatarFallback className="bg-emerald-600 text-xs font-medium text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {profile?.name && (
          <div className="px-2 py-1.5 text-sm font-medium text-slate-50">
            {profile.name}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          Профиль
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void signOut()}
          className="text-red-400 focus:text-red-400"
        >
          Выход
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
