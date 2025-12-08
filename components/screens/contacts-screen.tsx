"use client"

import { useState } from "react"
import { Search, Plus, Mail, Phone, Trash2, Star, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useContactsApi } from "@/hooks/use-contacts-api"
import { useApiConfig } from "@/hooks/use-api-config"

interface ContactsScreenProps {
  contacts: any[]
  onCallContact?: (contact: any) => void
}

export function ContactsScreen({ contacts: initialContacts, onCallContact }: ContactsScreenProps) {
  const { apiUrl } = useApiConfig()
  const { contacts, isLoading, addContact, deleteContact, toggleFavorite } = useContactsApi(apiUrl)

  const [searchTerm, setSearchTerm] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" })
  const [filterFavorites, setFilterFavorites] = useState(false)

  const displayContacts = contacts.length > 0 ? contacts : initialContacts

  const filteredContacts = displayContacts
    .filter((contact) => {
      const matchesSearch =
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) || contact.phone?.includes(searchTerm)
      const matchesFavorite = !filterFavorites || contact.is_favorite
      return matchesSearch && matchesFavorite
    })
    .sort((a, b) => {
      // Sort favorites first
      if (a.is_favorite && !b.is_favorite) return -1
      if (!a.is_favorite && b.is_favorite) return 1
      // Then by name
      return (a.name || "").localeCompare(b.name || "")
    })

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
      console.error("Error adding contact:", error)
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return

    try {
      await deleteContact(contactId)
    } catch (error) {
      console.error("Error deleting contact:", error)
    }
  }

  const handleToggleFavorite = async (contactId: string) => {
    try {
      await toggleFavorite(contactId)
    } catch (error) {
      console.error("Error toggling favorite:", error)
    }
  }

  const handleCallContact = (contact: any) => {
    if (onCallContact) {
      onCallContact(contact)
    }
  }

  const favoriteCount = displayContacts.filter((c) => c.is_favorite).length

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="text-xs text-muted-foreground font-semibold">Total Contacts</div>
          <div className="text-2xl font-bold text-foreground mt-1">{displayContacts.length}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <div className="text-xs text-muted-foreground font-semibold">Favorites</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{favoriteCount}</div>
        </Card>
      </div>

      {/* Search Bar */}
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

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => setFilterFavorites(false)}
          variant={!filterFavorites ? "default" : "outline"}
          size="sm"
        >
          All Contacts
        </Button>
        <Button
          onClick={() => setFilterFavorites(true)}
          variant={filterFavorites ? "default" : "outline"}
          size="sm"
          className="gap-1"
        >
          <Star className="w-3 h-3" fill={filterFavorites ? "currentColor" : "none"} />
          Favorites
        </Button>
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <Card className="p-4 space-y-3 bg-card border-border">
          <div className="text-sm font-semibold mb-2">Add New Contact</div>
          <Input
            placeholder="Name *"
            value={newContact.name}
            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
            className="text-sm"
          />
          <Input
            placeholder="Phone *"
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false)
                setNewContact({ name: "", phone: "", email: "" })
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddContact}
              disabled={!newContact.name || !newContact.phone}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Save Contact
            </Button>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading contacts...</p>
        </Card>
      )}

      {/* Contacts List */}
      <div className="space-y-2">
        {!isLoading && filteredContacts.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {searchTerm || filterFavorites ? "No matching contacts found" : "No contacts yet. Add your first contact!"}
          </Card>
        ) : (
          filteredContacts.map((contact) => (
            <Card
              key={contact._id || contact.id}
              className={`p-4 hover:bg-secondary/50 transition-colors border ${
                contact.is_favorite ? "border-amber-500/30 bg-amber-500/5" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{contact.name}</p>
                    {contact.is_favorite && (
                      <Star className="w-3 h-3 text-amber-500" fill="currentColor" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{contact.phone}</p>
                  {contact.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3" />
                      {contact.email}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleFavorite(contact._id || contact.id)}
                    className={contact.is_favorite ? "text-amber-500 hover:text-amber-600" : "hover:text-amber-500"}
                    title={contact.is_favorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className="w-4 h-4" fill={contact.is_favorite ? "currentColor" : "none"} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCallContact(contact)}
                    className="hover:text-primary"
                    title="Call contact"
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  {contact.email && (
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      className="hover:text-primary"
                      title="Send email"
                    >
                      <a href={`mailto:${contact.email}`}>
                        <Mail className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteContact(contact._id || contact.id)}
                    title="Delete contact"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Results Count */}
      {!isLoading && filteredContacts.length > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          Showing {filteredContacts.length} {filteredContacts.length === 1 ? "contact" : "contacts"}
          {filterFavorites && " (favorites)"}
        </div>
      )}
    </div>
  )
}
