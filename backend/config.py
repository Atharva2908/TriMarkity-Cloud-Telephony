import os
from dotenv import load_dotenv
from typing import List

# Load environment variables from .env file
load_dotenv()

class Config:
    # Application
    APP_NAME = os.getenv("APP_NAME", "ctp.trimarkity.app")
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"
    
    # MongoDB
    MONGODB_URL = os.getenv(
        "MONGODB_URL",
        "mongodb+srv://ganganeatharv29_db_user:86QN7qcMsLRnWK02@cluster0.xfbdxfr.mongodb.net/"
    )
    DATABASE_NAME = os.getenv("DATABASE_NAME", "telnyx_calling")
    
    # Telnyx API Configuration
    TELNYX_API_KEY = os.getenv("TELNYX_API_KEY", "")
    TELNYX_API_V2_KEY = os.getenv("TELNYX_API_V2_KEY", "")
    TELNYX_WEBHOOK_URL = os.getenv(
        "TELNYX_WEBHOOK_URL",
        "http://localhost:8000/webhooks/call"
    )
    TELNYX_CONNECTION_ID = os.getenv("TELNYX_CONNECTION_ID", "")
    
    # JWT Authentication
    JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
    
    # CORS Configuration
    CORS_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", "http://localhost:3000")
    ]
    
    # Remove duplicates and filter empty strings
    CORS_ORIGINS = list(filter(None, set(CORS_ORIGINS)))
    
    # API Configuration
    API_TIMEOUT = int(os.getenv("API_TIMEOUT", "30"))
    MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production environment"""
        return cls.ENVIRONMENT.lower() == "production"
    
    @classmethod
    def validate(cls):
        """Validate critical configuration"""
        errors = []
        
        if not cls.MONGODB_URL:
            errors.append("MONGODB_URL is required")
        
        if cls.is_production() and cls.JWT_SECRET == "your-secret-key-change-in-production":
            errors.append("JWT_SECRET must be changed in production")
        
        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")
        
        return True

# Create singleton config instance
config = Config()

# Validate configuration on import
try:
    config.validate()
except ValueError as e:
    import logging
    logging.warning(f"Configuration validation failed: {e}")
