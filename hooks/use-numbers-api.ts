"use client"

import { useCallback } from "react"
import useSWR from "swr"

interface CallNumber {
  _id?: string
  number: string
  name: string
  status: string
  is_default: boolean
  created_at?: string
}

export function useNumbersApi(apiUrl = "http://localhost:8000") {
  const { data, error, isLoading, mutate } = useSWR<{ numbers: CallNumber[] }>(
    `${apiUrl}/api/numbers/`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch numbers")
      return res.json()
    },
    { refreshInterval: 60000 },
  )

  const addNumber = useCallback(
    async (number: CallNumber) => {
      try {
        const res = await fetch(`${apiUrl}/api/numbers/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(number),
        })
        if (!res.ok) throw new Error("Failed to add number")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("[v0] Error adding number:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  const setDefaultNumber = useCallback(
    async (numberId: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/numbers/${numberId}/set-default`, {
          method: "POST",
        })
        if (!res.ok) throw new Error("Failed to set default number")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("[v0] Error setting default:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  const deleteNumber = useCallback(
    async (numberId: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/numbers/${numberId}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Failed to delete number")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("[v0] Error deleting number:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  return {
    numbers: data?.numbers || [],
    isLoading,
    error,
    addNumber,
    setDefaultNumber,
    deleteNumber,
    mutate,
  }
}
