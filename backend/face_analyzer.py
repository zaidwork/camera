import os
import cv2
import numpy as np

# Get absolute path to models directory
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

class FaceAnalyzer:
    def __init__(self):
        # Load ONNX models for Age and Gender
        age_onnx = os.path.join(MODELS_DIR, "age_googlenet.onnx")
        gender_onnx = os.path.join(MODELS_DIR, "gender_googlenet.onnx")
        emotion_onnx = os.path.join(MODELS_DIR, "emotion-ferplus-8.onnx")

        self.age_net = None
        self.gender_net = None
        self.emotion_net = None

        if os.path.exists(age_onnx):
            try:
                self.age_net = cv2.dnn.readNetFromONNX(age_onnx)
                print("Age ONNX model loaded successfully.")
            except Exception as e:
                print(f"Error loading age net: {e}")
        
        if os.path.exists(gender_onnx):
            try:
                self.gender_net = cv2.dnn.readNetFromONNX(gender_onnx)
                print("Gender ONNX model loaded successfully.")
            except Exception as e:
                print(f"Error loading gender net: {e}")

        if os.path.exists(emotion_onnx):
            try:
                self.emotion_net = cv2.dnn.readNetFromONNX(emotion_onnx)
                print("Emotion ONNX model loaded successfully.")
            except Exception as e:
                print(f"Error loading emotion net: {e}")

        self.age_list = ['(0-2)', '(4-6)', '(8-12)', '(15-20)', '(25-32)', '(38-43)', '(48-53)', '(60-100)']
        self.gender_list = ['Male', 'Female']
        self.emotion_list = ['Neutral', 'Happy', 'Surprise', 'Sad', 'Angry', 'Disgust', 'Fear', 'Contempt']
        # GoogLeNet standard mean values (BGR)
        self.model_mean_values = (104.0, 117.0, 123.0)

    def analyze_face(self, frame, face_landmarks, x_min, y_min, x_max, y_max):
        """
        Runs the full analysis on a single face: Face Shape, Eye Color, Emotion, Age, Gender.
        """
        h, w, _ = frame.shape
        analysis = {
            "face_shape": "Unknown",
            "eye_color": "Unknown",
            "emotion": "Unknown",
            "age": "Unknown",
            "gender": "Unknown"
        }

        # 1. Face Shape classification
        try:
            analysis["face_shape"] = self.classify_face_shape(face_landmarks, w, h)
        except Exception as e:
            print(f"Error classifying face shape: {e}")

        # 2. Eye Color classification
        try:
            analysis["eye_color"] = self.detect_eye_color(frame, face_landmarks, w, h)
        except Exception as e:
            print(f"Error detecting eye color: {e}")

        # Crop face for DNN models (age, gender, emotion)
        pad_w = int((x_max - x_min) * 0.15)
        pad_h = int((y_max - y_min) * 0.15)
        cx_min = max(0, x_min - pad_w)
        cy_min = max(0, y_min - pad_h)
        cx_max = min(w, x_max + pad_w)
        cy_max = min(h, y_max + pad_h)

        if cx_max - cx_min > 10 and cy_max - cy_min > 10:
            face_crop = frame[cy_min:cy_max, cx_min:cx_max]

            # 3. Emotion classification
            if self.emotion_net is not None:
                try:
                    gray_crop = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                    gray_crop = cv2.resize(gray_crop, (64, 64))
                    blob = cv2.dnn.blobFromImage(gray_crop, 1.0, (64, 64))
                    self.emotion_net.setInput(blob)
                    emotion_preds = self.emotion_net.forward()
                    analysis["emotion"] = self.emotion_list[emotion_preds[0].argmax()]
                except Exception as e:
                    print(f"Error predicting emotion: {e}")

            # 4. Age and Gender classification
            if self.age_net is not None and self.gender_net is not None:
                try:
                    # GoogLeNet ONNX models expect 224x224 images
                    blob = cv2.dnn.blobFromImage(face_crop, 1.0, (224, 224), self.model_mean_values, swapRB=False)
                    
                    # Predict Gender
                    self.gender_net.setInput(blob)
                    gender_preds = self.gender_net.forward()
                    analysis["gender"] = self.gender_list[gender_preds[0].argmax()]

                    # Predict Age
                    self.age_net.setInput(blob)
                    age_preds = self.age_net.forward()
                    analysis["age"] = self.age_list[age_preds[0].argmax()]
                except Exception as e:
                    print(f"Error predicting age/gender: {e}")

        return analysis

    def classify_face_shape(self, landmarks, w, h):
        """
        Classifies face shape based on ratios calculated from face mesh landmarks:
        - Face Length: Chin (152) to Forehead (10)
        - Cheekbone Width: Left Cheek (234) to Right Cheek (454)
        - Jawline Width: Left Jaw (58) to Right Jaw (288)
        - Forehead Width: Left Forehead (109) to Right Forehead (338)
        """
        def get_dist(p1_idx, p2_idx):
            pt1 = landmarks[p1_idx]
            pt2 = landmarks[p2_idx]
            # Handle both tasks API landmark objects (which have x, y, z) and legacy dicts/objects
            x1, y1 = (pt1.x if hasattr(pt1, 'x') else pt1['x']), (pt1.y if hasattr(pt1, 'y') else pt1['y'])
            x2, y2 = (pt2.x if hasattr(pt2, 'x') else pt2['x']), (pt2.y if hasattr(pt2, 'y') else pt2['y'])
            return np.sqrt((x1 * w - x2 * w) ** 2 + (y1 * h - y2 * h) ** 2)

        face_length = get_dist(10, 152)
        cheekbone_width = get_dist(234, 454)
        jaw_width = get_dist(58, 288)
        forehead_width = get_dist(109, 338)

        if face_length == 0 or cheekbone_width == 0:
            return "Unknown"

        # Ratios
        len_width_ratio = face_length / cheekbone_width
        forehead_cheek_ratio = forehead_width / cheekbone_width
        jaw_cheek_ratio = jaw_width / cheekbone_width

        # Simple classification heuristics based on classic face shape dimensions
        if len_width_ratio > 1.25:
            if jaw_cheek_ratio < 0.75:
                return "Heart"
            else:
                return "Oval" if forehead_cheek_ratio > 0.8 else "Oblong"
        else: # Shorter face
            if abs(cheekbone_width - jaw_width) < cheekbone_width * 0.1:
                return "Square"
            else:
                return "Round"

    def detect_eye_color(self, frame, landmarks, w, h):
        """
        Detects eye color by analyzing the iris region from MediaPipe Face Mesh iris landmarks.
        Left iris landmarks: 468, 469, 470, 471, 472
        Right iris landmarks: 473, 474, 475, 476, 477
        """
        center_idx = 473
        center_pt = landmarks[center_idx]
        cx = int((center_pt.x if hasattr(center_pt, 'x') else center_pt['x']) * w)
        cy = int((center_pt.y if hasattr(center_pt, 'y') else center_pt['y']) * h)

        # Estimate iris radius as 1/15th of the eye width
        pt33 = landmarks[33]
        pt133 = landmarks[133]
        x33, y33 = (pt33.x if hasattr(pt33, 'x') else pt33['x']) * w, (pt33.y if hasattr(pt33, 'y') else pt33['y']) * h
        x133, y133 = (pt133.x if hasattr(pt133, 'x') else pt133['x']) * w, (pt133.y if hasattr(pt133, 'y') else pt133['y']) * h
        eye_width = np.sqrt((x33 - x133)**2 + (y33 - y133)**2)
        
        radius = max(2, int(eye_width * 0.15))
        
        # Crop iris box
        y1, y2 = max(0, cy - radius), min(h, cy + radius)
        x1, x2 = max(0, cx - radius), min(w, cx + radius)

        if (x2 - x1) < 4 or (y2 - y1) < 4:
            return "Brown"  # Fallback

        iris_crop = frame[y1:y2, x1:x2]
        
        # Convert to HSV
        hsv = cv2.cvtColor(iris_crop, cv2.COLOR_BGR2HSV)
        
        # We want to filter out pupil (very dark) and sclera/reflection (very bright/white)
        mask = cv2.inRange(hsv, (0, 30, 30), (180, 255, 200))
        filtered_pixels = hsv[mask > 0]
        
        if len(filtered_pixels) == 0:
            return "Brown" # Fallback if dark/underexposed
            
        median_hue = np.median(filtered_pixels[:, 0])
        median_sat = np.median(filtered_pixels[:, 1])
        median_val = np.median(filtered_pixels[:, 2])

        if median_sat < 50:
            return "Grey"
        elif 35 <= median_hue <= 85:
            return "Green" if median_sat > 70 else "Hazel"
        elif 85 < median_hue <= 135:
            return "Blue"
        else:
            return "Brown"
