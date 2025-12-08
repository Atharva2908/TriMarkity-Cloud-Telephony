"use client"

import { Navigation } from "@/components/navigation"
import { NumberManagement } from "@/components/number-management"

export default function NumbersPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Number Management</h1>
        <NumberManagement />
      </div>
    </main>
  )
}
