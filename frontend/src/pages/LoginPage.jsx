import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Eye, EyeOff, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) {
          setError('Please enter your full name');
          setIsLoading(false);
          return;
        }
        await signup(name, email, password);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'signup' : 'login');
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)', transition: 'background 0.3s ease' }}
    >
      {/* Scan line effect */}
      <div className="scan-line" />

      {/* Background grid effect */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
            style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-border)' }}
            animate={{ boxShadow: ['0 0 10px rgba(0,240,255,0.2)', '0 0 25px rgba(0,240,255,0.4)', '0 0 10px rgba(0,240,255,0.2)'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Activity size={24} style={{ color: 'var(--primary)' }} />
          </motion.div>
          <h1 className="font-heading text-xl tracking-widest uppercase mb-1" style={{ color: 'var(--text-primary)' }}>
            IT Service Desk
          </h1>
          <p className="font-mono text-xs tracking-widest" style={{ color: 'var(--text-faint)' }}>
            Voice Agent // Real-time Voice API
          </p>
        </div>

        {/* Card */}
        <div
          className="glass-panel corner-accent rounded-xl p-8"
          style={{ border: '1px solid var(--primary-border)' }}
        >
          {/* Mode toggle */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: 'var(--tab-container-bg)' }}>
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 px-3 rounded-md font-heading text-xs uppercase tracking-wider transition-all"
                style={
                  mode === m
                    ? { background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                    : { background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }
                }
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === 'signup' ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {mode === 'signup' && (
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                    autoComplete="name"
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm outline-none transition-all"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                  />
                </div>
              )}

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm outline-none transition-all"
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                />
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Password {mode === 'signup' && <span style={{ color: 'var(--text-faint)' }}>(min. 8 characters)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full px-4 py-2.5 pr-10 rounded-lg font-mono text-sm outline-none transition-all"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--input-border)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="font-mono text-xs px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,0,60,0.08)', border: '1px solid rgba(255,0,60,0.25)', color: '#FF003C' }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg font-heading text-sm uppercase tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: 'var(--primary-bg)',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary-border)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
                  </>
                ) : (
                  mode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </motion.button>
            </motion.form>
          </AnimatePresence>

          <div className="mt-5 text-center">
            <span className="font-mono text-xs" style={{ color: 'var(--text-faint)' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button
              onClick={switchMode}
              className="font-mono text-xs font-semibold transition-colors hover:opacity-80"
              style={{ color: 'var(--primary)' }}
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>

        <p className="text-center font-mono mt-6" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
          Secure access // IT Service Desk Voice Agent
        </p>
      </motion.div>
    </div>
  );
}
