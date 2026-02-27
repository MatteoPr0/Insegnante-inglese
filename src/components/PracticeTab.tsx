import React from "react";
import { BrainCircuit, Trophy, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { motion } from "motion/react";

interface PracticeTabProps {
  currentExercise: any;
  exerciseLoading: boolean;
  exerciseFeedback: { isCorrect: boolean; explanation: string } | null;
  exerciseAnswer: string;
  setExerciseAnswer: (val: string) => void;
  generateExercise: () => void;
  checkAnswer: (answer: string) => void;
}

export function PracticeTab({
  currentExercise, exerciseLoading, exerciseFeedback, exerciseAnswer,
  setExerciseAnswer, generateExercise, checkAnswer
}: PracticeTabProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 overflow-y-auto p-5 pb-24"
    >
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
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#1E2025] rounded-[28px] p-8 text-center flex flex-col items-center gap-4"
        >
          <Trophy className="w-12 h-12 text-[#93D7B7] mb-2" />
          <h3 className="text-lg font-medium">Ready for a challenge?</h3>
          <p className="text-sm text-[#C4C7C5] mb-4">Complete a quick medical English exercise to earn 25 XP.</p>
          <button 
            onClick={generateExercise}
            className="bg-[#93D7B7] text-[#003822] px-6 py-3 rounded-full font-medium flex items-center gap-2 hover:bg-[#AEEFD0] transition-colors"
          >
            Start Exercise <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {exerciseLoading && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-[#1E2025] rounded-[28px] p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]"
        >
          <div className="w-8 h-8 border-4 border-[#334B38] border-t-[#93D7B7] rounded-full animate-spin"></div>
          <p className="text-[#C4C7C5] text-sm">Generating medical scenario...</p>
        </motion.div>
      )}

      {currentExercise && !exerciseFeedback && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#1E2025] rounded-[28px] p-6 flex flex-col gap-6"
        >
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
        </motion.div>
      )}

      {exerciseFeedback && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className={`rounded-[28px] p-6 flex flex-col gap-4 ${exerciseFeedback.isCorrect ? 'bg-[#334B38]' : 'bg-[#690005]/40'}`}
        >
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
        </motion.div>
      )}
    </motion.div>
  );
}
