"use client"

import { useCallback } from "react"
import useSWR from "swr"

interface Recording {
  _id: string
  call_id: string
  filename: string
  size: number
  url: string
  created_at: string
}

export function useRecordings(apiUrl = "http://localhost:8000") {
  const { data, error, isLoading, mutate } = useSWR<{ recordings: Recording[] }>(
    `${apiUrl}/api/recordings/`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch recordings")
      return res.json()
    },
    { refreshInterval: 10000 },
  )

  const uploadRecording = useCallback(
    async (callId: string, file: File) => {
      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch(`${apiUrl}/api/recordings/${callId}/upload`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) throw new Error("Upload failed")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("Error uploading recording:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  const deleteRecording = useCallback(
    async (recordingId: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/recordings/${recordingId}`, {
          method: "DELETE",
        })

        if (!res.ok) throw new Error("Delete failed")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("Error deleting recording:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  return {
    recordings: data?.recordings || [],
    isLoading,
    error,
    uploadRecording,
    deleteRecording,
    mutate,
  }
}
