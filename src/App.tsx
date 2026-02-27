import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { AnimatePresence } from "motion/react";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { ChatTab } from "./components/ChatTab";
import { VoiceTab } from "./components/VoiceTab";
import { PracticeTab } from "./components/PracticeTab";

const apiKey = process.env.GEMINI_API_KEY || "missing_api_key";
const ai = new GoogleGenAI({ apiKey });

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
  const [level, setLevel] = useState(() => {
    const saved = localStorage.getItem("atlas_level");
    return saved ? parseInt(saved, 10) : 1;
  });
  const [xp, setXp] = useState(() => {
    const saved = localStorage.getItem("atlas_xp");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [streak, setStreak] = useState(() => {
    const saved = localStorage.getItem("atlas_streak");
    return saved ? parseInt(saved, 10) : 3;
  });
  const xpToNextLevel = level * 100;

  useEffect(() => {
    localStorage.setItem("atlas_level", level.toString());
    localStorage.setItem("atlas_xp", xp.toString());
    localStorage.setItem("atlas_streak", streak.toString());
  }, [level, xp, streak]);

  // Chat State
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>(() => {
    const saved = localStorage.getItem("atlas_messages");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved messages", e);
      }
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    localStorage.setItem("atlas_messages", JSON.stringify(messages));
  }, [messages]);

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
  const initializedRef = useRef(false);
  
  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const saved = localStorage.getItem("atlas_messages");
    let initialMessages: { role: "user" | "model"; text: string }[] = [];
    if (saved) {
      try {
        initialMessages = JSON.parse(saved);
      } catch (e) {}
    }

    const history = initialMessages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    chatRef.current = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
      history: history.length > 0 ? history : undefined,
    });

    if (initialMessages.length === 0) {
      handleSend("Ciao Atlas, sono pronto per iniziare.", true);
    }
    
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
        const history = messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        }));
        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.7 },
          history: history.length > 0 ? history : undefined,
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
        
        <Header level={level} xp={xp} xpToNextLevel={xpToNextLevel} streak={streak} />

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {tab === "chat" && (
              <ChatTab 
                key="chat"
                messages={messages} 
                input={input} 
                setInput={setInput} 
                isLoading={isLoading} 
                isRecording={isRecording} 
                handleSend={handleSend} 
                startRecording={startRecording} 
                stopRecording={stopRecording} 
                speak={speak} 
                messagesEndRef={messagesEndRef} 
              />
            )}

            {tab === "voice" && (
              <VoiceTab 
                key="voice"
                isCallActive={isCallActive} 
                isConnecting={isConnecting} 
                isModelSpeaking={isModelSpeaking} 
                isUserSpeaking={isUserSpeaking} 
                transcript={transcript} 
                startCall={startCall} 
                endCall={endCall} 
              />
            )}

            {tab === "practice" && (
              <PracticeTab 
                key="practice"
                currentExercise={currentExercise} 
                exerciseLoading={exerciseLoading} 
                exerciseFeedback={exerciseFeedback} 
                exerciseAnswer={exerciseAnswer} 
                setExerciseAnswer={setExerciseAnswer} 
                generateExercise={generateExercise} 
                checkAnswer={checkAnswer} 
              />
            )}
          </AnimatePresence>
        </div>

        <BottomNav tab={tab} setTab={setTab} isCallActive={isCallActive} endCall={endCall} />

      </div>
    </div>
  );
}
