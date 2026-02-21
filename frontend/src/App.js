import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { Shield, Cpu, Activity, ChevronRight, ExternalLink, AlertTriangle, Settings } from 'lucide-react';
import { VoiceOrb } from './components/VoiceOrb';
import { TranscriptFeed } from './components/TranscriptFeed';
import { TicketsPanel } from './components/TicketsPanel';
import { KnowledgeBase } from './components/KnowledgeBase';
import { useVoiceAgent } from './hooks/useVoiceAgent';
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

  useEffect(() => {
    try { setIsIframe(window !== window.top); } catch (e) { setIsIframe(true); }
    // Load agent name from config
    fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/config`)
      .then(r => r.json())
      .then(d => { if (d.agent_name) setAgentName(d.agent_name.toUpperCase()); })
      .catch(() => {});
  }, []);

  const onTicketsChange = useCallback(() => {
    setTicketRefresh(n => n + 1);
    toast.success('Ticket updated', {
      style: { background: '#0a0a0a', border: '1px solid rgba(0,255,148,0.3)', color: '#00FF94' },
    });
  }, []);

  const { status, transcript, currentAiText, lastFunction, error, connect, disconnect } = useVoiceAgent({ onTicketsChange });

  // Show error toast (except iframe-specific error which is handled inline)
  useEffect(() => {
    if (error && error !== 'IFRAME_MIC_BLOCKED') {
      toast.error(error, {
        style: { background: '#0a0a0a', border: '1px solid rgba(255,0,60,0.3)', color: '#FF003C' },
      });
    }
  }, [error]);

  const isActive = status !== 'idle' && status !== 'error';
  const showIframeMicError = error === 'IFRAME_MIC_BLOCKED';

  return (
    <div className="min-h-screen" style={{ background: '#050505' }} data-testid="app-container">
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
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            data-testid="iframe-mic-modal"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full rounded-xl p-8 text-center corner-accent"
              style={{ background: '#0a0a0a', border: '1px solid rgba(255,214,0,0.3)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,214,0,0.1)', border: '1px solid rgba(255,214,0,0.3)' }}>
                <AlertTriangle size={28} color="#FFD600" />
              </div>
              <h2 className="font-heading text-lg text-white uppercase tracking-widest mb-2">
                Microphone Blocked
              </h2>
              <p className="font-mono text-sm text-gray-400 leading-relaxed mb-6">
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
                  style={{ background: 'rgba(0,240,255,0.1)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.3)' }}
                >
                  <ExternalLink size={14} />
                  Open in New Tab
                </a>
                <button
                  onClick={() => { disconnect(); }}
                  className="font-mono text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b" style={{ borderColor: 'rgba(0,240,255,0.08)', background: 'rgba(5,5,5,0.95)' }}>
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-4">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="w-8 h-8 rounded flex items-center justify-center"
              style={{ background: 'rgba(0,240,255,0.1)', border: '1px solid rgba(0,240,255,0.3)' }}>
              <Activity size={16} color="#00F0FF" />
            </div>
            <div>
              <h1 className="font-heading text-sm tracking-widest text-white uppercase" data-testid="app-title">
                IT Service Desk
              </h1>
              <p className="font-mono text-xs text-gray-600" style={{ fontSize: '10px' }}>
                Voice Agent // Grok Realtime + GPT-4.1
              </p>
            </div>
          </motion.div>

          {/* Status indicator */}
          <div className="ml-auto flex items-center gap-3">
            <a
              href="/admin"
              data-testid="admin-link"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all hover:opacity-80"
              style={{ background: 'rgba(112,0,255,0.08)', color: '#7000FF', border: '1px solid rgba(112,0,255,0.2)' }}
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
              <span className="font-mono text-xs text-gray-500 uppercase tracking-wider">
                {isActive ? 'Session Active' : 'Offline'}
              </span>
              {isActive && (
                <span className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{ color: '#00F0FF', background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)', fontSize: '10px' }}>
                  {agentName} AI
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-100px)]">

          {/* LEFT — Side panel (Tickets / KB) */}
          <motion.div
            className="lg:col-span-4 glass-panel corner-accent rounded-xl p-5 flex flex-col"
            style={{ minHeight: '600px' }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Tab switcher */}
            <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
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
                        ? { background: 'rgba(0,240,255,0.1)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.25)' }
                        : { background: 'transparent', color: '#6B7280', border: '1px solid transparent' }
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
            className="lg:col-span-4 glass-panel corner-accent rounded-xl p-6 flex flex-col items-center justify-center gap-8"
            style={{ minHeight: '600px', background: 'radial-gradient(circle at 50% 30%, rgba(0,240,255,0.04) 0%, rgba(5,5,5,0.95) 70%)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {/* Title */}
            <div className="text-center">
              <div className="hud-line w-32 mx-auto mb-3" />
              <h2 className="font-heading text-2xl text-white tracking-widest uppercase" data-testid="agent-name">
                {agentName}
              </h2>
              <p className="font-sub text-sm text-gray-500 tracking-widest mt-1">
                IT Voice Intelligence
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
                { label: 'Troubleshoot Issues', color: '#00F0FF' },
                { label: 'Create Support Tickets', color: '#7000FF' },
                { label: 'Search Knowledge Base', color: '#00FF94' },
                { label: 'Track Ticket Status', color: '#FFD600' },
              ].map((cap) => (
                <div key={cap.label} className="flex items-center gap-2 px-3 py-1.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <ChevronRight size={10} style={{ color: cap.color }} />
                  <span className="font-mono text-xs text-gray-500">{cap.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT — Transcript */}
          <motion.div
            className="lg:col-span-4 glass-panel corner-accent rounded-xl p-5 flex flex-col"
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
