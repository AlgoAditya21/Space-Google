const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Determine if running in Docker/production
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Create directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');
const modelsDir = path.join(__dirname, 'models');

[uploadsDir, outputsDir, modelsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Serve static files
app.use('/uploads', express.static(uploadsDir));
app.use('/outputs', express.static(outputsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// ============================================
// Python Inference Server (Singleton Pattern)
// ============================================
let pythonProcess = null;
let isModelLoaded = false;
let requestQueue = [];
let isProcessing = false;

// Get the correct Python path based on environment
function getPythonPath() {
    if (isProduction) {
        // In Docker, use system python3
        return 'python3';
    }
    // Local development - use venv
    const venvPython = path.join(__dirname, '..', '.venv', 'bin', 'python');
    if (fs.existsSync(venvPython)) {
        return venvPython;
    }
    return 'python3';
}

// Start the persistent Python inference server
function startPythonServer() {
    const pythonPath = getPythonPath();
    const serverScript = path.join(__dirname, '..', 'python', 'inference_server.py');
    
    console.log(`🐍 Starting Python inference server with: ${pythonPath}`);
    console.log(`📜 Script path: ${serverScript}`);
    
    pythonProcess = spawn(pythonPath, [serverScript], {
        env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PYTHONPATH: process.env.PYTHONPATH || path.join(__dirname, '..', 'python')
        },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.startsWith('READY:')) {
                isModelLoaded = true;
                console.log('✅ Python model loaded and ready');
            } else if (line.startsWith('RESULT:')) {
                const jsonStr = line.substring(7);
                try {
                    const result = JSON.parse(jsonStr);
                    processResult(result);
                } catch (e) {
                    console.error('Failed to parse Python result:', e);
                }
            } else if (line.startsWith('ERROR:')) {
                console.error('Python error:', line.substring(6));
            } else {
                console.log('Python:', line);
            }
        });
    });
    
    pythonProcess.stderr.on('data', (data) => {
        console.error('Python stderr:', data.toString());
    });
    
    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        isModelLoaded = false;
        pythonProcess = null;
        
        // Restart after 5 seconds if not shutting down
        if (code !== 0) {
            console.log('Restarting Python server in 5 seconds...');
            setTimeout(startPythonServer, 5000);
        }
    });
    
    pythonProcess.on('error', (error) => {
        console.error('Failed to start Python process:', error);
        isModelLoaded = false;
    });
}

// Process result from Python
function processResult(result) {
    if (requestQueue.length > 0) {
        const { resolve, imagePath, outputDir } = requestQueue.shift();
        
        if (result.success) {
            const outputImageName = path.basename(result.output_image);
            const inputImageName = path.basename(result.input_image);
            result.output_image_url = `/outputs/${outputImageName}`;
            result.input_image_url = `/uploads/${inputImageName}`;
        }
        
        resolve(result);
        isProcessing = false;
        processNextRequest();
    }
}

// Process the next request in queue
function processNextRequest() {
    if (requestQueue.length === 0 || isProcessing || !isModelLoaded) {
        return;
    }
    
    isProcessing = true;
    const { imagePath, modelPath, outputDir } = requestQueue[0];
    
    const command = JSON.stringify({
        action: 'predict',
        image_path: imagePath,
        model_path: modelPath || 'default',
        output_dir: outputDir
    });
    
    pythonProcess.stdin.write(command + '\n');
}

// Send prediction request to Python
function sendPrediction(imagePath, modelPath, outputDir) {
    return new Promise((resolve, reject) => {
        if (!pythonProcess || !isModelLoaded) {
            // Fallback to one-shot inference if server not ready
            return runOneShotInference(imagePath, modelPath, outputDir)
                .then(resolve)
                .catch(reject);
        }
        
        requestQueue.push({ resolve, reject, imagePath, modelPath, outputDir });
        processNextRequest();
        
        // Timeout after 60 seconds
        setTimeout(() => {
            const index = requestQueue.findIndex(r => r.imagePath === imagePath);
            if (index !== -1) {
                requestQueue.splice(index, 1);
                reject(new Error('Inference timeout'));
            }
        }, 60000);
    });
}

// One-shot inference fallback
function runOneShotInference(imagePath, modelPath, outputDir) {
    return new Promise((resolve, reject) => {
        const pythonPath = getPythonPath();
        const pythonScript = path.join(__dirname, '..', 'python', 'inference.py');
        
        const args = [pythonScript, imagePath];
        args.push(modelPath || 'null');
        args.push(outputDir);
        
        const proc = spawn(pythonPath, args, {
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1'
            }
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || 'Inference failed'));
            }
            
            try {
                const lines = stdout.trim().split('\n');
                let jsonLine = '';
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim().startsWith('{')) {
                        jsonLine = lines[i].trim();
                        break;
                    }
                }
                
                if (!jsonLine) {
                    throw new Error('No JSON output found');
                }
                
                const result = JSON.parse(jsonLine);
                
                if (result.success) {
                    const outputImageName = path.basename(result.output_image);
                    const inputImageName = path.basename(result.input_image);
                    result.output_image_url = `/outputs/${outputImageName}`;
                    result.input_image_url = `/uploads/${inputImageName}`;
                }
                
                resolve(result);
            } catch (e) {
                reject(new Error('Failed to parse inference result'));
            }
        });
        
        proc.on('error', reject);
    });
}

// Start Python server on startup
startPythonServer();

// ============================================
// API Routes
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        modelLoaded: isModelLoaded,
        environment: isProduction ? 'production' : 'development'
    });
});

// Get available models
app.get('/api/models', (req, res) => {
    try {
        const models = [];
        
        // Check for custom models
        if (fs.existsSync(modelsDir)) {
            const files = fs.readdirSync(modelsDir);
            files.forEach(file => {
                if (file.endsWith('.pt') || file.endsWith('.onnx')) {
                    models.push({
                        name: file,
                        path: path.join(modelsDir, file),
                        type: file.endsWith('.pt') ? 'PyTorch' : 'ONNX'
                    });
                }
            });
        }
        
        // Add default model option
        models.unshift({
            name: 'YOLOv8n (Default)',
            path: null,
            type: 'PyTorch'
        });
        
        res.json({ success: true, models });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload and process image
app.post('/api/predict', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }
    
    const imagePath = req.file.path;
    const modelPath = req.body.modelPath || null;
    
    try {
        const result = await sendPrediction(imagePath, modelPath, outputsDir);
        res.json(result);
    } catch (error) {
        console.error('Prediction error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Inference failed', 
            details: error.message 
        });
    }
});

// Cleanup old files periodically (every hour)
setInterval(() => {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    
    [uploadsDir, outputsDir].forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                const filePath = path.join(dir, file);
                try {
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlinkSync(filePath);
                        console.log(`Cleaned up: ${file}`);
                    }
                } catch (e) {
                    // Ignore errors during cleanup
                }
            });
        }
    });
}, 60 * 60 * 1000);

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false, 
                error: 'File too large. Maximum size is 10MB' 
            });
        }
    }
    res.status(500).json({ success: false, error: error.message });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    if (pythonProcess) {
        pythonProcess.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n');
        pythonProcess.kill();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    if (pythonProcess) {
        pythonProcess.stdin.write(JSON.stringify({ action: 'shutdown' }) + '\n');
        pythonProcess.kill();
    }
    process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`📁 Outputs directory: ${outputsDir}`);
    console.log(`📁 Models directory: ${modelsDir}`);
    console.log(`🌍 Environment: ${isProduction ? 'production' : 'development'}`);
    console.log('\n💡 Place your best.pt or best.onnx files in the models directory');
});
