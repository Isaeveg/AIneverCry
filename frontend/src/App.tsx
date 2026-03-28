import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:4000/api/v1';

const FileIcon = ({ type, isAlert }: { type: string, isAlert?: boolean }) => {
  const cls = isAlert ? "f-icon-alert" : `f-icon-${type.toLowerCase()}`;
  if (type === 'PDF') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 24 24"><path d="M11.363 2.028a3.44 3.44 0 0 0-2.726 0l-5.36 2.112C2.083 4.632 1.25 5.56 1.25 6.623v10.754c0 1.063.833 1.991 2.027 2.483l5.36 2.112a3.44 3.44 0 0 0 2.726 0l5.36-2.112c1.194-.492 2.027-1.42 2.027-2.483V6.623c0-1.063-.833-1.991-2.027-2.483zm.887 2.071L17.25 6.25l-2.5 1L9.75 5.148zM3.25 6.623c0-.181.1-.394.473-.564l5.277-2.08v4.209l-5.75-2.3Zm0 10.754V7.992l5.75 2.3v4.209l-5.277 2.08c-.373.17-.473-.043-.473-.224zm11.25.224-5.277 2.08v-4.209l5.75-2.3V17.6c0 .181-.1.394-.473.564zm1.25-2.754-5.75 2.3v-4.209l5.277-2.08c.373-.17.473.043.473.224Z"/></svg>
  );
  if (type === 'CSV') return (
    <svg className={`f-icon ${cls}`} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1.8 18H14v-2h1.8v2zm0-4H14v-2h1.8v2zm0-4H14V8h1.8v2zM13 9V3.5L18.5 9H13z"/></svg>
  );
  return (
    <svg className={`f-icon f-icon-gen ${isAlert ? 'f-icon-alert' : ''}`} viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
  );
};

interface WorkspaceFile {
  id: string;
  jobId?: string;
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
}

const historyFiles: WorkspaceFile[] = [
  { id: '101', name: 'legacy_data_backup_2024.pdf', type: 'PDF', statusColor: 'green', size: '15 MB', date: 'Jan 20, 2026', desc: 'Archived system snapshot' },
];

function App() {
  const [activeTab, setActiveTab] = useState('Workspace');
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pollingJobs, setPollingJobs] = useState<Set<string>>(new Set());
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

              if (jobStatus.status === 'completed') {
                statusColor = fileData?.isMalicious ? 'red' : 'green';
                jobsToRemove.push(jobId);
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
          name: file.name,
          type: file.name.split('.').pop()?.toUpperCase() || 'GEN',
          statusColor: 'orange',
          size: (file.size / 1024).toFixed(1) + ' KB',
          date: 'Just now',
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
      const response = await axios.get(`${API_URL}/jobs/${jobId}/export`);
      return response.data;
    } catch (err) {
      console.error('Failed to fetch job data:', err);
      return null;
    }
  };

  const exportBatch = async () => {
    const refined = workspaceFiles.filter(f => f.statusColor === 'green');
    if (refined.length === 0) return;

    const jobIds = [...new Set(refined.map(f => f.jobId).filter(Boolean))];
    let allData = {
      system: "Data Refinery Gateway",
      operator: "AIneverCry Team",
      timestamp: new Date().toISOString(),
      bundle_id: `BCK-${Date.now()}`,
      files: [] as any[]
    };

    for (const jobId of jobIds) {
      const jobData = await fetchJobData(jobId);
      if (jobData?.files) {
        allData.files.push(...jobData.files);
      }
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `refinery_export_${allData.bundle_id}.json`;
    a.click();
  };

  const saveMetadata = () => {
    if (selectedFile) {
      setWorkspaceFiles(prev => prev.map(f =>
        f.id === selectedFile.id ? { ...f, desc: editDesc } : f
      ));
      setSelectedFile(null);
    }
  };

  const openReview = async (file: WorkspaceFile) => {
    setSelectedFile(file);
    setEditDesc(file.desc || '');

    if (file.jobId && file.statusColor === 'green') {
      const jobData = await fetchJobData(file.jobId);
      if (jobData?.files) {
        const fileData = jobData.files.find((f: any) => f.originalName === file.name);
        if (fileData) {
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

  const renderGrid = (list: WorkspaceFile[], showAdd = false) => (
    <div className="file-grid">
      {list.map(file => (
        <div key={file.id} className="file-card" onClick={() => openReview(file)}>
          <span className={`status-dot dot-${file.statusColor}`}></span>
          <div className="file-icon-container">
            <FileIcon type={file.type} isAlert={file.statusColor === 'red'} />
          </div>
          <div className="file-name">{file.name}</div>
          <div className="file-meta">{file.size} • {file.date}</div>
        </div>
      ))}
      {showAdd && (
        <div className="file-card upload-card-empty" onClick={() => fileInputRef.current?.click()}>
          <div className="file-icon-container"><div className="upload-icon-big">+</div></div>
          <div className="file-name">Ingest File</div>
          <div className="file-meta">Click to upload</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand"><div className="brand-logo">AIneverCry</div></div>
        <nav className="nav-links">
          {['Workspace', 'History', 'Settings'].map(tab => (
            <button key={tab} className={`nav-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-wrapper">
        <header className="header">
          <div className="header-title">{activeTab}</div>
          {activeTab === 'Workspace' && (
            <div className="header-actions">
              <button className="btn-outline" onClick={exportBatch} disabled={uploading}>Commit Batch</button>
              <input type="file" multiple ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
              <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Ingest Data'}
              </button>
            </div>
          )}
        </header>

        <section className="content-area">
          {activeTab === 'Workspace' && (
            <>
              <div className="toolbar">
                <input className="search-input" placeholder="Search by filename..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="All">All Entities</option>
                  <option value="green">Refined</option>
                  <option value="orange">Processing</option>
                  <option value="red">Security Alerts</option>
                </select>
              </div>
              {renderGrid(filtered, !uploading && filterStatus === 'All' && searchQuery === '')}
            </>
          )}
          {activeTab === 'History' && renderGrid(historyFiles)}
          {activeTab === 'Settings' && <div style={{color: '#666', fontSize: '0.9rem', padding: '1rem'}}>System configuration panel restricted.</div>}
        </section>
      </main>

      {selectedFile && (
        <div className="modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Data Object Review</h2>
              <button onClick={() => setSelectedFile(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="view-panel">
                <h3>Operator Annotation</h3>
                <input className="desc-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Provide context description..." />
                <h3>Sanitized Content Preview</h3>
                <div className="text-box">
                  {selectedFile.extractedData?.content
                    ? selectedFile.extractedData.content.substring(0, 500)
                    : 'Content extraction successful. PII data redacted. Data integrity verified. [SECURE_MODE]'}
                </div>
              </div>
              <div className="view-panel">
                <h3>Schema Output (JSON)</h3>
                <pre className="json-box">
                  {selectedFile.extractedData
                    ? JSON.stringify({
                        id: selectedFile.extractedData.id,
                        type: selectedFile.type,
                        secure: selectedFile.extractedData.secure,
                        annotation: editDesc,
                        processing: selectedFile.extractedData.processing,
                        warnings: selectedFile.extractedData.warnings,
                        metadata: selectedFile.extractedData.metadata
                      }, null, 2)
                    : JSON.stringify({
                        id: selectedFile.id,
                        type: selectedFile.type,
                        secure: true,
                        annotation: editDesc,
                        system_meta: { size: selectedFile.size }
                      }, null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedFile(null)}>Dismiss</button>
              <button className="btn-primary" onClick={saveMetadata}>Approve & Commit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;