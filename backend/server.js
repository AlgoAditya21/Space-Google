const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
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

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
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
app.post('/api/predict', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }
    
    const imagePath = req.file.path;
    const modelPath = req.body.modelPath || null;
    
    // Path to Python script
    const pythonScript = path.join(__dirname, '..', 'python', 'inference.py');
    
    // Build command arguments
    const args = [pythonScript, imagePath];
    if (modelPath && modelPath !== 'null') {
        args.push(modelPath);
    } else {
        args.push('null');
    }
    args.push(outputsDir);
    
    // Run Python inference script (use venv python)
    const pythonPath = path.join(__dirname, '..', '.venv', 'bin', 'python');
    const pythonProcess = spawn(pythonPath, args);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error('Python error:', stderr);
            return res.status(500).json({ 
                success: false, 
                error: 'Inference failed', 
                details: stderr 
            });
        }
        
        try {
            // Find the JSON output (last line that starts with '{')
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
                // Convert file paths to URLs
                const outputImageName = path.basename(result.output_image);
                const inputImageName = path.basename(result.input_image);
                
                result.output_image_url = `/outputs/${outputImageName}`;
                result.input_image_url = `/uploads/${inputImageName}`;
            }
            
            res.json(result);
        } catch (parseError) {
            console.error('Parse error:', parseError);
            console.error('Python stdout:', stdout);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to parse inference result',
                stdout: stdout,
                stderr: stderr
            });
        }
    });
    
    pythonProcess.on('error', (error) => {
        console.error('Spawn error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to start Python process',
            details: error.message
        });
    });
});

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

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`📁 Outputs directory: ${outputsDir}`);
    console.log(`📁 Models directory: ${modelsDir}`);
    console.log('\n💡 Place your best.pt or best.onnx files in the models directory');
});
