import numpy as np

class InteractionDetector:
    def __init__(self):
        # Store historical hand positions for tracking velocity
        # Format: {person_id: {"left_hand": [positions...], "right_hand": [positions...]}}
        self.hand_histories = {}
        # Simple tracker state: {person_id: last_bounding_box}
        self.tracked_people = {}
        self.next_id = 1
        self.max_history_len = 5 # Number of frames to calculate velocity

    def update_tracker(self, detections):
        """
        Simple centroid-based tracking to keep IDs consistent between frames.
        detections: list of bounding boxes [x_min, y_min, x_max, y_max]
        returns: list of dicts {"id": person_id, "bbox": bbox}
        """
        current_tracked = {}
        updated_detections = []

        for bbox in detections:
            x_min, y_min, x_max, y_max = bbox
            cx, cy = (x_min + x_max) / 2, (y_min + y_max) / 2

            # Find matching person from previous frame
            matched_id = None
            min_dist = float('inf')
            
            for pid, prev_bbox in self.tracked_people.items():
                px_min, py_min, px_max, py_max = prev_bbox
                pcx, pcy = (px_min + px_max) / 2, (py_min + py_max) / 2
                dist = np.sqrt((cx - pcx)**2 + (cy - pcy)**2)
                
                # Threshold for distance (relative to box size)
                box_width = x_max - x_min
                if dist < box_width * 0.8 and dist < min_dist:
                    min_dist = dist
                    matched_id = pid

            if matched_id is None:
                matched_id = self.next_id
                self.next_id += 1

            current_tracked[matched_id] = bbox
            updated_detections.append({"id": matched_id, "bbox": bbox})

        # Cleanup lost histories
        for pid in list(self.hand_histories.keys()):
            if pid not in current_tracked:
                del self.hand_histories[pid]

        self.tracked_people = current_tracked
        return updated_detections

    def check_aggression(self, people_landmarks, frame_w, frame_h):
        """
        Analyzes landmarks of all tracked people to detect contact and aggressive behavior.
        people_landmarks: dict {person_id: pose_landmarks_object}
        returns: list of alerts (strings)
        """
        alerts = []
        
        # 1. Update histories
        for pid, landmarks in people_landmarks.items():
            if landmarks is None:
                continue
            
            # MediaPipe Pose landmarks:
            # 15: left_wrist, 16: right_wrist
            # 19: left_index, 20: right_index
            lw = landmarks[15]
            rw = landmarks[16]
            
            lw_pos = np.array([lw.x * frame_w, lw.y * frame_h])
            rw_pos = np.array([rw.x * frame_w, rw.y * frame_h])

            if pid not in self.hand_histories:
                self.hand_histories[pid] = {"left": [], "right": []}
                
            self.hand_histories[pid]["left"].append(lw_pos)
            self.hand_histories[pid]["right"].append(rw_pos)
            
            # Keep history short
            if len(self.hand_histories[pid]["left"]) > self.max_history_len:
                self.hand_histories[pid]["left"].pop(0)
            if len(self.hand_histories[pid]["right"]) > self.max_history_len:
                self.hand_histories[pid]["right"].pop(0)

        # 2. Check for interactions between every pair of people
        pids = list(people_landmarks.keys())
        for i in range(len(pids)):
            for j in range(i + 1, len(pids)):
                pid_a, pid_b = pids[i], pids[j]
                
                lm_a = people_landmarks[pid_a]
                lm_b = people_landmarks[pid_b]
                
                if lm_a is None or lm_b is None:
                    continue

                # Get coordinates
                # Person B head (nose: 0, left shoulder: 11, right shoulder: 12)
                head_b = np.array([lm_b[0].x * frame_w, lm_b[0].y * frame_h])
                shoulder_b = np.array([
                    (lm_b[11].x + lm_b[12].x) / 2 * frame_w, 
                    (lm_b[11].y + lm_b[12].y) / 2 * frame_h
                ])
                
                # Person A head and shoulder
                head_a = np.array([lm_a[0].x * frame_w, lm_a[0].y * frame_h])
                shoulder_a = np.array([
                    (lm_a[11].x + lm_a[12].x) / 2 * frame_w, 
                    (lm_a[11].y + lm_a[12].y) / 2 * frame_h
                ])

                # Get Person A's hands
                left_hand_a = np.array([lm_a[15].x * frame_w, lm_a[15].y * frame_h])
                right_hand_a = np.array([lm_a[16].x * frame_w, lm_a[16].y * frame_h])
                
                # Get Person B's hands
                left_hand_b = np.array([lm_b[15].x * frame_w, lm_b[15].y * frame_h])
                right_hand_b = np.array([lm_b[16].x * frame_w, lm_b[16].y * frame_h])

                # Estimate head-shoulder span as bounding distance threshold
                dist_threshold = np.linalg.norm(head_b - shoulder_b) * 1.5
                if dist_threshold < 20: # Fallback minimum pixel distance
                    dist_threshold = 40

                # Check Person A hitting Person B
                for hand_side, hand_pos in [("Left", left_hand_a), ("Right", right_hand_a)]:
                    # Distance from A's hand to B's face/neck
                    dist_to_head = np.linalg.norm(hand_pos - head_b)
                    dist_to_shoulder = np.linalg.norm(hand_pos - shoulder_b)

                    if dist_to_head < dist_threshold or dist_to_shoulder < dist_threshold:
                        # Contact detected! Now check velocity of the hand
                        velocity = self._calculate_hand_velocity(pid_a, hand_side.lower())
                        if velocity > 25.0: # Threshold for strike/hit velocity
                            alerts.append({
                                "type": "aggression",
                                "message": f"Person {pid_a} hit Person {pid_b}! (Sudden velocity: {velocity:.1f}px/fr)",
                                "parties": [pid_a, pid_b]
                            })
                        else:
                            alerts.append({
                                "type": "contact",
                                "message": f"Physical contact: Person {pid_a} touching Person {pid_b}",
                                "parties": [pid_a, pid_b]
                            })

                # Check Person B hitting Person A
                for hand_side, hand_pos in [("Left", left_hand_b), ("Right", right_hand_b)]:
                    dist_to_head = np.linalg.norm(hand_pos - head_a)
                    dist_to_shoulder = np.linalg.norm(hand_pos - shoulder_a)

                    if dist_to_head < dist_threshold or dist_to_shoulder < dist_threshold:
                        velocity = self._calculate_hand_velocity(pid_b, hand_side.lower())
                        if velocity > 25.0:
                            alerts.append({
                                "type": "aggression",
                                "message": f"Person {pid_b} hit Person {pid_a}! (Sudden velocity: {velocity:.1f}px/fr)",
                                "parties": [pid_b, pid_a]
                            })
                        else:
                            alerts.append({
                                "type": "contact",
                                "message": f"Physical contact: Person {pid_b} touching Person {pid_a}",
                                "parties": [pid_b, pid_a]
                            })

        # Remove duplicate alerts (just in case)
        unique_alerts = []
        seen = set()
        for alert in alerts:
            key = (alert["type"], alert["message"])
            if key not in seen:
                seen.add(key)
                unique_alerts.append(alert)

        return unique_alerts

    def _calculate_hand_velocity(self, pid, hand_side):
        """
        Calculates the instantaneous pixel velocity of a hand.
        """
        if pid not in self.hand_histories:
            return 0.0
            
        history = self.hand_histories[pid][hand_side]
        if len(history) < 2:
            return 0.0
            
        # Velocity is distance between last frame and current frame
        diffs = []
        for i in range(1, len(history)):
            diffs.append(np.linalg.norm(history[i] - history[i-1]))
            
        # Return max diff in history to catch sudden movements
        return float(np.max(diffs))
