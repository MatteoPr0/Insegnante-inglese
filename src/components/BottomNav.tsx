import React from "react";
import { MessageSquare, Phone, ListTodo } from "lucide-react";

interface BottomNavProps {
  tab: "chat" | "voice" | "practice";
  setTab: (tab: "chat" | "voice" | "practice") => void;
  isCallActive: boolean;
  endCall: () => void;
}

export function BottomNav({ tab, setTab, isCallActive, endCall }: BottomNavProps) {
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
    <nav className="bg-[#1E2025] h-20 flex items-center justify-around px-2 pb-2 shrink-0 z-20">
      <NavItem id="chat" icon={<MessageSquare className="w-5 h-5" />} label="Chat" />
      <NavItem id="voice" icon={<Phone className="w-5 h-5" />} label="Voice" />
      <NavItem id="practice" icon={<ListTodo className="w-5 h-5" />} label="Practice" />
    </nav>
  );
}
