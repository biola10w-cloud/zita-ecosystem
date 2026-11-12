'use client';

import { useEffect, useRef, useState } from 'react';
import { Headphones, Pause, Play, Square } from 'lucide-react';

export function ListenControls({ text, language }: { text: string; language: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [rate, setRate] = useState(1);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const matches = voices.filter(voice => voice.lang.split(/[-_]/)[0].toLowerCase() === language.split('-')[0].toLowerCase());

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    setSupported(true);
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', update); };
  }, []);

  function stop() {
    generation.current++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    utterance.current = null;
    setState('idle');
  }
  useEffect(() => {
    stop(); setMessage('');
    return () => { generation.current++; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
  }, [text, language]);

  function play() {
    const speech = window.speechSynthesis;
    if (state === 'paused') { speech.resume(); setState('playing'); return; }
    stop(); setMessage('');
    // Short utterances avoid browser limits on long chapters. Keep every character.
    const chunks = text.match(/[\s\S]{1,220}(?:\s|$)|[\s\S]{1,220}/g) ?? [];
    const run = generation.current;
    const voice = matches.find(item => item.name === voiceName) ?? matches[0];
    let index = 0;
    const next = () => {
      if (run !== generation.current) return;
      if (index >= chunks.length) { setState('idle'); setMessage('Chapter finished. Choose the next chapter to keep listening.'); return; }
      const part = new SpeechSynthesisUtterance(chunks[index++]);
      part.lang = language; part.rate = rate; part.voice = voice;
      part.onend = next;
      part.onerror = event => { if (run === generation.current && event.error !== 'canceled' && event.error !== 'interrupted') { setState('idle'); setMessage('The voice could not play. Try another voice or try again.'); } };
      utterance.current = part;
      speech.speak(part);
    };
    setState('playing'); next();
  }

  return <section className="listen-panel" aria-label="Listen to this chapter">
    <div className="listen-heading"><Headphones size={19} /><strong>Listen to this chapter</strong></div>
    <div className="listen-actions">
      {state === 'playing' ? <button className="button button-dark" onClick={() => { window.speechSynthesis.pause(); setState('paused'); }}><Pause size={16} /> Pause</button>
        : <button className="button button-dark" disabled={!supported || matches.length === 0 || !text} onClick={play}><Play size={16} /> {state === 'paused' ? 'Resume' : 'Listen'}</button>}
      <button className="button button-light" disabled={state === 'idle'} onClick={stop}><Square size={15} /> Stop</button>
      <label>Speed<select aria-label="Listening speed" value={rate} onChange={event => { stop(); setRate(Number(event.target.value)); }}>{[0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
      {matches.length > 0 && <label>Voice<select aria-label="Narrator voice" value={voiceName || matches[0]?.name} onChange={event => { stop(); setVoiceName(event.target.value); }}>{matches.map(voice => <option key={voice.voiceURI} value={voice.name}>{voice.name}</option>)}</select></label>}
    </div>
    <p role="status">{message || (!supported ? 'Voice reading is not supported by this browser.' : !matches.length ? 'No voice for this language is installed on your device. Add a matching voice in your device settings.' : 'Uses your device’s voices. Keep this page open while listening.')}</p>
  </section>;
}
