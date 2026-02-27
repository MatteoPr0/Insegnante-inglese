import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Mic,
  Flame,
  Play,
  Square,
  Stethoscope,
  MessageSquare,
  Phone,
  PhoneOff,
  ListTodo,
  CheckCircle,
  XCircle,
  Trophy,
  ArrowRight,
  BrainCircuit
} from "lucide-react";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import ReactMarkdown from "react-markdown";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Sei "Atlas", un tutor di inglese AI ultra-personalizzato. Il tuo obiettivo è sostituire Duolingo offrendo un apprendimento adattivo, conversazionale e basato sulla pratica reale.

L'utente è un medico italiano specializzando in medicina dello sport che vuole imparare/migliorare l'inglese.

MODALITÀ DI INTERAZIONE:
1. Valutazione Iniziale: Al primo messaggio, proponi un brevissimo test di 3 domande (una alla volta) per capire il livello dell'utente (A1-C2).
2. Struttura a "Unità": Dopo il test, organizza le sessioni in micro-lezioni (Grammatica, Vocabolario, Speaking).
3. Conversational First: Incoraggia la conversazione. Se l'utente commette un errore, annotalo e correggilo alla fine della tua risposta in modo costruttivo.

REGOLE DI FEEDBACK E LINGUA:
- Usa l'inglese per insegnare e conversare.
- **IMPORTANTE**: Usa l'italiano come lingua di supporto. Se l'utente non capisce qualcosa, fa una domanda in italiano, o ha un livello basso, fornisci spiegazioni chiare in italiano.
- Usa il rinforzo positivo (assegna punti virtuali es. "+10 XP" o elogia lo "streak" nel testo).
- Fornisci la spiegazione grammaticale (in italiano se necessario) solo se l'errore è grave o ripetuto.
- Se l'utente dice qualcosa di innaturale, suggerisci la versione "Native-like".

PERSONALIZZAZIONE:
- Integra termini tecnici o scenari clinici (es. parlare con un atleta infortunato, diagnosticare una distorsione, ecc.) nelle lezioni.
- Inserisci brevi momenti di "Roleplay" (es. "Fingiamo di essere al ristorante" o "Fingiamo che io sia un paziente con dolore al ginocchio").

PROTOCOLLO VOCALE:
- Parla in modo chiaro ma naturale (usa contrazioni come "don't", "wanna" se il livello è avanzato).
- Se l'utente non risponde o sembra in difficoltà, offri un piccolo suggerimento (hint) per continuare la conversazione.

Rispondi in modo amichevole, chiaro e naturale. Inizia salutando l'utente e avviando il test di valutazione.`;

// --- Audio Utilities ---
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

const float32ToPCM16Base64 = (float32Array: Float32Array) => {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const pcm16Base64ToFloat32 = (base64: string) => {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new DataView(buffer);
  for (let i = 0; i < binary.length; i++) {
    view.setUint8(i, binary.charCodeAt(i));
  }
  const float32Array = new Float32Array(buffer.byteLength / 2);
  for (let i = 0; i < float32Array.length; i++) {
    float32Array[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return float32Array;
};

export default function App() {
  const [tab, setTab] = useState<"chat" | "voice" | "practice">("chat");
  
  // Progression State
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(3); // Example streak
  const xpToNextLevel = level * 100;

  // Chat State
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Voice Mode State
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Practice State
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [currentExercise, setCurrentExercise] = useState<any>(null);
  const [exerciseAnswer, setExerciseAnswer] = useState("");
  const [exerciseFeedback, setExerciseFeedback] = useState<{isCorrect: boolean, explanation: string} | null>(null);

  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    chatRef.current = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    handleSend("Ciao Atlas, sono pronto per iniziare.", true);
    
    return () => {
      endCall();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const addXp = (amount: number) => {
    setXp(prev => {
      const newXp = prev + amount;
      if (newXp >= level * 100) {
        setLevel(l => l + 1);
        return newXp - (level * 100);
      }
      return newXp;
    });
  };

  const extractXP = (text: string) => {
    const match = text.match(/\+(\d+)\s*XP/i);
    if (match && match[1]) {
      addXp(parseInt(match[1], 10));
    }
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- Chat Logic ---
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) recognitionRef.current.stop();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async (textToSend?: string, isInitial = false) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    if (!isInitial) {
      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");
    }

    setIsLoading(true);

    try {
      if (!chatRef.current) {
        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.7 },
        });
      }

      const response = await chatRef.current.sendMessage({ message: text });
      const responseText = response.text || "";

      setMessages((prev) => [...prev, { role: "model", text: responseText }]);
      extractXP(responseText);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [...prev, { role: "model", text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Live API Call Logic ---
  const startCall = async () => {
    try {
      setIsConnecting(true);
      setTranscript("Connecting to Atlas...");
      
      if (audioContext.state === 'suspended') await audioContext.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } 
      });
      mediaStreamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      audioSourceRef.current = source;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const checkVolume = () => {
        if (!analyserRef.current || !isCallActive) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const average = sum / dataArray.length;
        setIsUserSpeaking(average > 10);
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        if (!liveSessionRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const base64Data = float32ToPCM16Base64(inputData);
        
        liveSessionRef.current.then((session: any) => {
          session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=24000' } });
        }).catch(console.error);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      nextPlayTimeRef.current = audioContext.currentTime;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } },
          systemInstruction: SYSTEM_INSTRUCTION + "\n\nSei in una chiamata vocale. Rispondi in modo conciso e naturale, come in una vera conversazione telefonica. Non usare formattazione markdown.",
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsCallActive(true);
            setTranscript("Atlas is listening...");
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsModelSpeaking(true);
              const float32Data = pcm16Base64ToFloat32(base64Audio);
              const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
              audioBuffer.getChannelData(0).set(float32Data);
              
              const sourceNode = audioContext.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(audioContext.destination);
              
              const startTime = Math.max(audioContext.currentTime, nextPlayTimeRef.current);
              sourceNode.start(startTime);
              nextPlayTimeRef.current = startTime + audioBuffer.duration;
              
              sourceNode.onended = () => {
                if (audioContext.currentTime >= nextPlayTimeRef.current - 0.1) setIsModelSpeaking(false);
              };
            }

            if (message.serverContent?.interrupted) {
              nextPlayTimeRef.current = audioContext.currentTime;
              setIsModelSpeaking(false);
            }
            
            if (message.serverContent?.modelTurn) {
               const text = message.serverContent.modelTurn.parts.find(p => p.text)?.text;
               if (text) setTranscript(text);
            }
          },
          onerror: (err) => { console.error("Live API Error:", err); endCall(); },
          onclose: () => endCall()
        }
      });

      liveSessionRef.current = sessionPromise;

    } catch (err) {
      console.error("Failed to start call:", err);
      setIsConnecting(false);
      endCall();
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    setIsUserSpeaking(false);
    setTranscript("");
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (liveSessionRef.current) {
      liveSessionRef.current.then((session: any) => session.close()).catch(console.error);
      liveSessionRef.current = null;
    }
    if (audioProcessorRef.current) { audioProcessorRef.current.disconnect(); audioProcessorRef.current = null; }
    if (audioSourceRef.current) { audioSourceRef.current.disconnect(); audioSourceRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach(track => track.stop()); mediaStreamRef.current = null; }
  };

  // --- Practice Logic ---
  const generateExercise = async () => {
    setExerciseLoading(true);
    setExerciseFeedback(null);
    setExerciseAnswer("");
    setCurrentExercise(null);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Genera un esercizio di inglese livello B2 per un medico dello sport. Scegli casualmente tra 'multiple_choice' (4 opzioni) o 'fill_in_blank' (una parola mancante indicata con ___). L'argomento deve essere medicina dello sport (es. anatomia, infortuni, riabilitazione, dialogo con paziente).",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "La domanda o la frase da completare (usa ___ per lo spazio vuoto)" },
              type: { type: Type.STRING, description: "'multiple_choice' o 'fill_in_blank'" },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 opzioni se multiple_choice, altrimenti array vuoto" },
              correctAnswer: { type: Type.STRING, description: "La risposta corretta esatta" },
              explanation: { type: Type.STRING, description: "Spiegazione in italiano del perché è corretta e traduzione" }
            },
            required: ["question", "type", "options", "correctAnswer", "explanation"]
          }
        }
      });
      setCurrentExercise(JSON.parse(response.text || "{}"));
    } catch (e) {
      console.error("Failed to generate exercise", e);
    } finally {
      setExerciseLoading(false);
    }
  };

  const checkAnswer = (answer: string) => {
    if (!currentExercise) return;
    const isCorrect = answer.toLowerCase().trim() === currentExercise.correctAnswer.toLowerCase().trim();
    setExerciseFeedback({ isCorrect, explanation: currentExercise.explanation });
    if (isCorrect) {
      addXp(25); // Award 25 XP for correct exercise
    }
  };

  // --- UI Components ---
  const NavItem = ({ id, icon, label }: { id: "chat" | "voice" | "practice", icon: React.ReactNode, label: string }) => {
    const active = tab === id;
    return (
      <button 
        onClick={() => {
          if (isCallActive && id !== 'voice') endCall();
          setTab(id);
        }} 
        className="flex flex-col items-center gap-1 w-20"
      >
        <div className={`w-16 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
          active ? 'bg-[#93D7B7] text-[#003822]' : 'text-[#C4C7C5] hover:bg-[#282A2F]'
        }`}>
          {icon}
        </div>
        <span className={`text-[11px] font-medium transition-colors ${active ? 'text-[#E2E2E2]' : 'text-[#C4C7C5]'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex justify-center h-[100dvh] bg-[#111318] text-[#E2E2E2] font-sans overflow-hidden">
      <div className="w-full max-w-md flex flex-col relative shadow-2xl sm:border-x sm:border-[#1E2025] bg-[#111318]">
        
        {/* Material You Header */}
        <header className="px-5 pt-6 pb-4 flex flex-col gap-4 bg-[#111318] z-20 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#93D7B7] flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-[#003822]" />
              </div>
              <h1 className="text-2xl font-normal tracking-tight">Atlas</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-[#334B38] text-[#A8E5B6] px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5">
                <Flame className="w-4 h-4" /> {streak}
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-medium text-[#C4C7C5]">
              <span>Level {level}</span>
              <span>{xp} / {xpToNextLevel} XP</span>
            </div>
            <div className="h-2.5 bg-[#1E2025] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#93D7B7] rounded-full transition-all duration-700 ease-out" 
                style={{ width: `${Math.min((xp / xpToNextLevel) * 100, 100)}%` }} 
              />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* CHAT TAB */}
          {tab === "chat" && (
            <div className="absolute inset-0 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scroll-smooth">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-[24px] p-4 ${
                      msg.role === "user"
                        ? "bg-[#93D7B7] text-[#003822] rounded-br-[4px]"
                        : "bg-[#1E2025] text-[#E2E2E2] rounded-bl-[4px]"
                    }`}>
                      <div className={`prose prose-sm max-w-none prose-p:leading-relaxed ${msg.role === 'user' ? 'prose-p:text-[#003822]' : 'prose-invert prose-p:text-[#E2E2E2]'}`}>
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                      {msg.role === "model" && (
                        <div className="mt-2 flex items-center gap-4 pt-2">
                          <button
                            onClick={() => speak(msg.text)}
                            className="text-[#C4C7C5] hover:text-[#93D7B7] transition-colors flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
                          >
                            <Play className="w-3 h-3" /> Listen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#1E2025] rounded-[24px] rounded-bl-[4px] p-4 flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 bg-[#C4C7C5] rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-[#C4C7C5] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      <div className="w-1.5 h-1.5 bg-[#C4C7C5] rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input (Material You Pill) */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#111318] via-[#111318] to-transparent">
                <div className="flex items-end gap-2 bg-[#1E2025] rounded-[28px] p-1.5 shadow-lg">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-full flex-shrink-0 transition-all duration-300 ${
                      isRecording ? "bg-[#FFB4AB] text-[#690005]" : "text-[#C4C7C5] hover:bg-[#282A2F]"
                    }`}
                  >
                    {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                  </button>
                  
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
                    placeholder={isRecording ? "Listening..." : "Message Atlas..."}
                    className="flex-1 bg-transparent py-3 px-2 focus:outline-none text-sm text-[#E2E2E2] placeholder-[#C4C7C5]"
                  />
                  
                  <button
                    onClick={() => !isLoading && handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="p-3 rounded-full bg-[#93D7B7] text-[#003822] disabled:bg-[#282A2F] disabled:text-[#C4C7C5] transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VOICE TAB */}
          {tab === "voice" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                <div className={`w-64 h-64 rounded-full bg-[#93D7B7] blur-3xl transition-all duration-1000 ${isModelSpeaking ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
                <div className={`absolute w-64 h-64 rounded-full bg-[#A8C7FA] blur-3xl transition-all duration-1000 ${isUserSpeaking ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
              </div>

              <div className="relative z-10 flex flex-col items-center w-full max-w-xs">
                <div className="relative mb-12">
                  <div className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCallActive 
                      ? isModelSpeaking 
                        ? 'bg-[#93D7B7] shadow-[0_0_60px_rgba(147,215,183,0.4)] scale-110' 
                        : 'bg-[#1E2025] border-2 border-[#93D7B7]/50 shadow-[0_0_30px_rgba(147,215,183,0.1)]'
                      : 'bg-[#1E2025] border border-[#282A2F]'
                  }`}>
                    <Stethoscope className={`w-14 h-14 ${isCallActive && isModelSpeaking ? 'text-[#003822]' : 'text-[#93D7B7]'}`} />
                  </div>
                  
                  {isCallActive && (
                    <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isUserSpeaking ? 'bg-[#A8C7FA] shadow-[0_0_20px_rgba(168,199,250,0.5)] scale-110' : 'bg-[#282A2F] border border-[#1E2025]'
                    }`}>
                      <Mic className={`w-5 h-5 ${isUserSpeaking ? 'text-[#062E6F]' : 'text-[#C4C7C5]'}`} />
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-normal mb-2">Atlas Voice</h2>
                <p className="text-[#C4C7C5] text-sm mb-8 h-6">
                  {isConnecting ? "Connecting..." : 
                   isCallActive ? (isModelSpeaking ? "Atlas is speaking..." : "Listening...") : 
                   "Ready to practice speaking?"}
                </p>

                <div className="w-full h-24 mb-12 flex items-center justify-center text-center">
                  <p className="text-[#E2E2E2] text-sm line-clamp-3 px-4">
                    {transcript}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-6">
                  {!isCallActive ? (
                    <button
                      onClick={startCall}
                      disabled={isConnecting}
                      className="w-20 h-20 rounded-[28px] bg-[#93D7B7] hover:bg-[#AEEFD0] flex items-center justify-center shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                    >
                      <Phone className="w-8 h-8 text-[#003822] fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={endCall}
                      className="w-20 h-20 rounded-[28px] bg-[#FFB4AB] hover:bg-[#FFDAD6] flex items-center justify-center shadow-lg transition-transform hover:scale-105"
                    >
                      <PhoneOff className="w-8 h-8 text-[#690005] fill-current" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PRACTICE TAB */}
          {tab === "practice" && (
            <div className="absolute inset-0 overflow-y-auto p-5 pb-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#A8C7FA] flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-[#062E6F]" />
                </div>
                <div>
                  <h2 className="text-xl font-normal">Daily Practice</h2>
                  <p className="text-xs text-[#C4C7C5]">Sports Medicine Scenarios</p>
                </div>
              </div>

              {!currentExercise && !exerciseLoading && !exerciseFeedback && (
                <div className="bg-[#1E2025] rounded-[28px] p-8 text-center flex flex-col items-center gap-4">
                  <Trophy className="w-12 h-12 text-[#93D7B7] mb-2" />
                  <h3 className="text-lg font-medium">Ready for a challenge?</h3>
                  <p className="text-sm text-[#C4C7C5] mb-4">Complete a quick medical English exercise to earn 25 XP.</p>
                  <button 
                    onClick={generateExercise}
                    className="bg-[#93D7B7] text-[#003822] px-6 py-3 rounded-full font-medium flex items-center gap-2 hover:bg-[#AEEFD0] transition-colors"
                  >
                    Start Exercise <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {exerciseLoading && (
                <div className="bg-[#1E2025] rounded-[28px] p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
                  <div className="w-8 h-8 border-4 border-[#334B38] border-t-[#93D7B7] rounded-full animate-spin"></div>
                  <p className="text-[#C4C7C5] text-sm">Generating medical scenario...</p>
                </div>
              )}

              {currentExercise && !exerciseFeedback && (
                <div className="bg-[#1E2025] rounded-[28px] p-6 flex flex-col gap-6">
                  <div className="inline-block bg-[#334B38] text-[#A8E5B6] px-3 py-1 rounded-full text-xs font-medium self-start uppercase tracking-wider">
                    {currentExercise.type === 'multiple_choice' ? 'Multiple Choice' : 'Fill in the Blank'}
                  </div>
                  
                  <p className="text-lg leading-relaxed">{currentExercise.question}</p>

                  {currentExercise.type === 'multiple_choice' ? (
                    <div className="flex flex-col gap-3">
                      {currentExercise.options.map((opt: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => checkAnswer(opt)}
                          className="bg-[#282A2F] hover:bg-[#334B38] text-[#E2E2E2] p-4 rounded-2xl text-left transition-colors border border-transparent hover:border-[#93D7B7]/30"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <input
                        type="text"
                        value={exerciseAnswer}
                        onChange={(e) => setExerciseAnswer(e.target.value)}
                        placeholder="Type the missing word..."
                        className="bg-[#282A2F] text-[#E2E2E2] p-4 rounded-2xl w-full focus:outline-none focus:ring-2 focus:ring-[#93D7B7] placeholder-[#C4C7C5]"
                      />
                      <button
                        onClick={() => checkAnswer(exerciseAnswer)}
                        disabled={!exerciseAnswer.trim()}
                        className="bg-[#93D7B7] text-[#003822] p-4 rounded-full font-medium disabled:bg-[#282A2F] disabled:text-[#C4C7C5] transition-colors"
                      >
                        Submit Answer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {exerciseFeedback && (
                <div className={`rounded-[28px] p-6 flex flex-col gap-4 ${exerciseFeedback.isCorrect ? 'bg-[#334B38]' : 'bg-[#690005]/40'}`}>
                  <div className="flex items-center gap-3">
                    {exerciseFeedback.isCorrect ? (
                      <CheckCircle className="w-8 h-8 text-[#93D7B7]" />
                    ) : (
                      <XCircle className="w-8 h-8 text-[#FFB4AB]" />
                    )}
                    <h3 className={`text-xl font-medium ${exerciseFeedback.isCorrect ? 'text-[#A8E5B6]' : 'text-[#FFDAD6]'}`}>
                      {exerciseFeedback.isCorrect ? 'Excellent! +25 XP' : 'Not quite right'}
                    </h3>
                  </div>
                  
                  <div className="bg-[#111318]/50 p-4 rounded-2xl">
                    <p className="text-sm text-[#E2E2E2] leading-relaxed">{exerciseFeedback.explanation}</p>
                  </div>

                  <button
                    onClick={generateExercise}
                    className={`mt-2 p-4 rounded-full font-medium transition-colors ${
                      exerciseFeedback.isCorrect 
                        ? 'bg-[#93D7B7] text-[#003822] hover:bg-[#AEEFD0]' 
                        : 'bg-[#FFB4AB] text-[#690005] hover:bg-[#FFDAD6]'
                    }`}
                  >
                    Next Exercise
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Material You Bottom Navigation */}
        <nav className="bg-[#1E2025] h-20 flex items-center justify-around px-2 pb-2 shrink-0 z-20">
          <NavItem id="chat" icon={<MessageSquare className="w-5 h-5" />} label="Chat" />
          <NavItem id="voice" icon={<Phone className="w-5 h-5" />} label="Voice" />
          <NavItem id="practice" icon={<ListTodo className="w-5 h-5" />} label="Practice" />
        </nav>

      </div>
    </div>
  );
}
