import { useRef, useState, useCallback, useEffect } from 'react';

const SAMPLE_RATE = 24000;

// AudioWorklet processor code (inline blob)
const PROCESSOR_CODE = `
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 1024;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) this._buffer.push(channel[i]);
      while (this._buffer.length >= this._bufferSize) {
        this.port.postMessage(new Float32Array(this._buffer.splice(0, this._bufferSize)));
      }
    }
    return true;
  }
}
registerProcessor('audio-capture', AudioCaptureProcessor);
`;

function float32ToInt16Base64(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.min(1, Math.max(-1, float32[i])) * 32767;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToFloat32(b64) {
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
  return float32;
}

export function useVoiceAgent({ onTicketsChange } = {}) {
  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState([]);
  const [currentAiText, setCurrentAiText] = useState('');
  const [lastFunction, setLastFunction] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const playbackCtxRef = useRef(null);
  const streamRef = useRef(null);
  const workletRef = useRef(null);
  const workletBlobRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const aiTextRef = useRef('');
  const statusRef = useRef('idle');
  // Auto-reconnect refs
  const shouldAutoReconnectRef = useRef(false);
  const preserveTranscriptRef = useRef(false);
  // Conversation memory refs
  const transcriptRef = useRef([]);       // mirrors transcript state for use in callbacks
  const isReconnectingRef = useRef(false); // true when reconnecting with history to restore

  // Keep transcriptRef current so callbacks (running in stale closures) always
  // see the latest transcript without needing it in their dependency arrays.
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const updateStatus = useCallback((s) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // Inject the previous conversation turns into a freshly-opened xAI session so
  // the model can continue without asking the user to repeat themselves.
  function injectConversationHistory(ws, history) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !history.length) return;

    const messages = history
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-30); // cap to last 30 turns to stay within context limits

    for (const msg of messages) {
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: msg.role,
          content: [{ type: msg.role === 'user' ? 'input_text' : 'text', text: msg.text }],
        },
      }));
    }

    // Silent system hint — tells the model it reconnected and to carry on
    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: '[System: The voice session was briefly interrupted and has now reconnected. Resume the conversation naturally from where you left off. Do not re-greet the user or ask them to repeat themselves. If there was a pending action, complete it.]',
        }],
      },
    }));

    // Prompt the model to respond immediately and pick up the task
    ws.send(JSON.stringify({ type: 'response.create' }));
  }

  const playAudioChunk = useCallback((b64Audio) => {
    if (!playbackCtxRef.current) return;
    try {
      const ctx = playbackCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const float32 = base64ToFloat32(b64Audio);
      const buffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
      buffer.copyToChannel(float32, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const now = ctx.currentTime;
      const startTime = Math.max(now + 0.02, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
    } catch (e) {
      // ignore playback errors
    }
  }, []);

  const getWsUrl = () => {
    const base = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    return base.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws';
  };

  const connect = useCallback(async () => {
    if (statusRef.current !== 'idle' && statusRef.current !== 'error') return;
    setError(null);
    updateStatus('connecting');

    // On fresh user-initiated call: clear history. On auto-reconnect: preserve it.
    isReconnectingRef.current = Boolean(preserveTranscriptRef.current);
    if (!preserveTranscriptRef.current) {
      setTranscript([]);
    } else {
      // Show a small reconnecting divider in the transcript
      setTranscript(prev => [...prev, { role: 'system', text: 'Reconnecting...', time: Date.now() }]);
      preserveTranscriptRef.current = false;
    }
    aiTextRef.current = '';
    setCurrentAiText('');
    shouldAutoReconnectRef.current = true; // Enable auto-reconnect for this session

    try {
      // Audio contexts
      audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      playbackCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      nextPlayTimeRef.current = 0;

      // Connect WebSocket
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = async () => {
        updateStatus('active');
        await startMicCapture(ws);
      };

      ws.onerror = () => {
        shouldAutoReconnectRef.current = false;
        setError('Connection failed. Check your API keys and try again.');
        updateStatus('error');
      };

      ws.onclose = () => {
        const wasActive = statusRef.current !== 'idle' && statusRef.current !== 'error';
        stopMicCapture();

        if (wasActive && shouldAutoReconnectRef.current) {
          // Unexpected session drop — auto-reconnect silently
          updateStatus('idle');
          setTimeout(() => {
            if (statusRef.current === 'idle' && shouldAutoReconnectRef.current) {
              preserveTranscriptRef.current = true;
              connect(); // re-open session, keep transcript
            }
          }, 1200);
        } else {
          shouldAutoReconnectRef.current = false;
          if (statusRef.current !== 'idle') updateStatus('idle');
        }
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          handleEvent(data);
        } catch (e) {}
      };
    } catch (e) {
      shouldAutoReconnectRef.current = false;
      setError('Could not initialize audio. Please allow microphone access.');
      updateStatus('error');
    }
  }, []); // eslint-disable-line

  const handleEvent = (event) => {
    switch (event.type) {
      case 'session.updated':
        updateStatus('active');
        if (isReconnectingRef.current) {
          isReconnectingRef.current = false;
          injectConversationHistory(wsRef.current, transcriptRef.current);
        }
        break;
      case 'input_audio_buffer.speech_started':
        if (statusRef.current === 'speaking') {
          // User interrupted
          nextPlayTimeRef.current = 0;
        }
        updateStatus('listening');
        break;
      case 'input_audio_buffer.speech_stopped':
        updateStatus('processing');
        break;
      case 'response.created':
        updateStatus('speaking');
        aiTextRef.current = '';
        setCurrentAiText('');
        break;
      case 'response.output_audio.delta':
        if (event.delta) playAudioChunk(event.delta);
        break;
      case 'response.output_audio_transcript.delta':
        aiTextRef.current += event.delta || '';
        setCurrentAiText(aiTextRef.current);
        break;
      case 'response.output_audio_transcript.done':
        if (aiTextRef.current.trim()) {
          setTranscript(prev => [
            ...prev,
            { role: 'assistant', text: aiTextRef.current, time: Date.now() },
          ]);
        }
        aiTextRef.current = '';
        setCurrentAiText('');
        updateStatus('active');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) {
          setTranscript(prev => [
            ...prev,
            { role: 'user', text: event.transcript, time: Date.now() },
          ]);
        }
        break;
      case 'function.started':
        // Add a "thinking" function entry to the transcript
        setTranscript(prev => [
          ...prev,
          { role: 'function', name: event.function, status: 'pending', time: Date.now(), id: Date.now() },
        ]);
        updateStatus('processing');
        break;
      case 'function.executed':
        // Replace the pending function entry with the completed result
        setTranscript(prev => {
          const idx = [...prev].reverse().findIndex(m => m.role === 'function' && m.name === event.function && m.status === 'pending');
          if (idx === -1) {
            return [...prev, { role: 'function', name: event.function, args: event.args, result: event.result, status: 'done', time: Date.now(), id: Date.now() }];
          }
          const realIdx = prev.length - 1 - idx;
          const updated = [...prev];
          updated[realIdx] = { ...updated[realIdx], args: event.args, result: event.result, status: 'done' };
          return updated;
        });
        setLastFunction({ name: event.function, result: event.result, args: event.args });
        if (event.function === 'create_ticket' || event.function === 'update_ticket_status') {
          onTicketsChange && onTicketsChange();
        }
        updateStatus('speaking');
        break;
      case 'response.done':
        // Fallback: commit any streamed text that wasn't committed by transcript.done
        if (aiTextRef.current.trim()) {
          setTranscript(prev => [
            ...prev,
            { role: 'assistant', text: aiTextRef.current, time: Date.now() },
          ]);
          aiTextRef.current = '';
          setCurrentAiText('');
        }
        if (statusRef.current !== 'idle') updateStatus('active');
        break;
      case 'error':
        setError(event.message || 'An error occurred');
        updateStatus('error');
        break;
      default:
        break;
    }
  };

  const startMicCapture = async (ws) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      // AudioWorklet
      const blob = new Blob([PROCESSOR_CODE], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      workletBlobRef.current = blobUrl;
      await ctx.audioWorklet.addModule(blobUrl);

      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, 'audio-capture');
      workletRef.current = worklet;

      worklet.port.onmessage = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const b64 = float32ToInt16Base64(e.data);
        wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64 }));
      };

      source.connect(worklet);
    } catch (e) {
      // Close the WebSocket cleanly when mic fails
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
      wsRef.current = null;
      stopMicCapture();

      // Detect iframe microphone restriction
      const inIframe = window !== window.top;
      if (inIframe) {
        setError('IFRAME_MIC_BLOCKED');
      } else {
        setError('Microphone access denied. Please allow microphone access in your browser and try again.');
      }
      updateStatus('error');
    }
  };

  const stopMicCapture = () => {
    if (workletRef.current) {
      try { workletRef.current.disconnect(); } catch (e) {}
      workletRef.current = null;
    }
    if (workletBlobRef.current) {
      URL.revokeObjectURL(workletBlobRef.current);
      workletBlobRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) {}
      audioCtxRef.current = null;
    }
    if (playbackCtxRef.current) {
      try { playbackCtxRef.current.close(); } catch (e) {}
      playbackCtxRef.current = null;
    }
    nextPlayTimeRef.current = 0;
  };

  const disconnect = useCallback(() => {
    shouldAutoReconnectRef.current = false; // User explicitly ended — no auto-reconnect
    preserveTranscriptRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopMicCapture();
    updateStatus('idle');
    aiTextRef.current = '';
    setCurrentAiText('');
  }, []); // eslint-disable-line

  return {
    status,
    transcript,
    currentAiText,
    lastFunction,
    error,
    connect,
    disconnect,
  };
}
