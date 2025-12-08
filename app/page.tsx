"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { SoftphoneLayout } from "@/components/softphone-layout"

// Demo contacts for testing without backend
const DEMO_CONTACTS = [
  { id: "1", phone: "+12125551001", name: "John Smith", email: "john@example.com", tags: ["sales"] },
  { id: "2", phone: "+12125551002", name: "Sarah Johnson", email: "sarah@example.com", tags: ["support"] },
  { id: "3", phone: "+12125551003", name: "Mike Davis", email: "mike@example.com", tags: ["manager"] },
  { id: "4", phone: "+12125551004", name: "Emma Wilson", email: "emma@example.com", tags: ["admin"] },
]

export default function Home() {
  const [useDemo, setUseDemo] = useState(true)
  const [contacts, setContacts] = useState(DEMO_CONTACTS)

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${apiUrl}/api/contacts/`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("API not available")

      const data = await response.json()
      setContacts(data.contacts || DEMO_CONTACTS)
      setUseDemo(false)
    } catch (error) {
      console.log("Backend not available, using demo data:", error)
      setContacts(DEMO_CONTACTS)
      setUseDemo(true)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      {useDemo && (
        <div className="bg-amber-900/20 border-b border-amber-700/30 p-3">
          <p className="text-xs text-amber-700 font-medium">Demo Mode: Backend not connected</p>
        </div>
      )}
      <SoftphoneLayout contacts={contacts} demoMode={useDemo} />
    </main>
  )
}
