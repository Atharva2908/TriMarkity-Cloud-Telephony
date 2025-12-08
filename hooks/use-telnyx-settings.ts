"use client"

import useSWR from "swr"

interface TelnyxSettings {
  api_key: string
  connection_id: string
  webhook_url: string
  configured: boolean
}

export function useTelnyxSettings(apiUrl = "http://localhost:8000") {
  const { data, error, isLoading, mutate } = useSWR<TelnyxSettings>(
    `${apiUrl}/api/telnyx/settings`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch settings")
      return res.json()
    },
    { refreshInterval: 60000 },
  )

  const updateSettings = async (settings: Partial<TelnyxSettings>) => {
    try {
      const res = await fetch(`${apiUrl}/api/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error("Failed to update settings")
      mutate()
      return await res.json()
    } catch (error) {
      console.error("[v0] Error updating settings:", error)
      throw error
    }
  }

  return {
    settings: data,
    isLoading,
    error,
    updateSettings,
    mutate,
  }
}
