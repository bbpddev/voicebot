import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket, RefreshCw, AlertCircle, CheckCircle,
  Clock, XCircle, ChevronDown, Trash2,
  Flame, Users, UserPlus
} from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const PRIORITY_CONFIG = {
  critical: { color: '#FF003C', label: 'CRITICAL', bg: 'rgba(255,0,60,0.1)', border: 'rgba(255,0,60,0.3)' },
  high:     { color: '#FF6B00', label: 'HIGH',     bg: 'rgba(255,107,0,0.1)', border: 'rgba(255,107,0,0.3)' },
  medium:   { color: '#FFD600', label: 'MEDIUM',   bg: 'rgba(255,214,0,0.1)', border: 'rgba(255,214,0,0.3)' },
  low:      { color: '#00FF94', label: 'LOW',      bg: 'rgba(0,255,148,0.1)', border: 'rgba(0,255,148,0.2)' },
};

const STATUS_CONFIG = {
  open:        { color: '#00F0FF', label: 'OPEN',        icon: AlertCircle },
  in_progress: { color: '#FFD600', label: 'IN PROGRESS', icon: Clock },
  resolved:    { color: '#00FF94', label: 'RESOLVED',    icon: CheckCircle },
  closed:      { color: '#9CA3AF', label: 'CLOSED',      icon: XCircle },
};

const DUMMY_PRIORITIES = [
  {
    id: 'INC-0091',
    priority: 'critical',
    title: 'Email service outage — Exchange Online',
    status: 'in_progress',
    since: '09:14 AM',
    affected: 142,
    description: 'Exchange Online is experiencing intermittent delivery failures across all regions. Emails delayed by 15-30 min.',
  },
  {
    id: 'INC-0088',
    priority: 'critical',
    title: 'VPN gateway unreachable — Global Protect',
    status: 'open',
    since: '08:42 AM',
    affected: 87,
    description: 'EU West VPN cluster not accepting connections. Users unable to access internal resources remotely.',
  },
  {
    id: 'INC-0085',
    priority: 'high',
    title: 'SSO login failures — PingMFA',
    status: 'in_progress',
    since: '07:55 AM',
    affected: 63,
    description: 'Intermittent 503 errors on SSO login. Some users able to authenticate after multiple retries.',
  },
  {
    id: 'INC-0082',
    priority: 'high',
    title: 'Shared drive latency — Network drives',
    status: 'in_progress',
    since: '11:30 PM',
    affected: 34,
    description: 'File operations on NAS cluster 3 are 5-10x slower than normal. Impacting departments on floors 4-6.',
  },
];

export function TicketsPanel({ refreshTrigger }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [affectedMap, setAffectedMap] = useState({});
  const [expandedPriority, setExpandedPriority] = useState(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? `${API}/api/tickets` : `${API}/api/tickets?status=${filter}`;
      const res = await axios.get(url);
      setTickets(res.data);
    } catch (e) {
      console.error('Failed to fetch tickets:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets, refreshTrigger]);

  const updateStatus = async (ticketId, status) => {
    try {
      await axios.patch(`${API}/api/tickets/${ticketId}`, { status });
      fetchTickets();
    } catch (e) {}
  };

  const deleteTicket = async (ticketId) => {
    try {
      await axios.delete(`${API}/api/tickets/${ticketId}`);
      fetchTickets();
    } catch (e) {}
  };

  const filters = ['all', 'open', 'in_progress', 'resolved', 'closed'];

  return (
    <div className="flex flex-col h-full" data-testid="tickets-panel">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <Ticket size={14} style={{ color: 'var(--primary)' }} />
        <h2 className="font-heading text-xs tracking-widest uppercase" style={{ color: 'var(--primary)' }}>Support Tickets</h2>
        <span className="ml-auto font-mono text-xs" style={{ color: 'var(--text-faint)' }}>{tickets.length}</span>
        <button
          onClick={fetchTickets}
          className="p-1 rounded transition-colors"
          style={{ background: 'transparent' }}
          data-testid="refresh-tickets-btn"
          title="Refresh tickets"
        >
          <RefreshCw size={12} style={{ color: 'var(--text-secondary)' }} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
            className="px-2 py-1 rounded font-mono text-xs uppercase tracking-wider transition-all"
            style={
              filter === f
                ? { background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }
            }
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
        <AnimatePresence mode="popLayout">
          {tickets.length === 0 && !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                No tickets found
              </p>
            </motion.div>
          )}

          {tickets.map((ticket) => {
            const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.medium;
            const StatusIcon = statusCfg.icon;
            const isExpanded = expanded === ticket.ticket_id;

            return (
              <motion.div
                key={ticket.ticket_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-lg overflow-hidden cursor-pointer"
                style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}
                data-testid={`ticket-${ticket.ticket_id}`}
              >
                {/* Ticket row */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 transition-colors"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(isExpanded ? null : ticket.ticket_id)}
                >
                  <StatusIcon size={12} style={{ color: statusCfg.color, flexShrink: 0 }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{ticket.ticket_id}</span>
                      <span className="font-body text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{ticket.title}</span>
                    </div>
                  </div>

                  {/* Priority badge */}
                  <span
                    className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      color: priorityCfg.color,
                      background: priorityCfg.bg,
                      border: `1px solid ${priorityCfg.border}`,
                      fontSize: '9px',
                    }}
                  >
                    {priorityCfg.label}
                  </span>

                  <ChevronDown
                    size={12}
                    style={{ color: 'var(--text-muted)' }}
                    className={`transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>

                {/* Expanded details */}
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
                        <p className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {ticket.description}
                        </p>
                        {ticket.resolution && (
                          <p className="font-mono text-xs text-success/70">
                            Resolution: {ticket.resolution}
                          </p>
                        )}
                        {/* Status & Category */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs px-2 py-0.5 rounded"
                            style={{ color: statusCfg.color, background: `${statusCfg.color}15`, border: `1px solid ${statusCfg.color}30`, fontSize: '9px' }}>
                            {statusCfg.label}
                          </span>
                          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                            {ticket.category?.toUpperCase()}
                          </span>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {ticket.status === 'open' && (
                            <ActionBtn
                              label="In Progress"
                              color="#FFD600"
                              onClick={() => updateStatus(ticket.ticket_id, 'in_progress')}
                              testId={`btn-progress-${ticket.ticket_id}`}
                            />
                          )}
                          {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                            <ActionBtn
                              label="Resolve"
                              color="#00FF94"
                              onClick={() => updateStatus(ticket.ticket_id, 'resolved')}
                              testId={`btn-resolve-${ticket.ticket_id}`}
                            />
                          )}
                          {ticket.status !== 'closed' && (
                            <ActionBtn
                              label="Close"
                              color="#9CA3AF"
                              onClick={() => updateStatus(ticket.ticket_id, 'closed')}
                              testId={`btn-close-${ticket.ticket_id}`}
                            />
                          )}
                          <button
                            onClick={() => deleteTicket(ticket.ticket_id)}
                            className="ml-auto p-1 rounded hover:bg-red-500/10 transition-colors"
                            data-testid={`btn-delete-${ticket.ticket_id}`}
                            title="Delete ticket"
                          >
                            <Trash2 size={12} color="#FF003C" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Current P1 & P2 Section */}
      <div className="mt-4 pt-4 flex flex-col min-h-0" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-3 mb-3">
          <Flame size={14} style={{ color: '#FF003C' }} />
          <h2 className="font-heading text-xs tracking-widest uppercase" style={{ color: '#FF003C' }}>
            Current P1 &amp; P2
          </h2>
          <span className="ml-auto font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
            {DUMMY_PRIORITIES.length} active
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1" data-testid="priorities-list">
          {DUMMY_PRIORITIES.map((inc) => {
            const priorityCfg = PRIORITY_CONFIG[inc.priority] || PRIORITY_CONFIG.high;
            const statusCfg = STATUS_CONFIG[inc.status] || STATUS_CONFIG.open;
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedPriority === inc.id;
            const isMeAffected = affectedMap[inc.id] || false;
            const totalAffected = inc.affected + (isMeAffected ? 1 : 0);

            return (
              <motion.div
                key={inc.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg overflow-hidden"
                style={{
                  border: `1px solid ${priorityCfg.border}`,
                  background: priorityCfg.bg,
                }}
                data-testid={`priority-${inc.id}`}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                  onClick={() => setExpandedPriority(isExpanded ? null : inc.id)}
                >
                  <StatusIcon size={12} style={{ color: statusCfg.color, flexShrink: 0 }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs flex-shrink-0" style={{ color: priorityCfg.color, fontWeight: 600 }}>
                        {inc.id}
                      </span>
                      <span className="font-body text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {inc.title}
                      </span>
                    </div>
                  </div>

                  <span
                    className="font-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      color: priorityCfg.color,
                      background: priorityCfg.bg,
                      border: `1px solid ${priorityCfg.border}`,
                      fontSize: '9px',
                    }}
                  >
                    {priorityCfg.label}
                  </span>

                  <ChevronDown
                    size={12}
                    style={{ color: 'var(--text-muted)' }}
                    className={`transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  />
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
                      <div className="px-3 pb-3 pt-2 space-y-2.5" style={{ borderTop: `1px solid ${priorityCfg.border}` }}>
                        <p className="font-mono text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {inc.description}
                        </p>

                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-xs px-2 py-0.5 rounded"
                            style={{ color: statusCfg.color, background: `${statusCfg.color}15`, border: `1px solid ${statusCfg.color}30`, fontSize: '9px' }}>
                            {statusCfg.label}
                          </span>
                          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                            SINCE {inc.since}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            <Users size={11} style={{ color: 'var(--text-muted)' }} />
                            <span className="font-mono text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                              {totalAffected} impacted
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAffectedMap(prev => ({ ...prev, [inc.id]: !prev[inc.id] }));
                            }}
                            data-testid={`btn-affected-${inc.id}`}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs uppercase tracking-wider transition-all hover:opacity-80"
                            style={
                              isMeAffected
                                ? { color: '#00FF94', background: 'rgba(0,255,148,0.1)', border: '1px solid rgba(0,255,148,0.3)', fontSize: '9px' }
                                : { color: '#FF6B00', background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.3)', fontSize: '9px' }
                            }
                          >
                            <UserPlus size={10} />
                            {isMeAffected ? 'Added' : "I'm Affected"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ label, color, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="px-2 py-1 rounded font-mono text-xs uppercase tracking-wider transition-all hover:opacity-80"
      style={{
        color,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        fontSize: '9px',
      }}
    >
      {label}
    </button>
  );
}
