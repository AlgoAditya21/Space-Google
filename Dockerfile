# Use Node.js 18 as base image
FROM node:18-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app/python
ENV PORT=5000

# Install Python3, pip, and required system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy Python requirements first (for Docker layer caching)
COPY python/requirements.txt /app/python/requirements.txt

# Install Python dependencies globally (no venv needed in Docker)
RUN pip3 install --no-cache-dir -r /app/python/requirements.txt

# Copy package.json first (for Docker layer caching)
COPY backend/package.json /app/backend/package.json

# Install Node.js dependencies
WORKDIR /app/backend
RUN npm install --production

# Copy the rest of the application
WORKDIR /app
COPY backend/ /app/backend/
COPY python/ /app/python/

# Create necessary directories
RUN mkdir -p /app/backend/uploads /app/backend/outputs /app/backend/models

# Pre-download YOLOv8n model to avoid download on first request
RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" || true

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start the Node.js server
CMD ["node", "backend/server.js"]
