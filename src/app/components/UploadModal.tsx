'use client';
import { useState, useEffect } from 'react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

interface UploadProgress {
  status: 'pending' | 'uploading' | 'success' | 'error';
  chunks?: number;
  error?: string;
}

interface DuplicateFile {
  fileName: string;
  fileIndex: number;
  existingId: string;
}

interface DuplicateDecision {
  fileName: string;
  action: 'skip' | 'replace';
}

export default function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [uploading, setUploading] = useState(false);
  const [overallMessage, setOverallMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [existingDocuments, setExistingDocuments] = useState<Array<{ id: string; file_name: string }>>([]);
  const [duplicates, setDuplicates] = useState<DuplicateFile[]>([]);
  const [currentDuplicateIndex, setCurrentDuplicateIndex] = useState(0);
  const [duplicateDecisions, setDuplicateDecisions] = useState<DuplicateDecision[]>([]);
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    if (!isOpen) { 
      setFiles([]); 
      setUploadProgress({}); 
      setOverallMessage(null);
      setDuplicates([]);
      setCurrentDuplicateIndex(0);
      setDuplicateDecisions([]);
      setApplyToAll(false);
    } else {
      fetchExistingDocuments();
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const fetchExistingDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setExistingDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setUploadProgress({});
      setOverallMessage(null);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    const fileName = files[index].name;
    const newProgress = { ...uploadProgress };
    delete newProgress[fileName];
    setUploadProgress(newProgress);
  };

  const checkForDuplicates = (): DuplicateFile[] => {
    const foundDuplicates: DuplicateFile[] = [];
    
    files.forEach((file, index) => {
      const existing = existingDocuments.find(doc => doc.file_name === file.name);
      if (existing) {
        foundDuplicates.push({
          fileName: file.name,
          fileIndex: index,
          existingId: existing.id
        });
      }
    });

    return foundDuplicates;
  };

  const handleDuplicateDecision = (action: 'skip' | 'replace') => {
    const currentDuplicate = duplicates[currentDuplicateIndex];
    
    setDuplicateDecisions([
      ...duplicateDecisions,
      { fileName: currentDuplicate.fileName, action }
    ]);

    if (applyToAll) {
      // Apply decision to all remaining duplicates
      const remainingDuplicates = duplicates.slice(currentDuplicateIndex + 1);
      const newDecisions = remainingDuplicates.map(dup => ({
        fileName: dup.fileName,
        action
      }));
      setDuplicateDecisions(prev => [...prev, ...newDecisions]);
      setApplyToAll(false);
      proceedWithUpload([...duplicateDecisions, { fileName: currentDuplicate.fileName, action }, ...newDecisions]);
    } else if (currentDuplicateIndex < duplicates.length - 1) {
      setCurrentDuplicateIndex(currentDuplicateIndex + 1);
    } else {
      proceedWithUpload([...duplicateDecisions, { fileName: currentDuplicate.fileName, action }]);
    }
  };

  const proceedWithUpload = async (decisions: DuplicateDecision[]) => {
    setUploading(true);
    setDuplicates([]);
    setCurrentDuplicateIndex(0);
    setDuplicateDecisions([]);
    setOverallMessage(null);

    const initialProgress: Record<string, UploadProgress> = {};
    files.forEach(file => {
      initialProgress[file.name] = { status: 'pending' };
    });
    setUploadProgress(initialProgress);

    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;

    try {
      for (const file of files) {
        const decision = decisions.find(d => d.fileName === file.name);

        // Skip file if decided
        if (decision?.action === 'skip') {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'success', chunks: 0 }
          }));
          skippedCount++;
          continue;
        }

        // If replacing, delete old document first
        if (decision?.action === 'replace') {
          const duplicate = duplicates.find(dup => dup.fileName === file.name);
          if (duplicate) {
            await fetch(`/api/documents?id=${duplicate.existingId}`, {
              method: 'DELETE'
            });
          }
        }

        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'uploading' }
        }));

        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();

          if (data.success) {
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: { status: 'success', chunks: data.chunks }
            }));
            successCount++;
          } else {
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: { status: 'error', error: data.error || 'Upload failed' }
            }));
            failureCount++;
          }
        } catch (error: any) {
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { status: 'error', error: error.message || 'Upload failed' }
          }));
          failureCount++;
        }
      }

      let summaryText = `Uploaded ${successCount}/${files.length} files successfully.`;
      if (skippedCount > 0) summaryText += ` ${skippedCount} skipped.`;
      if (failureCount > 0) summaryText += ` ${failureCount} failed.`;
      
      setOverallMessage({ 
        type: failureCount === 0 ? 'success' : 'error', 
        text: summaryText 
      });

      if (failureCount === 0 && skippedCount === 0) {
        setTimeout(() => { onUploadSuccess?.(); onClose(); }, 1500);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setOverallMessage({ type: 'error', text: 'Please select at least one file' });
      return;
    }

    const foundDuplicates = checkForDuplicates();

    if (foundDuplicates.length > 0) {
      setDuplicates(foundDuplicates);
      setCurrentDuplicateIndex(0);
      setDuplicateDecisions([]);
      setApplyToAll(false);
      return;
    }

    proceedWithUpload([]);
  };

  if (!isOpen) return null;

  const totalFiles = files.length;
  const completedFiles = Object.values(uploadProgress).filter(p => p.status === 'success' || p.status === 'error').length;
  const successCount = Object.values(uploadProgress).filter(p => p.status === 'success').length;
  const currentDuplicate = duplicates.length > 0 ? duplicates[currentDuplicateIndex] : null;
  const isShowingDuplicateDialog = duplicates.length > 0 && currentDuplicateIndex < duplicates.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Upload Documents
          </h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Duplicate Dialog */}
        {isShowingDuplicateDialog && currentDuplicate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-800">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Duplicate File Found
                </h3>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                    A file named "<strong>{currentDuplicate.fileName}</strong>" already exists.
                  </p>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Duplicate {currentDuplicateIndex + 1} of {duplicates.length}
                </p>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    disabled={currentDuplicateIndex === duplicates.length - 1}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Apply to all remaining duplicates
                  </span>
                </label>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setDuplicates([]);
                    setCurrentDuplicateIndex(0);
                    setDuplicateDecisions([]);
                    setApplyToAll(false);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDuplicateDecision('skip')}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleDuplicateDecision('replace')}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium"
                >
                  Replace
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6" style={{ display: isShowingDuplicateDialog ? 'none' : 'block' }}>
          <div className="mb-6">
            <label htmlFor="upload-file-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select one or more files (PDF, DOCX, or TXT)
            </label>
            <input
              id="upload-file-input"
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900 dark:file:text-blue-300
                dark:hover:file:bg-blue-800
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {files.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Selected files: {files.length}
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, index) => {
                  const progress = uploadProgress[file.name];
                  return (
                    <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {progress && (
                          <>
                            {progress.status === 'uploading' && (
                              <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"></circle>
                                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {progress.status === 'success' && (
                              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                            {progress.status === 'error' && (
                              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                            {progress.status === 'pending' && !uploading && (
                              <button
                                onClick={() => removeFile(index)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {uploading && completedFiles > 0 && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                Progress: {completedFiles} of {totalFiles} files processed
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(completedFiles / totalFiles) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {uploading ? `Uploading... (${successCount}/${totalFiles} success)` : `Upload ${files.length > 0 ? files.length : 'Documents'}`}
          </button>

          {overallMessage && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                overallMessage.type === 'success'
                  ? 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {overallMessage.text}
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">Supported: PDF, DOCX, TXT</p>
            <p className="text-blue-700 dark:text-blue-400">Upload multiple files at once. Each file will be processed and embedded for RAG search.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

