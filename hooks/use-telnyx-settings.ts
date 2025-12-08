"use client"

import useSWR from "swr"

export interface TelnyxSettings {
  api_key: string
  connection_id: string
  webhook_url?: string
  configured: boolean
  auto_record?: boolean
  notification_sounds?: boolean
  recording_format?: string
  country_restriction?: string
  updated_at?: string
  created_at?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error("Failed to fetch settings")
  }
  return res.json()
}

export function useTelnyxSettings(apiUrl = "http://localhost:8000") {
  const { data, error, isLoading, mutate } = useSWR<TelnyxSettings>(
    `${apiUrl}/api/telnyx/settings`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every 60 seconds
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Prevent duplicate requests within 5 seconds
    }
  )

  const updateSettings = async (settings: Partial<TelnyxSettings>) => {
    try {
      const res = await fetch(`${apiUrl}/api/telnyx/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || errorData.message || "Failed to update settings")
      }

      const updated = await res.json()
      
      // Optimistically update the cache
      mutate(updated, false)
      
      return updated
    } catch (error) {
      console.error("Error updating Telnyx settings:", error)
      throw error
    }
  }

  const testConnection = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/telnyx/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!res.ok) {
        throw new Error("Connection test failed")
      }

      return await res.json()
    } catch (error) {
      console.error("Error testing Telnyx connection:", error)
      throw error
    }
  }

  return {
    settings: data,
    isLoading,
    error,
    updateSettings,
    testConnection,
    mutate,
  }
}
