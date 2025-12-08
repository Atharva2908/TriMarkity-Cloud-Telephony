"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Toggle } from "@/components/ui/toggle"
import { Input } from "@/components/ui/input"
import { Check, Loader2, AlertCircle, Eye, EyeOff, ExternalLink, RefreshCw } from "lucide-react"
import { useTelnyxSettings } from "@/hooks/use-telnyx-settings"
import { useApiConfig } from "@/hooks/use-api-config"

export function SettingsScreen() {
  const { apiUrl } = useApiConfig()
  const { settings, isLoading, updateSettings, mutate } = useTelnyxSettings(apiUrl)

  const [localSettings, setLocalSettings] = useState({
    api_key: "",
    connection_id: "",
    auto_record: false,
    notification_sounds: true,
    recording_format: "mp3",
    country_restriction: "all",
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (settings) {
      const newSettings = {
        api_key: settings.api_key || "",
        connection_id: settings.connection_id || "",
        auto_record: settings.auto_record ?? false,
        notification_sounds: settings.notification_sounds ?? true,
        recording_format: settings.recording_format || "mp3",
        country_restriction: settings.country_restriction || "all",
      }
      setLocalSettings(newSettings)
      setHasChanges(false)
    }
  }, [settings])

  const handleSettingChange = (key: string, value: any) => {
    setLocalSettings({ ...localSettings, [key]: value })
    setHasChanges(true)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      await updateSettings(localSettings)
      setSaved(true)
      setHasChanges(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (settings) {
      setLocalSettings({
        api_key: settings.api_key || "",
        connection_id: settings.connection_id || "",
        auto_record: settings.auto_record ?? false,
        notification_sounds: settings.notification_sounds ?? true,
        recording_format: settings.recording_format || "mp3",
        country_restriction: settings.country_restriction || "all",
      })
      setHasChanges(false)
      setError("")
    }
  }

  const testConnection = async () => {
    try {
      const response = await fetch(`${apiUrl}/health`)
      if (response.ok) {
        alert("✅ Backend connection successful!")
      } else {
        alert("⚠️ Backend responded but might have issues")
      }
    } catch (err) {
      alert("❌ Cannot reach backend server")
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
      {/* Connection Status */}
      <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${settings?.configured ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></span>
            <div>
              <p className="font-semibold text-sm">Backend Connection</p>
              <p className="text-xs text-muted-foreground">{apiUrl}</p>
            </div>
          </div>
          <Button onClick={testConnection} variant="outline" size="sm">
            <RefreshCw className="w-3 h-3 mr-2" />
            Test
          </Button>
        </div>
      </Card>

      {/* Telnyx Configuration */}
      <Card className="p-6 space-y-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${settings?.configured ? "bg-green-500" : "bg-red-500"}`}></span>
            Telnyx Configuration
          </h3>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href="https://portal.telnyx.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3 h-3 mr-2" />
              Portal
            </a>
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">API Key</label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                placeholder="KEY01xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={localSettings.api_key}
                onChange={(e) => handleSettingChange("api_key", e.target.value)}
                className="text-sm bg-input border-border pr-10 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your Telnyx API key (starts with KEY01...)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Connection ID</label>
            <Input
              placeholder="Enter connection ID"
              value={localSettings.connection_id}
              onChange={(e) => handleSettingChange("connection_id", e.target.value)}
              className="text-sm bg-input border-border font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your Telnyx voice connection ID
            </p>
          </div>

          {settings?.configured ? (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✅ Telnyx is configured and ready
              </p>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Telnyx not configured. Add your credentials above.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Call Settings */}
      <Card className="p-6 space-y-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
        <h3 className="font-semibold">Call Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
            <div>
              <label className="text-sm font-medium">Auto Record Calls</label>
              <p className="text-xs text-muted-foreground">Automatically record all outgoing calls</p>
            </div>
            <Toggle
              pressed={localSettings.auto_record}
              onPressedChange={(pressed) => handleSettingChange("auto_record", pressed)}
              className="data-[state=on]:bg-primary"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50">
            <div>
              <label className="text-sm font-medium">Notification Sounds</label>
              <p className="text-xs text-muted-foreground">Play sounds for call events</p>
            </div>
            <Toggle
              pressed={localSettings.notification_sounds}
              onPressedChange={(pressed) => handleSettingChange("notification_sounds", pressed)}
              className="data-[state=on]:bg-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Recording Format</label>
            <select
              value={localSettings.recording_format}
              onChange={(e) => handleSettingChange("recording_format", e.target.value)}
              className="w-full bg-input border border-border rounded-lg p-2 text-sm"
            >
              <option value="mp3">MP3 (Recommended)</option>
              <option value="wav">WAV (Highest Quality)</option>
              <option value="m4a">M4A (Apple)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Audio format for call recordings
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Country Restrictions</label>
            <select
              value={localSettings.country_restriction}
              onChange={(e) => handleSettingChange("country_restriction", e.target.value)}
              className="w-full bg-input border border-border rounded-lg p-2 text-sm"
            >
              <option value="all">Allow All Countries</option>
              <option value="us_only">US Only</option>
              <option value="whitelist">Custom Whitelist</option>
              <option value="blacklist">Custom Blacklist</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Restrict outgoing calls to specific countries
            </p>
          </div>
        </div>
      </Card>

      {/* System Info */}
      <Card className="p-6 space-y-3 bg-gradient-to-br from-slate-500/10 to-slate-500/5 border-slate-500/20">
        <h3 className="font-semibold">System Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Backend URL:</span>
            <span className="font-mono text-xs">{apiUrl}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Environment:</span>
            <span className="font-mono text-xs">
              {apiUrl.includes("localhost") ? "Development" : "Production"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last Updated:</span>
            <span className="font-mono text-xs">
              {settings?.updated_at ? new Date(settings.updated_at).toLocaleString() : "Never"}
            </span>
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

      {/* Success Message */}
      {saved && (
        <Card className="p-4 bg-green-500/10 border-green-500/20 flex gap-2">
          <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-600 dark:text-green-400 text-sm">Settings saved successfully!</p>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleReset}
          disabled={!hasChanges || saving}
          variant="outline"
          className="flex-1"
        >
          Reset Changes
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Saved
            </>
          ) : saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Save Settings
              {hasChanges && <span className="ml-2 text-xs">(unsaved)</span>}
            </>
          )}
        </Button>
      </div>

      {/* Help Text */}
      <Card className="p-4 bg-blue-500/5 border-blue-500/10">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Tip:</strong> After updating your Telnyx credentials, test the connection to ensure everything is working correctly.
          Changes are saved to the backend and will persist across sessions.
        </p>
      </Card>
    </div>
  )
}
