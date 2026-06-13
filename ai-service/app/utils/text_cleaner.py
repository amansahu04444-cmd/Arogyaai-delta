import re
import unicodedata
import json

def clean_ai_text(text: str) -> str:
    if not text:
        return ""
    
    text = str(text).strip()
    
    # If text is a JSON string (e.g. mock response), extract the message/summary
    if text.startswith('{') and text.endswith('}'):
        try:
            obj = json.loads(text)
            text = obj.get("summary") or obj.get("message") or obj.get("recommendation") or obj.get("symptoms") or text
        except Exception:
            pass
            
    # Normalize UTF-8 / Unicode
    text = unicodedata.normalize('NFC', text)
    
    # Remove markdown bold/italic/header characters
    text = re.sub(r'\*+', '', text)
    text = re.sub(r'#+', '', text)
    text = re.sub(r'`+', '', text)
    text = re.sub(r'_+', '', text)
    
    # Remove emojis using a regex range for emojis and pictographs
    text = re.sub(r'[\U00010000-\U0010ffff]|\u2704|\u2709|\u270F|\u2712|\u2714|\u2716|\u2728|\u2733|\u2734|\u2744|\u2747|\u274C|\u274E|\u2753|\u2754|\u2755|\u2757|\u2764|\u2795|\u2796|\u2797|\u27A1|\u27B0|\u27BF|\u2934|\u2935|\u2B05|\u2B06|\u2B07|\u2B1B|\u2B1C|\u2B50|\u2B55|\u3030|\u303D|\u3297|\u3299', '', text)
    
    # Filter printable ASCII and degree symbol (° = 176)
    cleaned = []
    for char in text:
        val = ord(char)
        if val in (10, 13, 9) or (32 <= val <= 126) or val == 176:
            cleaned.append(char)
            
    text = "".join(cleaned)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()
