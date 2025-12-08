"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import { Plus, Edit2, Trash2, Star } from "lucide-react"

const DEMO_CONTACTS = [
  {
    _id: "1",
    name: "John Smith",
    phone: "+12125551001",
    email: "john@example.com",
    notes: "CEO",
    category: "client",
    is_favorite: true,
  },
  {
    _id: "2",
    name: "Sarah Johnson",
    phone: "+12125551002",
    email: "sarah@example.com",
    notes: "Manager",
    category: "lead",
    is_favorite: false,
  },
  {
    _id: "3",
    name: "Mike Davis",
    phone: "+12125551003",
    email: "mike@example.com",
    notes: "Developer",
    category: "follow_up",
    is_favorite: true,
  },
]

interface Contact {
  _id?: string
  name: string
  email?: string
  phone: string
  notes?: string
  category?: string
  is_favorite?: boolean
}

const CATEGORIES = [
  { value: "lead", label: "Lead" },
  { value: "client", label: "Client" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
]

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(DEMO_CONTACTS)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Contact>({
    name: "",
    phone: "",
    email: "",
    notes: "",
    category: "other",
    is_favorite: false,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [useDemo, setUseDemo] = useState(true)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)

  useEffect(() => {
    fetchContacts()
  }, [])

  const fetchContacts = async () => {
    try {
      setLoading(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const response = await fetch(`${apiUrl}/api/contacts/`)

      if (!response.ok) throw new Error("API not available")

      const data = await response.json()
      setContacts(data.contacts || DEMO_CONTACTS)
      setUseDemo(false)
    } catch (error) {
      console.log("Using demo contacts:", error)
      setContacts(DEMO_CONTACTS)
      setUseDemo(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (useDemo) {
        if (editingId) {
          setContacts(contacts.map((c) => (c._id === editingId ? { ...formData, _id: editingId } : c)))
        } else {
          setContacts([...contacts, { ...formData, _id: String(Date.now()) }])
        }
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        if (editingId) {
          await fetch(`${apiUrl}/api/contacts/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })
        } else {
          await fetch(`${apiUrl}/api/contacts/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })
        }
      }
      fetchContacts()
      setFormData({ name: "", phone: "", email: "", notes: "", category: "other", is_favorite: false })
      setShowForm(false)
      setEditingId(null)
    } catch (error) {
      console.error("Error saving contact:", error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      if (useDemo) {
        setContacts(contacts.filter((c) => c._id !== id))
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        await fetch(`${apiUrl}/api/contacts/${id}`, { method: "DELETE" })
        fetchContacts()
      }
    } catch (error) {
      console.error("Error deleting contact:", error)
    }
  }

  const handleToggleFavorite = async (id: string) => {
    try {
      if (useDemo) {
        setContacts(contacts.map((c) => (c._id === id ? { ...c, is_favorite: !c.is_favorite } : c)))
      } else {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        await fetch(`${apiUrl}/api/contacts/${id}/favorite`, { method: "POST" })
        fetchContacts()
      }
    } catch (error) {
      console.error("Error toggling favorite:", error)
    }
  }

  const handleEdit = (contact: Contact) => {
    setFormData(contact)
    setEditingId(contact._id || null)
    setShowForm(true)
  }

  const filteredContacts = filterCategory ? contacts.filter((c) => c.category === filterCategory) : contacts

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {useDemo && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg text-sm">
            <p className="font-medium text-ring">Demo Mode - Changes not saved</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Contacts</h1>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingId(null)
              setFormData({ name: "", phone: "", email: "", notes: "", category: "other", is_favorite: false })
            }}
            className="bg-accent text-accent-foreground hover:opacity-90 rounded-lg px-4 py-2 flex items-center gap-2 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Add Contact
          </button>
        </div>

        {showForm && (
          <div className="bg-card rounded-lg border border-border p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg p-2 text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg p-2 text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg p-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={formData.category || "other"}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg p-2 text-foreground"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg p-2 text-foreground"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-accent text-accent-foreground hover:opacity-90 rounded-lg px-4 py-2 transition-opacity"
                >
                  {editingId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                  }}
                  className="bg-secondary hover:bg-secondary/80 rounded-lg px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterCategory === null ? "bg-accent text-accent-foreground" : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterCategory === cat.value ? "bg-accent text-accent-foreground" : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredContacts.map((contact) => (
              <div key={contact._id} className="bg-card rounded-lg border border-border p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{contact.name}</h3>
                  {contact.is_favorite && <Star className="w-5 h-5 fill-accent text-accent" />}
                </div>
                <p className="text-sm text-muted-foreground font-mono">{contact.phone}</p>
                {contact.email && <p className="text-sm text-muted-foreground">{contact.email}</p>}
                {contact.category && (
                  <div className="mt-2">
                    <span className="inline-block bg-accent/20 text-accent px-2 py-1 rounded text-xs font-medium">
                      {CATEGORIES.find((c) => c.value === contact.category)?.label}
                    </span>
                  </div>
                )}
                {contact.notes && <p className="text-sm mt-2">{contact.notes}</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => contact._id && handleToggleFavorite(contact._id)}
                    className="flex-1 bg-secondary hover:bg-secondary/80 rounded px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Star className="w-4 h-4" />
                    {contact.is_favorite ? "Unfavorite" : "Favorite"}
                  </button>
                  <button
                    onClick={() => handleEdit(contact)}
                    className="flex-1 bg-secondary hover:bg-secondary/80 rounded px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => contact._id && handleDelete(contact._id)}
                    className="flex-1 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded px-3 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
