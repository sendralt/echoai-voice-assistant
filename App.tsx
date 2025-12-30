
import React, { useState, useEffect, useRef } from 'react';
import { MessageRole, ChatMessage, ModelType, VoicePersona, AudioSettings } from './types';
import { gemini } from './services/geminiService';
import { Visualizer } from './components/Visualizer';

// Discrete Status Indicator Component
interface StatusIndicatorProps {
  label: string;
  status: 'active' | 'processing' | 'error' | 'inactive';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ label, status }) => {
  const colors = {
    active: 'text-[#39ff14] border-[#39ff14]',
    processing: 'text-[#0066ff] border-[#0066ff] animate-pulse',
    error: 'text-red-500 border-red-500',
    inactive: 'text-[#00f2ff44] border-[#00f2ff22]',
  };

  const icons = {
    active: '●',
    processing: '◌',
    error: '×',
    inactive: '○',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 border rounded-sm transition-all duration-500 ${colors[status]}`}>
      <span className="text-[10px] font-bold leading-none">{icons[status]}</span>
      <span className="text-[8px] font-black tracking-[0.2em] uppercase whitespace-nowrap">{label}</span>
    </div>
  );
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [lastError, setLastError] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<ModelType>('gemini-3-flash-preview');
  const [activeVoicePersona, setActiveVoicePersona] = useState<VoicePersona>('Zephyr');
  const [liveTranscription, setLiveTranscription] = useState<{ text: string, isUser: boolean } | null>(null);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ volume: 0.8, speed: 1.0 });
  const [showSettings, setShowSettings] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, liveTranscription, isProcessing]);

  useEffect(() => {
    gemini.setAudioSettings(audioSettings);
  }, [audioSettings]);

  const showFeedback = (msg: string) => {
    setCommandFeedback(msg);
    setTimeout(() => setCommandFeedback(null), 3000);
  };

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedInput = inputText.trim();
    if (!trimmedInput || isProcessing) return;

    gemini.stopAudio();
    setLastError(false);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content: trimmedInput,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await gemini.sendChatMessage(userMessage.content, activeModel, messages);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.ASSISTANT,
        content: response.text,
        timestamp: Date.now(),
        sources: response.sources
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      setLastError(true);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.ASSISTANT,
        content: `UPLINK_ERROR: ${error.message || "UNABLE TO RESOLVE QUERY."}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleVoice = async () => {
    if (voiceActive) {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setVoiceActive(false);
      setLiveTranscription(null);
    } else {
      setLastError(false);
      setVoiceActive(true);
      try {
        const session = await gemini.connectLive(activeVoicePersona, {
          onTranscription: (text, isUser) => setLiveTranscription({ text, isUser }),
          onTurnComplete: () => setLiveTranscription(null),
          onError: () => {
            setVoiceActive(false);
            setLastError(true);
          },
          onToolCall: async (name, args) => {
            if (name === 'clear_chat') {
              setMessages([]);
              showFeedback("SYSTEM_HISTORY_PURGED");
              return "Chat cleared.";
            }
            if (name === 'set_volume') {
              const level = Math.max(0, Math.min(100, args.level)) / 100;
              setAudioSettings(prev => ({ ...prev, volume: level }));
              showFeedback(`VOLUME_ADJUSTED_${Math.round(level * 100)}%`);
              return `Volume set to ${Math.round(level * 100)}%`;
            }
            if (name === 'set_speed') {
              const rate = Math.max(0.5, Math.min(2.0, args.rate));
              setAudioSettings(prev => ({ ...prev, speed: rate }));
              showFeedback(`SPEED_CALIBRATED_${rate.toFixed(1)}X`);
              return `Playback speed set to ${rate.toFixed(1)}x`;
            }
            return "Command unknown.";
          }
        });
        if (!session) { setVoiceActive(false); return; }
        liveSessionRef.current = session;
      } catch { 
        setVoiceActive(false); 
        setLastError(true);
      }
    }
  };

  const handleRepeat = (text: string) => {
    gemini.speakText(text, activeVoicePersona);
  };

  const handleStopAudio = () => {
    gemini.stopAudio();
  };

  return (
    <div className="flex flex-col h-screen relative border-[12px] border-[#0a0a0a] shadow-[inset_0_0_120px_rgba(0,102,255,0.2)] bg-[#050505] overflow-hidden">
      {/* HUD Frame Elements */}
      <div className="absolute top-4 left-4 border-t-2 border-l-2 border-[#00f2ff] w-16 h-16 opacity-40 z-0"></div>
      <div className="absolute top-4 right-4 border-t-2 border-r-2 border-[#00f2ff] w-16 h-16 opacity-40 z-0"></div>
      <div className="absolute bottom-4 left-4 border-b-2 border-l-2 border-[#00f2ff] w-16 h-16 opacity-40 z-0"></div>
      <div className="absolute bottom-4 right-4 border-b-2 border-r-2 border-[#00f2ff] w-16 h-16 opacity-40 z-0"></div>

      {/* Voice Command Feedback Notification */}
      {commandFeedback && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#39ff1411] border border-[#39ff1444] px-6 py-2 hud-panel animate-bounce">
          <span className="text-[#39ff14] text-[10px] font-black tracking-[0.4em] uppercase">{commandFeedback}</span>
        </div>
      )}

      {/* Header HUD */}
      <header className="px-10 py-6 border-b border-[#00f2ff22] flex flex-wrap justify-between items-center z-30 bg-[#050505]/90 backdrop-blur-md gap-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
             <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#00f2ff]/30 animate-[spin_15s_linear_infinite] absolute inset-0"></div>
             <div className="w-16 h-16 rounded-full border border-[#00f2ff] flex items-center justify-center bg-[#00f2ff]/5 shadow-[0_0_25px_rgba(0,242,255,0.3)]">
                <div className="w-8 h-8 bg-[#00f2ff] rounded-sm animate-pulse opacity-80" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}></div>
             </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-widest text-[#00f2ff] hud-font glitch-text">ECHO_OS V.4.0</h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-[9px] font-bold text-[#0066ff] tracking-[0.4em] uppercase">SYSTEM_STATE: 
                <span className={voiceActive ? "text-[#39ff14] animate-pulse" : "text-[#00f2ff]"}> {voiceActive ? "VOICE_ACTIVE" : "STANDBY"}</span>
              </span>
              <div className="h-[1px] w-32 bg-[#00f2ff11] relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-[#00f2ff]/50 w-1/4 animate-[translateX_1.5s_infinite]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* System Status Indicators */}
        <div className="flex gap-4 items-center">
          <StatusIndicator 
            label="Search Grounding" 
            status={isProcessing ? 'processing' : 'active'} 
          />
          <StatusIndicator 
            label="Voice Input" 
            status={voiceActive ? 'active' : lastError ? 'error' : 'inactive'} 
          />
          <StatusIndicator 
            label="AI Processing" 
            status={isProcessing ? 'processing' : lastError ? 'error' : 'inactive'} 
          />
        </div>

        {/* Global Controls HUD Panel */}
        <div className="flex gap-8 items-center bg-[#00f2ff05] px-6 py-3 border border-[#00f2ff11] hud-panel">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-[#00f2ff] opacity-40 tracking-widest uppercase text-center">Neural_Core</span>
            <div className="flex bg-[#050505] p-1 border border-[#00f2ff33] rounded-sm">
              <button
                onClick={() => setActiveModel('gemini-3-flash-preview')}
                className={`px-3 py-1 text-[9px] font-bold tracking-tighter transition-all ${activeModel === 'gemini-3-flash-preview' ? 'bg-[#00f2ff] text-black shadow-[0_0_15px_rgba(0,242,255,0.5)]' : 'text-[#00f2ff33] hover:text-[#00f2ff66]'}`}
              >
                FLASH
              </button>
              <button
                onClick={() => setActiveModel('gemini-3-pro-preview')}
                className={`px-3 py-1 text-[9px] font-bold tracking-tighter transition-all ${activeModel === 'gemini-3-pro-preview' ? 'bg-[#0066ff] text-white shadow-[0_0_15px_rgba(0,102,255,0.5)]' : 'text-[#0066ff33] hover:text-[#0066ff66]'}`}
              >
                PRO
              </button>
            </div>
          </div>

          <div className="w-[1px] h-8 bg-[#00f2ff11]"></div>

          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-[#39ff14] opacity-40 tracking-widest uppercase text-center">Voice_Persona</span>
            <div className="flex bg-[#050505] p-1 border border-[#39ff1433] rounded-sm">
              {(['Zephyr', 'Puck', 'Kore', 'Charon'] as VoicePersona[]).map((persona) => (
                <button 
                  key={persona}
                  onClick={() => setActiveVoicePersona(persona)} 
                  className={`px-2 py-1 text-[9px] font-bold tracking-tighter transition-all ${activeVoicePersona === persona ? 'bg-[#39ff14] text-black shadow-[0_0_15px_rgba(57,255,20,0.5)]' : 'text-[#39ff1433] hover:text-[#39ff1466]'}`}
                >
                  {persona.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          <div className="w-[1px] h-8 bg-[#00f2ff11]"></div>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 border transition-all ${showSettings ? 'border-[#00f2ff] bg-[#00f2ff11] text-[#00f2ff]' : 'border-[#00f2ff33] text-[#00f2ff44] hover:text-[#00f2ff]'}`}
            title="Audio Interface Controls"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        </div>

        {showSettings && (
          <div className="absolute top-[85px] right-10 bg-[#050505] border border-[#00f2ff33] hud-panel p-6 z-40 w-64 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            <h3 className="text-[10px] font-black text-[#00f2ff] tracking-[0.3em] uppercase mb-4 border-b border-[#00f2ff11] pb-2">Audio_Parameters</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] font-bold text-[#00f2ff55] uppercase">
                  <span>Output_Volume</span>
                  <span className="text-[#39ff14]">{Math.round(audioSettings.volume * 100)}%</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.01" 
                  value={audioSettings.volume}
                  onChange={(e) => setAudioSettings(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-[#00f2ff11] rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[8px] font-bold text-[#00f2ff55] uppercase">
                  <span>Playback_Speed</span>
                  <span className="text-[#0066ff]">{audioSettings.speed.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.5" max="2.0" step="0.1" 
                  value={audioSettings.speed}
                  onChange={(e) => setAudioSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-[#00f2ff11] rounded-lg appearance-none cursor-pointer accent-[#0066ff]"
                />
              </div>
              <button 
                onClick={handleStopAudio}
                className="w-full py-2 border border-red-500/30 text-red-500 text-[10px] font-black tracking-widest uppercase hover:bg-red-500/10 transition-all"
              >
                Halt_All_Audio
              </button>
            </div>
          </div>
        )}
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8 space-y-10 scroll-smooth custom-scrollbar relative z-10">
        {messages.length === 0 && !liveTranscription && (
          <div className="flex flex-col items-center justify-center h-full opacity-20 select-none">
            <div className="text-center space-y-6">
              <div className="hud-font text-5xl font-black text-[#00f2ff] tracking-tighter text-glow">INITIATE UPLINK</div>
              <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f2ff] to-transparent"></div>
              <div className="flex justify-center gap-10">
                <div className="text-[10px] tracking-[0.4em] uppercase">Search Grounding: [ONLINE]</div>
                <div className="text-[10px] tracking-[0.4em] uppercase">Voice Commands: [ENABLED]</div>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'} group`}>
            <div className={`max-w-[80%] px-8 py-5 transition-all duration-300 hud-panel relative ${
              msg.role === MessageRole.USER 
                ? 'border-[#0066ff] bg-[#0066ff]/5 text-white' 
                : 'border-[#00f2ff] bg-[#00f2ff]/5 text-[#00f2ff]'
            }`}>
              <div className={`absolute top-0 ${msg.role === MessageRole.USER ? 'right-0' : 'left-0'} w-4 h-4 border-t-2 border-${msg.role === MessageRole.USER ? 'l' : 'r'}-2 border-current opacity-60`}></div>
              <div className="flex justify-between items-center mb-4 opacity-50 text-[9px] font-bold tracking-[0.3em] border-b border-current/10 pb-2 uppercase">
                <span className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full bg-current ${msg.role === MessageRole.ASSISTANT ? 'animate-pulse' : ''}`}></div>
                  {msg.role === MessageRole.USER ? 'CLIENT_ID' : 'SYSTEM_ECHO'}
                </span>
                <span className="flex gap-4 items-center">
                   {msg.role === MessageRole.ASSISTANT && (
                     <>
                       <span className="text-[#00f2ff88]">CORE_{activeModel.replace('gemini-3-', '').split('-')[0].toUpperCase()}</span>
                       <button 
                        onClick={() => handleRepeat(msg.content)}
                        className="hover:text-white transition-colors p-1 bg-white/5 rounded border border-white/10"
                        title="Replay Audio Node"
                       >
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                       </button>
                     </>
                   )}
                   <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                </span>
              </div>
              <p className="text-[15px] leading-relaxed font-light tracking-wide">{msg.content}</p>
              {msg.sources && (
                <div className="mt-6 pt-4 border-t border-[#00f2ff22]">
                  <div className="text-[8px] font-black text-[#00f2ff] mb-3 tracking-[0.4em] uppercase opacity-60">Verified Data Nodes</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {msg.sources.map((source, idx) => (
                      <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[10px] text-[#39ff14] hover:bg-[#39ff1411] p-2 border border-[#39ff1422] transition-all group/link">
                        <div className="w-1.5 h-1.5 bg-[#39ff14] group-hover/link:animate-ping"></div>
                        <span className="truncate font-bold tracking-wider">{source.title.toUpperCase()}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {liveTranscription && (
          <div className={`flex ${liveTranscription.isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
             <div className="hud-panel px-8 py-5 border-[#39ff14] bg-[#39ff1405] max-w-[80%] border-l-4">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-2 h-2 bg-[#39ff14] animate-ping rounded-full"></div>
                   <span className="text-[9px] text-[#39ff14] font-black tracking-[0.4em] uppercase">Signal_Stream // Persona_{activeVoicePersona.toUpperCase()}</span>
                </div>
                <p className="text-[#39ff14] italic text-[15px] font-medium tracking-wide">"{liveTranscription.text}"</p>
             </div>
          </div>
        )}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="hud-panel px-8 py-4 border-[#0066ff] bg-[#0066ff05] flex items-center gap-4 border-l-4">
              <div className="flex gap-1">
                <div className="w-1 h-3 bg-[#0066ff] animate-[bounce_1s_infinite]"></div>
                <div className="w-1 h-3 bg-[#0066ff] animate-[bounce_1s_infinite_0.1s]"></div>
                <div className="w-1 h-3 bg-[#0066ff] animate-[bounce_1s_infinite_0.2s]"></div>
              </div>
              <span className="text-[10px] font-black tracking-[0.5em] uppercase text-[#0066ff]">Accessing Global Data Repositories...</span>
            </div>
          </div>
        )}
      </main>

      <footer className="p-10 border-t border-[#00f2ff22] bg-[#050505]/95 backdrop-blur-2xl relative z-20">
        <div className="max-w-6xl mx-auto flex items-center gap-10">
          <div className="relative group shrink-0">
            <div className={`absolute inset-[-10px] rounded-full blur-2xl transition-all duration-700 ${voiceActive ? 'bg-[#39ff1422] opacity-100' : 'bg-[#00f2ff08] opacity-0'}`}></div>
            <button 
              onClick={toggleVoice}
              className={`w-24 h-24 rounded-full relative flex items-center justify-center transition-all duration-500 z-10 border-4 ${
                voiceActive 
                  ? 'border-[#39ff14] shadow-[0_0_60px_rgba(57,255,20,0.5)] scale-110' 
                  : 'border-[#00f2ff] hover:shadow-[0_0_40px_rgba(0,242,255,0.4)]'
              } bg-[#0a0a0a]`}
            >
              <div className={`absolute inset-0 rounded-full border-2 border-dashed opacity-20 ${voiceActive ? 'border-[#39ff14] animate-[spin_3s_linear_infinite]' : 'border-[#00f2ff] animate-[spin_12s_linear_infinite]'}`}></div>
              <div className={`absolute inset-2 rounded-full border border-dotted opacity-10 ${voiceActive ? 'border-[#39ff14] animate-[spin_8s_linear_infinite_reverse]' : 'border-[#00f2ff] animate-[spin_20s_linear_infinite_reverse]'}`}></div>
              {voiceActive ? (
                <div className="flex flex-col items-center">
                  <div className="w-4 h-4 bg-[#39ff14] rounded-sm rotate-45 animate-pulse"></div>
                  <span className="text-[9px] font-black text-[#39ff14] mt-2 tracking-tighter">LIVE</span>
                </div>
              ) : (
                <svg className="w-10 h-10 text-[#00f2ff] drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          </div>

          <form onSubmit={handleSendText} className="flex-1 relative flex items-center">
             <div className="absolute left-5 z-10 pointer-events-none opacity-40">
                <span className="text-[#00f2ff] font-black text-sm tracking-widest">QUERY_IN:</span>
             </div>
             <input 
               type="text" 
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               disabled={voiceActive || isProcessing}
               placeholder={voiceActive ? "VOICE_COMMANDS_ACTIVE..." : "WAITING_FOR_COMMAND_"}
               className="w-full bg-[#00f2ff05] border border-[#00f2ff22] rounded-sm pl-24 pr-40 py-5 text-[#00f2ff] placeholder-[#00f2ff22] outline-none focus:border-[#00f2ff44] focus:bg-[#00f2ff0c] transition-all text-sm tracking-widest font-bold uppercase"
             />
             <div className="absolute right-5 flex items-center gap-6">
               {voiceActive && <Visualizer isActive={voiceActive} color={liveTranscription?.isUser ? '#39ff14' : '#00f2ff'} />}
               {!voiceActive && (
                 <button 
                   type="submit" 
                   disabled={!inputText.trim() || isProcessing}
                   className="flex items-center gap-3 px-4 py-2 border border-[#00f2ff] text-[#00f2ff] hover:bg-[#00f2ff] hover:text-black transition-all disabled:opacity-10 group"
                 >
                   <span className="text-[10px] font-black tracking-widest hidden sm:inline">EXECUTE</span>
                   <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                   </svg>
                 </button>
               )}
             </div>
          </form>
        </div>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-20 px-10 pointer-events-none opacity-20 overflow-hidden">
          <div className="text-[7px] text-[#00f2ff] font-mono tracking-[0.5em] animate-[marquee_20s_linear_infinite] whitespace-nowrap">
            SEARCH_MODULE_CONNECTED // VOICE_CMDS: [CLEAR, VOL, SPEED] // ENCRYPTION_L9 // 
          </div>
          <div className="text-[7px] text-[#00f2ff] font-mono tracking-[0.5em] animate-[marquee_20s_linear_infinite] whitespace-nowrap">
            PERSONA: {activeVoicePersona.toUpperCase()} // VOL: {Math.round(audioSettings.volume * 100)}% // SPEED: {audioSettings.speed}x // 
          </div>
        </div>
      </footer>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #050505; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #00f2ff22; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #00f2ff44; }
        @keyframes translateX { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        .text-glow { text-shadow: 0 0 10px rgba(0, 242, 255, 0.5), 0 0 20px rgba(0, 242, 255, 0.3); }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 2px; background: #00f2ff; cursor: pointer; box-shadow: 0 0 10px #00f2ff; }
      `}</style>
    </div>
  );
};

export default App;
