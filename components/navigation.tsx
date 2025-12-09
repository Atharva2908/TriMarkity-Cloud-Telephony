"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "./theme-toggle"
import { Phone, Users, Clock, BarChart3, Hash, Settings, Menu, X, Mic } from "lucide-react"
import { useState } from "react"

const navItems = [
  { href: "/", label: "Dialer", icon: Phone },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/call-logs", label: "Logs", icon: Clock },
  { href: "/recordings", label: "Recordings", icon: Mic },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/numbers", label: "Numbers", icon: Hash },
  { href: "/admin", label: "Settings", icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(path)
  }

  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
            <div className="relative w-8 h-8 transition-transform group-hover:scale-110">
              <Image
                src="/trimarkity-logo.png"
                alt="TriMarkity logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="hidden md:inline bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TriMarkity Cloud Telephony
            </span>
            <span className="md:hidden bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TriMarkity
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-secondary hover:scale-105"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            
            <div className="ml-2 pl-2 border-l border-border">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex lg:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 pb-3 border-t border-border pt-3 animate-in slide-in-from-top-5 duration-200">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      active
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
