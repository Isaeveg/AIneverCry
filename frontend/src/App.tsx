import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api/v1'
  : `http://${window.location.hostname}:4000/api/v1`;

const FileIcon = ({ type, isAlert }: { type: string, isAlert?: boolean }) => {
  const cls = isAlert ? "f-icon-alert" : `f-icon-${type.toLowerCase()}`;

  if (type === 'PDF') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="48" height="64" rx="2" ry="2"/>
      <text x="32" y="45" fontSize="20" fontWeight="bold" textAnchor="middle" fill="currentColor">PDF</text>
    </svg>
  );
  if (type === 'TXT') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="48" height="64" rx="2" ry="2"/>
      <line x1="16" y1="24" x2="48" y2="24" strokeLinecap="round"/>
      <line x1="16" y1="34" x2="48" y2="34" strokeLinecap="round"/>
      <line x1="16" y1="44" x2="48" y2="44" strokeLinecap="round"/>
      <line x1="16" y1="54" x2="36" y2="54" strokeLinecap="round"/>
    </svg>
  );
  if (type === 'CSV') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="48" height="64" rx="2" ry="2"/>
      <line x1="20" y1="26" x2="44" y2="26" strokeLinecap="round"/>
      <line x1="20" y1="38" x2="44" y2="38" strokeLinecap="round"/>
      <line x1="20" y1="50" x2="44" y2="50" strokeLinecap="round"/>
      <line x1="32" y1="26" x2="32" y2="56"/>
    </svg>
  );
  if (type === 'MD') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="48" height="64" rx="2" ry="2"/>
      <path d="M18 32 L22 40 L26 32" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M30 32 L34 40 L38 32" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="42" y1="32" x2="48" y2="40" strokeLinecap="round"/>
      <line x1="48" y1="32" x2="42" y2="40" strokeLinecap="round"/>
      <line x1="18" y1="50" x2="48" y2="50" strokeLinecap="round"/>
    </svg>
  );
  if (type === 'SVG') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="48" height="64" rx="2" ry="2"/>
      <circle cx="24" cy="36" r="6" fill="none"/>
      <path d="M36 26 Q40 32 36 42 Q32 32 36 26" fill="none"/>
      <line x1="42" y1="48" x2="50" y2="56" strokeLinecap="round"/>
    </svg>
  );
  if (type === 'JPG' || type === 'PNG') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="48" height="64" rx="2" ry="2"/>
      <circle cx="28" cy="28" r="4" fill="currentColor"/>
      <path d="M16 48 L28 32 L40 44 L52 28" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg className={`f-icon f-icon-gen ${isAlert ? 'f-icon-alert' : ''}`} viewBox="0 0 64 80" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="48" height="64" rx="2" ry="2"/>
    </svg>
  );
};

interface WorkspaceFile {
  id: string;
  jobId?: string;
  fileIndex?: number;
  name: string;
  type: string;
  statusColor: 'green' | 'orange' | 'red';
  size: string;
  date: string;
  desc: string;
  isMalicious?: boolean;
  extractedData?: any;
  errors?: string[];
  warnings?: string[];
  securityIssues?: any[];
}

function App() {
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pollingJobs, setPollingJobs] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pollingJobs.size === 0) return;

    const pollInterval = setInterval(async () => {
      const jobsToRemove: string[] = [];

      for (const jobId of pollingJobs) {
        try {
          const response = await axios.get(`${API_URL}/jobs/${jobId}`);
          const jobStatus = response.data;

          setWorkspaceFiles(prev => prev.map(file => {
            if (file.jobId === jobId) {
              let statusColor: 'green' | 'orange' | 'red' = 'orange';
              const fileData = jobStatus.files.find((f: any) => f.originalName === file.name);
              console.log(`[POLLING] File: ${file.name}, fileData:`, fileData);

              if (jobStatus.status === 'completed') {
                console.log(`[POLLING] Full fileData:`, JSON.stringify(fileData, null, 2));
                statusColor = fileData?.hasErrors || fileData?.isMalicious ? 'red' : 'green';
                jobsToRemove.push(jobId);
                return { ...file, statusColor, type: fileData?.detectedType || file.type };
              } else if (jobStatus.status === 'processing') {
                statusColor = 'orange';
              } else if (jobStatus.status === 'failed') {
                statusColor = 'red';
                jobsToRemove.push(jobId);
              }

              return { ...file, statusColor };
            }
            return file;
          }));
        } catch (err) {
          console.error(`Failed to poll job ${jobId}:`, err);
        }
      }

      if (jobsToRemove.length > 0) {
        setPollingJobs(prev => {
          const newSet = new Set(prev);
          jobsToRemove.forEach(id => newSet.delete(id));
          return newSet;
        });
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [pollingJobs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const SUPPORTED_FORMATS = ['pdf', 'txt', 'md', 'csv', 'svg', 'jpg', 'jpeg', 'png'];
    const invalidFiles: string[] = [];

    Array.from(e.target.files).forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !SUPPORTED_FORMATS.includes(ext)) {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      alert(`Invalid file formats:\n${invalidFiles.join('\n')}\n\nSupported: PDF, TXT, MD, CSV, SVG, JPG, PNG`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    const formData = new FormData();

    Array.from(e.target.files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(`${API_URL}/jobs`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const jobId = response.data.jobId;

      Array.from(e.target.files!).forEach((file, index) => {
        const newFile: WorkspaceFile = {
          id: `${jobId}-${index}`,
          jobId,
          fileIndex: index,
          name: file.name,
          type: file.name.split('.').pop()?.toUpperCase() || 'GEN',
          statusColor: 'orange',
          size: (file.size / 1024).toFixed(1) + ' KB',
          date: '',
          desc: ''
        };
        setWorkspaceFiles(prev => [newFile, ...prev]);
      });

      setPollingJobs(prev => new Set([...prev, jobId]));
    } catch (err) {
      console.error('Upload failed:', err);
      alert('File upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchJobData = async (jobId: string) => {
    try {
      const response = await axios.get(`${API_URL}/jobs/${jobId}`);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch job data:', err);
      return null;
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    const visibleIds = new Set(filtered.map(f => f.id));
    setSelectedFileIds(visibleIds);
  };

  const clearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const clearAllFiles = () => {
    setConfirmDialog({
      visible: true,
      title: 'Clear All Files',
      message: 'Are you sure? This will clear all files.',
      onConfirm: () => {
        setWorkspaceFiles([]);
        setSelectedFileIds(new Set());
        setSearchQuery('');
        setFilterStatus('All');
        setSelectedFile(null);
        setPollingJobs(new Set());
        setConfirmDialog(null);
      }
    });
  };

  const getStats = () => {
    const total = workspaceFiles.length;
    const clean = workspaceFiles.filter(f => f.statusColor === 'green').length;
    const warnings = workspaceFiles.filter(f => f.statusColor === 'red').length;
    const processing = workspaceFiles.filter(f => f.statusColor === 'orange').length;
    return { total, clean, warnings, processing };
  };

  const stats = getStats();

  const exportBatch = async () => {
    const toExport = selectedFileIds.size > 0
      ? workspaceFiles.filter(f => selectedFileIds.has(f.id))
      : workspaceFiles.filter(f => f.statusColor !== 'orange');

    if (toExport.length === 0) {
      alert('No files to export. Please select and process files first.');
      return;
    }

    const jobIds = [...new Set(toExport.map(f => f.jobId).filter(Boolean))];
    let allData = {
      system: 'AINEVERCRY Gateway',
      operator: 'Data Operator',
      timestamp: new Date().toISOString(),
      bundle_id: `EXP-${Date.now()}`,
      files: [] as any[]
    };

    for (const jobId of jobIds) {
      if (!jobId) continue;
      const jobData = await fetchJobData(jobId);
      if (jobData?.files) {
        const filesWithLocal = jobData.files
          .filter((backendFile: any) => toExport.some(f => f.name === backendFile.originalName))
          .map((backendFile: any) => {
            const localFile = toExport.find(f => f.name === backendFile.originalName);
            return {
              ...backendFile,
              metadata: {
                ...backendFile.metadata,
                operatorAnnotation: localFile?.desc || backendFile.metadata?.operatorAnnotation || ''
              }
            };
          });
        allData.files.push(...filesWithLocal);
      }
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `refinery_export_${allData.bundle_id}.json`;
    a.click();
    setSelectedFileIds(new Set());
  };

  const saveMetadata = async () => {
    if (!selectedFile || selectedFile.fileIndex === undefined || !selectedFile.jobId) return;

    try {
      await axios.put(`${API_URL}/jobs/${selectedFile.jobId}/annotation`, {
        fileIndex: selectedFile.fileIndex,
        annotation: editDesc
      });

      setWorkspaceFiles(prev => prev.map(f =>
        f.id === selectedFile.id ? { ...f, desc: editDesc } : f
      ));
      setSelectedFile(null);
    } catch (err) {
      console.error('Failed to save annotation:', err);
    }
  };

  const openReview = async (file: WorkspaceFile) => {
    setSelectedFile(file);
    setEditDesc(file.desc || '');

    if (file.jobId && file.fileIndex !== undefined) {
      const jobData = await fetchJobData(file.jobId);
      console.log(`[openReview] Fetched jobData:`, jobData);
      if (jobData?.files) {
        console.log(`[openReview] Looking for file at index: ${file.fileIndex} in ${jobData.files.length} files`);
        const fileData = jobData.files[file.fileIndex];
        console.log(`[openReview] Found fileData:`, fileData);
        if (fileData) {
          console.log(`[openReview] Setting extractedData...`);
          setSelectedFile(prev => prev ? { ...prev, extractedData: fileData } : null);
        }
      }
    }
  };

  const filtered = workspaceFiles.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'All' || f.statusColor === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderGrid = (list: WorkspaceFile[]) => (
    <div className="file-grid">
      {list.map(file => (
        <div key={file.id} className="file-card-wrapper">
          <input
            type="checkbox"
            className="file-checkbox"
            checked={selectedFileIds.has(file.id)}
            onChange={() => toggleFileSelection(file.id)}
          />
          <div className="file-card" onClick={() => openReview(file)}>
            <span className={`status-dot dot-${file.statusColor}`}></span>
            <div className="file-icon-container">
              <FileIcon type={file.type} isAlert={file.statusColor === 'red'} />
            </div>
            <div className="file-name">{file.name}</div>
            <div className="file-meta">{file.size}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const sanitizeDataForDisplay = (data: any) => {
    if (!data) return data;
    const copy = JSON.parse(JSON.stringify(data));
    if (copy.extracted?.rawContent) delete copy.extracted.rawContent;
    if (copy.extracted?.preview) delete copy.extracted.preview;
    if (copy.extracted?.beforeRedaction) delete copy.extracted.beforeRedaction;
    if (copy.extracted?.afterRedaction) delete copy.extracted.afterRedaction;
    return copy;
  };

  const generateSanitizationPreview = (file: WorkspaceFile): string => {
    if (!file.extractedData) return 'Processing...';

    const { extractedData } = file;
    const messages: string[] = [];

    const redactionDetails = extractedData.extracted?.redactionDetails || extractedData.redactionDetails;

    if (redactionDetails?.patternsRemoved && redactionDetails.patternsRemoved.length > 0) {
      const patterns = redactionDetails.patternsRemoved;
      messages.push(`✓ PII redacted: ${patterns.join(', ')}`);
    }

    if (extractedData.extracted?.type === 'IMAGE' || ['JPG', 'PNG'].includes(extractedData.type)) {
      const sanitizationStatus = extractedData.extracted?.sanitizationStatus || extractedData.sanitizationStatus;
      if (sanitizationStatus === 'COMPLETED') {
        messages.push('✓ Metadata removed');
      }
      const orig = extractedData.extracted?.dimensions?.original || extractedData.dimensions?.original;
      const norm = extractedData.extracted?.dimensions?.normalized || extractedData.dimensions?.normalized;

      if (orig && norm && (orig.width !== norm.width || orig.height !== norm.height)) {
        messages.push(`✓ Resized: ${orig.width}×${orig.height} → ${norm.width}×${norm.height}`);
      }
    }

    if (extractedData.type === 'SVG' && (extractedData.extracted?.sanitized || extractedData.sanitized)) {
      messages.push('✓ SVG sanitized');
    }

    if (messages.length === 0) {
      if (extractedData.securityIssues?.length > 0 || extractedData.extracted?.securityIssues?.length > 0) {
        return 'File contains security warnings. See details above.';
      }
      return 'No processing actions performed';
    }

    return messages.join('\n');
  };

  const renderEmptyState = () => (
    <div className="empty-state">
      <div className="empty-state-title">No files</div>
      <div className="empty-state-text">Upload documents to begin</div>
    </div>
  );

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand"><div className="brand-logo">AINEVERCRY</div></div>

        <div className="stats-card">
          <div className="stat-item">
            <div className="stat-label">Total</div>
            <div className="stat-number">{stats.total}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Clean</div>
            <div className="stat-number">{stats.clean}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Warnings</div>
            <div className="stat-number">{stats.warnings}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Processing</div>
            <div className="stat-number">{stats.processing}</div>
          </div>
        </div>

        <div style={{ flex: 1 }}></div>

        <button className="btn-clear-all" onClick={clearAllFiles} disabled={workspaceFiles.length === 0}>
          Clear All
        </button>
      </aside>

      <main className="main-wrapper">
        <header className="header">
          <div className="header-title">Data Refinery</div>
          <div className="header-actions">
            <button className="btn-outline" onClick={exportBatch} disabled={uploading}>Export</button>
            <input type="file" multiple ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </header>

        <section className="content-area">
          <>
            {workspaceFiles.length > 0 ? (
              <>
                <div className="toolbar">
                  <input className="search-input" placeholder="Search by filename..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="All">All Files</option>
                    <option value="green">Clean</option>
                    <option value="orange">Processing</option>
                    <option value="red">Warnings</option>
                  </select>
                </div>
                {filtered.length > 0 ? renderGrid(filtered) : renderEmptyState()}
                {filtered.length > 0 && (
                  <div className="selection-footer">
                    <span className="selection-count">{selectedFileIds.size} selected</span>
                    <div className="selection-buttons">
                      <button className="btn-outline btn-small" onClick={selectAllVisible}>Select All</button>
                      <button className="btn-outline btn-small" onClick={clearSelection}>Clear</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              renderEmptyState()
            )}
            </>
        </section>
      </main>

      {selectedFile && (
        <div className="modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>File Details</h2>
              <button onClick={() => setSelectedFile(null)}>×</button>
            </div>
            <div className="modal-body">
              {selectedFile.extractedData && (
                <>
                  <div className="view-panel">
                    <h3>Processing Status</h3>
                    <div className="processing-status-inline">
                      <div className="status-item">
                        <span className={`status-icon ${(selectedFile.extractedData?.errors?.length ?? 0) > 0 ? 'error' : ''}`}>
                          {(selectedFile.extractedData?.errors?.length ?? 0) > 0 ? '−' : '✓'}
                        </span>
                        <div>
                          <div className="status-label">Validation</div>
                          <div className="status-value">{(selectedFile.extractedData?.errors?.length ?? 0) > 0 ? 'FAILED' : 'PASSED'}</div>
                        </div>
                      </div>
                      <div className="status-item">
                        <span className={`status-icon ${(selectedFile.extractedData?.securityIssues?.length ?? 0) > 0 ? 'warning' : ''}`}>
                          {(selectedFile.extractedData?.securityIssues?.length ?? 0) > 0 ? '!' : '✓'}
                        </span>
                        <div>
                          <div className="status-label">Security</div>
                          <div className="status-value">{(selectedFile.extractedData?.securityIssues?.length ?? 0) > 0 ? 'WARNINGS' : 'SAFE'}</div>
                        </div>
                      </div>
                      <div className="status-item">
                        <span className={`status-icon ${selectedFile.extractedData?.extracted ? '' : 'error'}`}>
                          {selectedFile.extractedData?.extracted ? '✓' : '−'}
                        </span>
                        <div>
                          <div className="status-label">Extraction</div>
                          <div className="status-value">{selectedFile.extractedData?.extracted ? 'SUCCESS' : 'FAILED'}</div>
                        </div>
                      </div>
                      <div className="status-item">
                        <span className={`status-icon ${(selectedFile.extractedData?.extracted?.piiRedacted || selectedFile.extractedData?.processing?.piiRedacted) ? 'warning' : ''}`}>
                          {(selectedFile.extractedData?.extracted?.piiRedacted || selectedFile.extractedData?.processing?.piiRedacted) ? '!' : '✓'}
                        </span>
                        <div>
                          <div className="status-label">PII Check</div>
                          <div className="status-value">{(selectedFile.extractedData?.extracted?.piiRedacted || selectedFile.extractedData?.processing?.piiRedacted) ? 'REDACTED' : 'CLEAN'}</div>
                        </div>
                      </div>
                    </div>

                    {selectedFile.extractedData.securityIssues && selectedFile.extractedData.securityIssues.length > 0 && (
                      <div className="warnings-panel">
                        <div className="warnings-title">Security Issues</div>
                        <div className="warnings-list">
                          {selectedFile.extractedData.securityIssues.map((issue: any, i: number) => (
                            <div key={i} className="warning-item">{issue.message}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="view-panel">
                    <h3>Sanitized Content Preview</h3>
                    <div className="text-box">
                      {generateSanitizationPreview(selectedFile)}
                    </div>
                  </div>

                  <div className="view-panel">
                    <h3>Schema Output</h3>
                    <pre className="json-box">
                      {JSON.stringify(sanitizeDataForDisplay(selectedFile.extractedData), null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {!selectedFile.extractedData && (
                <div className="view-panel">
                  <h3>Schema Output (JSON)</h3>
                  <pre className="json-box">
                    {JSON.stringify({
                      id: selectedFile.id,
                      type: selectedFile.type,
                      secure: true,
                      annotation: editDesc,
                      system_meta: { size: selectedFile.size }
                    }, null, 2)}
                  </pre>
                </div>
              )}

              <div className="view-panel">
                <h3>Operator Annotation</h3>
                <input className="desc-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Provide context description..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedFile(null)}>Dismiss</button>
              <button className="btn-primary" onClick={saveMetadata}>Save Annotation</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog?.visible && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">{confirmDialog.title}</div>
            <div className="confirm-message">{confirmDialog.message}</div>
            <div className="confirm-buttons">
              <button className="btn-outline" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmDialog.onConfirm}>Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;