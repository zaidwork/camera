import os
import requests

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

MODEL_URLS = {
    "emotion-ferplus-8.onnx": "https://huggingface.co/onnxmodelzoo/emotion-ferplus-8/resolve/main/emotion-ferplus-8.onnx",
    "age_googlenet.onnx": "https://huggingface.co/onnxmodelzoo/age_googlenet/resolve/main/age_googlenet.onnx",
    "gender_googlenet.onnx": "https://huggingface.co/onnxmodelzoo/gender_googlenet/resolve/main/gender_googlenet.onnx",
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
}

def download_file(url, destination):
    print(f"Downloading {url}...")
    try:
        # Allow redirects for Hugging Face LFS resolve URLs
        response = requests.get(url, stream=True, timeout=60, allow_redirects=True)
        response.raise_for_status()
        with open(destination, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print(f"Saved to {destination}")
    except Exception as e:
        print(f"Failed to download {url}: {e}")

def main():
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR)
        print(f"Created models directory: {MODELS_DIR}")
    
    for filename, url in MODEL_URLS.items():
        dest = os.path.join(MODELS_DIR, filename)
        if os.path.exists(dest) and os.path.getsize(dest) > 10000:
            print(f"{filename} already exists, skipping download.")
        else:
            download_file(url, dest)

if __name__ == "__main__":
    main()
