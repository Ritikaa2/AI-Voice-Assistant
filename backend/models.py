from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="General")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True) 
    session_id = Column(String, index=True, default="default") # Grouping sessions
    role = Column(String) # 'user' or 'ai'
    content = Column(Text)
    image_data = Column(Text, nullable=True) # Base64 image
    action_data = Column(Text, nullable=True) 
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
