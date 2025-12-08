from fastapi import APIRouter, HTTPException
from models import Contact, ContactCategory
from database import db
from bson.objectid import ObjectId
from typing import List
from datetime import datetime

router = APIRouter()

@router.get("/")
async def get_contacts(category: str = None):
    """Get all contacts, optionally filtered by category"""
    contacts_collection = db.get_db()["contacts"]
    query = {}
    if category:
        query = {"category": category}
    contacts = list(contacts_collection.find(query, {"_id": 1, "name": 1, "phone": 1, "email": 1, "notes": 1, "category": 1, "is_favorite": 1, "created_at": 1}))
    for contact in contacts:
        contact["_id"] = str(contact["_id"])
    return {"contacts": contacts}

@router.get("/favorites")
async def get_favorite_contacts():
    """Get all favorite contacts"""
    contacts_collection = db.get_db()["contacts"]
    favorites = list(contacts_collection.find({"is_favorite": True}, {"_id": 1, "name": 1, "phone": 1}))
    for contact in favorites:
        contact["_id"] = str(contact["_id"])
    return {"contacts": favorites}

@router.post("/")
async def create_contact(contact: Contact):
    """Create a new contact"""
    contacts_collection = db.get_db()["contacts"]
    result = contacts_collection.insert_one(contact.dict())
    return {"id": str(result.inserted_id), "message": "Contact created"}

@router.get("/{contact_id}")
async def get_contact(contact_id: str):
    """Get a specific contact"""
    contacts_collection = db.get_db()["contacts"]
    contact = contacts_collection.find_one({"_id": ObjectId(contact_id)})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    contact["_id"] = str(contact["_id"])
    return contact

@router.put("/{contact_id}")
async def update_contact(contact_id: str, contact: Contact):
    """Update a contact"""
    contacts_collection = db.get_db()["contacts"]
    update_data = contact.dict()
    update_data["updated_at"] = datetime.utcnow()
    result = contacts_collection.update_one(
        {"_id": ObjectId(contact_id)},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact updated"}

@router.post("/{contact_id}/favorite")
async def toggle_favorite(contact_id: str):
    """Toggle favorite status for a contact"""
    contacts_collection = db.get_db()["contacts"]
    contact = contacts_collection.find_one({"_id": ObjectId(contact_id)})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    new_favorite_status = not contact.get("is_favorite", False)
    contacts_collection.update_one(
        {"_id": ObjectId(contact_id)},
        {"$set": {"is_favorite": new_favorite_status}}
    )
    return {"is_favorite": new_favorite_status}

@router.delete("/{contact_id}")
async def delete_contact(contact_id: str):
    """Delete a contact"""
    contacts_collection = db.get_db()["contacts"]
    result = contacts_collection.delete_one({"_id": ObjectId(contact_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted"}
