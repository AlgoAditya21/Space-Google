# YOLOv8 Web Application

A simple web application for object detection using YOLOv8. Upload images and get predictions with bounding boxes, confidence scores, and statistics.

## Project Structure

```
yolo_web_app/
├── frontend/          # Next.js frontend
│   ├── src/
│   │   └── app/
│   │       ├── page.js
│   │       ├── layout.js
│   │       └── globals.css
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
├── backend/           # Express backend
│   ├── server.js
│   ├── package.json
│   ├── uploads/       # Uploaded images (created automatically)
│   ├── outputs/       # Prediction results (created automatically)
│   └── models/        # Place your model files here
├── python/            # Python inference scripts
│   ├── inference.py
│   └── requirements.txt
└── README.md
```

## Prerequisites

- Node.js 18+ 
- Python 3.8+
- pip (Python package manager)

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd python
pip install -r requirements.txt
```

This will install:
- ultralytics (YOLOv8)
- opencv-python
- numpy
- Pillow

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Add Your Custom Model (Optional)

Place your trained model files in the `backend/models/` directory:
- `best.pt` (PyTorch format)
- `best.onnx` (ONNX format)

If no custom model is found, the application will use the default YOLOv8n model.

## Running the Application

### Start the Backend Server

```bash
cd backend
npm run dev
```

The backend will run on http://localhost:5000

### Start the Frontend (in a new terminal)

```bash
cd frontend
npm run dev
```

The frontend will run on http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Select a model from the dropdown (or use the default YOLOv8n)
3. Drag and drop an image or click to upload
4. Click "Run Detection"
5. View the results with bounding boxes, confidence scores, and statistics

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/models` | GET | List available models |
| `/api/predict` | POST | Upload image and run detection |

## Features

- 📤 Drag & drop image upload
- 🔍 YOLOv8 object detection
- 📊 Detection statistics (confidence, class distribution)
- 🎯 Support for custom trained models (.pt, .onnx)
- 🖼️ Annotated output images with bounding boxes
- 📱 Responsive design

## Troubleshooting

### Python not found
Make sure Python 3 is installed and accessible as `python3` in your terminal.

### Model loading issues
- Ensure ultralytics is properly installed
- Check that model files are in the correct format (.pt or .onnx)

### Port conflicts
- Backend default: 5000 (change with `PORT` environment variable)
- Frontend default: 3000 (Next.js default)

## License

MIT
