"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { Plus, Trash2 } from "lucide-react"

const DEMO_NUMBERS = [
  { number: "+12125551234", name: "Main Line", status: "active" },
  { number: "+14155551234", name: "West Coast", status: "active" },
]

interface TelnyxConfig {
  api_key: string
  api_v2_key: string
  webhook_url: string
}

interface CallNumber {
  number: string
  name: string
  status: string
}

export default function AdminPage() {
  const [config, setConfig] = useState<TelnyxConfig>({ api_key: "", api_v2_key: "", webhook_url: "" })
  const [numbers, setNumbers] = useState<CallNumber[]>(DEMO_NUMBERS)
  const [newNumber, setNewNumber] = useState({ number: "", name: "", status: "active" })
  const [loading, setLoading] = useState(false)
  const [useDemo, setUseDemo] = useState(true)

  useEffect(() => {
    fetchConfig()
    fetchNumbers()
  }, [])

  const fetchConfig = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${apiUrl}/api/admin/config`)
      const data = await response.json()
      if (data.api_key) {
        setConfig(data)
        setUseDemo(false)
      }
    } catch (error) {
      console.log("Using demo config:", error)
      setUseDemo(true)
    }
  }

  const fetchNumbers = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${apiUrl}/api/admin/numbers`)
      const data = await response.json()
      if (data.numbers) setNumbers(data.numbers)
    } catch (error) {
      console.log("Using demo numbers:", error)
    }
  }

  const handleConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      if (useDemo) {
        alert("Demo mode: Configuration not saved. Connect backend to persist changes.")
        return
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      await fetch(`${apiUrl}/api/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      alert("Configuration updated successfully")
    } catch (error) {
      console.error("Error updating config:", error)
      alert("Error updating configuration")
    } finally {
      setLoading(false)
    }
  }

  const handleAddNumber = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (useDemo) {
        setNumbers([...numbers, newNumber])
        setNewNumber({ number: "", name: "", status: "active" })
        alert("Demo mode: Changes not persisted.")
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        await fetch(`${apiUrl}/api/admin/numbers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newNumber),
        })
        fetchNumbers()
        setNewNumber({ number: "", name: "", status: "active" })
      }
    } catch (error) {
      console.error("Error adding number:", error)
    }
  }

  const handleDeleteNumber = async (number: string) => {
    try {
      if (useDemo) {
        setNumbers(numbers.filter((n) => n.number !== number))
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        await fetch(`${apiUrl}/api/admin/numbers/${number}`, { method: "DELETE" })
        fetchNumbers()
      }
    } catch (error) {
      console.error("Error deleting number:", error)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {useDemo && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg text-sm">
            <p className="font-medium text-ring">
              Demo Mode - To use real Telnyx credentials, set NEXT_PUBLIC_API_URL environment variable
            </p>
          </div>
        )}

        <h1 className="text-3xl font-bold mb-8">Admin Configuration</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Telnyx API Configuration</h2>
            <form onSubmit={handleConfigUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">API Key</label>
                <input
                  type="password"
                  value={config.api_key}
                  onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                  placeholder="sk_..."
                  className="w-full bg-input border border-border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">API v2 Key</label>
                <input
                  type="password"
                  value={config.api_v2_key}
                  onChange={(e) => setConfig({ ...config, api_v2_key: e.target.value })}
                  placeholder="sk_..."
                  className="w-full bg-input border border-border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={config.webhook_url}
                  onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-input border border-border rounded-lg p-2"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 rounded-lg px-4 py-2 font-medium transition-opacity"
              >
                {loading ? "Updating..." : "Update Configuration"}
              </button>
            </form>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-xl font-bold mb-4">Outbound Caller IDs</h2>
            <form onSubmit={handleAddNumber} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={newNumber.number}
                  onChange={(e) => setNewNumber({ ...newNumber, number: e.target.value })}
                  placeholder="+1234567890"
                  required
                  className="w-full bg-input border border-border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Name/Label</label>
                <input
                  type="text"
                  value={newNumber.name}
                  onChange={(e) => setNewNumber({ ...newNumber, name: e.target.value })}
                  placeholder="Main Line"
                  required
                  className="w-full bg-input border border-border rounded-lg p-2"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:opacity-90 rounded-lg px-4 py-2 font-medium flex items-center justify-center gap-2 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                Add Number
              </button>
            </form>

            <div className="space-y-2">
              {numbers.map((num) => (
                <div key={num.number} className="flex justify-between items-center bg-input rounded-lg p-3">
                  <div>
                    <p className="font-medium">{num.name}</p>
                    <p className="text-sm font-mono text-muted-foreground">{num.number}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteNumber(num.number)}
                    className="p-2 hover:bg-secondary rounded transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
