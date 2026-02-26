import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, BookOpen, Save, RotateCcw, ChevronLeft,
  Plus, Pencil, Trash2, X, Check, Tag, Info, Mic, Users, Eye, EyeOff
} from 'lucide-react';
import axios from 'axios';
import { Toaster, toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const VOICE_OPTIONS = [
  { value: 'Rex', label: 'Rex — Professional Male' },
  { value: 'Ara', label: 'Ara — Warm Female' },
  { value: 'Leo', label: 'Leo — Friendly Male' },
  { value: 'Eve', label: 'Eve — Clear Female' },
  { value: 'Sal', label: 'Sal — Calm Male' },
];

const CATEGORIES = ['network', 'software', 'hardware', 'access', 'email', 'general'];

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState('prompt');
  const [config, setConfig] = useState(null);
  const [articles, setArticles] = useState([]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [showNewArticle, setShowNewArticle] = useState(false);
  const [promptDirty, setPromptDirty] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showNewUser, setShowNewUser] = useState(false);

  const authToken = localStorage.getItem('auth_token');
  const authHeaders = authToken ? { Authorization: `Bearer ${authToken}` } : {};

  const loadConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/admin/config`);
      setConfig(res.data);
      setPromptDirty(false);
    } catch (e) {
      toast.error('Failed to load config');
    }
  }, []);

  const loadArticles = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/kb`);
      setArticles(res.data);
    } catch (e) {
      toast.error('Failed to load KB articles');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API}/api/admin/users`, { headers });
      setUsers(res.data);
    } catch (e) {
      toast.error('Failed to load users');
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadArticles();
    loadUsers();
  }, [loadConfig, loadArticles, loadUsers]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/admin/config`, {
        system_prompt: config.system_prompt,
        voice: config.voice,
        agent_name: config.agent_name,
      });
      toast.success('Configuration saved — changes apply on next voice session', {
        style: { background: '#0a0a0a', border: '1px solid rgba(0,255,148,0.3)', color: '#00FF94' },
      });
      setPromptDirty(false);
    } catch (e) {
      toast.error('Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const resetPrompt = async () => {
    try {
      const res = await axios.post(`${API}/api/admin/config/reset`);
      setConfig(prev => ({ ...prev, system_prompt: res.data.system_prompt, voice: res.data.voice, agent_name: res.data.agent_name }));
      setPromptDirty(false);
      toast.success('Prompt reset to default');
    } catch (e) {
      toast.error('Failed to reset prompt');
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#050505' }}>
        <div className="font-mono text-xs text-gray-600 animate-pulse">Loading admin portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#050505' }}>
      <Toaster position="top-right" />
      <div className="scan-line" />

      {/* Header */}
      <header className="border-b px-6 py-3 flex items-center gap-4"
        style={{ borderColor: 'rgba(112,0,255,0.2)', background: 'rgba(5,5,5,0.98)' }}>
        <a href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity" data-testid="back-to-app">
          <ChevronLeft size={14} color="#9CA3AF" />
          <span className="font-mono text-xs text-gray-500">Back to Agent</span>
        </a>
        <div className="h-4 w-px bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: 'rgba(112,0,255,0.15)', border: '1px solid rgba(112,0,255,0.4)' }}>
            <Settings size={12} color="#7000FF" />
          </div>
          <h1 className="font-heading text-sm tracking-widest text-white uppercase" data-testid="admin-title">
            Admin Portal
          </h1>
        </div>
        <div className="ml-auto font-mono text-xs text-gray-600">
          IT Service Desk Voice Agent
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-8">
          {[
            { id: 'prompt', label: 'Voice Agent Config', icon: Settings },
            { id: 'kb', label: 'Knowledge Base', icon: BookOpen },
            { id: 'users', label: 'Users', icon: Users },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`admin-tab-${tab.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-heading text-xs uppercase tracking-wider transition-all"
                style={
                  activeTab === tab.id
                    ? { background: 'rgba(112,0,255,0.15)', color: '#7000FF', border: '1px solid rgba(112,0,255,0.35)' }
                    : { background: 'rgba(255,255,255,0.02)', color: '#6B7280', border: '1px solid rgba(255,255,255,0.06)' }
                }
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'prompt' ? (
            <motion.div key="prompt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <PromptEditor
                config={config}
                setConfig={setConfig}
                saving={saving}
                dirty={promptDirty}
                setDirty={setPromptDirty}
                onSave={saveConfig}
                onReset={resetPrompt}
              />
            </motion.div>
          ) : activeTab === 'kb' ? (
            <motion.div key="kb" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <KBEditor
                articles={articles}
                onRefresh={loadArticles}
                editingArticle={editingArticle}
                setEditingArticle={setEditingArticle}
                showNewArticle={showNewArticle}
                setShowNewArticle={setShowNewArticle}
              />
            </motion.div>
          ) : (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <UsersEditor
                users={users}
                onRefresh={loadUsers}
                authHeaders={authHeaders}
                editingUser={editingUser}
                setEditingUser={setEditingUser}
                showNewUser={showNewUser}
                setShowNewUser={setShowNewUser}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- Prompt Editor ----
function PromptEditor({ config, setConfig, saving, dirty, setDirty, onSave, onReset }) {
  const charCount = config.system_prompt.length;
  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg"
        style={{ background: 'rgba(112,0,255,0.06)', border: '1px solid rgba(112,0,255,0.2)' }}>
        <Info size={14} color="#7000FF" className="mt-0.5 flex-shrink-0" />
        <p className="font-mono text-xs text-gray-400 leading-relaxed">
          Changes to the system prompt and voice settings apply to the <strong className="text-white">next voice session</strong>. 
          Use the system prompt to set the agent's name, scope, guardrails, company name, and behaviour.
        </p>
      </div>

      {/* Agent Name & Voice row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel rounded-xl p-5">
          <label className="font-heading text-xs text-gray-500 uppercase tracking-widest block mb-3">
            Agent Name
          </label>
          <input
            type="text"
            value={config.agent_name}
            onChange={e => { setConfig(p => ({ ...p, agent_name: e.target.value })); setDirty(true); }}
            className="w-full px-3 py-2.5 rounded-lg font-mono text-sm border focus:outline-none transition-colors"
            style={{
              background: '#0d0d14',
              color: '#e2e8f0',
              borderColor: 'rgba(255,255,255,0.1)',
              WebkitTextFillColor: '#e2e8f0',
            }}
            placeholder="e.g. Rex, Aria, Max..."
            data-testid="agent-name-input"
          />
          <p className="font-mono text-xs text-gray-600 mt-2">
            Display name shown in the UI
          </p>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <label className="font-heading text-xs text-gray-500 uppercase tracking-widest block mb-3 flex items-center gap-2">
            <Mic size={11} />
            Voice
          </label>
          <select
            value={config.voice}
            onChange={e => { setConfig(p => ({ ...p, voice: e.target.value })); setDirty(true); }}
            className="w-full px-3 py-2.5 rounded-lg font-mono text-sm border focus:outline-none transition-colors appearance-none cursor-pointer"
            style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)' }}
            data-testid="voice-select"
          >
            {VOICE_OPTIONS.map(v => (
              <option key={v.value} value={v.value} style={{ background: '#0d0d14' }}>{v.label}</option>
            ))}
          </select>
          <p className="font-mono text-xs text-gray-600 mt-2">
            xAI Grok voice personality
          </p>
        </div>
      </div>

      {/* System Prompt */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="font-heading text-xs text-gray-500 uppercase tracking-widest">
            System Prompt / Guardrails
          </label>
          <span className="font-mono text-xs text-gray-600">{charCount} chars</span>
        </div>

        <textarea
          value={config.system_prompt}
          onChange={e => { setConfig(p => ({ ...p, system_prompt: e.target.value })); setDirty(true); }}
          rows={18}
          className="w-full px-4 py-3 rounded-lg font-mono text-sm leading-relaxed border focus:outline-none resize-none transition-colors"
          placeholder="Define the agent's identity, scope, guardrails, and behaviour..."
          data-testid="system-prompt-textarea"
          style={{
            background: '#0d0d14',
            color: '#e2e8f0',
            borderColor: 'rgba(255,255,255,0.1)',
            lineHeight: '1.7',
            WebkitTextFillColor: '#e2e8f0',
          }}
        />

        <p className="font-mono text-xs text-gray-600 mt-2 leading-relaxed">
          Tip: Define the agent name, company name, scope (what topics to answer / avoid), tone, language, escalation rules, and any specific IT policies.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={onSave}
          disabled={saving || !dirty}
          whileHover={!saving && dirty ? { scale: 1.02 } : {}}
          whileTap={!saving && dirty ? { scale: 0.98 } : {}}
          data-testid="save-config-btn"
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-heading text-xs uppercase tracking-widest transition-all disabled:opacity-40"
          style={{
            background: dirty ? 'rgba(0,255,148,0.1)' : 'rgba(255,255,255,0.04)',
            color: dirty ? '#00FF94' : '#6B7280',
            border: `1px solid ${dirty ? 'rgba(0,255,148,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {saving ? (
            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={12} />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </motion.button>

        <button
          onClick={onReset}
          data-testid="reset-prompt-btn"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs transition-all hover:opacity-80"
          style={{ background: 'rgba(255,0,60,0.06)', color: '#FF003C', border: '1px solid rgba(255,0,60,0.2)' }}
        >
          <RotateCcw size={11} />
          Reset to Default
        </button>

        {!dirty && (
          <span className="font-mono text-xs text-success/60 flex items-center gap-1 ml-2">
            <Check size={11} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

// ---- KB Editor ----
function KBEditor({ articles, onRefresh, editingArticle, setEditingArticle, showNewArticle, setShowNewArticle }) {
  const [search, setSearch] = useState('');

  const filtered = articles.filter(a =>
    !search ||
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags || []).join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-3 py-2 rounded-lg font-mono text-xs border focus:outline-none"
            style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', WebkitTextFillColor: '#e2e8f0' }}
            data-testid="admin-kb-search"
          />
        </div>
        <span className="font-mono text-xs text-gray-600">{articles.length} articles</span>
        <motion.button
          onClick={() => { setShowNewArticle(true); setEditingArticle(null); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          data-testid="new-article-btn"
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg font-heading text-xs uppercase tracking-wider"
          style={{ background: 'rgba(0,240,255,0.1)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.3)' }}
        >
          <Plus size={12} />
          New Article
        </motion.button>
      </div>

      {/* Article list */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full" data-testid="kb-articles-table">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {['ID', 'Title', 'Category', 'Tags', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-heading text-xs text-gray-600 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-mono text-xs text-gray-600">
                  No articles found
                </td>
              </tr>
            )}
            {filtered.map((article, idx) => (
              <ArticleRow
                key={article.article_id}
                article={article}
                idx={idx}
                onEdit={() => { setEditingArticle(article); setShowNewArticle(false); }}
                onDelete={async () => {
                  await axios.delete(`${API}/api/kb/${article.article_id}`);
                  onRefresh();
                  toast.success(`Deleted ${article.article_id}`);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / New Article modal */}
      <AnimatePresence>
        {(editingArticle || showNewArticle) && (
          <ArticleModal
            article={editingArticle}
            onClose={() => { setEditingArticle(null); setShowNewArticle(false); }}
            onSaved={() => { setEditingArticle(null); setShowNewArticle(false); onRefresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const CATEGORY_COLORS = {
  network: '#00F0FF', software: '#7000FF', hardware: '#FF6B00',
  access: '#FFD600', email: '#00FF94', general: '#9CA3AF',
};

function ArticleRow({ article, idx, onEdit, onDelete }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: idx * 0.03 }}
      className="hover:bg-white/2 transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
      data-testid={`admin-article-row-${article.article_id}`}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-500">{article.article_id}</span>
      </td>
      <td className="px-4 py-3 max-w-xs">
        <span className="font-body text-sm text-gray-200 truncate block">{article.title}</span>
      </td>
      <td className="px-4 py-3">
        <span
          className="font-mono text-xs px-2 py-0.5 rounded capitalize"
          style={{
            color: CATEGORY_COLORS[article.category] || '#9CA3AF',
            background: `${CATEGORY_COLORS[article.category] || '#9CA3AF'}15`,
          }}
        >
          {article.category}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(article.tags || []).slice(0, 3).map(tag => (
            <span key={tag} className="font-mono text-gray-600 px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.04)', fontSize: '10px' }}>
              {tag}
            </span>
          ))}
          {(article.tags || []).length > 3 && (
            <span className="font-mono text-gray-700" style={{ fontSize: '10px' }}>
              +{article.tags.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            data-testid={`edit-${article.article_id}`}
            className="p-1.5 rounded hover:bg-cyan-500/10 transition-colors"
            title="Edit article"
          >
            <Pencil size={13} color="#00F0FF" />
          </button>
          <button
            onClick={onDelete}
            data-testid={`delete-${article.article_id}`}
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete article"
          >
            <Trash2 size={13} color="#FF003C80" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

// Article create/edit modal
function ArticleModal({ article, onClose, onSaved }) {
  const isNew = !article;
  const [form, setForm] = useState({
    title: article?.title || '',
    content: article?.content || '',
    category: article?.category || 'general',
    tags: (article?.tags || []).join(', '),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      if (isNew) {
        await axios.post(`${API}/api/kb`, payload);
        toast.success('Article created');
      } else {
        await axios.put(`${API}/api/kb/${article.article_id}`, payload);
        toast.success(`${article.article_id} updated`);
      }
      onSaved();
    } catch (e) {
      toast.error('Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      data-testid="article-modal"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        className="w-full max-w-2xl rounded-xl p-6 corner-accent"
        style={{ background: '#0a0a0a', border: '1px solid rgba(0,240,255,0.15)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-sm text-white uppercase tracking-widest">
            {isNew ? 'New KB Article' : `Edit ${article.article_id}`}
          </h2>
          <button onClick={onClose} className="p-1 hover:opacity-70" data-testid="close-modal">
            <X size={16} color="#9CA3AF" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="font-heading text-xs text-gray-500 uppercase tracking-wider block mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm border focus:outline-none transition-colors"
              style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', WebkitTextFillColor: '#e2e8f0' }}
              placeholder="e.g. Cannot Connect to VPN"
              data-testid="article-title-input"
            />
          </div>

          {/* Category & Tags row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-heading text-xs text-gray-500 uppercase tracking-wider block mb-2">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm border focus:outline-none appearance-none cursor-pointer"
                style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)' }}
                data-testid="article-category-select"
              >
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#0d0d14' }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="font-heading text-xs text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
                <Tag size={10} /> Tags (comma separated)
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm border focus:outline-none transition-colors"
                style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', WebkitTextFillColor: '#e2e8f0' }}
                placeholder="vpn, network, remote"
                data-testid="article-tags-input"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="font-heading text-xs text-gray-500 uppercase tracking-wider block mb-2">
              Content
              <span className="normal-case font-mono ml-2 text-gray-600">({form.content.length} chars)</span>
            </label>
            <textarea
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              rows={12}
              className="w-full px-3 py-3 rounded-lg font-mono text-sm leading-relaxed border focus:outline-none resize-none"
              style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', lineHeight: '1.7', WebkitTextFillColor: '#e2e8f0' }}
              placeholder="Step-by-step troubleshooting instructions..."
              data-testid="article-content-textarea"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <motion.button
              onClick={handleSave}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid="save-article-btn"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-heading text-xs uppercase tracking-wider"
              style={{ background: 'rgba(0,255,148,0.1)', color: '#00FF94', border: '1px solid rgba(0,255,148,0.3)' }}
            >
              {saving ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
              {isNew ? 'Create Article' : 'Save Changes'}
            </motion.button>
            <button
              onClick={onClose}
              data-testid="cancel-modal-btn"
              className="px-5 py-2.5 rounded-lg font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Users Editor ----
function UsersEditor({ users, onRefresh, authHeaders, editingUser, setEditingUser, showNewUser, setShowNewUser }) {
  const [search, setSearch] = useState('');

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-3 py-2 rounded-lg font-mono text-xs border focus:outline-none"
            style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', WebkitTextFillColor: '#e2e8f0' }}
            data-testid="admin-users-search"
          />
        </div>
        <span className="font-mono text-xs text-gray-600">{users.length} users</span>
        <motion.button
          onClick={() => { setShowNewUser(true); setEditingUser(null); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          data-testid="new-user-btn"
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg font-heading text-xs uppercase tracking-wider"
          style={{ background: 'rgba(0,240,255,0.1)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.3)' }}
        >
          <Plus size={12} />
          New User
        </motion.button>
      </div>

      {/* Users table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full" data-testid="users-table">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {['Name', 'Email', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-heading text-xs text-gray-600 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center font-mono text-xs text-gray-600">
                  No users found
                </td>
              </tr>
            )}
            {filtered.map((user, idx) => (
              <UserRow
                key={user.id}
                user={user}
                idx={idx}
                onEdit={() => { setEditingUser(user); setShowNewUser(false); }}
                onDelete={async () => {
                  try {
                    await axios.delete(`${API}/api/admin/users/${user.id}`, { headers: authHeaders });
                    onRefresh();
                    toast.success(`Deleted ${user.email}`);
                  } catch (e) {
                    toast.error(e?.response?.data?.detail || 'Failed to delete user');
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit user modal */}
      <AnimatePresence>
        {(editingUser || showNewUser) && (
          <UserModal
            user={editingUser}
            authHeaders={authHeaders}
            onClose={() => { setEditingUser(null); setShowNewUser(false); }}
            onSaved={() => { setEditingUser(null); setShowNewUser(false); onRefresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UserRow({ user, idx, onEdit, onDelete }) {
  const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: idx * 0.03 }}
      className="hover:bg-white/2 transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
      data-testid={`user-row-${user.id}`}
    >
      <td className="px-4 py-3">
        <span className="font-body text-sm text-gray-200">{user.name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-400">{user.email}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-600">{createdDate}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            data-testid={`edit-user-${user.id}`}
            className="p-1.5 rounded hover:bg-cyan-500/10 transition-colors"
            title="Edit user"
          >
            <Pencil size={13} color="#00F0FF" />
          </button>
          <button
            onClick={onDelete}
            data-testid={`delete-user-${user.id}`}
            className="p-1.5 rounded hover:bg-red-500/10 transition-colors"
            title="Delete user"
          >
            <Trash2 size={13} color="#FF003C80" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

// User create/edit modal
function UserModal({ user, authHeaders, onClose, onSaved }) {
  const isNew = !user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (isNew && !form.password) { toast.error('Password is required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        await axios.post(`${API}/api/admin/users`, {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }, { headers: authHeaders });
        toast.success('User created');
      } else {
        const payload = {};
        if (form.name.trim() !== user.name) payload.name = form.name.trim();
        if (form.email.trim() !== user.email) payload.email = form.email.trim();
        if (form.password) payload.password = form.password;
        if (Object.keys(payload).length === 0) { toast('No changes to save'); onClose(); return; }
        await axios.put(`${API}/api/admin/users/${user.id}`, payload, { headers: authHeaders });
        toast.success('User updated');
      }
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      data-testid="user-modal"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        className="w-full max-w-md rounded-xl p-6 corner-accent"
        style={{ background: '#0a0a0a', border: '1px solid rgba(0,240,255,0.15)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-sm text-white uppercase tracking-widest">
            {isNew ? 'New User' : `Edit User`}
          </h2>
          <button onClick={onClose} className="p-1 hover:opacity-70" data-testid="close-user-modal">
            <X size={16} color="#9CA3AF" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="font-heading text-xs text-gray-500 uppercase tracking-wider block mb-2">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm border focus:outline-none transition-colors"
              style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', WebkitTextFillColor: '#e2e8f0' }}
              placeholder="Full name"
              data-testid="user-name-input"
            />
          </div>

          {/* Email */}
          <div>
            <label className="font-heading text-xs text-gray-500 uppercase tracking-wider block mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg font-mono text-sm border focus:outline-none transition-colors"
              style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', WebkitTextFillColor: '#e2e8f0' }}
              placeholder="user@example.com"
              data-testid="user-email-input"
            />
          </div>

          {/* Password */}
          <div>
            <label className="font-heading text-xs text-gray-500 uppercase tracking-wider block mb-2">
              {isNew ? 'Password' : 'New Password'}{!isNew && <span className="normal-case font-mono ml-2 text-gray-600">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2.5 pr-10 rounded-lg font-mono text-sm border focus:outline-none transition-colors"
                style={{ background: '#0d0d14', color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.1)', WebkitTextFillColor: '#e2e8f0' }}
                placeholder={isNew ? 'Min 8 characters' : '••••••••'}
                data-testid="user-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
              >
                {showPassword ? <EyeOff size={14} color="#6B7280" /> : <Eye size={14} color="#6B7280" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <motion.button
              onClick={handleSave}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid="save-user-btn"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-heading text-xs uppercase tracking-wider"
              style={{ background: 'rgba(0,255,148,0.1)', color: '#00FF94', border: '1px solid rgba(0,255,148,0.3)' }}
            >
              {saving ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
              {isNew ? 'Create User' : 'Save Changes'}
            </motion.button>
            <button
              onClick={onClose}
              data-testid="cancel-user-modal-btn"
              className="px-5 py-2.5 rounded-lg font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
