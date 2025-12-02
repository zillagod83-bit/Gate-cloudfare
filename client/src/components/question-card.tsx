import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Question } from '@/lib/store';
import { AIExplanation } from './ai-explanation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from "framer-motion";

interface QuestionCardProps {
  question: Question;
  selectedOption?: string;
  onSelect: (option: string) => void;
}

export function QuestionCard({ question, selectedOption, onSelect }: QuestionCardProps) {
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);

  // Format question with structured points on new lines
  const formatQuestion = (text: string) => {
    // Split on capital letters P, Q, R, S, T, U, V, W, X, Y, Z followed by period and space
    // Also split on numbered items like "1. ", "2. " for matching questions
    const parts = text.split(/(?=[PQRSTUVWXYZ]\.\s|[1-9]\d?\.\s+[A-Z])/);
    
    if (parts.length === 1) {
      // No structured points, return as is
      // Handle diagram descriptions, long text, and matching questions naturally
      return (
        <div className="whitespace-pre-wrap text-base sm:text-lg font-normal leading-relaxed">
          {text}
        </div>
      );
    }

    // Has structured points, render with line breaks and better spacing
    return (
      <div className="space-y-2">
        {parts.map((part, idx) => {
          const trimmed = part.trim();
          return trimmed ? (
            <div key={idx} className="whitespace-pre-wrap text-base sm:text-lg font-normal leading-relaxed">
              {trimmed}
            </div>
          ) : null;
        })}
      </div>
    );
  };

  // Helper to check correctness
  const isOptionCorrect = (optionText: string, index: number) => {
     const correctText = question.correctAnswer.trim();
     
     // Case 1: Correct Answer is "Option A", "Option 1", etc.
     if (/^Option\s?[A-D]$/i.test(correctText) || /^Option\s?[1-4]$/i.test(correctText)) {
        let correctIndex = -1;
        const matchLetter = correctText.match(/Option\s?([A-D])/i);
        const matchNumber = correctText.match(/Option\s?(\d)/i);
        
        if (matchLetter) {
           correctIndex = matchLetter[1].toUpperCase().charCodeAt(0) - 65;
        } else if (matchNumber) {
           correctIndex = parseInt(matchNumber[1]) - 1;
        }
        
        return index === correctIndex;
     }

     // Case 2: Single Letter Answer "A", "B", "C", "D"
     if (/^[A-D]$/i.test(correctText)) {
        const correctIndex = correctText.toUpperCase().charCodeAt(0) - 65;
        return index === correctIndex;
     }
     
     // Case 3: Exact text match (Case Insensitive)
     if (optionText.trim().toLowerCase() === correctText.toLowerCase()) {
        return true;
     }
     
     return false;
  };

  const isAnswered = !!selectedOption;
  
  // Determine if the selected answer was correct
  let isSelectedCorrect = false;
  if (selectedOption) {
    const idx = question.options.indexOf(selectedOption);
    isSelectedCorrect = isOptionCorrect(selectedOption, idx);
  }

  // Auto-open explanation when correct answer is selected, close on question change
  useEffect(() => {
    if (isSelectedCorrect && selectedOption) {
      setIsExplanationOpen(true);
    }
  }, [isSelectedCorrect, selectedOption]);

  // Close explanation when question changes
  useEffect(() => {
    setIsExplanationOpen(false);
    setIsAIOpen(false);
  }, [question.id]);

  return (
    <Card className="w-full h-full border-0 shadow-none bg-transparent flex flex-col">
      <CardHeader className="pb-2 px-0 pt-0">
        <div className="flex items-start gap-3">
          <span className="text-lg font-bold text-muted-foreground shrink-0">
            {question.no}
          </span>
          <div className="text-base sm:text-lg font-normal leading-snug text-foreground">
            {formatQuestion(question.question)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col px-0 gap-6">
        <div className="space-y-3">
            {question.options && question.options.length > 0 ? (
            question.options.map((option, idx) => {
              const isSelected = selectedOption === option;
              
              // Handle long options (might be from match-the-pair or complex questions)
              const isLongOption = option && option.length > 100;
              
              let containerClass = "hover:bg-muted/50 border-border text-foreground";
              let icon = null;
              let badgeClass = "border-muted-foreground/30 text-muted-foreground";

              // Only show color if SELECTED and ANSWERED
              if (isSelected && isAnswered) {
                 if (isSelectedCorrect) {
                    // Selected and CORRECT (Green Border)
                    containerClass = "!border-green-600 dark:!border-green-500 bg-transparent text-foreground font-bold";
                    icon = <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />;
                    badgeClass = "border-green-600 dark:border-green-500 text-green-700 bg-green-100 dark:bg-green-900/30 font-bold";
                 } else {
                    // Selected but WRONG (Red Border)
                    containerClass = "!border-red-600 dark:!border-red-500 bg-transparent text-foreground font-bold";
                    icon = <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />;
                    badgeClass = "border-red-600 dark:border-red-500 text-red-700 bg-red-100 dark:bg-red-900/30 font-bold";
                 }
              } else if (!isAnswered && isSelected) {
                 // Not answered yet but this is selected
                 containerClass = "border-primary ring-1 ring-primary bg-primary/5 text-foreground";
              }
              
              return (
                <div 
                  key={idx}
                  onClick={() => onSelect(option)}
                  className={cn(
                    isLongOption ? "p-4" : "p-3",
                    "relative flex items-center gap-4 border-2 rounded-xl p-3 cursor-pointer transition-all duration-200 text-sm sm:text-base font-normal active:scale-[0.99]",
                    containerClass
                  )}
                >
                   <div className={cn(
                     "flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold shrink-0 transition-colors",
                     badgeClass
                   )}>
                      {String.fromCharCode(65 + idx)}
                   </div>
                   
                   <span className="flex-1 leading-relaxed">
                     {option}
                   </span>
                   
                   {icon}
                </div>
              );
            })
            ) : (
              <div className="p-4 text-muted-foreground text-center text-sm">
                No options available for this question
              </div>
            )}
        </div>

        {/* Explanation Section - Dropdown */}
        <div className="mt-4 border rounded-2xl bg-card shadow-sm overflow-hidden">
           <button
             onClick={() => setIsExplanationOpen(!isExplanationOpen)}
             className="w-full flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
           >
              <span className="font-semibold text-sm">Explanation</span>
              {isExplanationOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
           </button>

           <AnimatePresence initial={false}>
             {isExplanationOpen && (
               <motion.div
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: "auto", opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 transition={{ duration: 0.2 }}
                 className="border-t"
               >
                 <div className="p-4">
                    <div className="flex items-start gap-3 text-sm text-muted-foreground leading-relaxed">
                       {isSelectedCorrect && <AlertCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
                       <div>
                          {isSelectedCorrect && (
                             <p className="font-bold text-green-700 dark:text-green-500 mb-1">
                               Correct!
                             </p>
                          )}
                          <p className="text-foreground/80">
                            {question.explanation ? question.explanation : "No detailed explanation provided for this question."}
                          </p>
                       </div>
                    </div>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* AI Solution Button */}
        <Button
          onClick={() => setIsAIOpen(!isAIOpen)}
          variant="outline"
          className="w-full gap-2 mt-4"
        >
          <Sparkles className="w-4 h-4" />
          {isAIOpen ? "Hide AI Solution" : "Get AI Detailed Solution"}
        </Button>

        {/* AI Solution Dropdown */}
        <AnimatePresence initial={false}>
          {isAIOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border rounded-2xl bg-card shadow-sm overflow-hidden mt-3"
            >
              <div className="p-4">
                <AIExplanation 
                  question={question.question}
                  options={question.options}
                  correctAnswer={question.correctAnswer}
                  autoLoad={true}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
