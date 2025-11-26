"""
YOLOv8 Inference Script
This script loads a YOLOv8 model and performs inference on uploaded images.
"""

import sys
import json
import os
import warnings
from pathlib import Path

# Suppress all warnings and logging before importing ultralytics
warnings.filterwarnings('ignore')
os.environ['YOLO_VERBOSE'] = 'False'

import logging
logging.getLogger('ultralytics').setLevel(logging.ERROR)

from ultralytics import YOLO
import cv2
import numpy as np

def run_inference(image_path: str, model_path: str = None, output_dir: str = None):
    """
    Run YOLOv8 inference on an image.
    
    Args:
        image_path: Path to the input image
        model_path: Path to the model weights (best.pt or best.onnx). If None, uses yolov8n.pt
        output_dir: Directory to save the output image
    
    Returns:
        dict: Results including output image path and statistics
    """
    try:
        # Load the model
        if model_path and os.path.exists(model_path):
            model = YOLO(model_path)
        else:
            # Use default YOLOv8 nano model
            model = YOLO('yolov8n.pt')
        
        # Run inference
        results = model(image_path, verbose=False)
        
        # Get the first result (single image)
        result = results[0]
        
        # Create output directory if it doesn't exist
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        else:
            output_dir = os.path.dirname(image_path)
        
        # Generate output filename
        input_filename = os.path.basename(image_path)
        name, ext = os.path.splitext(input_filename)
        output_filename = f"{name}_predicted{ext}"
        output_path = os.path.join(output_dir, output_filename)
        
        # Save the annotated image
        annotated_frame = result.plot()
        cv2.imwrite(output_path, annotated_frame)
        
        # Extract detection statistics
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
        
        # Calculate summary statistics
        stats = {
            "total_detections": len(detections),
            "unique_classes": len(set(d["class_name"] for d in detections)),
            "avg_confidence": round(sum(d["confidence"] for d in detections) / len(detections), 2) if detections else 0,
            "max_confidence": max((d["confidence"] for d in detections), default=0),
            "min_confidence": min((d["confidence"] for d in detections), default=0),
            "classes_detected": list(set(d["class_name"] for d in detections))
        }
        
        # Prepare response
        response = {
            "success": True,
            "input_image": image_path,
            "output_image": output_path,
            "detections": detections,
            "stats": stats,
            "model_used": model_path if model_path and os.path.exists(model_path) else "yolov8n.pt (default)"
        }
        
        return response
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    model_path = sys.argv[2] if len(sys.argv) > 2 else None
    output_dir = sys.argv[3] if len(sys.argv) > 3 else None
    
    result = run_inference(image_path, model_path, output_dir)
    print(json.dumps(result))
