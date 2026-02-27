import React from "react";
import { Send, Mic, Square, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "motion/react";

interface ChatTabProps {
  messages: { role: "user" | "model"; text: string }[];
  input: string;
  setInput: (val: string) => void;
  isLoading: boolean;
  isRecording: boolean;
  handleSend: (text?: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  speak: (text: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatTab({
  messages, input, setInput, isLoading, isRecording,
  handleSend, startRecording, stopRecording, speak, messagesEndRef
}: ChatTabProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 flex flex-col"
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scroll-smooth">
        {messages.map((msg, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            key={idx} 
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
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
          </motion.div>
        ))}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
            className="flex justify-start"
          >
            <div className="bg-[#1E2025] rounded-[24px] rounded-bl-[4px] p-4 flex gap-1.5 items-center">
              <div className="w-1.5 h-1.5 bg-[#C4C7C5] rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-[#C4C7C5] rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-1.5 h-1.5 bg-[#C4C7C5] rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
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
    </motion.div>
  );
}
