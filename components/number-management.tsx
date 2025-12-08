"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Plus, Trash2, Star, Search, RefreshCw, Loader2, CheckCircle, XCircle } from "lucide-react"
import { useApiConfig } from "@/hooks/use-api-config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

interface CallNumber {
  _id?: string
  number: string
  name: string
  status: string
  is_default?: boolean
  created_at?: string
}

interface AvailableNumber {
  number: string
  city?: string
  state?: string
  country_code?: string
  features?: string[]
}

export function NumberManagement() {
  const { apiUrl } = useApiConfig()
  const [numbers, setNumbers] = useState<CallNumber[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CallNumber>({
    number: "",
    name: "",
    status: "active",
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useState({
    country_code: "US",
    area_code: "",
  })

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
    if (!confirm("Are you sure you want to delete this number?")) return

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
      setSuccess("Number deleted successfully")
      await fetchNumbers()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error("Error deleting number:", err)
      setError(err.message || "Failed to delete number")
    }
  }

  const handleSearchNumbers = async () => {
    try {
      setSearching(true)
      setError(null)
      const params = new URLSearchParams({
        country_code: searchParams.country_code,
        ...(searchParams.area_code && { area_code: searchParams.area_code }),
      })
      const response = await fetch(`${apiUrl}/api/numbers/search?${params}`)
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }
      const data = await response.json()
      setAvailableNumbers(data.available_numbers || [])
      if ((data.available_numbers || []).length === 0) {
        setError("No available numbers found. Try different search criteria.")
      }
    } catch (err: any) {
      console.error("Error searching numbers:", err)
      setError(err.message || "Failed to search available numbers")
    } finally {
      setSearching(false)
    }
  }

  const handleSelectAvailableNumber = (num: AvailableNumber) => {
    setFormData({
      number: num.number,
      name: `${num.city || "Unknown"}, ${num.state || "Unknown"}`,
      status: "active",
    })
    setShowForm(true)
    setSearchOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Virtual Numbers</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your Telnyx phone numbers
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setSearchOpen(!searchOpen)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Search className="w-4 h-4" />
              Search Available
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              size="sm"
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Plus className="w-4 h-4" />
              Add Number
            </Button>
            <Button
              onClick={fetchNumbers}
              variant="ghost"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading numbers...</p>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20 flex gap-2">
          <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-destructive text-sm">{error}</p>
        </Card>
      )}

      {/* Success Message */}
      {success && (
        <Card className="p-4 bg-green-500/10 border-green-500/20 flex gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-600 dark:text-green-400 text-sm">{success}</p>
        </Card>
      )}

      {/* Search Available Numbers */}
      {searchOpen && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-lg">Search Available Numbers</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="country-code" className="block text-sm font-medium mb-2">
                Country Code
              </label>
              <select
                id="country-code"
                value={searchParams.country_code}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, country_code: e.target.value })
                }
                className="w-full bg-input border border-border rounded-lg p-2 text-foreground"
              >
                <option value="US">United States (+1)</option>
                <option value="CA">Canada (+1)</option>
                <option value="GB">United Kingdom (+44)</option>
                <option value="AU">Australia (+61)</option>
              </select>
            </div>
            <div>
              <label htmlFor="area-code" className="block text-sm font-medium mb-2">
                Area Code (Optional)
              </label>
              <Input
                id="area-code"
                type="text"
                value={searchParams.area_code}
                onChange={(e) =>
                  setSearchParams({ ...searchParams, area_code: e.target.value })
                }
                placeholder="e.g., 212, 415"
                className="text-foreground"
              />
            </div>
          </div>

          <Button
            onClick={handleSearchNumbers}
            disabled={searching}
            className="w-full sm:w-auto"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search Numbers
              </>
            )}
          </Button>

          {/* Available Numbers List */}
          {availableNumbers.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <p className="text-sm text-muted-foreground">
                Found {availableNumbers.length} available numbers
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableNumbers.map((num, idx) => (
                  <Card
                    key={idx}
                    className="p-3 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-mono font-bold">{num.number}</p>
                        <p className="text-xs text-muted-foreground">
                          {num.city}, {num.state}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleSelectAvailableNumber(num)}
                        size="sm"
                        variant="default"
                      >
                        Add
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add Number Form */}
      {showForm && (
        <Card className="p-6 space-y-4">
          <h3 className="font-bold text-lg">Add Virtual Number</h3>
          <form onSubmit={handleAddNumber} className="space-y-4">
            <div>
              <label htmlFor="phone-number" className="block text-sm font-medium mb-2">
                Phone Number *
              </label>
              <Input
                id="phone-number"
                type="tel"
                value={formData.number}
                onChange={(e) =>
                  setFormData({ ...formData, number: e.target.value })
                }
                placeholder="+1 (212) 555-0000"
                className="font-mono"
                required
              />
            </div>
            <div>
              <label htmlFor="number-name" className="block text-sm font-medium mb-2">
                Name/Label *
              </label>
              <Input
                id="number-name"
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Main Office, Sales Team"
                required
              />
            </div>
            <div>
              <label htmlFor="number-status" className="block text-sm font-medium mb-2">
                Status
              </label>
              <select
                id="number-status"
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
              <Button type="submit" className="flex-1">
                Add Number
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setFormData({ number: "", name: "", status: "active" })
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Numbers Grid */}
      {!loading && numbers.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>No virtual numbers configured yet.</p>
          <p className="text-sm mt-2">Click "Add Number" or "Search Available" to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {numbers.map((num) => (
            <Card
              key={num._id ?? num.number}
              className={`p-4 ${
                num.is_default
                  ? "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20"
                  : ""
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-lg truncate">{num.number}</p>
                  <p className="text-sm text-muted-foreground truncate">{num.name}</p>
                </div>
                {num.is_default && (
                  <div className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 flex-shrink-0">
                    <Star className="w-3 h-3 fill-current" />
                    Default
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">Status:</span>
                <span
                  className={`text-xs font-medium ${
                    num.status === "active"
                      ? "text-green-600 dark:text-green-400"
                      : "text-slate-500"
                  }`}
                >
                  {num.status === "active" ? "🟢 Active" : "⚪ Inactive"}
                </span>
              </div>

              <div className="flex gap-2">
                {!num.is_default && (
                  <Button
                    onClick={() => num._id && handleSetDefault(num._id)}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                  >
                    <Star className="w-4 h-4" />
                    Set Default
                  </Button>
                )}
                <Button
                  onClick={() => num._id && handleDeleteNumber(num._id)}
                  variant="destructive"
                  size="sm"
                  className={`gap-2 ${num.is_default ? "flex-1" : "flex-1"}`}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Footer */}
      {!loading && numbers.length > 0 && (
        <Card className="p-4 bg-secondary/20">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">
              Total Numbers: <strong className="text-foreground">{numbers.length}</strong>
            </span>
            <span className="text-muted-foreground">
              Active: <strong className="text-green-600 dark:text-green-400">
                {numbers.filter((n) => n.status === "active").length}
              </strong>
            </span>
            <span className="text-muted-foreground">
              Default: <strong className="text-amber-600 dark:text-amber-400">
                {numbers.filter((n) => n.is_default).length}
              </strong>
            </span>
          </div>
        </Card>
      )}
    </div>
  )
}
