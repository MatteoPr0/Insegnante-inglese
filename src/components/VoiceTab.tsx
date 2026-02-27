import React from "react";
import { Phone, PhoneOff, Mic, Stethoscope } from "lucide-react";
import { motion } from "motion/react";

interface VoiceTabProps {
  isCallActive: boolean;
  isConnecting: boolean;
  isModelSpeaking: boolean;
  isUserSpeaking: boolean;
  transcript: string;
  startCall: () => void;
  endCall: () => void;
}

export function VoiceTab({
  isCallActive, isConnecting, isModelSpeaking, isUserSpeaking, transcript, startCall, endCall
}: VoiceTabProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden"
    >
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
    </motion.div>
  );
}
