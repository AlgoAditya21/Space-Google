"""
YOLOv8 Persistent Inference Server
Keeps the model loaded in memory to avoid reloading on each request.
Optimized for free-tier deployment with CPU inference.
"""

import sys
import json
import os
import warnings
import gc

# Suppress all warnings before importing
warnings.filterwarnings('ignore')
os.environ['YOLO_VERBOSE'] = 'False'
os.environ['OMP_NUM_THREADS'] = '2'  # Limit CPU threads for free tier
os.environ['OPENBLAS_NUM_THREADS'] = '2'
os.environ['MKL_NUM_THREADS'] = '2'

import logging
logging.getLogger('ultralytics').setLevel(logging.ERROR)

from ultralytics import YOLO
import cv2
import numpy as np

class InferenceServer:
    def __init__(self):
        self.model = None
        self.model_path = None
        self.default_model_name = 'yolov8n.pt'  # Smallest model for free tier
        
    def load_model(self, model_path=None):
        """Load or reload the YOLO model."""
        target_path = model_path if model_path and os.path.exists(model_path) else self.default_model_name
        
        # Only reload if model path changed
        if self.model is not None and self.model_path == target_path:
            return True
            
        try:
            # Clear previous model from memory
            if self.model is not None:
                del self.model
                gc.collect()
            
            self.model = YOLO(target_path)
            self.model_path = target_path
            
            # Force CPU inference for free tier
            self.model.to('cpu')
            
            return True
        except Exception as e:
            print(f"ERROR:Failed to load model: {str(e)}", flush=True)
            return False
    
    def predict(self, image_path, model_path=None, output_dir=None):
        """Run inference on an image."""
        try:
            # Load model if needed
            if model_path and model_path != 'default' and model_path != 'null':
                self.load_model(model_path)
            elif self.model is None:
                self.load_model()
            
            # Run inference with memory-optimized settings
            results = self.model(
                image_path, 
                verbose=False,
                imgsz=640,  # Standard size, good balance
                half=False,  # CPU doesn't support half precision
                device='cpu'
            )
            
            result = results[0]
            
            # Create output directory if needed
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            else:
                output_dir = os.path.dirname(image_path)
            
            # Generate output filename
            input_filename = os.path.basename(image_path)
            name, ext = os.path.splitext(input_filename)
            output_filename = f"{name}_predicted{ext}"
            output_path = os.path.join(output_dir, output_filename)
            
            # Save annotated image
            annotated_frame = result.plot()
            cv2.imwrite(output_path, annotated_frame)
            
            # Extract detections
            boxes = result.boxes
            detections = []
            
            if boxes is not None and len(boxes) > 0:
                for i, box in enumerate(boxes):
                    detection = {
                        "id": i + 1,
                        "class_id": int(box.cls[0].item()),
                        "class_name": result.names[int(box.cls[0].item())],
                        "confidence": round(float(box.conf[0].item()) * 100, 2),
                        "bbox": {
                            "x1": round(float(box.xyxy[0][0].item()), 2),
                            "y1": round(float(box.xyxy[0][1].item()), 2),
                            "x2": round(float(box.xyxy[0][2].item()), 2),
                            "y2": round(float(box.xyxy[0][3].item()), 2)
                        }
                    }
                    detections.append(detection)
            
            # Calculate statistics
            stats = {
                "total_detections": len(detections),
                "unique_classes": len(set(d["class_name"] for d in detections)),
                "avg_confidence": round(sum(d["confidence"] for d in detections) / len(detections), 2) if detections else 0,
                "max_confidence": max((d["confidence"] for d in detections), default=0),
                "min_confidence": min((d["confidence"] for d in detections), default=0),
                "classes_detected": list(set(d["class_name"] for d in detections))
            }
            
            return {
                "success": True,
                "input_image": image_path,
                "output_image": output_path,
                "detections": detections,
                "stats": stats,
                "model_used": self.model_path
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            # Force garbage collection after each inference
            gc.collect()

def main():
    server = InferenceServer()
    
    # Pre-load default model
    print("Loading YOLOv8 model...", flush=True)
    if server.load_model():
        print("READY:Model loaded successfully", flush=True)
    else:
        print("ERROR:Failed to load model", flush=True)
        sys.exit(1)
    
    # Process commands from stdin
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
                
            line = line.strip()
            if not line:
                continue
            
            try:
                command = json.loads(line)
            except json.JSONDecodeError:
                print("ERROR:Invalid JSON command", flush=True)
                continue
            
            action = command.get('action')
            
            if action == 'predict':
                image_path = command.get('image_path')
                model_path = command.get('model_path')
                output_dir = command.get('output_dir')
                
                result = server.predict(image_path, model_path, output_dir)
                print(f"RESULT:{json.dumps(result)}", flush=True)
                
            elif action == 'reload':
                model_path = command.get('model_path')
                if server.load_model(model_path):
                    print("READY:Model reloaded", flush=True)
                else:
                    print("ERROR:Failed to reload model", flush=True)
                    
            elif action == 'shutdown':
                print("Shutting down inference server...", flush=True)
                break
                
            else:
                print(f"ERROR:Unknown action: {action}", flush=True)
                
        except Exception as e:
            print(f"ERROR:{str(e)}", flush=True)

if __name__ == "__main__":
    main()
