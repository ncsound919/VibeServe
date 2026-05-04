import { useState, useCallback, useEffect, useRef } from 'react';
import { FileText, Image, Code, Eye, RefreshCw, Copy, Check, Cpu, HardDrive, Globe, Terminal, Upload, Wand2 } from 'lucide-react';
import type { FileInfo } from '../components/CodeEditor';
import { useAuditStore } from '../../core/agents/monitoring/auditStore';

interface PreviewContent {
  type: 'markdown' | 'html' | 'image' | 'code' | 'plan';
  content: string;
  title?: string;
  timestamp?: number;
}

export function MultimodalPreview() {
  const [preview, setPreview] = useState<PreviewContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateDocPreview = useCallback(async (file: FileInfo | null) => {
    if (!file) return;
    
    setLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const docContent = generateMockDoc(file);
    const previewContent = {
      type: 'markdown' as const,
      content: docContent,
      title: `${file.name} - Auto-generated Documentation`,
      timestamp: Date.now(),
    };
    setPreview(previewContent);
    
    // Log artifact for traceability
    try {
      const auditStore = useAuditStore.getState();
      auditStore.addArtifact({
        type: 'doc',
        title: previewContent.title || 'Documentation',
        content: docContent,
        agentId: 'preview-agent',
        sessionId: 'preview-session',
      });
    } catch (error) {
      console.error('Failed to log artifact:', error);
    }
    
    setLoading(false);
  }, []);

  const generatePlanPreview = useCallback(async (task: string) => {
    if (!task) return;
    
    setLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const planContent = generateMockPlan(task);
    const previewContent = {
      type: 'plan' as const,
      content: planContent,
      title: `Plan: ${task.slice(0, 30)}...`,
      timestamp: Date.now(),
    };
    setPreview(previewContent);
    
    // Log artifact
    try {
      const auditStore = useAuditStore.getState();
      auditStore.addArtifact({
        type: 'plan',
        title: previewContent.title || 'Plan',
        content: planContent,
        agentId: 'preview-agent',
        sessionId: 'preview-session',
      });
    } catch (error) {
      console.error('Failed to log artifact:', error);
    }
    
    setLoading(false);
  }, []);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImageFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const generateImageUI = useCallback(async () => {
    if (!imageFile) return;
    
    setLoading(true);
    
    // Simulate AI processing of image to generate UI
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const uiCode = generateMockUIFromImage(imageFile.name);
    const previewContent = {
      type: 'code' as const,
      content: uiCode,
      title: `UI from ${imageFile.name}`,
      timestamp: Date.now(),
    };
    setPreview(previewContent);
    
    // Log artifact
    try {
      const auditStore = useAuditStore.getState();
      auditStore.addArtifact({
        type: 'image-ui',
        title: previewContent.title || 'UI from Image',
        content: uiCode,
        agentId: 'preview-agent',
        sessionId: 'preview-session',
      });
    } catch (error) {
      console.error('Failed to log artifact:', error);
    }
    
    setLoading(false);
  }, [imageFile]);

  const handleCopy = useCallback(() => {
    if (preview?.content) {
      navigator.clipboard.writeText(preview.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [preview]);

  const getTypeIcon = (type: PreviewContent['type']) => {
    switch (type) {
      case 'markdown': return <FileText className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'code': return <Code className="w-4 h-4" />;
      case 'plan': return <Eye className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center gap-2 p-3 border-b border-slate-700">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => generateDocPreview({ name: 'example.ts', path: '/example.ts', language: 'typescript' } as FileInfo)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            Generate Docs
          </button>
          <button
            onClick={() => generatePlanPreview('Implement user authentication flow')}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            Preview Plan
          </button>
          
          {/* Image to UI Generation */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload Image
          </button>
          
          {imageFile && (
            <button
              onClick={generateImageUI}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded text-sm transition-colors disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4" />
              Generate UI from Image
            </button>
          )}
          
          {imagePreviewUrl && (
            <div className="w-8 h-8 rounded overflow-hidden border border-slate-600">
              <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        
        {preview && (
          <button
            onClick={handleCopy}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-slate-200 text-sm"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Generating preview...</span>
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              {getTypeIcon(preview.type)}
              <span>{preview.title || preview.type}</span>
              {preview.timestamp && (
                <span className="ml-auto text-xs">
                  {new Date(preview.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <pre className="whitespace-pre-wrap text-sm text-slate-200 font-mono">
                {preview.content}
              </pre>
            </div>
            
            {preview.type === 'plan' && (
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-sm">
                  Approve Plan
                </button>
                <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm">
                  Request Changes
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Eye className="w-12 h-12 mb-3 opacity-30" />
            <p>Click a button above to generate a preview</p>
            <p className="text-xs mt-2">Auto-generated documentation or execution plans</p>
          </div>
        )}
      </div>
    </div>
  );
}

function generateMockDoc(file: FileInfo): string {
  return `# API Documentation: ${file.name}

## Overview
This module provides core functionality for the application.

## Usage
\`\`\`typescript
import { example } from '${file.path}';

const result = example();
\`\`\`

## Functions

### \`example()\`
- **Parameters**: None
- **Returns**: \`string\`
- **Description**: Main function that handles core logic

## Types

### \`ExampleConfig\`
\`\`\`typescript
interface ExampleConfig {
  enabled: boolean;
  timeout?: number;
}
\`\`\`

---
*Generated at ${new Date().toLocaleString()}*`;
}

function generateMockPlan(task: string): string {
  return `# Execution Plan: ${task}

## Steps

1. **Analyze Requirements**
   - Review existing codebase patterns
   - Identify necessary dependencies
   
2. **Implementation**
   - Create new module structure
   - Implement core functionality
   - Add error handling
   
3. **Testing**
   - Write unit tests
   - Run integration tests
   - Verify edge cases
   
4. **Deployment**
   - Build production bundle
   - Deploy to staging
   - Run smoke tests

## Estimated Time
- Total: ~45 minutes

## Risks
- None identified

---
*Plan generated at ${new Date().toLocaleString()}*`;
}

function generateMockUIFromImage(imageName: string): string {
  const baseName = imageName.split('.')[0];
  return `import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function ${baseName}Screen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Generated from ${imageName}</Text>
      </View>
      
      <View style={styles.card}>
        <Image 
          source={{ uri: 'data:image/placeholder' }} 
          style={styles.previewImage} 
        />
        <Text style={styles.cardTitle}>Preview</Text>
        <Text style={styles.cardText}>
          This UI was generated by analyzing your image.
        </Text>
      </View>
      
      <View style={styles.actions}>
        <button style={styles.buttonPrimary}>Get Started</button>
        <button style={styles.buttonSecondary}>Learn More</button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
});

// Generated by Nexus Alpha Multimodal AI
// Image analyzed: ${imageName}
// Timestamp: ${new Date().toISOString()}`;
}
