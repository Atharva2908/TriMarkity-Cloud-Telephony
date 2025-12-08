from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from config import config
import logging

logger = logging.getLogger(__name__)

class Database:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        try:
            self.client = MongoClient(config.MONGODB_URL, serverSelectionTimeoutMS=5000)
            self.client.admin.command('ping')
            self.db = self.client[config.DATABASE_NAME]
            self._initialized = True
            logger.info("✓ MongoDB connection successful")
            self._create_collections()
        except ServerSelectionTimeoutError:
            logger.error("✗ Could not connect to MongoDB")
            raise
    
    def _create_collections(self):
        """Create collections and indexes if they don't exist"""
        collections = {
            "contacts": [("email", 1), ("phone", 1)],
            "call_logs": [("from_number", 1), ("to_number", 1), ("created_at", -1)],
            "recordings": [("call_id", 1), ("created_at", -1)],
            "telnyx_config": [("key", 1)],
            "call_numbers": [("number", 1)],
            "users": [("email", 1)],
        }
        
        for collection_name, indexes in collections.items():
            if collection_name not in self.db.list_collection_names():
                self.db.create_collection(collection_name)
                for field, order in indexes:
                    self.db[collection_name].create_index(field, unique=False)
                logger.info(f"✓ Created collection: {collection_name}")
    
    def get_db(self):
        return self.db
    
    def close(self):
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

# Singleton instance
db = Database()
