"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Toggle } from "@/components/ui/toggle"
import { Input } from "@/components/ui/input"
import { Check, Loader2, AlertCircle } from "lucide-react"
import { useTelnyxSettings } from "@/hooks/use-telnyx-settings"

export function SettingsScreen() {
  const { settings, isLoading, updateSettings } = useTelnyxSettings(
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  )

  const [localSettings, setLocalSettings] = useState({
    api_key: "",
    connection_id: "",
    auto_record: false,
    notification_sounds: true,
    recording_format: "mp3",
    country_restriction: "all",
  })

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (settings) {
      setLocalSettings((prev) => ({
        ...prev,
        api_key: settings.api_key || "",
        connection_id: settings.connection_id || "",
      }))
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      await updateSettings({
        api_key: localSettings.api_key,
        connection_id: localSettings.connection_id,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p className="text-muted-foreground">Loading settings...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Telnyx Configuration */}
      <Card className="p-6 space-y-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <h3 className="font-semibold flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${settings?.configured ? "bg-green-500" : "bg-red-500"}`}></span>
          Telnyx Configuration
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">API Key</label>
            <Input
              type="password"
              placeholder="Enter your Telnyx API key"
              value={localSettings.api_key}
              onChange={(e) => setLocalSettings({ ...localSettings, api_key: e.target.value })}
              className="text-sm bg-input border-border"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Connection ID</label>
            <Input
              placeholder="Enter connection ID"
              value={localSettings.connection_id}
              onChange={(e) => setLocalSettings({ ...localSettings, connection_id: e.target.value })}
              className="text-sm bg-input border-border"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Get your credentials from{" "}
            <a
              href="https://portal.telnyx.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Telnyx Portal
            </a>
          </p>
        </div>
      </Card>

      {/* Call Settings */}
      <Card className="p-6 space-y-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
        <h3 className="font-semibold">Call Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Auto Record Calls</label>
            <Toggle
              pressed={localSettings.auto_record}
              onPressedChange={(pressed) => setLocalSettings({ ...localSettings, auto_record: pressed })}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Notification Sounds</label>
            <Toggle
              pressed={localSettings.notification_sounds}
              onPressedChange={(pressed) => setLocalSettings({ ...localSettings, notification_sounds: pressed })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Recording Format</label>
            <select
              value={localSettings.recording_format}
              onChange={(e) => setLocalSettings({ ...localSettings, recording_format: e.target.value })}
              className="w-full bg-input border border-border rounded-lg p-2 text-sm"
            >
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="m4a">M4A</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Country Restrictions</label>
            <select
              value={localSettings.country_restriction}
              onChange={(e) => setLocalSettings({ ...localSettings, country_restriction: e.target.value })}
              className="w-full bg-input border border-border rounded-lg p-2 text-sm"
            >
              <option value="all">Allow All Countries</option>
              <option value="us_only">US Only</option>
              <option value="whitelist">Whitelist</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20 flex gap-2">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-destructive text-sm">{error}</p>
        </Card>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
      >
        {saved ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Settings Saved
          </>
        ) : saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Settings"
        )}
      </Button>
    </div>
  )
}
