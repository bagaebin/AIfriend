import base64
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import JSONResponse

app = FastAPI()

# Tiny 1x1 png (transparent)
DUMMY_IMAGE = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQAB"
    "DQottAAAAABJRU5ErkJggg=="
)


class GenerateRequest(BaseModel):
    prompt: str


@app.post("/generate")
def generate_avatar(req: GenerateRequest):
    # In a real implementation, use req.prompt with SD Turbo/ComfyUI
    return JSONResponse({"image_base64": DUMMY_IMAGE})
