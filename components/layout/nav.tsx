"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Plane,
  Calculator,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/trips", label: "Trips", icon: Plane },
  { href: "/calculator", label: "Calc", icon: Calculator },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-safe md:hidden"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav({ email }: { email?: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-background md:flex">
      <div className="border-b px-4 py-4">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          The Vault
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2" aria-label="Primary">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label === "Calc" ? "Calculator" : label}
            </Link>
          );
        })}
      </nav>
      <form action="/api/auth/signout" method="post" className="border-t p-3">
        {email && (
          <p className="mb-2 truncate px-1 text-xs text-muted-foreground" title={email}>
            {email}
          </p>
        )}
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </aside>
  );
}

export function MobileHeader({ email }: { email?: string | null }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 pt-safe backdrop-blur md:hidden">
      <span className="text-base font-bold tracking-tight">The Vault</span>
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          aria-label="Sign out"
          title={email ?? "Sign out"}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </header>
  );
}
