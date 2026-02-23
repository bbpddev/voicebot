import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, Search, Ticket, FileText, List, CheckCircle, Loader, ChevronRight } from 'lucide-react';

export function TranscriptFeed({ transcript, currentAiText }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentAiText]);

  return (
    <div className="flex flex-col h-full" data-testid="transcript-feed">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--primary)', boxShadow: '0 0 6px var(--primary)' }} />
        <h2 className="font-heading text-xs tracking-widest uppercase" style={{ color: 'var(--primary)' }}>
          Agent Journey
        </h2>
        <span className="ml-auto font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
          {transcript.filter(m => m.role === 'user' || m.role === 'assistant').length} turns
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        <AnimatePresence initial={false}>
          {transcript.length === 0 && !currentAiText && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-32 text-center"
            >
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                — Awaiting voice session —
              </p>
              <p className="font-mono text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
                Activate the orb to start
              </p>
            </motion.div>
          )}

          {transcript.map((msg, idx) => {
            if (msg.role === 'user') return <UserMessage key={idx} msg={msg} />;
            if (msg.role === 'assistant') return <AssistantMessage key={idx} msg={msg} />;
            if (msg.role === 'function') return <FunctionCard key={msg.id || idx} msg={msg} />;
            if (msg.role === 'system') return <SystemMessage key={idx} msg={msg} />;
            return null;
          })}

          {/* Streaming AI text */}
          {currentAiText && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2"
              data-testid="streaming-ai-text"
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(0,255,148,0.1)', border: '1px solid rgba(0,255,148,0.3)' }}>
                <Bot size={12} color="#00FF94" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-1 mb-1">
                  <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'rgba(0,255,148,0.6)' }}>Agent</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                </div>
                <p className="font-mono text-sm leading-relaxed" style={{ color: 'var(--msg-text)' }}>
                  {currentAiText}
                  <span className="inline-block w-0.5 h-3.5 bg-success animate-pulse ml-0.5 align-middle" />
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// --- System / reconnect divider ---
function SystemMessage({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 py-1"
      data-testid="transcript-msg-system"
    >
      <div className="flex-1 h-px" style={{ background: 'rgba(255,214,0,0.15)' }} />
      <span className="font-mono text-yellow-500/60 uppercase tracking-widest" style={{ fontSize: '9px' }}>
        {msg.text}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,214,0,0.15)' }} />
    </motion.div>
  );
}

// --- User bubble ---
function UserMessage({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-start gap-2 flex-row-reverse"
      data-testid="transcript-msg-user"
    >
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-border)' }}>
        <User size={12} style={{ color: 'var(--primary)' }} />
      </div>
      <div className="max-w-[78%] flex flex-col items-end">
        <span className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--primary)', opacity: 0.7 }}>You</span>
        <div className="px-3 py-2 rounded-lg"
          style={{ background: 'var(--msg-user-bg)', border: '1px solid var(--msg-user-border)' }}>
          <p className="font-mono text-sm leading-relaxed" style={{ color: 'var(--msg-text)' }}>{msg.text}</p>
        </div>
      </div>
    </motion.div>
  );
}

// --- Assistant bubble ---
function AssistantMessage({ msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-start gap-2"
      data-testid="transcript-msg-assistant"
    >
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(0,255,148,0.1)', border: '1px solid rgba(0,255,148,0.3)' }}>
        <Bot size={12} color="#00FF94" />
      </div>
      <div className="max-w-[85%] flex flex-col">
        <span className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: 'rgba(0,255,148,0.6)' }}>Agent</span>
        <div className="px-3 py-2 rounded-lg"
          style={{ background: 'var(--msg-ai-bg)', border: '1px solid var(--msg-ai-border)' }}>
          <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--msg-text)' }}>{msg.text}</p>
        </div>
      </div>
    </motion.div>
  );
}

// --- Function Journey Card ---
function FunctionCard({ msg }) {
  const isPending = msg.status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-8"
      data-testid={`function-card-${msg.name}`}
    >
      <div className="rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(112,0,255,0.2)', background: 'rgba(112,0,255,0.04)' }}>

        {/* Card header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: 'rgba(112,0,255,0.12)' }}>
          <FunctionIcon name={msg.name} pending={isPending} />
          <span className="font-heading text-xs uppercase tracking-wider text-purple-400/80">
            {FUNCTION_LABELS[msg.name] || msg.name}
          </span>
          {isPending && (
            <Loader size={10} color="#7000FF" className="animate-spin ml-auto" />
          )}
        </div>

        {/* Card body */}
        {!isPending && msg.result && (
          <div className="px-3 py-2 space-y-1.5">
            <FunctionBody name={msg.name} args={msg.args} result={msg.result} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FunctionIcon({ name, pending }) {
  const icons = {
    search_knowledge_base: Search,
    create_ticket: Ticket,
    get_ticket: FileText,
    list_tickets: List,
    update_ticket_status: CheckCircle,
  };
  const Icon = icons[name] || FileText;
  return (
    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(112,0,255,0.15)' }}>
      <Icon size={10} color="#7000FF" />
    </div>
  );
}

const FUNCTION_LABELS = {
  search_knowledge_base: 'KB Search',
  create_ticket: 'Create Ticket',
  get_ticket: 'Get Ticket',
  list_tickets: 'List Tickets',
  update_ticket_status: 'Update Ticket',
};

// --- Function body renderers ---
function FunctionBody({ name, args, result }) {
  if (name === 'search_knowledge_base') return <KBSearchBody args={args} result={result} />;
  if (name === 'create_ticket') return <CreateTicketBody result={result} />;
  if (name === 'get_ticket') return <GetTicketBody result={result} />;
  if (name === 'list_tickets') return <ListTicketsBody result={result} />;
  if (name === 'update_ticket_status') return <UpdateTicketBody args={args} result={result} />;
  return <GenericBody result={result} />;
}

function Step({ label, value, color = '#9CA3AF' }) {
  return (
    <div className="flex items-start gap-1.5">
      <ChevronRight size={10} color={color} className="mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{label}: </span>
        <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{value}</span>
      </div>
    </div>
  );
}

function KBSearchBody({ args, result }) {
  return (
    <div className="space-y-1.5">
      <Step label="Query" value={`"${args?.query}"`} color="#7000FF" />
      {result.found ? (
        <>
          <Step label="Articles found" value={(result.articles || []).join(', ')} color="#00FF94" />
          {result.summary && (
            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(112,0,255,0.1)' }}>
              <p className="font-mono leading-relaxed" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                {result.summary}
              </p>
            </div>
          )}
        </>
      ) : (
        <Step label="Result" value="No articles found" color="#FF003C" />
      )}
    </div>
  );
}

function CreateTicketBody({ result }) {
  return (
    <div className="space-y-1">
      <Step label="Ticket ID" value={result.ticket_id} color="#00FF94" />
      <Step label="Status" value={result.success ? 'Created' : 'Failed'} color={result.success ? '#00FF94' : '#FF003C'} />
    </div>
  );
}

function GetTicketBody({ result }) {
  if (!result.found) return <Step label="Result" value={result.message} color="#FF003C" />;
  return (
    <div className="space-y-1">
      <Step label="Ticket" value={result.ticket_id} color="#00F0FF" />
      <Step label="Title" value={result.title} color="#9CA3AF" />
      <Step label="Status" value={result.status?.toUpperCase()} color={STATUS_COLORS[result.status] || '#9CA3AF'} />
      <Step label="Priority" value={result.priority?.toUpperCase()} color="#FFD600" />
    </div>
  );
}

function ListTicketsBody({ result }) {
  return (
    <div className="space-y-1">
      <Step label="Found" value={`${result.count} tickets`} color="#00F0FF" />
      {(result.tickets || []).slice(0, 5).map(t => (
        <div key={t.ticket_id} className="flex items-center gap-2 pl-3">
          <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{t.ticket_id}</span>
          <span className="font-mono truncate" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t.title}</span>
          <span className="font-mono ml-auto flex-shrink-0" style={{ fontSize: '9px', color: STATUS_COLORS[t.status] || '#9CA3AF' }}>
            {t.status?.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

function UpdateTicketBody({ args, result }) {
  return (
    <div className="space-y-1">
      <Step label="Ticket" value={args?.ticket_id} color="#00F0FF" />
      <Step label="New status" value={args?.status?.toUpperCase()} color={STATUS_COLORS[args?.status] || '#9CA3AF'} />
      <Step label="Result" value={result.success ? 'Updated' : result.message} color={result.success ? '#00FF94' : '#FF003C'} />
    </div>
  );
}

function GenericBody({ result }) {
  return (
    <p className="font-mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
      {JSON.stringify(result).substring(0, 120)}
    </p>
  );
}

const STATUS_COLORS = {
  open: '#00F0FF',
  in_progress: '#FFD600',
  resolved: '#00FF94',
  closed: '#9CA3AF',
};
