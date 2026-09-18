import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Image as ImageIcon, CheckCircle, Database } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const UploadAnalysis = () => {
  const [file, setFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0); // 0: IDLE, 1: CLAHE, 2: DETECTING, 3: DONE

  const [results, setResults] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const onDrop = useCallback(acceptedFiles => {
    console.log("Selected files:", acceptedFiles);
    console.log("Number of files:", acceptedFiles.length);

    if (acceptedFiles && acceptedFiles.length > 0) {
      setSelectedFiles(acceptedFiles);

      setFile(acceptedFiles[0]);
      setPreviewUrl(URL.createObjectURL(acceptedFiles[0]));

      setResults(null);
      setSaveStatus(null);
      setProcessStep(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/jpg': [],
      'image/tiff': []
    },
    multiple: true
  });

  const handleProcess = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessStep(1);

    const formData = new FormData();

    selectedFiles.forEach((selectedFile) => {
      formData.append('images', selectedFile);
    });

    try {
      setTimeout(() => setProcessStep(2), 1500);

      console.log("Sending images to Flask...");
      console.log("Number of images:", selectedFiles.length);

      const response = await axios.post(
        `${API_BASE}/process-collection`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 120000,
        }
      );

      console.log("RESULT FROM FLASK:", response.data);

      if (!response.data || !response.data.results) {
        throw new Error("Invalid response received from Flask");
      }

      setProcessStep(3);
      setResults(response.data);

    } catch (error) {
      console.error("Processing error:", error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);

      alert(
        `Error processing image collection.\n\n${error.response?.data?.error || error.message}`
      );

      setProcessStep(0);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleSaveToMongo = async () => {
    if (!results) return;

    setIsSaving(true);

    try {
      // Get all image results
      const imageResults = results.results || [];

      // Combine analytics from all images
      let healthy = 0;
      let bleached = 0;
      let dead = 0;

      imageResults.forEach((imageResult) => {
        const counts = imageResult.analytics?.counts || {};

        healthy += counts['Healthy Coral'] || 0;
        bleached += counts['Bleached Coral'] || 0;
        dead += counts['Dead Coral'] || 0;
      });

      const total = healthy + bleached + dead;

      let riskScore = 0;
      let riskLevel = 'Low Risk';

      if (total > 0) {
        riskScore = ((bleached * 0.5) + (dead * 1.0)) / total;

        if (riskScore > 0.6) {
          riskLevel = 'Critical Risk';
        } else if (riskScore > 0.3) {
          riskLevel = 'Moderate Risk';
        }
      }

      const payload = {
        imageId: "IMG-" + Date.now(),
        timestamp: new Date().toISOString(),
        totalImages: results.total_images,
        counts: {
          healthy,
          bleached,
          dead
        },
        riskScore,
        riskLevel
      };

      await axios.post(`${API_BASE}/save`, payload);

      setSaveStatus('success');

    } catch (error) {
      console.error('MongoDB save error:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-24 pb-12 px-6 max-w-7xl mx-auto min-h-screen"
    >
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4">Reef Image Analysis</h1>
        <p className="text-slate-400">
          Upload a collection of underwater images to run the CLAHE enhancement and Faster R-CNN detection pipeline.
        </p>
      </div>

      {!results ? (
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          <div
            {...getRootProps()}
            className={`glass-panel border-2 border-dashed p-12 text-center cursor-pointer transition-colors duration-300 flex flex-col items-center justify-center min-h-[300px]
              ${isDragActive ? 'border-accent-cyan bg-ocean-800/80' : 'border-ocean-600 hover:border-ocean-500'}
            `}
          >
            <input {...getInputProps()} />

            {previewUrl ? (
              <div className="w-full">
                {/* First selected image preview */}
                <div className="relative w-full rounded-xl overflow-hidden group">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-auto max-h-[400px] object-cover"
                  />

                  <div className="absolute inset-0 bg-ocean-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                    <UploadCloud className="w-12 h-12 text-white mb-2" />

                    <span className="font-semibold text-white">
                      Click or drag to replace images
                    </span>
                  </div>
                </div>

                {/* Number of selected images */}
                <p className="text-sm text-slate-400 mt-3 text-center">
                  {selectedFiles.length} image(s) selected
                </p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-ocean-800 border border-ocean-700 flex items-center justify-center mb-6 text-accent-cyan shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                  <UploadCloud className="w-10 h-10" />
                </div>

                <h3 className="text-xl font-semibold mb-2">
                  Drag & Drop Images Here
                </h3>

                <p className="text-sm text-slate-400">
                  Supports JPG, PNG, TIFF (Max 32MB)
                </p>
              </>
            )}
          </div>

          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex flex-col gap-6"
              >
                {!isProcessing ? (
                  <button onClick={handleProcess} className="btn-primary w-full py-4 text-lg">
                    Begin Inference Pipeline
                  </button>
                ) : (
                  <div className="glass-panel p-6 flex flex-col gap-4">
                    <h3 className="text-lg font-semibold flex items-center gap-3">
                      <div className="animate-spin w-5 h-5 border-2 border-accent-cyan border-t-transparent rounded-full" />
                      Processing Engine Active...
                    </h3>

                    <div className="flex flex-col gap-3">
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${processStep >= 1 ? 'bg-ocean-800/80' : 'opacity-50'}`}>
                        {processStep > 1 ? <CheckCircle className="text-accent-teal w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600" />}
                        <span className="text-sm">Stage 1: Preprocessing (CLAHE Contrast Adjustment)</span>
                      </div>
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${processStep >= 2 ? 'bg-ocean-800/80' : 'opacity-50'}`}>
                        {processStep > 2 ? <CheckCircle className="text-accent-teal w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600" />}
                        <span className="text-sm">Stage 2: Deep Feature Extraction (ResNet-50)</span>
                      </div>
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${processStep >= 3 ? 'bg-ocean-800/80' : 'opacity-50'}`}>
                        {processStep >= 3 ? <CheckCircle className="text-accent-teal w-5 h-5" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600" />}
                        <span className="text-sm">Stage 3: Faster R-CNN Detection & Bounding Box Mapping</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex flex-col gap-8"
        >
          {/* Dashboard Headers */}
          <div className="flex flex-wrap items-center justify-between gap-4 glass-panel py-4 px-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <ImageIcon className="text-accent-cyan" /> Inference Results
            </h2>
            <div className="flex gap-4">
              <button onClick={() => setResults(null)} className="btn-secondary text-sm py-2">
                Analyze New Image
              </button>
              <button
                onClick={handleSaveToMongo}
                disabled={isSaving || saveStatus === 'success'}
                className={`btn-primary text-sm py-2 flex items-center gap-2 ${saveStatus === 'success' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Database className="w-4 h-4" />
                {saveStatus === 'success' ? 'Saved to DB' : isSaving ? 'Saving...' : 'Save Analysis to DB'}
              </button>
            </div>
          </div>

          {saveStatus === 'success' && (
            <div className="bg-emerald-900/50 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5" />
              Analysis successfully saved to MongoDB Atlas!
            </div>
          )}

          {/* All Image Results */}
          <div className="flex flex-col gap-8">
            {results.results.map((imageResult, index) => (
              <div key={index} className="glass-panel p-6">

                <h3 className="text-xl font-bold mb-6">
                  Image {index + 1}
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                  {/* Original Image */}
                  <div className="glass-panel p-2 flex flex-col">
                    <div className="bg-ocean-900/50 p-3 border-b border-ocean-700/50 text-sm text-slate-400 font-semibold uppercase tracking-wider flex justify-between">
                      <span>Raw Underwater Input</span>
                      <span>Stage 0</span>
                    </div>

                    <div className="w-full overflow-hidden rounded-b-xl flex items-center justify-center bg-black">
                      <img
                        src={imageResult.original_image}
                        alt={`Original Image ${index + 1}`}
                        className="max-w-full max-h-[60vh] object-contain"
                      />
                    </div>
                  </div>

                  {/* Annotated Image */}
                  <div className="glass-panel p-2 flex flex-col">
                    <div className="bg-ocean-900/50 p-3 border-b border-ocean-700/50 text-sm text-accent-cyan font-semibold uppercase tracking-wider flex justify-between">
                      <span>Bounding Box Detection Output</span>
                      <span>Stage 2</span>
                    </div>

                    <div className="w-full overflow-hidden rounded-b-xl flex items-center justify-center bg-black">
                      <img
                        src={imageResult.annotated_image}
                        alt={`Annotated Image ${index + 1}`}
                        className="max-w-full max-h-[60vh] object-contain"
                      />
                    </div>
                  </div>

                </div>

                {/* Individual Image Analytics */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">

                  <div className="bg-ocean-900/50 p-4 rounded-xl text-center">
                    <div className="text-sm text-slate-400">Total</div>
                    <div className="text-2xl font-bold">
                      {imageResult.analytics?.total_corals || 0}
                    </div>
                  </div>

                  <div className="bg-emerald-900/20 p-4 rounded-xl text-center">
                    <div className="text-sm text-emerald-400">Healthy</div>
                    <div className="text-2xl font-bold">
                      {imageResult.analytics?.counts?.['Healthy Coral'] || 0}
                    </div>
                  </div>

                  <div className="bg-amber-900/20 p-4 rounded-xl text-center">
                    <div className="text-sm text-amber-400">Bleached</div>
                    <div className="text-2xl font-bold">
                      {imageResult.analytics?.counts?.['Bleached Coral'] || 0}
                    </div>
                  </div>

                  <div className="bg-red-900/20 p-4 rounded-xl text-center">
                    <div className="text-sm text-red-500">Dead / Rubble</div>
                    <div className="text-2xl font-bold">
                      {imageResult.analytics?.counts?.['Dead Coral'] || 0}
                    </div>
                  </div>

                </div>

              </div>
            ))}
          </div>
          {/* Analytics Summary */}
          <div className="glass-panel p-8">
            <h3 className="text-xl font-bold mb-6">Population Demographics</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-ocean-900/50 p-4 rounded-xl border border-ocean-700/50 flex flex-col items-center justify-center text-center text-slate-300">
                <div className="text-sm font-semibold uppercase tracking-wider mb-2">Total Detections</div>
                <div className="text-4xl font-display font-bold text-white">{results.results.reduce(
                  (total, imageResult) =>
                    total + (imageResult.analytics?.total_corals || 0),
                  0
                )}</div>
              </div>

              <div className="bg-emerald-900/20 p-4 rounded-xl border border-status-healthy flex flex-col items-center justify-center text-center">
                <div className="text-sm font-semibold uppercase tracking-wider mb-2 text-emerald-400">Healthy</div>
                <div className="text-4xl font-display font-bold text-status-healthy">{results.results.reduce(
                  (total, imageResult) =>
                    total + (imageResult.analytics?.counts?.['Healthy Coral'] || 0),
                  0
                )}</div>
              </div>

              <div className="bg-amber-900/20 p-4 rounded-xl border border-status-bleached flex flex-col items-center justify-center text-center">
                <div className="text-sm font-semibold uppercase tracking-wider mb-2 text-amber-400">Bleached</div>
                <div className="text-4xl font-display font-bold text-status-bleached">{results.results.reduce(
                  (total, imageResult) =>
                    total + (imageResult.analytics?.counts?.['Bleached Coral'] || 0),
                  0
                )}</div>
              </div>

              <div className="bg-red-900/20 p-4 rounded-xl border border-status-dead flex flex-col items-center justify-center text-center">
                <div className="text-sm font-semibold uppercase tracking-wider mb-2 text-red-500">Dead / Rubble</div>
                <div className="text-4xl font-display font-bold text-status-dead">{results.results.reduce(
                  (total, imageResult) =>
                    total + (imageResult.analytics?.counts?.['Dead Coral'] || 0),
                  0
                )}</div>
              </div>
            </div>
          </div>

        </motion.div>
      )}
    </motion.div>
  );
};

export default UploadAnalysis;
