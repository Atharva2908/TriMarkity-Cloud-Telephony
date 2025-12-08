"use client"

import Link from "next/link"
import Image from "next/image"
import { ThemeToggle } from "./theme-toggle"

export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          {/* TriMarkity logo only */}
          <div className="relative w-8 h-8">
            <Image
              src="/trimarkity-logo.png" // ensure this file exists in /public
              alt="TriMarkity logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          <span className="hidden sm:inline bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            TriMarkity Cloud Telephony
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Dialer
          </Link>
          <Link
            href="/contacts"
            className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Contacts
          </Link>
          <Link
            href="/call-logs"
            className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Logs
          </Link>
          <Link
            href="/analytics"
            className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Analytics
          </Link>
          <Link
            href="/numbers"
            className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Numbers
          </Link>
          <Link
            href="/admin"
            className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-secondary transition-colors duration-200"
          >
            Settings
          </Link>
          <div className="ml-2 pl-2 border-l border-border">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  )
}
