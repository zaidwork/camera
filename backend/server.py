import os
import cv2
import json
import base64
import asyncio
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python import BaseOptions

from face_analyzer import FaceAnalyzer
from interaction_detector import InteractionDetector
from object_detector import ObjectDetector

app = FastAPI(title="AI Room Monitor & Facial Analysis API")

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase_client: Client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("Connected to Supabase successfully!")
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
else:
    print("Warning: SUPABASE_URL or SUPABASE_KEY is missing. Database persistence is disabled.")

# Initialize AI Modules
face_analyzer = FaceAnalyzer()
interaction_detector = InteractionDetector()
object_detector = ObjectDetector()

# Initialize MediaPipe Tasks
# Load Face Landmarker
base_options_face = BaseOptions(model_asset_path=os.path.join(MODELS_DIR, 'face_landmarker.task'))
options_face = vision.FaceLandmarkerOptions(
    base_options=base_options_face,
    output_face_blendshapes=False,
    output_facial_transformation_matrixes=False,
    num_faces=4
)
face_landmarker = vision.FaceLandmarker.create_from_options(options_face)

# Load Hand Landmarker
base_options_hand = BaseOptions(model_asset_path=os.path.join(MODELS_DIR, 'hand_landmarker.task'))
options_hand = vision.HandLandmarkerOptions(
    base_options=base_options_hand,
    num_hands=4
)
hand_landmarker = vision.HandLandmarker.create_from_options(options_hand)

# Helper to draw beautiful styled borders and elements
def draw_sci_fi_box(img, x1, y1, x2, y2, color, label, subtext=None):
    length = min(30, int((x2 - x1) * 0.25))
    thickness = 2
    
    # Corners
    cv2.line(img, (x1, y1), (x1 + length, y1), color, thickness)
    cv2.line(img, (x1, y1), (x1, y1 + length), color, thickness)
    
    cv2.line(img, (x2, y1), (x2 - length, y1), color, thickness)
    cv2.line(img, (x2, y1), (x2, y1 + length), color, thickness)
    
    cv2.line(img, (x1, y2), (x1 + length, y2), color, thickness)
    cv2.line(img, (x1, y2), (x1, y2 - length), color, thickness)
    
    cv2.line(img, (x2, y2), (x2 - length, y2), color, thickness)
    cv2.line(img, (x2, y2), (x2, y2 - length), color, thickness)
    
    tag_h = 22 if subtext is None else 36
    cv2.rectangle(img, (x1, y1 - tag_h), (x2, y1), (10, 10, 10), -1)
    cv2.rectangle(img, (x1, y1 - tag_h), (x2, y1), color, 1)
    
    cv2.putText(img, label, (x1 + 6, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    if subtext:
        cv2.putText(img, subtext, (x1 + 6, y1 - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1, cv2.LINE_AA)

def draw_hand_landmarks(img, hand_landmarks, w, h):
    connections = [
        (0, 1), (1, 2), (2, 3), (3, 4), # Thumb
        (0, 5), (5, 6), (6, 7), (7, 8), # Index
        (5, 9), (9, 10), (10, 11), (11, 12), # Middle
        (9, 13), (13, 14), (14, 15), (15, 16), # Ring
        (13, 17), (17, 18), (18, 19), (19, 20), # Pinky
        (0, 17) # Palm boundary
    ]
    color = (255, 0, 127) # Glowing magenta
    for p1, p2 in connections:
        if p1 < len(hand_landmarks) and p2 < len(hand_landmarks):
            pt1 = hand_landmarks[p1]
            pt2 = hand_landmarks[p2]
            x1, y1 = int(pt1.x * w), int(pt1.y * h)
            x2, y2 = int(pt2.x * w), int(pt2.y * h)
            cv2.line(img, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
        
    for pt in hand_landmarks:
        x, y = int(pt.x * w), int(pt.y * h)
        cv2.circle(img, (x, y), 2, (255, 255, 255), -1)

# Eye contours, lips, eyebrows
face_key_indices = [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398,
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 95
]

def draw_face_keypoints(img, face_landmarks, w, h):
    color = (57, 255, 20) # Neon green
    for idx in face_key_indices:
        if idx < len(face_landmarks):
            pt = face_landmarks[idx]
            x, y = int(pt.x * w), int(pt.y * h)
            cv2.circle(img, (x, y), 1, color, -1)
            
    # Draw iris centers in yellow
    for idx in [468, 473]:
        if idx < len(face_landmarks):
            pt = face_landmarks[idx]
            x, y = int(pt.x * w), int(pt.y * h)
            cv2.circle(img, (x, y), 2, (0, 255, 255), -1)

# Supabase Database Helpers (Non-blocking writes)
def _sync_save_alert(alert_type: str, message: str, parties: list, severity: str):
    if not supabase_client:
        return
    try:
        supabase_client.table("security_alerts").insert({
            "type": alert_type,
            "message": message,
            "parties": parties,
            "severity": severity
        }).execute()
        print(f"Alert saved to DB: {message}")
    except Exception as e:
        print(f"Error saving alert to DB: {e}")

async def async_save_alert(alert_type: str, message: str, parties: list, severity: str = "medium"):
    if supabase_client:
        asyncio.create_task(asyncio.to_thread(_sync_save_alert, alert_type, message, parties, severity))

def _sync_save_room_stats(people_count: int, objects: list, dominant_emotion: str):
    if not supabase_client:
        return
    try:
        supabase_client.table("room_statistics").insert({
            "people_count": people_count,
            "objects_detected": objects,
            "dominant_emotion": dominant_emotion
        }).execute()
        print(f"Room stats saved to DB: {people_count} people, {len(objects)} objects")
    except Exception as e:
        print(f"Error saving room stats to DB: {e}")

async def async_save_room_stats(people_count: int, objects: list, dominant_emotion: str = None):
    if supabase_client:
        asyncio.create_task(asyncio.to_thread(_sync_save_room_stats, people_count, objects, dominant_emotion))

def _sync_save_game_score(player_name: str, score: int, high_score: int):
    if not supabase_client:
        return
    try:
        supabase_client.table("game_leaderboard").insert({
            "player_name": player_name,
            "score": score,
            "high_score": high_score
        }).execute()
        print(f"Game score saved to DB: {player_name} - {score}")
    except Exception as e:
        print(f"Error saving game score to DB: {e}")

async def async_save_game_score(player_name: str, score: int, high_score: int):
    if supabase_client:
        asyncio.create_task(asyncio.to_thread(_sync_save_game_score, player_name, score, high_score))


from pydantic import BaseModel

class ScoreSubmission(BaseModel):
    player_name: str
    score: int
    high_score: int

@app.get("/")
def read_root():
    return {"status": "AI Server is running"}

@app.get("/api/history/alerts")
def get_history_alerts():
    if not supabase_client:
        return []
    try:
        response = supabase_client.table("security_alerts").select("*").order("created_at", desc=True).limit(50).execute()
        return response.data
    except Exception as e:
        print(f"Error fetching alerts from Supabase: {e}")
        return []

@app.get("/api/history/stats")
def get_history_stats():
    if not supabase_client:
        return []
    try:
        response = supabase_client.table("room_statistics").select("*").order("created_at", desc=True).limit(100).execute()
        return response.data
    except Exception as e:
        print(f"Error fetching stats from Supabase: {e}")
        return []

@app.get("/api/leaderboard")
def get_leaderboard():
    if not supabase_client:
        return []
    try:
        response = supabase_client.table("game_leaderboard").select("*").order("score", desc=True).limit(10).execute()
        return response.data
    except Exception as e:
        print(f"Error fetching leaderboard from Supabase: {e}")
        return []

@app.post("/api/leaderboard")
async def submit_score(submission: ScoreSubmission):
    await async_save_game_score(
        player_name=submission.player_name,
        score=submission.score,
        high_score=submission.high_score
    )
    return {"status": "success"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket client connected")

    import time
    last_saved_alerts = {}
    last_stats_save = 0

    game_state = {
        "active": False,
        "target_emotion": None,
        "score": 0,
        "high_score": 0,
        "feedback": "Press Start to Play!"
    }

    try:
        while True:
            # Receive message
            message = await websocket.receive_text()
            data = json.loads(message)
            
            action = data.get("action")
            
            # Handle game commands
            if action == "start_game":
                game_state["active"] = True
                game_state["target_emotion"] = data.get("target_emotion", "Happy")
                game_state["score"] = 0
                game_state["feedback"] = f"Mimic: {game_state['target_emotion']}!"
                await websocket.send_text(json.dumps({"type": "game_update", "game": game_state}))
                continue
                
            elif action == "stop_game":
                game_state["active"] = False
                game_state["target_emotion"] = None
                await websocket.send_text(json.dumps({"type": "game_update", "game": game_state}))
                continue

            # Process frame
            image_data_b64 = data.get("image")
            if not image_data_b64:
                continue

            if "," in image_data_b64:
                image_data_b64 = image_data_b64.split(",")[1]
            
            image_bytes = base64.b64decode(image_data_b64)
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                continue

            h, w, _ = frame.shape

            # 1. Run YOLO object detection
            detections = object_detector.detect(frame)
            
            # Separate person bounding boxes
            person_bboxes = [d["bbox"] for d in detections if d["label"] == "person"]
            other_detections = [d for d in detections if d["label"] != "person"]
            
            # Update interaction tracker with person bboxes
            tracked_people = interaction_detector.update_tracker(person_bboxes)

            # 2. Run MediaPipe Face Mesh and Hands via Tasks API
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
            face_result = face_landmarker.detect(mp_image)
            hand_result = hand_landmarker.detect(mp_image)

            # Map faces and hands to tracked people
            people_faces = {}
            people_hands = {}
            
            # Temporary structures to match hands to person IDs
            hand_landmarks_list = []
            if hand_result.hand_landmarks:
                for hand_lms in hand_result.hand_landmarks:
                    wrist = hand_lms[0] # Index 0 is wrist in MediaPipe Hand landmarks
                    wx, wy = int(wrist.x * w), int(wrist.y * h)
                    hand_landmarks_list.append((wx, wy, hand_lms))

            # Populate tracked people details
            face_analyses = {}
            for person in tracked_people:
                pid = person["id"]
                px_min, py_min, px_max, py_max = person["bbox"]
                
                # Check if any face center is within this person's bounding box
                matched_face_lms = None
                if face_result.face_landmarks:
                    for face_lms in face_result.face_landmarks:
                        # Landmark 4 is nose tip
                        nose = face_lms[4]
                        nx, ny = int(nose.x * w), int(nose.y * h)
                        if px_min <= nx <= px_max and py_min <= ny <= py_max:
                            matched_face_lms = face_lms
                            break
                
                # Check if any hand wrist is within this person's bounding box
                matched_left_hand = None
                matched_right_hand = None
                for wx, wy, lms in hand_landmarks_list:
                    if px_min <= wx <= px_max and py_min <= wy <= py_max:
                        if matched_left_hand is None:
                            matched_left_hand = lms
                        else:
                            matched_right_hand = lms

                # Package landmarks for aggression detection
                people_faces[pid] = matched_face_lms
                
                pose_stub = None
                if matched_face_lms is not None:
                    # Create a mock pose dictionary containing landmarks mapping
                    pose_stub = {
                        0: matched_face_lms[4],    # Nose tip
                        11: matched_face_lms[234], # Left face outer boundary (shoulder approx)
                        12: matched_face_lms[454], # Right face outer boundary
                        15: matched_left_hand[0] if matched_left_hand else matched_face_lms[4],  # Wrist/hand
                        16: matched_right_hand[0] if matched_right_hand else matched_face_lms[4] # Wrist/hand
                    }
                    if not matched_left_hand:
                        pose_stub[15].x, pose_stub[15].y = -1, -1
                    if not matched_right_hand:
                        pose_stub[16].x, pose_stub[16].y = -1, -1

                people_hands[pid] = pose_stub

                # Analyze face features (shape, eye color, emotion, age, gender)
                if matched_face_lms is not None:
                    fxs = [lm.x * w for lm in matched_face_lms]
                    fys = [lm.y * h for lm in matched_face_lms]
                    fx_min, fx_max = int(min(fxs)), int(max(fxs))
                    fy_min, fy_max = int(min(fys)), int(max(fys))
                    
                    analysis = face_analyzer.analyze_face(frame, matched_face_lms, fx_min, fy_min, fx_max, fy_max)
                    face_analyses[pid] = analysis
                    
                    # Update Game matching
                    if game_state["active"] and game_state["target_emotion"]:
                        if analysis["emotion"].lower() == game_state["target_emotion"].lower():
                            game_state["score"] += 1
                            import random
                            emotions = ["Happy", "Sad", "Angry", "Surprise", "Neutral"]
                            emotions.remove(game_state["target_emotion"])
                            game_state["target_emotion"] = random.choice(emotions)
                            game_state["feedback"] = f"Correct! Now make: {game_state['target_emotion']}!"
                            if game_state["score"] > game_state["high_score"]:
                                game_state["high_score"] = game_state["score"]

            # 3. Check for contacts and physical aggression
            aggression_alerts = interaction_detector.check_aggression(people_hands, w, h)

            # Save Alerts and Stats to Supabase
            current_time = time.time()
            
            # 1. Save Alerts (aggression / contact)
            for alert in aggression_alerts:
                alert_msg = alert["message"]
                alert_type = alert["type"]
                parties = alert.get("parties", [])
                
                last_saved = last_saved_alerts.get(alert_msg, 0)
                if current_time - last_saved > 10.0:
                    last_saved_alerts[alert_msg] = current_time
                    await async_save_alert(
                        alert_type=alert_type,
                        message=alert_msg,
                        parties=parties,
                        severity="high" if alert_type == "aggression" else "medium"
                    )

            # 2. Save Suspicious Objects
            for obj in other_detections:
                obj_label = obj["label"].lower()
                if obj_label in ["lighter", "ruler"]:
                    alert_msg = f"Suspicious object detected: {obj_label} ({obj['conf']:.2f})"
                    last_saved = last_saved_alerts.get(alert_msg, 0)
                    if current_time - last_saved > 20.0:
                        last_saved_alerts[alert_msg] = current_time
                        await async_save_alert(
                            alert_type="suspicious_object",
                            message=alert_msg,
                            parties=[],
                            severity="medium"
                        )

            # 3. Save Room Statistics (throttled to 30 seconds)
            if current_time - last_stats_save >= 30.0:
                last_stats_save = current_time
                emotions = [fa["emotion"] for fa in face_analyses.values() if "emotion" in fa]
                dominant_emotion = max(set(emotions), key=emotions.count) if emotions else "Neutral"
                await async_save_room_stats(
                    people_count=len(tracked_people),
                    objects=[obj["label"] for obj in other_detections],
                    dominant_emotion=dominant_emotion
                )

            # Draw Overlays on Frame
            # Draw Objects
            for obj in other_detections:
                ox1, oy1, ox2, oy2 = obj["bbox"]
                label = f"{obj['label']} ({obj['conf']:.2f})"
                color = (0, 165, 255) if obj["label"] in ["lighter", "ruler"] else (0, 255, 0)
                draw_sci_fi_box(frame, ox1, oy1, ox2, oy2, color, label)

            # Draw People Bounding Boxes & Facial stats
            for person in tracked_people:
                pid = person["id"]
                px1, py1, px2, py2 = person["bbox"]
                
                # Check if person is involved in current aggression
                is_aggressive = False
                for alert in aggression_alerts:
                    if alert["type"] == "aggression" and pid in alert["parties"]:
                        is_aggressive = True
                        break

                color = (0, 0, 255) if is_aggressive else (255, 120, 0) # Red if fighting, blue/cyan otherwise
                
                label = f"Person #{pid}"
                subtext = None
                
                if pid in face_analyses:
                    fa = face_analyses[pid]
                    label += f" | {fa['gender']} | {fa['age']}"
                    subtext = f"{fa['emotion']} | {fa['face_shape']} | Eyes: {fa['eye_color']}"

                draw_sci_fi_box(frame, px1, py1, px2, py2, color, label, subtext)

            # Draw Face Mesh landmarks
            if face_result.face_landmarks:
                for face_lms in face_result.face_landmarks:
                    draw_face_keypoints(frame, face_lms, w, h)

            # Draw Hand Skeletons
            if hand_result.hand_landmarks:
                for hand_lms in hand_result.hand_landmarks:
                    draw_hand_landmarks(frame, hand_lms, w, h)

            # If there's an aggressive action, draw global red alert overlay
            if any(alert["type"] == "aggression" for alert in aggression_alerts):
                cv2.rectangle(frame, (0, 0), (w, h), (0, 0, 255), 6)
                cv2.putText(frame, "VIOLENCE DETECTED", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3, cv2.LINE_AA)

            # Encode processed image to base64
            _, buffer = cv2.imencode('.jpg', frame)
            processed_b64 = base64.b64encode(buffer).decode('utf-8')
            processed_src = f"data:image/jpeg;base64,{processed_b64}"

            # Prepare metadata package
            metadata = {
                "type": "frame_data",
                "image": processed_src,
                "people_count": len(tracked_people),
                "objects": [obj["label"] for obj in other_detections],
                "alerts": aggression_alerts,
                "game": game_state,
                "analyses": face_analyses
            }

            await websocket.send_text(json.dumps(metadata))

    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"Error in WebSocket handler: {e}")
