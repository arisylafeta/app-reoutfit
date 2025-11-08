"use client"

import * as React from "react"
import {
  ChevronsUpDown,
  CreditCard,
  LogOut,
  LifeBuoy,
  User as UserIcon,
  Sun,
  Moon,
  Monitor,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

import { createClient } from "@/utils/supabase/client"
import { logout } from "@/app/(auth)/actions"
import { getProfileCached, clearProfileCache } from "@/lib/profile-cache"

function getInitials(name?: string) {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface NavUserProps {
  isLargeScreen: boolean;
}

export function NavUser({ isLargeScreen }: NavUserProps) {
  const isMobile = !isLargeScreen
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = React.useState<{
    name: string
    email: string
    avatar?: string
  } | null>(null)

  React.useEffect(() => {
    const supabase = createClient()
    let mounted = true

    getProfileCached(supabase).then((p) => {
      if (mounted) setProfile(p)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // User changed (login/logout): invalidate and refresh cache
      clearProfileCache()
      getProfileCached(supabase, { forceRefresh: true }).then((p) => {
        if (mounted) setProfile(p)
      })
    })

    return () => {
      mounted = false
      // supabase-js v2 returns { subscription }
      try {
        listener?.subscription?.unsubscribe?.()
      } catch (err) {
        console.debug("auth listener unsubscribe failed", err)
      }
    }
  }, [])

  const display = profile || { name: "User", email: "", avatar: undefined }

  // User menu (full view only)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full h-auto p-2 justify-start data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
        >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={display.avatar} alt={display.name} />
                <AvatarFallback className="rounded-lg">{getInitials(display.name)}</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{display.name}</span>
                <span className="truncate text-xs">{display.email}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
        </Button>
      </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={display.avatar} alt={display.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(display.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{display.name}</span>
                  <span className="truncate text-xs">{display.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="gap-2">
                <Link href="/account" className="flex items-center">
                  <UserIcon className="size-4 text-muted-foreground mr-2" strokeWidth={1.5} />
                  My account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2">
                <Link href="/credits" className="flex items-center">
                  <CreditCard className="size-4 text-muted-foreground mr-2" strokeWidth={1.5} />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="gap-2">
                <Link href="/support" className="flex items-center">
                  <LifeBuoy className="size-4 text-muted-foreground mr-2" strokeWidth={1.5} />
                  Support
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light" className="gap-2">
                <Sun className="size-4 text-muted-foreground mr-2" strokeWidth={1.5} />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="gap-2">
                <Moon className="size-4 text-muted-foreground mr-2" strokeWidth={1.5} />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="gap-2">
                <Monitor className="size-4 text-muted-foreground mr-2" strokeWidth={1.5} />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <form action={logout}>
                <button type="submit" className="flex w-full items-center">
                  <LogOut className="size-4 text-muted-foreground mr-2" strokeWidth={1.5} />
                  Logout
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
    </DropdownMenu>
  )
}

