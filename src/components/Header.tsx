import React from "react";
import { Stethoscope, Flame } from "lucide-react";

interface HeaderProps {
  level: number;
  xp: number;
  xpToNextLevel: number;
  streak: number;
}

export function Header({ level, xp, xpToNextLevel, streak }: HeaderProps) {
  return (
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
  );
}
