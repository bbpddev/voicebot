import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Upload, Trash2, Search, Tag, RefreshCw, X, FileText } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_COLORS = {
  network:  { color: '#00F0FF', bg: 'rgba(0,240,255,0.08)' },
  software: { color: '#7000FF', bg: 'rgba(112,0,255,0.08)' },
  hardware: { color: '#FF6B00', bg: 'rgba(255,107,0,0.08)' },
  access:   { color: '#FFD600', bg: 'rgba(255,214,0,0.08)' },
  email:    { color: '#00FF94', bg: 'rgba(0,255,148,0.08)' },
  general:  { color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)' },
};

export function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/kb`);
      setArticles(res.data);
    } catch (e) {
      console.error('Failed to fetch KB articles:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/api/kb/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadStatus({ type: 'success', message: `Created ${res.data.articles_created} articles from "${file.name}"` });
      fetchArticles();
    } catch (e) {
      setUploadStatus({ type: 'error', message: e.response?.data?.detail || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const deleteArticle = async (articleId) => {
    try {
      await axios.delete(`${API}/api/kb/${articleId}`);
      fetchArticles();
    } catch (e) {}
  };

  const filtered = articles.filter(a =>
    !search ||
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.content.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full" data-testid="knowledge-base-panel">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <BookOpen size={14} style={{ color: 'var(--primary)' }} />
        <h2 className="font-heading text-xs tracking-widest uppercase" style={{ color: 'var(--primary)' }}>Knowledge Base</h2>
        <span className="ml-auto font-mono text-xs" style={{ color: 'var(--text-faint)' }}>{articles.length} articles</span>
        <button onClick={fetchArticles} className="p-1 rounded transition-colors" data-testid="refresh-kb-btn">
          <RefreshCw size={12} style={{ color: 'var(--text-secondary)' }} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Upload zone */}
      <div
        className="mb-4 rounded-lg border-2 border-dashed p-3 text-center cursor-pointer transition-all"
        style={{
          borderColor: uploading ? 'var(--secondary)' : 'var(--primary-border-faint)',
          background: uploading ? 'var(--secondary-bg)' : 'transparent',
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files[0]); }}
        data-testid="kb-upload-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={e => handleUpload(e.target.files[0])}
          data-testid="kb-file-input"
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <RefreshCw size={14} style={{ color: 'var(--secondary)' }} className="animate-spin" />
            <span className="font-mono text-xs" style={{ color: 'var(--secondary)' }}>Processing with GPT-4.1...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Upload size={14} style={{ color: 'var(--primary)' }} />
            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              Drop PDF / DOCX / TXT to add to KB
            </span>
          </div>
        )}
      </div>

      {/* Upload status */}
      <AnimatePresence>
        {uploadStatus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2"
            style={{
              background: uploadStatus.type === 'success' ? 'rgba(0,255,148,0.08)' : 'rgba(255,0,60,0.08)',
              border: `1px solid ${uploadStatus.type === 'success' ? 'rgba(0,255,148,0.2)' : 'rgba(255,0,60,0.2)'}`,
            }}
            data-testid="upload-status"
          >
            <span className="font-mono text-xs flex-1"
              style={{ color: uploadStatus.type === 'success' ? '#00FF94' : '#FF003C' }}>
              {uploadStatus.message}
            </span>
            <button onClick={() => setUploadStatus(null)}>
              <X size={12} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={12} style={{ color: 'var(--text-muted)' }} className="absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded font-mono text-xs focus:outline-none"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            color: 'var(--text-secondary)',
          }}
          data-testid="kb-search-input"
        />
      </div>

      {/* Articles */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 && !loading && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-8">
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                {search ? 'No articles match your search' : 'No articles found'}
              </p>
            </motion.div>
          )}

          {filtered.map((article) => {
            const catCfg = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.general;
            const isExpanded = expanded === article.article_id;

            return (
              <motion.div
                key={article.article_id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
                data-testid={`kb-article-${article.article_id}`}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : article.article_id)}
                >
                  <FileText size={12} style={{ color: catCfg.color, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{article.title}</p>
                  </div>
                  <span
                    className="font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ color: catCfg.color, background: catCfg.bg, fontSize: '9px' }}
                  >
                    {article.article_id}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteArticle(article.article_id); }}
                    className="p-1 rounded hover:bg-red-500/10 transition-colors flex-shrink-0"
                    data-testid={`delete-kb-${article.article_id}`}
                  >
                    <Trash2 size={10} color="#FF003C60" />
                  </button>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-2 space-y-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                        <p className="font-mono text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                          {article.content}
                        </p>
                        {article.tags?.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Tag size={10} style={{ color: 'var(--text-muted)' }} />
                            {article.tags.map(tag => (
                              <span key={tag} className="font-mono text-xs px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '9px' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {article.source && article.source !== 'preloaded' && (
                          <p className="font-mono" style={{ fontSize: '9px', color: 'var(--text-faint)' }}>
                            Source: {article.source}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
