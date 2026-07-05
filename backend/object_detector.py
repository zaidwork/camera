import cv2
from ultralytics import YOLOWorld

class ObjectDetector:
    def __init__(self):
        self.model = None
        self.classes = ["person", "ruler", "lighter", "cell phone", "bottle", "cup", "pen", "scissors", "book"]
        
        try:
            print("Loading YOLO-World model...")
            # Using yolov8s-worldv2.pt which is a lightweight open-vocabulary model (~40MB)
            self.model = YOLOWorld('yolov8s-worldv2.pt')
            self.model.set_classes(self.classes)
            print("YOLO-World loaded and classes set: ", self.classes)
        except Exception as e:
            print(f"Error loading YOLO-World: {e}. Falling back to standard YOLOv8n.")
            try:
                from ultralytics import YOLO
                self.model = YOLO('yolov8n.pt')
                self.classes = None # Will use default COCO labels
                print("Standard YOLOv8n loaded successfully as fallback.")
            except Exception as ex:
                print(f"Critical: Failed to load fallback YOLO model: {ex}")

    def detect(self, frame):
        """
        Runs object detection on the frame.
        Returns:
            list of dicts: [{"label": label, "bbox": [x1, y1, x2, y2], "conf": conf}]
        """
        if self.model is None:
            return []

        # Predict with threshold
        results = self.model.predict(frame, conf=0.3, verbose=False)
        detections = []
        
        if not results:
            return detections
            
        result = results[0]
        boxes = result.boxes
        
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            xyxy = box.xyxy[0].cpu().numpy().tolist()
            x1, y1, x2, y2 = map(int, xyxy)
            
            # Map class ID to label name
            if self.classes is not None:
                # YOLO-World custom classes mapping
                if cls_id < len(self.classes):
                    label = self.classes[cls_id]
                else:
                    label = f"unknown_{cls_id}"
            else:
                # Fallback YOLOv8n COCO mapping
                label = result.names[cls_id]
                
            detections.append({
                "label": label,
                "bbox": [x1, y1, x2, y2],
                "conf": conf
            })
            
        return detections
