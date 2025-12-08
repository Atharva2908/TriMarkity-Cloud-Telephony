"use client"

import { useCallback } from "react"
import useSWR from "swr"

interface Contact {
  _id: string
  name: string
  phone: string
  email?: string
  category: string
  is_favorite: boolean
  created_at: string
}

export function useContactsApi(apiUrl = "http://localhost:8000") {
  const { data, error, isLoading, mutate } = useSWR<{ contacts: Contact[] }>(
    `${apiUrl}/api/contacts/`,
    async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch contacts")
      return res.json()
    },
    { revalidateOnFocus: false, refreshInterval: 30000 },
  )

  const addContact = useCallback(
    async (contact: Omit<Contact, "_id" | "created_at">) => {
      try {
        const res = await fetch(`${apiUrl}/api/contacts/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contact),
        })
        if (!res.ok) throw new Error("Failed to add contact")
        mutate() // Refresh contacts list
        return await res.json()
      } catch (error) {
        console.error("[v0] Error adding contact:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  const updateContact = useCallback(
    async (id: string, contact: Partial<Contact>) => {
      try {
        const res = await fetch(`${apiUrl}/api/contacts/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contact),
        })
        if (!res.ok) throw new Error("Failed to update contact")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("[v0] Error updating contact:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  const deleteContact = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/contacts/${id}`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error("Failed to delete contact")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("[v0] Error deleting contact:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  const toggleFavorite = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/contacts/${id}/favorite`, {
          method: "POST",
        })
        if (!res.ok) throw new Error("Failed to toggle favorite")
        mutate()
        return await res.json()
      } catch (error) {
        console.error("[v0] Error toggling favorite:", error)
        throw error
      }
    },
    [apiUrl, mutate],
  )

  return {
    contacts: data?.contacts || [],
    isLoading,
    error,
    addContact,
    updateContact,
    deleteContact,
    toggleFavorite,
    mutate,
  }
}
