"""
Initialize MongoDB collections with sample data
Run: python backend/scripts/init_db.py
"""
import sys
sys.path.insert(0, '/backend')

from database import db
from datetime import datetime
from models import CallStatus, CallDisposition, ContactCategory

def init_collections():
    """Initialize and seed MongoDB collections"""
    database = db.get_db()
    
    # 1. Initialize contacts collection with sample data
    contacts_col = database["contacts"]
    if contacts_col.count_documents({}) == 0:
        sample_contacts = [
            {
                "name": "John Smith",
                "email": "john@example.com",
                "phone": "+12125551001",
                "notes": "Sales Lead",
                "category": "lead",
                "is_favorite": True,
                "call_logs": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "name": "Sarah Johnson",
                "email": "sarah@example.com",
                "phone": "+12125551002",
                "notes": "Support Client",
                "category": "client",
                "is_favorite": False,
                "call_logs": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "name": "Mike Davis",
                "email": "mike@example.com",
                "phone": "+12125551003",
                "notes": "Manager",
                "category": "other",
                "is_favorite": True,
                "call_logs": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "name": "Emma Wilson",
                "email": "emma@example.com",
                "phone": "+12125551004",
                "notes": "Admin",
                "category": "other",
                "is_favorite": False,
                "call_logs": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        ]
        contacts_col.insert_many(sample_contacts)
        print(f"✓ Created {len(sample_contacts)} contacts")
    
    # 2. Initialize numbers collection
    numbers_col = database["numbers"]
    if numbers_col.count_documents({}) == 0:
        sample_numbers = [
            {
                "number": "+12125551234",
                "name": "Main Office",
                "status": "active",
                "is_default": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "number": "+14155551234",
                "name": "SF Office",
                "status": "active",
                "is_default": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            },
            {
                "number": "+17075551234",
                "name": "Support Line",
                "status": "active",
                "is_default": False,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        ]
        numbers_col.insert_many(sample_numbers)
        print(f"✓ Created {len(sample_numbers)} phone numbers")
    
    # 3. Initialize telnyx_config collection
    config_col = database["telnyx_config"]
    if config_col.count_documents({}) == 0:
        config_col.insert_one({
            "key": "main",
            "api_key": "",
            "api_v2_key": "",
            "webhook_url": "http://localhost:8000/webhooks/call",
            "updated_at": datetime.utcnow()
        })
        print("✓ Created Telnyx configuration")
    
    # 4. Create indexes for performance
    collections_indexes = {
        "call_logs": [("from_number", 1), ("to_number", 1), ("created_at", -1), ("status", 1)],
        "contacts": [("email", 1), ("phone", 1), ("is_favorite", 1)],
        "recordings": [("call_id", 1), ("created_at", -1)],
        "numbers": [("number", 1), ("is_default", 1)],
        "webhooks": [("call_id", 1), ("event_type", 1), ("timestamp", -1)]
    }
    
    for collection_name, indexes in collections_indexes.items():
        col = database[collection_name]
        for field, direction in indexes:
            try:
                col.create_index([(field, direction)])
                print(f"✓ Created index on {collection_name}.{field}")
            except:
                pass
    
    print("\n✓ Database initialization complete!")

if __name__ == "__main__":
    init_collections()
