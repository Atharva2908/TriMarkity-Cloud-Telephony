"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react"

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
  const [config, setConfig] = useState<TelnyxConfig>({ 
    api_key: "", 
    api_v2_key: "", 
    webhook_url: "" 
  })
  const [numbers, setNumbers] = useState<CallNumber[]>(DEMO_NUMBERS)
  const [newNumber, setNewNumber] = useState({ 
    number: "", 
    name: "", 
    status: "active" 
  })
  const [loading, setLoading] = useState(false)
  const [useDemo, setUseDemo] = useState(true)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showV2Key, setShowV2Key] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  useEffect(() => {
    fetchConfig()
    fetchNumbers()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/admin/config`)
      if (!response.ok) throw new Error("Failed to fetch config")
      
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
      const response = await fetch(`${apiUrl}/api/admin/numbers`)
      if (!response.ok) throw new Error("Failed to fetch numbers")
      
      const data = await response.json()
      if (data.numbers) setNumbers(data.numbers)
    } catch (error) {
      console.log("Using demo numbers:", error)
    }
  }

  const handleConfigUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (useDemo) {
      alert("⚠️ Demo mode: Configuration not saved. Set NEXT_PUBLIC_API_URL to persist changes.")
      return
    }

    // Validate inputs
    if (!config.api_key.trim() || !config.api_v2_key.trim()) {
      alert("❌ API keys cannot be empty")
      return
    }

    if (config.webhook_url && !config.webhook_url.startsWith("https://")) {
      alert("❌ Webhook URL must use HTTPS for security")
      return
    }

    try {
      setLoading(true)
      setSaveSuccess(false)

      const response = await fetch(`${apiUrl}/api/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      if (!response.ok) throw new Error("Failed to update config")

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error("Error updating config:", error)
      alert("❌ Error updating configuration. Check console for details.")
    } finally {
      setLoading(false)
    }
  }

  const handleAddNumber = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate phone number format
    if (!newNumber.number.match(/^\+\d{10,15}$/)) {
      alert("❌ Phone number must be in E.164 format (e.g., +12345678901)")
      return
    }

    if (!newNumber.name.trim()) {
      alert("❌ Please provide a name/label for the number")
      return
    }

    try {
      if (useDemo) {
        setNumbers([...numbers, newNumber])
        setNewNumber({ number: "", name: "", status: "active" })
        alert("✅ Demo mode: Number added (not persisted)")
        return
      }

      const response = await fetch(`${apiUrl}/api/admin/numbers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNumber),
      })

      if (!response.ok) throw new Error("Failed to add number")

      await fetchNumbers()
      setNewNumber({ number: "", name: "", status: "active" })
      alert("✅ Number added successfully")
    } catch (error) {
      console.error("Error adding number:", error)
      alert("❌ Error adding number. Check console for details.")
    }
  }

  const handleDeleteNumber = async (number: string) => {
    if (!confirm(`Are you sure you want to delete ${number}?`)) return

    try {
      if (useDemo) {
        setNumbers(numbers.filter((n) => n.number !== number))
        alert("✅ Demo mode: Number deleted (not persisted)")
        return
      }

      const response = await fetch(`${apiUrl}/api/admin/numbers/${encodeURIComponent(number)}`, {
        method: "DELETE"
      })

      if (!response.ok) throw new Error("Failed to delete number")

      await fetchNumbers()
      alert("✅ Number deleted successfully")
    } catch (error) {
      console.error("Error deleting number:", error)
      alert("❌ Error deleting number. Check console for details.")
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Demo Mode Warning */}
        {useDemo && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                Demo Mode Active
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Changes will not be persisted. Set <code className="bg-amber-900/20 px-1 py-0.5 rounded">NEXT_PUBLIC_API_URL</code> environment variable to connect to your backend.
              </p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="font-medium text-emerald-600 dark:text-emerald-400">
              Configuration updated successfully!
            </p>
          </div>
        )}

        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <span className="p-2 bg-primary/10 rounded-lg">⚙️</span>
          Admin Configuration
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Telnyx API Configuration */}
          <div className="bg-card rounded-lg border border-border p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🔐 Telnyx API Configuration
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Configure your Telnyx API credentials. Never share these keys publicly.
            </p>
            
            <form onSubmit={handleConfigUpdate} className="space-y-4">
              {/* API Key */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  API Key (V1) <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={config.api_key}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                    placeholder="KEY..."
                    required
                    className="w-full bg-input border border-border rounded-lg p-2 pr-10 font-mono text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* API V2 Key */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  API V2 Key <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showV2Key ? "text" : "password"}
                    value={config.api_v2_key}
                    onChange={(e) => setConfig({ ...config, api_v2_key: e.target.value })}
                    placeholder="KEY..."
                    required
                    className="w-full bg-input border border-border rounded-lg p-2 pr-10 font-mono text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowV2Key(!showV2Key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded transition-colors"
                  >
                    {showV2Key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Webhook URL (HTTPS only)
                </label>
                <input
                  type="url"
                  value={config.webhook_url}
                  onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                  placeholder="https://your-domain.com/api/webhooks/telnyx"
                  pattern="https://.*"
                  className="w-full bg-input border border-border rounded-lg p-2 font-mono text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must use HTTPS for security
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2.5 font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Update Configuration
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Outbound Caller IDs */}
          <div className="bg-card rounded-lg border border-border p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              📞 Outbound Caller IDs
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage phone numbers for outbound calls
            </p>

            <form onSubmit={handleAddNumber} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone Number (E.164 format) <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  value={newNumber.number}
                  onChange={(e) => setNewNumber({ ...newNumber, number: e.target.value })}
                  placeholder="+12345678901"
                  pattern="^\+\d{10,15}$"
                  required
                  className="w-full bg-input border border-border rounded-lg p-2 font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Must start with + and include country code
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Name/Label <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={newNumber.name}
                  onChange={(e) => setNewNumber({ ...newNumber, name: e.target.value })}
                  placeholder="Main Line"
                  required
                  className="w-full bg-input border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg px-4 py-2.5 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Number
              </button>
            </form>

            {/* Numbers List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {numbers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No numbers configured</p>
                  <p className="text-xs mt-1">Add your first caller ID above</p>
                </div>
              ) : (
                numbers.map((num) => (
                  <div
                    key={num.number}
                    className="flex justify-between items-center bg-input hover:bg-secondary/50 rounded-lg p-3 transition-colors group"
                  >
                    <div>
                      <p className="font-medium">{num.name}</p>
                      <p className="text-sm font-mono text-muted-foreground">{num.number}</p>
                      <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                        {num.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteNumber(num.number)}
                      className="p-2 hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete number"
                    >
                      <Trash2 className="w-5 h-5 text-destructive" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-8 p-4 bg-muted/50 border border-border rounded-lg">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Security Best Practices
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Never commit API keys to version control (use .env files)</li>
            <li>Store API keys securely using environment variables</li>
            <li>Always use HTTPS for webhook URLs</li>
            <li>Rotate API keys periodically for enhanced security</li>
            <li>Restrict API access to trusted IP addresses when possible</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
