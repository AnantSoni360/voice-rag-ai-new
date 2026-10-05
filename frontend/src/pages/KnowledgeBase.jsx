import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, CheckCircle, XCircle, Loader,
  Trash2, Eye, Search, Send, Bot, AlertTriangle, RefreshCw, Layers
} from 'lucide-react';
import { toast } from '../components/Toast';
import { listDocuments, uploadDocument, deleteDocument, ragChat, collectionStats } from '../api/client';



const STATUS_ICON = {
  indexed:  { Icon: CheckCircle, color: 'var(--success)' },
  indexing: { Icon: Loader,      color: 'var(--warning)' },
  failed:   { Icon: XCircle,     color: 'var(--error)' },
};

const PLAYGROUND_EXAMPLES = [
  'What is the price of the Enterprise plan?',
  'Enterprise plan 200 employees के लिए suitable है?',
  'What is the refund policy?',
  'Do you offer white-labeling?',
];

function DocStatusBadge({ status }) {
  const { Icon, color } = STATUS_ICON[status] || STATUS_ICON.indexed;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color, fontSize: 12, fontWeight: 600 }}>
      <Icon size={13} style={status === 'indexing' ? { animation: 'spin 1s linear infinite' } : {}} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </div>
  );
}

export default function KnowledgeBase() {
  const [docs, setDocs] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState('');
  const [qaResult, setQaResult] = useState(null);
  const [qaLoading, setQaLoading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    try {
      const [docsRes] = await Promise.all([listDocuments(), collectionStats()]);
      setDocs(docsRes.data);
    } catch (e) {
      console.error('Failed to fetch documents:', e);
      // Backend not yet running — show empty state gracefully
      setDocs([]);
    }
  }, []);

  useEffect(() => { 
    let mounted = true;
    if (mounted) fetchDocs(); 
    return () => { mounted = false; };
  }, [fetchDocs]);

  // Poll every 5s to detect indexing completion
  useEffect(() => {
    const hasIndexing = docs.some(d => d.status === 'indexing');
    if (!hasIndexing) return;
    const t = setTimeout(fetchDocs, 5000);
    return () => clearTimeout(t);
  }, [docs, fetchDocs]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || e.target?.files || []);
    const valid = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf') || f.name.endsWith('.txt'));
    if (!valid.length) {
      toast.error('Unsupported Format', 'Only PDF and TXT files are supported.');
      return;
    }
    for (const file of valid) {
      toast.info('Uploading', `${file.name} — sending to server…`);
      try {
        await uploadDocument(file);
        toast.success('Upload Complete', `${file.name} is being indexed.`);
        await fetchDocs();
      } catch (err) {
        toast.error('Upload Failed', err.response?.data?.detail || err.message);
      }
    }
  }, [fetchDocs]);

  const handleQuery = async () => {
    if (!query.trim()) return;
    setQaLoading(true);
    setQaResult(null);
    try {
      const { data } = await ragChat({
        message: query,
        language: 'hi-en',
        conversation_history: [],
        use_fast_model: true,
      });
      setQaResult({
        answer: data.answer,
        source: data.sources?.[0]?.document || null,
        section: data.sources?.[0]?.section || null,
        confidence: Math.round((data.confidence || 0) * 100),
        found: data.found,
        question: query,
      });
    } catch (err) {
      toast.error('Query Failed', err.response?.data?.detail || err.message);
    } finally {
      setQaLoading(false);
    }
  };

  const deleteDoc = async (id, name) => {
    try {
      await deleteDocument(id);
      setDocs(prev => prev.filter(d => d.id !== id));
      toast.warning('Deleted', `${name} removed from knowledge base.`);
      fetchDocs();
    } catch (err) {
      toast.error('Delete Failed', err.response?.data?.detail || err.message);
    }
  };

  return (
    <div className="page-content">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">Knowledge <span>Base</span></h1>
          <p className="page-desc">Upload company documents and test retrieval accuracy.</p>
        </div>
        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} id="upload-btn">
          <Upload size={14} /> Upload Documents
        </button>
        <input
          ref={fileInputRef} type="file" accept=".pdf,.txt" multiple style={{ display: 'none' }}
          onChange={handleDrop}
          id="file-upload-input"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Upload Zone */}
        <motion.div
          className={`upload-zone ${dragging ? 'drag-over' : ''}`}
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          id="upload-dropzone"
          style={{ cursor: 'pointer', minHeight: 200 }}
        >
          <div className="upload-icon">
            <Upload size={28} />
          </div>
          <div className="upload-title">
            {dragging ? 'Drop files here' : 'Drag & Drop Documents'}
          </div>
          <div className="upload-desc" style={{ marginTop: 6 }}>
            Supports PDF and TXT files up to 50 MB
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Product Guides', 'FAQs', 'Pricing Tables', 'Policies'].map(tag => (
              <span key={tag} className="badge badge-orange">{tag}</span>
            ))}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        >
          <div className="card-header">
            <div className="card-title">Index Statistics</div>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Total Documents', value: docs.length, color: 'var(--text-primary)' },
              { label: 'Indexed Chunks', value: docs.reduce((a, d) => a + (d.chunks || 0), 0), color: 'var(--success)' },
              { label: 'Indexing', value: docs.filter(d => d.status === 'indexing').length, color: 'var(--warning)' },
              { label: 'Failed', value: docs.filter(d => d.status === 'failed').length, color: 'var(--error)' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '14px', background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', textAlign: 'center'
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Document List */}
      <motion.div
        className="table-wrap"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        style={{ marginBottom: 20 }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Uploaded Documents</div>
          <button className="btn btn-ghost btn-sm">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Size</th>
              <th>Pages</th>
              <th>Chunks</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc, i) => (
              <motion.tr
                key={doc.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                      background: 'var(--orange-50)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--orange-500)', flexShrink: 0
                    }}>
                      <FileText size={15} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.name}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{doc.size}</td>
                <td style={{ fontSize: 12.5 }}>{doc.pages}</td>
                <td>
                  {doc.status === 'indexing'
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-pill" style={{ width: 80 }}>
                          <motion.div
                            className="progress-fill"
                            animate={{ width: ['20%', '90%'] }}
                            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                          />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>…</span>
                      </div>
                    : <span style={{ fontSize: 12.5, fontWeight: 600 }}>{doc.chunks || '—'}</span>}
                </td>
                <td><DocStatusBadge status={doc.status} /></td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doc.uploaded}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" id={`view-doc-${doc.id}`}><Eye size={13} /></button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: 'var(--error)' }}
                      onClick={() => deleteDoc(doc.id, doc.name)}
                      id={`delete-doc-${doc.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Playground */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      >
        <div className="card-header">
          <div>
            <div className="card-title">RAG Testing Playground</div>
            <div className="card-subtitle">Test retrieval accuracy against your knowledge base</div>
          </div>
          <Layers size={16} color="var(--text-muted)" />
        </div>
        <div className="card-body">
          {/* Example queries */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {PLAYGROUND_EXAMPLES.map(ex => (
              <button
                key={ex}
                className="filter-btn"
                onClick={() => setQuery(ex)}
                style={{ fontSize: 11 }}
              >{ex}</button>
            ))}
          </div>

          {/* Query input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="search-wrap" style={{ flex: 1 }}>
              <Search size={13} className="search-icon" />
              <input
                className="form-input search-input"
                placeholder="Ask a question to test retrieval… (Hindi or English)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuery()}
                id="playground-query"
              />
            </div>
            <button className="btn btn-primary" onClick={handleQuery} disabled={qaLoading} id="playground-submit-btn">
              {qaLoading ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              Test
            </button>
          </div>

          {/* Result */}
          <AnimatePresence>
            {qaLoading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                style={{ marginTop: 16 }}
              >
                <div style={{
                  padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13
                }}>
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Retrieving relevant chunks and generating answer…
                </div>
              </motion.div>
            )}

            {qaResult && !qaLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ marginTop: 16 }}
              >
                {qaResult.found ? (
                  <div style={{
                    padding: 16, background: 'var(--success-bg)',
                    borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.15)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Bot size={16} color="var(--success)" />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Answer Found · {qaResult.confidence}% Confidence
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12 }}>
                      {qaResult.answer}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                      background: 'white', borderRadius: 'var(--radius-sm)', fontSize: 11.5,
                      color: 'var(--orange-700)', border: '1px solid var(--orange-100)'
                    }}>
                      <FileText size={10} /> {qaResult.source} · {qaResult.section}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: 16, background: 'var(--warning-bg)',
                    borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.15)',
                    display: 'flex', alignItems: 'flex-start', gap: 10
                  }}>
                    <AlertTriangle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>
                        No relevant document found
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        This question doesn't match any indexed content. Consider uploading a relevant document or adding this to the FAQ.
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
