"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Plus, Trash2, Star } from "lucide-react"

interface CallNumber {
  _id?: string
  number: string
  name: string
  status: string
  is_default?: boolean
  created_at?: string
}

export function NumberManagement() {
  const [numbers, setNumbers] = useState<CallNumber[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CallNumber>({
    number: "",
    name: "",
    status: "active",
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  useEffect(() => {
    fetchNumbers()
  }, [])

  const fetchNumbers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${apiUrl}/api/numbers/`)
      if (!response.ok) {
        throw new Error(`Failed to fetch numbers: ${response.status}`)
      }
      const data = await response.json()
      setNumbers(data.numbers || [])
    } catch (e: any) {
      console.error("Error fetching numbers:", e)
      setError("Failed to load numbers from API")
    } finally {
      setLoading(false)
    }
  }

  const handleAddNumber = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      setSuccess(null)
      const resp = await fetch(`${apiUrl}/api/numbers/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || `Failed to add number (${resp.status})`)
      }

      setSuccess("Number added successfully")
      await fetchNumbers()
      setFormData({ number: "", name: "", status: "active" })
      setShowForm(false)

      // Auto clear success after a few seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error("Error adding number:", err)
      setError(err.message || "Failed to add number")
    }
  }

  const handleSetDefault = async (numberId: string) => {
    try {
      setError(null)
      setSuccess(null)
      const resp = await fetch(`${apiUrl}/api/numbers/${numberId}/set-default`, {
        method: "POST",
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || `Failed to set default (${resp.status})`)
      }
      setSuccess("Default number updated")
      await fetchNumbers()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error("Error setting default:", err)
      setError(err.message || "Failed to set default number")
    }
  }

  const handleDeleteNumber = async (numberId: string) => {
    try {
      setError(null)
      setSuccess(null)
      const resp = await fetch(`${apiUrl}/api/numbers/${numberId}`, {
        method: "DELETE",
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || `Failed to delete (${resp.status})`)
      }
      setSuccess("Number deleted")
      await fetchNumbers()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error("Error deleting number:", err)
      setError(err.message || "Failed to delete number")
    }
  }

  const handleSearchNumbers = async () => {
    try {
      setError(null)
      const response = await fetch(
        `${apiUrl}/api/numbers/search?country_code=US&area_code=212`,
      )
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }
      const data = await response.json()
      setAvailableNumbers(data.available_numbers || [])
    } catch (err: any) {
      console.error("Error searching numbers:", err)
      setError(err.message || "Failed to search available numbers")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Virtual Numbers</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="bg-secondary hover:bg-secondary/80 rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Search Available
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-accent text-accent-foreground hover:opacity-90 rounded-lg px-4 py-2 flex items-center gap-2 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Number
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Loading numbers…</div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/40 rounded text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-400/60 rounded text-sm text-emerald-800 dark:text-emerald-200">
          {success}
        </div>
      )}

      {searchOpen && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="font-semibold mb-4">Available Numbers</h3>
          <button
            onClick={handleSearchNumbers}
            className="bg-accent text-accent-foreground hover:opacity-90 rounded px-3 py-2 text-sm mb-4 transition-opacity"
          >
            Search
          </button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availableNumbers.map((num, idx) => (
              <div
                key={idx}
                className="bg-input border border-border rounded p-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-mono font-bold">{num.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {num.city}, {num.state}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFormData({
                      number: num.number,
                      name: "",
                      status: "active",
                    })
                    setShowForm(true)
                    setSearchOpen(false)
                  }}
                  className="bg-accent text-accent-foreground hover:opacity-90 px-2 py-1 text-xs rounded transition-opacity"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-bold mb-4">Add Virtual Number</h3>
          <form onSubmit={handleAddNumber} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.number}
                onChange={(e) =>
                  setFormData({ ...formData, number: e.target.value })
                }
                placeholder="+1 (212) 555-0000"
                className="w-full bg-input border border-border rounded-lg p-2 text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Name/Label
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Main Office, Sales Team"
                className="w-full bg-input border border-border rounded-lg p-2 text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full bg-input border border-border rounded-lg p-2 text-foreground"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-accent text-accent-foreground hover:opacity-90 rounded-lg px-4 py-2 transition-opacity"
              >
                Add Number
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-secondary hover:bg-secondary/80 rounded-lg px-4 py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {numbers.map((num) => (
          <div
            key={num._id ?? num.number}
            className="bg-card rounded-lg border border-border p-4"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-mono font-bold text-lg">{num.number}</p>
                <p className="text-sm text-muted-foreground">{num.name}</p>
              </div>
              {num.is_default && (
                <div className="bg-accent/20 text-accent px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Default
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Status:{" "}
              <span
                className={
                  num.status === "active"
                    ? "text-green-500"
                    : "text-muted-foreground"
                }
              >
                {num.status}
              </span>
            </p>
            <div className="flex gap-2">
              {!num.is_default && (
                <button
                  onClick={() => num._id && handleSetDefault(num._id)}
                  className="flex-1 bg-secondary hover:bg-secondary/80 rounded px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Star className="w-4 h-4" />
                  Set Default
                </button>
              )}
              <button
                onClick={() => num._id && handleDeleteNumber(num._id)}
                className="flex-1 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
