import os
import json
import logging
import uuid
import base64
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import engine, get_db
import models
import auth

# Create database tables
models.Base.metadata.create_all(bind=engine)


# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Voice Assistant API")

app.include_router(auth.router, prefix="/api")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str = ""
    session_id: str = None
    image: str = None

# Initialize Gemini Client if key is available
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = None

if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        from google import genai
        from google.genai import types
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
else:
    logger.warning("GEMINI_API_KEY not found or invalid in .env. Running in MOCK mode.")

SYSTEM_PROMPT = """
You are a highly intelligent, realistic, and helpful AI Assistant.

Your Responsibilities:
* Understand natural language queries accurately and answer them comprehensively.
* Provide detailed, human-like responses using Markdown formatting (bold, italics, bullet points, code blocks).
* If the user asks for code or technical explanations, provide high-quality, deeply detailed answers.
* Detect intent to perform actions (e.g., search, reminder, play music) when applicable.

Behavior Rules:
* Be highly informative and conversational.
* Never arbitrarily restrict your response length. Provide long, detailed explanations.
* Structure your responses beautifully using Markdown.

Output Format:
* If the user asks for a normal conversation, JUST write your markdown response normally. Do not use JSON.
* ONLY IF the user explicitly wants to perform a digital ACTION (like search google, play music, set reminder), return STRICT JSON like this:
{
  "type": "action",
  "action": "action_name",
  "parameters": {},
  "response": "confirmation message"
}

If multiple actions:
{
  "type": "multi_action",
  "actions": [
    {
      "action": "action_name",
      "parameters": {}
    }
  ],
  "response": "summary message"
}

Supported Actions:
* search_google
* open_youtube
* play_music
* set_reminder
* get_weather
* open_app
* general_query

Parameter Rules:
* Extract values directly from user input
* Normalize time (e.g., "6 PM", "tomorrow morning")
* Leave unused fields empty
"""



@app.get("/api/sessions")
async def get_sessions(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.user_id == current_user.id, models.ChatMessage.role == 'user').order_by(models.ChatMessage.created_at.asc()).all()
    sessions_dict = {}
    for msg in messages:
        if msg.session_id not in sessions_dict:
            title = msg.content[:30] + "..." if len(msg.content) > 30 else msg.content
            if msg.image_data and not msg.content:
                title = "Image uploaded"
            sessions_dict[msg.session_id] = {
                "id": msg.session_id,
                "title": title or "New Chat",
                "created_at": msg.created_at
            }
    # Return reversed so newest is on top
    return {"sessions": list(sessions_dict.values())[::-1]}

@app.get("/api/history/{session_id}")
async def get_history(session_id: str, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.user_id == current_user.id, models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at.asc()).all()
    history = []
    for msg in messages:
        history.append({
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "image": msg.image_data,
            "type": "text" if not msg.action_data else "action",
            "action_data": json.loads(msg.action_data) if msg.action_data else None,
            "created_at": msg.created_at
        })
    return {"history": history}

@app.get("/api/suggestions/{role}")
async def get_suggestions(role: str):
    suggestions_map = {
        "Developer": ["Write a python script", "Explain REST APIs", "Debug this error", "What is Docker?"],
        "Student": ["Help me with calculus", "Explain quantum physics", "Summarize this article", "Study tips"],
        "Content Creator": ["Give me video ideas", "Write a catchy title", "Suggest a thumbnail", "Write a script"],
        "General": ["What's the weather like?", "Set a reminder", "Tell me a joke", "Play some music"]
    }
    return {"suggestions": suggestions_map.get(role, suggestions_map["General"])}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, current_user: models.User = Depends(auth.get_current_user_optional), db: Session = Depends(get_db)):
    if not request.message and not request.image:
        raise HTTPException(status_code=400, detail="Message or image cannot be empty")
    
    session_id = request.session_id or str(uuid.uuid4())
    
    if not gemini_client:
        return {
            "type": "text",
            "response": "Error: Gemini API key is not configured.",
            "session_id": session_id
        }
    
    try:
        from google.genai import types
        
        contents = []
        # Build history context
        if current_user:
            past_messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.user_id == current_user.id,
                models.ChatMessage.session_id == session_id
            ).order_by(models.ChatMessage.created_at.asc()).all()
            
            for msg in past_messages:
                parts = []
                if msg.image_data:
                    # Strip data:image/png;base64, prefix if present
                    b64 = msg.image_data.split(",")[-1] if "," in msg.image_data else msg.image_data
                    # determine mime based on prefix or default to jpeg
                    mime = "image/jpeg"
                    if "png" in msg.image_data: mime = "image/png"
                    elif "webp" in msg.image_data: mime = "image/webp"
                    parts.append(types.Part.from_bytes(data=base64.b64decode(b64), mime_type=mime))
                if msg.content:
                    parts.append(types.Part.from_text(msg.content))
                    
                if parts:
                    contents.append(types.Content(
                        role="user" if msg.role == "user" else "model",
                        parts=parts
                    ))
                
        # Add current message
        current_parts = []
        if request.image:
            b64 = request.image.split(",")[-1] if "," in request.image else request.image
            mime = "image/jpeg"
            if "png" in request.image: mime = "image/png"
            elif "webp" in request.image: mime = "image/webp"
            current_parts.append(types.Part.from_bytes(data=base64.b64decode(b64), mime_type=mime))
        if request.message:
            current_parts.append(types.Part.from_text(request.message))
            
        contents.append(types.Content(role="user", parts=current_parts))

        # Call Gemini API
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7, # Higher temperature for more realistic text
            )
        )
        
        response_text = response.text
        
        # Try to parse as JSON first (for actions)
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:-3].strip()
            
        try:
            parsed_json = json.loads(clean_text)
            if parsed_json.get("type") not in ["action", "multi_action", "text"]:
                parsed_json = {"type": "text", "response": response_text}
        except json.JSONDecodeError:
            # If it fails, it's just normal markdown text!
            parsed_json = {"type": "text", "response": response_text}
            
        # Save to database if user is logged in
        if current_user:
            user_msg = models.ChatMessage(user_id=current_user.id, session_id=session_id, role="user", content=request.message, image_data=request.image)
            db.add(user_msg)
            
            action_data = None
            if parsed_json.get("type") in ["action", "multi_action"]:
                action_data = json.dumps(parsed_json)
            
            ai_msg = models.ChatMessage(
                user_id=current_user.id, 
                session_id=session_id,
                role="ai", 
                content=parsed_json.get("response", response_text),
                action_data=action_data
            )
            db.add(ai_msg)
            db.commit()

        parsed_json["session_id"] = session_id
        return parsed_json
            
    except Exception as e:
        logger.error(f"Error calling Gemini API: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
