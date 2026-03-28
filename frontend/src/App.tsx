import { useState, useRef } from 'react';
import './App.css';

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

const initialWorkspaceFiles = [
  { id: 1, name: 'q4_financial_statement.pdf', type: 'PDF', statusColor: 'green', size: '2.4 MB', date: '12 min ago', desc: 'Verified financial data for auditing' },
  { id: 2, name: 'raw_user_activity_log.csv', type: 'CSV', statusColor: 'orange', size: '42 KB', date: 'Just now', desc: '' },
  { id: 3, name: 'network_integrity_check.exe', type: 'EXE', statusColor: 'red', size: '1.1 MB', date: '1 min ago', desc: '' },
];

const historyFiles = [
  { id: 101, name: 'legacy_data_backup_2024.pdf', type: 'PDF', statusColor: 'green', size: '15 MB', date: 'Jan 20, 2026', desc: 'Archived system snapshot' },
];

function App() {
  const [activeTab, setActiveTab] = useState('Workspace');
  const [workspaceFiles, setWorkspaceFiles] = useState(initialWorkspaceFiles);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [editDesc, setEditDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const uploaded = Array.from(e.target.files);
    uploaded.forEach((file, index) => {
      const name = file.name;
      const ext = name.split('.').pop()?.toUpperCase() || 'GEN';
      let statusColor = 'orange';
      if (name.toLowerCase().includes('.exe') || name.split('.').length > 2) statusColor = 'red';
      const newFile = {
        id: Date.now() + index,
        name, type: ext, statusColor,
        size: (file.size / 1024).toFixed(1) + ' KB',
        date: 'Just now', desc: ''
      };
      setWorkspaceFiles(prev => [newFile, ...prev]);
      if (statusColor === 'orange') {
        setTimeout(() => {
          setWorkspaceFiles(prev => prev.map(f => f.id === newFile.id ? { ...f, statusColor: 'green' } : f));
        }, 2500);
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportBatch = () => {
    const refined = workspaceFiles.filter(f => f.statusColor === 'green');
    if (refined.length === 0) return;
    const data = {
      system: "Data Refinery Gateway",
      operator: "AIneverCry Team",
      timestamp: new Date().toISOString(),
      bundle_id: `BCK-${Date.now()}`,
      files: refined.map(f => ({ name: f.name, type: f.type, secure: true, meta_desc: f.desc }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `refinery_export_${data.bundle_id}.json`;
    a.click();
  };

  const saveMetadata = () => {
    setWorkspaceFiles(prev => prev.map(f => f.id === selectedFile.id ? { ...f, desc: editDesc } : f));
    setSelectedFile(null);
  };

  const openReview = (file: any) => {
    setSelectedFile(file);
    setEditDesc(file.desc || '');
  };

  const filtered = workspaceFiles.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'All' || f.statusColor === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderGrid = (list: any[], showAdd = false) => (
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
              <button className="btn-outline" onClick={exportBatch}>Commit Batch</button>
              <input type="file" multiple ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
              <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>Ingest Data</button>
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
              {renderGrid(filtered, searchQuery === '' && filterStatus === 'All')}
            </>
          )}
          {activeTab === 'History' && renderGrid(historyFiles)}
          {activeTab === 'Settings' && <div style={{color: '#666', fontSize: '0.8vw'}}>System configuration panel restricted.</div>}
        </section>
      </main>

      {selectedFile && (
        <div className="modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Data Object Review: {selectedFile.name}</h2>
              <button className="close-modal" onClick={() => setSelectedFile(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="view-panel">
                <h3>Operator Annotation</h3>
                <input className="desc-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Provide context description..." />
                <h3>Sanitized Content Preview</h3>
                <div className="text-box">Content extraction successful. PII data redacted. Data integrity verified. [SECURE_MODE]</div>
              </div>
              <div className="view-panel">
                <h3>Schema Output (JSON)</h3>
                <pre className="json-box">{JSON.stringify({uuid: selectedFile.id, type: selectedFile.type, secure: true, annotation: editDesc, system_meta: {size: selectedFile.size}}, null, 2)}</pre>
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