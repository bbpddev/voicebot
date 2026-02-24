import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { Shield, Cpu, Activity, ChevronRight, ExternalLink, AlertTriangle, Settings, Sun, Moon } from 'lucide-react';
import { VoiceOrb } from './components/VoiceOrb';
import { TranscriptFeed } from './components/TranscriptFeed';
import { TicketsPanel } from './components/TicketsPanel';
import { KnowledgeBase } from './components/KnowledgeBase';
import { useVoiceAgent } from './hooks/useVoiceAgent';
import { useTheme } from './context/ThemeContext';
import './App.css';

const TABS = [
  { id: 'tickets', label: 'Tickets', icon: Shield },
  { id: 'kb', label: 'Knowledge Base', icon: Cpu },
];

function IframeBanner() {
  const directUrl = window.location.href;
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full px-4 py-2.5 flex items-center justify-between gap-4"
      style={{ background: 'rgba(255,214,0,0.06)', borderBottom: '1px solid rgba(255,214,0,0.2)' }}
      data-testid="iframe-banner"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} color="#FFD600" />
        <span className="font-mono text-xs text-yellow-400/80">
          Voice requires microphone — running in embedded preview. Open directly for full functionality.
        </span>
      </div>
      <a
        href={directUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="open-new-tab-btn"
        className="flex items-center gap-1.5 px-3 py-1 rounded font-mono text-xs font-semibold whitespace-nowrap transition-all hover:opacity-80"
        style={{ background: 'rgba(255,214,0,0.15)', color: '#FFD600', border: '1px solid rgba(255,214,0,0.35)' }}
      >
        <ExternalLink size={11} />
        Open in New Tab
      </a>
    </motion.div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('tickets');
  const [ticketRefresh, setTicketRefresh] = useState(0);
  const [isIframe, setIsIframe] = useState(false);
  const [agentName, setAgentName] = useState('REX');
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    try { setIsIframe(window !== window.top); } catch (e) { setIsIframe(true); }
    // Load agent name from config
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/config`)
      .then(r => r.json())
      .then(d => { if (d.agent_name) setAgentName(d.agent_name.toUpperCase()); })
      .catch(() => {});
  }, []);

  const onTicketsChange = useCallback((funcName) => {
    setTicketRefresh(n => n + 1);
    const messages = {
      create_ticket: 'Ticket created',
      update_ticket_status: 'Ticket updated',
      add_me_to_priority_incident: 'Impact reported',
      list_priority_incidents: 'Incidents refreshed',
    };
    toast.success(messages[funcName] || 'Dashboard updated', {
      style: { background: 'var(--surface-solid)', border: '1px solid rgba(0,255,148,0.3)', color: '#00FF94' },
    });
  }, []);

  const { status, transcript, currentAiText, lastFunction, error, connect, disconnect } = useVoiceAgent({ onTicketsChange });

  // Show error toast (except iframe-specific error which is handled inline)
  useEffect(() => {
    if (error && error !== 'IFRAME_MIC_BLOCKED') {
      toast.error(error, {
        style: { background: 'var(--surface-solid)', border: '1px solid rgba(255,0,60,0.3)', color: '#FF003C' },
      });
    }
  }, [error]);

  const isActive = status !== 'idle' && status !== 'error';
  const showIframeMicError = error === 'IFRAME_MIC_BLOCKED';

  return (
    <div
      className="min-h-screen lg:h-screen lg:flex lg:flex-col lg:overflow-hidden"
      style={{ background: 'var(--bg)', transition: 'background 0.3s ease' }}
      data-testid="app-container"
    >
      {/* Scan line effect */}
      <div className="scan-line" />

      <Toaster position="top-right" richColors />

      {/* Iframe banner - always show when in iframe */}
      {isIframe && <IframeBanner />}

      {/* Iframe mic blocked modal */}
      <AnimatePresence>
        {showIframeMicError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            data-testid="iframe-mic-modal"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full rounded-xl p-8 text-center corner-accent"
              style={{ background: 'var(--modal-bg)', border: '1px solid rgba(255,214,0,0.3)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.3)' }}>
                <AlertTriangle size={28} color="#FFD600" />
              </div>
              <h2 className="font-heading text-lg uppercase tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>
                Microphone Blocked
              </h2>
              <p className="font-mono text-sm leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                The embedded preview cannot access your microphone due to browser security restrictions.
                Open the app in a new tab to use the voice agent.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="modal-open-tab-btn"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-heading text-sm uppercase tracking-widest transition-all hover:opacity-80"
                  style={{ background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }}
                >
                  <ExternalLink size={14} />
                  Open in New Tab
                </a>
                <button
                  onClick={() => { disconnect(); }}
                  className="font-mono text-xs transition-colors"
                  style={{ color: 'var(--text-faint)' }}
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--header-border)', background: 'var(--header-bg)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-4">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="w-8 h-8 rounded flex items-center justify-center"
              style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-border)' }}>
              <Activity size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="font-heading text-sm tracking-widest uppercase" style={{ color: 'var(--text-primary)' }} data-testid="app-title">
                IT Service Desk
              </h1>
              <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                Voice Agent // Real-time Voice API
              </p>
            </div>
          </motion.div>

          {/* Right side: status + theme toggle + admin */}
          <div className="ml-auto flex items-center gap-3">
            {/* Theme toggle button */}
            <motion.button
              onClick={toggleTheme}
              data-testid="theme-toggle-btn"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
              style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-border)' }}
              whileTap={{ scale: 0.92 }}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark
                ? <Sun size={14} style={{ color: 'var(--primary)' }} />
                : <Moon size={14} style={{ color: 'var(--primary)' }} />
              }
            </motion.button>

            <a
              href="/admin"
              data-testid="admin-link"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all hover:opacity-80"
              style={{ background: 'var(--secondary-bg)', color: 'var(--secondary)', border: '1px solid var(--secondary-border)' }}
            >
              <Settings size={11} />
              Admin
            </a>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isActive ? '#00FF94' : '#9CA3AF',
                  boxShadow: isActive ? '0 0 8px #00FF94' : 'none',
                }}
              />
              <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {isActive ? 'Session Active' : 'Offline'}
              </span>
              {isActive && (
                <span className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{ color: 'var(--primary)', background: 'var(--primary-bg)', border: '1px solid var(--primary-border-faint)', fontSize: '10px' }}>
                  {agentName} AI
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-100px)] lg:h-full lg:min-h-0">

          {/* LEFT — Side panel (Tickets / KB) */}
          <motion.div
            className="lg:col-span-4 glass-panel corner-accent rounded-xl p-5 flex flex-col lg:min-h-0"
            style={{ minHeight: '600px' }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Tab switcher */}
            <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--tab-container-bg)' }}>
              {TABS.map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`tab-${tab.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md font-heading text-xs uppercase tracking-wider transition-all"
                    style={
                      activeTab === tab.id
                        ? { background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                        : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }
                    }
                  >
                    <TabIcon size={11} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 min-h-0">
              <AnimatePresence mode="wait">
                {activeTab === 'tickets' ? (
                  <motion.div key="tickets" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <TicketsPanel refreshTrigger={ticketRefresh} />
                  </motion.div>
                ) : (
                  <motion.div key="kb" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <KnowledgeBase />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* CENTER — Voice Agent */}
          <motion.div
            className="lg:col-span-4 glass-panel corner-accent rounded-xl p-6 flex flex-col items-center justify-center gap-8 lg:min-h-0"
            style={{ minHeight: '600px', background: 'var(--center-panel-gradient)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Title */}
            <div className="text-center">
              <div className="hud-line w-32 mx-auto mb-3" />
              <h2 className="font-heading text-2xl tracking-widest uppercase" style={{ color: 'var(--text-primary)' }} data-testid="agent-name">
                {agentName}
              </h2>
              <p className="font-sub text-sm tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
                Your friendly AI Assistant
              </p>
              <div className="hud-line w-32 mx-auto mt-3" />
            </div>

            {/* Voice Orb */}
            <VoiceOrb
              status={status}
              onConnect={connect}
              onDisconnect={disconnect}
              isIframe={isIframe}
            />

            {/* Capabilities */}
            <div className="w-full space-y-1.5" data-testid="capabilities-list">
              {[
                { label: 'Troubleshoot Issues', color: 'var(--primary)' },
                { label: 'Create Support Tickets', color: 'var(--secondary)' },
                { label: 'Search Knowledge Base', color: '#00FF94' },
                { label: 'Track Ticket Status', color: '#FFD600' },
                { label: 'Report P1/P2 Impact', color: '#FF003C' },
              ].map((cap) => (
                <div key={cap.label} className="flex items-center gap-2 px-3 py-1.5 rounded"
                  style={{ background: 'var(--cap-item-bg)', border: '1px solid var(--cap-item-border)' }}>
                  <ChevronRight size={10} style={{ color: cap.color }} />
                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{cap.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT — Transcript */}
          <motion.div
            className="lg:col-span-4 glass-panel corner-accent rounded-xl p-5 flex flex-col lg:min-h-0"
            style={{ minHeight: '600px' }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <TranscriptFeed
              transcript={transcript}
              currentAiText={currentAiText}
              lastFunction={lastFunction}
            />
          </motion.div>

        </div>
      </div>
    </div>
  );
}
