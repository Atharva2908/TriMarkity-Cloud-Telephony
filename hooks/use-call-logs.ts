"use client"
import useSWR from "swr"

interface CallLog {
  _id: string
  call_id: string
  to_number: string
  from_number: string
  duration: number
  status: string
  disposition?: string
  notes?: string
  recording_url?: string
  created_at: string
  ended_at?: string
}

export function useCallLogs(apiUrl = "http://localhost:8000") {
  const { data, error, isLoading, mutate } = useSWR<{ logs: CallLog[] }>(
    `${apiUrl}/api/calls/logs`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch call logs")
      return res.json()
    },
    { refreshInterval: 5000 },
  )

  const searchLogs = async (query: string, status?: string) => {
    try {
      const params = new URLSearchParams()
      if (query) params.append("query", query)
      if (status) params.append("status", status)

      const res = await fetch(`${apiUrl}/api/calls/logs/search?${params}`)
      if (!res.ok) throw new Error("Search failed")
      return await res.json()
    } catch (error) {
      console.error("Error searching logs:", error)
      return { logs: [] }
    }
  }

  const getCallStats = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/calls/stats/summary`)
      if (!res.ok) throw new Error("Failed to fetch stats")
      return await res.json()
    } catch (error) {
      console.error("Error fetching stats:", error)
      return null
    }
  }

  return {
    logs: data?.logs || [],
    isLoading,
    error,
    searchLogs,
    getCallStats,
    mutate,
  }
}
