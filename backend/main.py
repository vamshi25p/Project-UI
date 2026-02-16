from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io
import torch
import torch.nn.functional as F
from torchvision import transforms
import numpy as np
import os
from model import EfficientNetGAT  # Import your model class

app = FastAPI()

# Allow CORS for React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your trained model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = EfficientNetGAT(num_classes=5).to(device)
model.load_state_dict(torch.load(
    "best_model.pth", map_location=device))
model.eval()

# Image preprocessing
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

CLASS_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        # Read and validate image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")

        # Preprocess and predict
        input_tensor = preprocess(image)
        input_batch = input_tensor.unsqueeze(0).to(device)

        with torch.no_grad():
            output = model(input_batch)

        # Get probabilities and class
        probabilities = F.softmax(output[0], dim=0)
        confidence, predicted_class = torch.max(probabilities, 0)

        return {
            "class": predicted_class.item(),
            "class_name": CLASS_NAMES[predicted_class.item()],
            "confidence": confidence.item(),
            "probabilities": probabilities.cpu().numpy().tolist(),
            "class_names": CLASS_NAMES
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/")
def read_root():
    return {"message": "Retinal DR Classification API"}


# Serve static files for production
app.mount("/static", StaticFiles(directory="static"), name="static")
