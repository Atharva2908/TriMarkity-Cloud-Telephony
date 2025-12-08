"use client"

import { useCallback } from "react"
import useSWR from "swr"

interface Recording {
  _id: string
  call_id: string
  url: string
  size: number
  created_at: string
  filename?: string
}

export function useRecordingsApi(apiUrl = "http://localhost:8000") {
  const { data, error, isLoading, mutate } = useSWR<{ recordings: Recording[] }>(
    `${apiUrl}/api/recordings/`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch recordings")
      return res.json()
    },
    { refreshInterval: 30000 },
  )

  const getCallRecording = useCallback(
    async (callId: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/recordings/${callId}`)
        if (!res.ok) return null
        return await res.json()
      } catch (error) {
        console.error("[v0] Error fetching recording:", error)
        return null
      }
    },
    [apiUrl],
  )

  const deleteRecording = useCallback(
    async (recordingId: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/recordings/${recordingId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Failed to delete recording")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("[v0] Error deleting recording:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  return {
    recordings: data?.recordings || [],
    isLoading,
    error,
    getCallRecording,
    deleteRecording,
    mutate,
  }
}
