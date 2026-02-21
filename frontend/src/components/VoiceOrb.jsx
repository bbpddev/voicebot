import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Loader, Volume2, Zap, ExternalLink } from 'lucide-react';

const STATUS_CONFIG = {
  idle: {
    label: 'OFFLINE',
    color: '#9CA3AF',
    glowColor: 'rgba(156,163,175,0.2)',
    ringColor: 'rgba(156,163,175,0.15)',
    icon: MicOff,
    animation: 'orb-idle',
  },
  connecting: {
    label: 'CONNECTING',
    color: '#FFD600',
    glowColor: 'rgba(255,214,0,0.3)',
    ringColor: 'rgba(255,214,0,0.15)',
    icon: Loader,
    animation: 'spin-slow',
  },
  active: {
    label: 'CONNECTED',
    color: '#00F0FF',
    glowColor: 'rgba(0,240,255,0.4)',
    ringColor: 'rgba(0,240,255,0.15)',
    icon: Mic,
    animation: 'orb-listen',
  },
  listening: {
    label: 'CAPTURING VOICE',
    color: '#00F0FF',
    glowColor: 'rgba(0,240,255,0.6)',
    ringColor: 'rgba(0,240,255,0.2)',
    icon: Mic,
    animation: 'orb-listen',
  },
  speaking: {
    label: 'RESPONDING',
    color: '#00FF94',
    glowColor: 'rgba(0,255,148,0.4)',
    ringColor: 'rgba(0,255,148,0.15)',
    icon: Volume2,
    animation: 'orb-idle',
  },
  processing: {
    label: 'PROCESSING',
    color: '#7000FF',
    glowColor: 'rgba(112,0,255,0.5)',
    ringColor: 'rgba(112,0,255,0.2)',
    icon: Zap,
    animation: 'spin-slow',
  },
  error: {
    label: 'ERROR',
    color: '#FF003C',
    glowColor: 'rgba(255,0,60,0.3)',
    ringColor: 'rgba(255,0,60,0.15)',
    icon: MicOff,
    animation: 'orb-idle',
  },
};

export function VoiceOrb({ status, onConnect, onDisconnect, isIframe }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = cfg.icon;
  const isActive = status !== 'idle' && status !== 'error';
  const isConnecting = status === 'connecting';

  const handleClick = () => {
    if (status === 'idle' || status === 'error') {
      onConnect();
    } else if (isActive && status !== 'connecting' && status !== 'processing') {
      onDisconnect();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6" data-testid="voice-orb-container">
      {/* Outer glow rings */}
      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {isActive && (
            <>
              <motion.div
                key="ring1"
                className="absolute rounded-full border"
                style={{ borderColor: cfg.color, opacity: 0.15 }}
                initial={{ width: 140, height: 140, opacity: 0 }}
                animate={{ width: 220, height: 220, opacity: [0.15, 0, 0.15] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                key="ring2"
                className="absolute rounded-full border"
                style={{ borderColor: cfg.color, opacity: 0.1 }}
                initial={{ width: 140, height: 140, opacity: 0 }}
                animate={{ width: 280, height: 280, opacity: [0.1, 0, 0.1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              />
            </>
          )}
          {(status === 'listening') && (
            <motion.div
              key="ring3"
              className="absolute rounded-full border-2"
              style={{ borderColor: cfg.color, opacity: 0.3 }}
              initial={{ width: 140, height: 140, opacity: 0.3 }}
              animate={{ width: 180, height: 180, opacity: [0.3, 0.05, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>

        {/* Main orb button */}
        <motion.button
          data-testid="voice-orb-button"
          className="relative w-36 h-36 rounded-full flex items-center justify-center cursor-pointer select-none z-10"
          style={{
            background: `radial-gradient(circle at 35% 35%, ${cfg.color}22, #050505 70%)`,
            border: `2px solid ${cfg.color}`,
            boxShadow: `0 0 40px ${cfg.glowColor}, 0 0 80px ${cfg.glowColor}40, inset 0 0 30px ${cfg.glowColor}20`,
          }}
          onClick={handleClick}
          whileHover={!isConnecting ? { scale: 1.06 } : {}}
          whileTap={!isConnecting ? { scale: 0.96 } : {}}
          animate={
            status === 'listening'
              ? { scale: [1, 1.06, 1], transition: { duration: 0.8, repeat: Infinity } }
              : status === 'speaking'
              ? { scale: [1, 1.03, 1], transition: { duration: 0.5, repeat: Infinity } }
              : { scale: [1, 1.03, 1], transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }
          }
          title={isActive ? 'Click to disconnect' : 'Click to connect'}
        >
          {/* Inner gradient layer */}
          <div
            className="absolute inset-2 rounded-full"
            style={{
              background: `radial-gradient(circle at 40% 30%, ${cfg.color}15 0%, transparent 70%)`,
            }}
          />

          {/* Waveform or Icon */}
          {status === 'speaking' ? (
            <WaveformDisplay color={cfg.color} />
          ) : (
            <motion.div
              animate={isConnecting || status === 'processing' ? { rotate: 360 } : {}}
              transition={isConnecting || status === 'processing' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
            >
              <Icon
                size={38}
                color={cfg.color}
                strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 8px ${cfg.color})` }}
              />
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* Status label */}
      <motion.div
        className="flex items-center gap-2"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: cfg.color,
            boxShadow: `0 0 6px ${cfg.color}`,
          }}
        />
        <span
          className="font-heading text-xs tracking-widest uppercase"
          style={{ color: cfg.color }}
          data-testid="voice-status-label"
        >
          {cfg.label}
        </span>
      </motion.div>

      {/* Instruction text */}
      <motion.p
        className="font-mono text-xs text-gray-500 text-center max-w-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        data-testid="voice-orb-instruction"
      >
        {status === 'idle' || status === 'error'
          ? isIframe
            ? 'Open in new tab for voice access'
            : 'Click orb to start a call'
          : status === 'connecting'
          ? 'Establishing secure connection...'
          : status === 'active'
          ? 'Listening — speak freely, click orb to end'
          : status === 'listening'
          ? 'Voice detected — processing...'
          : status === 'speaking'
          ? 'Agent responding — stay on the line...'
          : status === 'processing'
          ? 'Executing request...'
          : ''}
      </motion.p>

      {/* Open in New Tab button - shown in iframe idle state */}
      {isIframe && (status === 'idle' || status === 'error') && (
        <motion.a
          href={window.location.href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="orb-open-tab-link"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs transition-all hover:opacity-80"
          style={{ background: 'rgba(0,240,255,0.08)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.25)' }}
        >
          <ExternalLink size={12} />
          Open in New Tab
        </motion.a>
      )}
    </div>
  );
}

function WaveformDisplay({ color }) {
  return (
    <div className="flex items-center gap-1" data-testid="waveform-display">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            color,
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.4 + (i % 3) * 0.15}s`,
            filter: `drop-shadow(0 0 4px ${color})`,
          }}
        />
      ))}
    </div>
  );
}
