'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await axios.get('/api/models');
      if (response.data.success) {
        setModels(response.data.models);
        if (response.data.models.length > 0) {
          setSelectedModel(response.data.models[0].path);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp']
    },
    multiple: false
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('modelPath', selectedModel || 'null');

    try {
      const response = await axios.post('/api/predict', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setResult(response.data);
      } else {
        setError(response.data.error || 'Prediction failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  if (!mounted) return null;

  return (
    <>
      <div className="gradient-bg" />
      <div className="grid-pattern" />
      
      <main className="min-h-screen px-4 py-12 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="text-center mb-16 fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-gray-400">AI-Powered Detection</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              <span className="gradient-text">YOLOv8</span>
              <br />
              <span className="text-white">Object Detection</span>
            </h1>
            
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Upload any image and let our AI instantly detect and classify objects 
              with state-of-the-art precision and speed.
            </p>
          </header>

          {/* Model Selection */}
          <div className="max-w-md mx-auto mb-12 fade-in" style={{ animationDelay: '0.1s' }}>
            <label className="block text-sm font-medium text-gray-300 mb-3 text-center">
              Select AI Model
            </label>
            <select
              value={selectedModel || ''}
              onChange={(e) => setSelectedModel(e.target.value || null)}
              className="custom-select w-full"
            >
              {models.map((model, index) => (
                <option key={index} value={model.path || ''}>
                  {model.name} • {model.type}
                </option>
              ))}
            </select>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="glass-card p-8 slide-in-left" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold">Upload Image</h2>
              </div>
              
              <div
                {...getRootProps()}
                className={`dropzone ${isDragActive ? 'active' : ''}`}
              >
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative z-10 space-y-4">
                    <div className="relative rounded-xl overflow-hidden inline-block">
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-h-72 rounded-xl shadow-2xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </div>
                    <p className="text-sm text-gray-300">{selectedFile?.name}</p>
                    <p className="text-xs text-gray-400">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="relative z-10 space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center float">
                      <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg text-gray-300 mb-2">
                        {isDragActive ? 'Drop your image here...' : 'Drag & drop your image'}
                      </p>
                      <p className="text-sm text-gray-400">
                        or click to browse • PNG, JPG, GIF, WebP
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || loading}
                  className="glow-button flex-1"
                >
                  <span className="flex items-center justify-center gap-3">
                    {loading ? (
                      <>
                        <div className="spinner" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Run Detection
                      </>
                    )}
                  </span>
                </button>
                
                {(selectedFile || result) && (
                  <button
                    onClick={resetState}
                    className="px-6 py-4 rounded-xl font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>

              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 scale-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-red-400">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Results Section */}
            <div className="glass-card p-8 slide-in-right" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold">Detection Results</h2>
              </div>
              
              {result ? (
                <div className="space-y-6 fade-in">
                  {/* Output Image */}
                  <div className="relative rounded-2xl overflow-hidden image-reveal">
                    <img
                      src={result.output_image_url}
                      alt="Detection Result"
                      className="w-full rounded-2xl"
                    />
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                      <span className="badge bg-black/50 backdrop-blur-sm">
                        <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Detection Complete
                      </span>
                    </div>
                  </div>

                  {/* Statistics Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="stat-card blue">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <p className="text-sm text-indigo-300">Total Objects</p>
                      </div>
                      <p className="text-4xl font-bold text-white">
                        {result.stats.total_detections}
                      </p>
                    </div>
                    
                    <div className="stat-card green">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-green-300">Avg Confidence</p>
                      </div>
                      <p className="text-4xl font-bold text-white">
                        {result.stats.avg_confidence}<span className="text-xl">%</span>
                      </p>
                    </div>
                    
                    <div className="stat-card purple">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <p className="text-sm text-purple-300">Max Confidence</p>
                      </div>
                      <p className="text-4xl font-bold text-white">
                        {result.stats.max_confidence}<span className="text-xl">%</span>
                      </p>
                    </div>
                    
                    <div className="stat-card cyan">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-sm text-cyan-300">Unique Classes</p>
                      </div>
                      <p className="text-4xl font-bold text-white">
                        {result.stats.unique_classes}
                      </p>
                    </div>
                  </div>

                  {/* Classes Detected */}
                  {result.stats.classes_detected.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-sm text-gray-300 mb-3">Detected Classes</p>
                      <div className="flex flex-wrap gap-2">
                        {result.stats.classes_detected.map((cls, idx) => (
                          <span key={idx} className="badge">
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detections Table */}
                  {result.detections.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-white/10">
                      <table className="detection-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Class</th>
                            <th className="text-right">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.detections.map((det) => (
                            <tr key={det.id}>
                              <td className="text-gray-300">{det.id}</td>
                              <td className="font-medium">{det.class_name}</td>
                              <td className="text-right">
                                <span
                                  className={`inline-flex px-3 py-1 rounded-full text-sm font-medium text-white ${
                                    det.confidence >= 80
                                      ? 'confidence-high'
                                      : det.confidence >= 50
                                      ? 'confidence-medium'
                                      : 'confidence-low'
                                  }`}
                                >
                                  {det.confidence}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Model Info */}
                  <div className="text-center pt-4 border-t border-white/10">
                    <p className="text-sm text-gray-400">
                      Model: <span className="text-gray-300">{result.model_used}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-6 float">
                    <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No Results Yet</h3>
                  <p className="text-gray-400 max-w-xs">
                    Upload an image and run detection to see AI-powered object recognition results
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="text-center mt-16 pt-8 border-t border-white/5">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
              <span>Powered by</span>
              <span className="gradient-text font-semibold">YOLOv8</span>
              <span>•</span>
              <span>Built with Next.js & Express</span>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
