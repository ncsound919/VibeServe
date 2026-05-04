import { useState, useRef } from 'react';
import { Image, Upload, Wand2, X, Eye, Code, Download } from 'lucide-react';

interface ImageAnalysis {
  id: string;
  imageUrl: string;
  analysis: string;
  suggestedComponents: string[];
  generatedCode?: string;
  timestamp: number;
}

interface MultimodalPromptProps {
  onGenerateCode?: (analysis: string, imageUrl: string) => void;
}

export function MultimodalPrompt({ onGenerateCode }: MultimodalPromptProps) {
  const [images, setImages] = useState<ImageAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageAnalysis | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsAnalyzing(true);

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async () => {
        const url = reader.result as string;
        
        await simulateAnalysis(url);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlSubmit = async () => {
    if (!imageUrl.trim()) return;
    
    setIsAnalyzing(true);
    await simulateAnalysis(imageUrl);
    setImageUrl('');
  };

  const simulateAnalysis = async (url: string) => {
    const analysis: ImageAnalysis = {
      id: `img-${Date.now()}`,
      imageUrl: url,
      analysis: 'Detected a modern UI design with card-based layout, hero section, and navigation bar. Color scheme appears to be dark mode with accent colors.',
      suggestedComponents: ['Hero Section', 'Navigation Bar', 'Feature Cards', 'CTA Button', 'Footer'],
      generatedCode: `export function GeneratedUI() {
  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="text-xl font-bold text-white">Logo</div>
        <div className="flex gap-4">
          <a href="#" className="text-gray-300 hover:text-white">Home</a>
          <a href="#" className="text-gray-300 hover:text-white">Features</a>
          <a href="#" className="text-gray-300 hover:text-white">Pricing</a>
        </div>
      </nav>
      <section className="px-6 py-20 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Build Amazing Apps</h1>
        <p className="text-gray-400 mb-8">The fastest way to build modern web applications</p>
        <button className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Get Started
        </button>
      </section>
    </div>
  );
}`,
      timestamp: Date.now(),
    };

    setTimeout(() => {
      setImages(prev => [...prev, analysis]);
      setIsAnalyzing(false);
    }, 2000);
  };

  const handleGenerateCode = (analysis: ImageAnalysis) => {
    if (onGenerateCode) {
      onGenerateCode(analysis.analysis, analysis.imageUrl);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-gray-300">
      <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-gray-800">
        <Image className="w-4 h-4 text-pink-400" />
        <span className="text-sm font-medium text-white">Image to UI</span>
        <span className="px-1.5 py-0.5 bg-pink-900/50 text-pink-300 text-xs rounded">
          Multimodal
        </span>
      </div>

      <div className="flex items-center gap-2 p-3 border-b border-gray-800">
        <button
          onClick={() => setMode('upload')}
          className={`px-3 py-1.5 text-xs rounded ${mode === 'upload' ? 'bg-pink-900 text-pink-300' : 'bg-[#252526] text-gray-400'}`}
        >
          <Upload className="w-3 h-3 inline mr-1" />
          Upload
        </button>
        <button
          onClick={() => setMode('url')}
          className={`px-3 py-1.5 text-xs rounded ${mode === 'url' ? 'bg-pink-900 text-pink-300' : 'bg-[#252526] text-gray-400'}`}
        >
          <Image className="w-3 h-3 inline mr-1" />
          URL
        </button>
      </div>

      <div className="p-3 border-b border-gray-800">
        {mode === 'upload' ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-pink-600 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
            <p className="text-sm text-gray-400">Click to upload images</p>
            <p className="text-xs text-gray-600">PNG, JPG, WebP supported</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Enter image URL..."
              className="flex-1 bg-[#252526] border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!imageUrl.trim() || isAnalyzing}
              className="px-3 py-2 bg-pink-900 text-pink-300 rounded hover:bg-pink-800 disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {isAnalyzing && (
          <div className="mt-3 flex items-center gap-2 text-pink-400">
            <Wand2 className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Analyzing image...</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {images.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No images uploaded yet</p>
            <p className="text-xs text-gray-600">Upload a design mockup and I'll generate UI code</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {images.map(img => (
              <div
                key={img.id}
                className="relative group bg-[#252526] rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setSelectedImage(img)}
              >
                <img
                  src={img.imageUrl}
                  alt="Upload"
                  className="w-full h-24 object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setImages(prev => prev.filter(i => i.id !== img.id)); }}
                  className="absolute top-1 right-1 p-1 bg-red-900 rounded opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3 h-3 text-red-300" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setSelectedImage(null)}>
          <div className="bg-[#1e1e1e] rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-medium text-white">Generated UI</span>
              <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={selectedImage.imageUrl}
                alt="Reference"
                className="w-full rounded mb-4"
              />
              <div className="mb-4">
                <h4 className="text-sm font-medium text-white mb-2">Analysis</h4>
                <p className="text-sm text-gray-400">{selectedImage.analysis}</p>
              </div>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-white mb-2">Suggested Components</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedImage.suggestedComponents.map((comp, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
              {selectedImage.generatedCode && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Generated Code</h4>
                  <pre className="bg-[#0d0d0d] p-3 rounded text-xs text-gray-300 overflow-x-auto max-h-48">
                    {selectedImage.generatedCode}
                  </pre>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleGenerateCode(selectedImage)}
                      className="flex items-center gap-2 px-3 py-2 bg-pink-900 text-pink-300 rounded text-sm hover:bg-pink-800"
                    >
                      <Code className="w-4 h-4" />
                      Use in Editor
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedImage.generatedCode || '')}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded text-sm hover:bg-gray-700"
                    >
                      <Download className="w-4 h-4" />
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
