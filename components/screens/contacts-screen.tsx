"use client"

import { useState } from "react"
import { Search, Plus, Mail, Phone, Trash2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useContactsApi } from "@/hooks/use-contacts-api"
import { Loader2 } from "lucide-react"

interface ContactsScreenProps {
  contacts: any[]
}

export function ContactsScreen({ contacts: initialContacts }: ContactsScreenProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  const { contacts, isLoading, addContact, deleteContact, toggleFavorite } = useContactsApi(apiUrl)

  const [searchTerm, setSearchTerm] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" })

  const displayContacts = contacts.length > 0 ? contacts : initialContacts

  const filteredContacts = displayContacts.filter(
    (contact) => contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) || contact.phone?.includes(searchTerm),
  )

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) return

    try {
      await addContact({
        name: newContact.name,
        phone: newContact.phone,
        email: newContact.email || undefined,
        category: "other",
        is_favorite: false,
      })
      setNewContact({ name: "", phone: "", email: "" })
      setShowAddForm(false)
    } catch (error) {
      console.error("[v0] Error adding contact:", error)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteContact(contactId)
    } catch (error) {
      console.error("[v0] Error deleting contact:", error)
    }
  }

  const handleToggleFavorite = async (contactId: string) => {
    try {
      await toggleFavorite(contactId)
    } catch (error) {
      console.error("[v0] Error toggling favorite:", error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-input border border-border"
          />
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          size="sm"
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <Card className="p-4 space-y-3 bg-card border-border">
          <Input
            placeholder="Name"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            className="text-sm"
          />
          <Input
            placeholder="Phone"
            type="tel"
            value={newContact.phone}
            onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
            className="text-sm"
          />
          <Input
            placeholder="Email (optional)"
            type="email"
            value={newContact.email}
            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            className="text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddContact}
              disabled={!newContact.name || !newContact.phone}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Save
            </Button>
          </div>
        </Card>
      )}

      {isLoading && (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading contacts...</p>
        </Card>
      )}

      {/* Contacts List */}
      <div className="space-y-2">
        {filteredContacts.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No contacts found</Card>
        ) : (
          filteredContacts.map((contact) => (
            <Card key={contact._id || contact.id} className="p-4 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{contact.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{contact.phone}</p>
                  {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleFavorite(contact._id || contact.id)}
                    className={contact.is_favorite ? "text-accent" : ""}
                  >
                    <Star className="w-4 h-4" fill={contact.is_favorite ? "currentColor" : "none"} />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost">
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteContact(contact._id || contact.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
