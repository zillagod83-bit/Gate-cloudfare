import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useStore, Question } from '@/lib/store';
import { QuestionCard } from '@/components/question-card';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid, 
  CheckCircle2, 
  XCircle, 
  Circle,
  Home
} from "lucide-react";
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export default function Practice() {
  const [location, setLocation] = useLocation();
  const { topics } = useStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> selectedOption
  const [isStatsOpen, setIsStatsOpen] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const topicIds = searchParams.get('topics')?.split(',') || [];
    const isRandom = searchParams.get('random') === 'true';

    if (topicIds.length === 0 || topics.length === 0) {
      return;
    }

    const allQuestions: Question[] = [];
    topics.forEach(t => {
      if (topicIds.includes(t.id)) {
        allQuestions.push(...t.questions);
      }
    });

    if (isRandom) {
       // Shuffle (Fisher-Yates)
       for (let i = allQuestions.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
       }
    }

    setQuestions(allQuestions);
  }, [topics]);

  const handleAnswer = (option: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;
    
    // Allow changing answer (Unlock options)
    // Update answer even if it exists
    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: option
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (questions.length === 0) {
    return null;
  }

  const currentQ = questions[currentIndex];

  const stats = {
    total: questions.length,
    answered: Object.keys(answers).length,
    correct: 0,
    incorrect: 0,
    unanswered: questions.length - Object.keys(answers).length
  };

  // Calculate detailed stats
  questions.forEach(q => {
    const ans = answers[q.id];
    if (ans) {
       // Logic for correctness - Match with question-card.tsx logic
       const correctText = q.correctAnswer.trim();
       let isCorrect = false;
       
       // Case 1: "Option A", "Option 1", etc.
       if (/^Option\s?[A-D]$/i.test(correctText) || /^Option\s?[1-4]$/i.test(correctText)) {
          let index = -1;
          const matchLetter = correctText.match(/Option\s?([A-D])/i);
          const matchNumber = correctText.match(/Option\s?(\d)/i);
          if (matchLetter) index = matchLetter[1].toUpperCase().charCodeAt(0) - 65;
          else if (matchNumber) index = parseInt(matchNumber[1]) - 1;
          if (index >= 0 && q.options[index] === ans) isCorrect = true;
       } 
       // Case 2: Single Letter "A", "B", "C", "D"
       else if (/^[A-D]$/i.test(correctText)) {
          const correctIndex = correctText.toUpperCase().charCodeAt(0) - 65;
          if (q.options[correctIndex] === ans) isCorrect = true;
       }
       // Case 3: Exact text match (Case Insensitive)
       else if (ans.trim().toLowerCase() === correctText.toLowerCase()) {
          isCorrect = true;
       }
       
       if (isCorrect) stats.correct++;
       else stats.incorrect++;
    }
  });

  // Get current question correctness
  const currentQAns = answers[currentQ.id];
  let currentQCorrect = false;
  if (currentQAns) {
    const correctText = currentQ.correctAnswer.trim();
    if (/^Option\s?[A-D]$/i.test(correctText) || /^Option\s?[1-4]$/i.test(correctText)) {
       let index = -1;
       const matchLetter = correctText.match(/Option\s?([A-D])/i);
       const matchNumber = correctText.match(/Option\s?(\d)/i);
       if (matchLetter) index = matchLetter[1].toUpperCase().charCodeAt(0) - 65;
       else if (matchNumber) index = parseInt(matchNumber[1]) - 1;
       if (index >= 0 && currentQ.options[index] === currentQAns) currentQCorrect = true;
    } else if (/^[A-D]$/i.test(correctText)) {
       const correctIndex = correctText.toUpperCase().charCodeAt(0) - 65;
       if (currentQ.options[correctIndex] === currentQAns) currentQCorrect = true;
    } else if (currentQAns.trim().toLowerCase() === correctText.toLowerCase()) {
       currentQCorrect = true;
    }
  }

  return (
    <div className="flex flex-col h-full relative bg-slate-50 dark:bg-slate-950/50">
      {/* Header */}
      <header className="p-4 flex items-center justify-center bg-background border-b shadow-sm z-20 relative">
        <Link href="/" className="absolute left-4">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Main Menu</span>
          </Button>
        </Link>

        <div className="text-xl sm:text-2xl font-bold text-foreground">
          {currentIndex + 1} / {questions.length}
        </div>
           
        <Sheet open={isStatsOpen} onOpenChange={setIsStatsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 absolute right-4">
              <LayoutGrid className="w-4 h-4" />
              Stats
            </Button>
          </SheetTrigger>
             <SheetContent side="right" className="w-[85vw] sm:w-[400px] p-0 flex flex-col bg-white">
                <SheetHeader className="p-6 border-b bg-white">
                  <SheetTitle>Question List</SheetTitle>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                     <div className="flex flex-col items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <span className="text-xl font-bold text-green-600">{stats.correct}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">Correct</span>
                     </div>
                     <div className="flex flex-col items-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <span className="text-xl font-bold text-red-500">{stats.incorrect}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">Incorrect</span>
                     </div>
                     <div className="flex flex-col items-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-xl font-bold text-slate-500">{stats.unanswered}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">Left</span>
                     </div>
                  </div>
                </SheetHeader>
                <ScrollArea className="flex-1 p-4 bg-white">
                   {/* Smaller boxes: grid-cols-6 instead of 5 */}
                   <div className="grid grid-cols-6 gap-2">
                      {questions.map((q, i) => {
                        const ans = answers[q.id];
                        let statusColor = "bg-slate-200 text-slate-900 border-2 border-slate-300 font-semibold hover:bg-slate-300"; // Default unanswered - dark text
                        if (i === currentIndex) statusColor = "ring-2 ring-primary border-2 border-primary bg-slate-200 text-slate-900 font-semibold hover:bg-slate-300"; // Current
                        
                        if (ans) {
                           const correctText = q.correctAnswer.trim();
                           let isCorrect = false;
                           
                           // Case 1: "Option A", "Option 1", etc.
                           if (/^Option\s?[A-D]$/i.test(correctText) || /^Option\s?[1-4]$/i.test(correctText)) {
                              let index = -1;
                              const matchLetter = correctText.match(/Option\s?([A-D])/i);
                              const matchNumber = correctText.match(/Option\s?(\d)/i);
                              if (matchLetter) index = matchLetter[1].toUpperCase().charCodeAt(0) - 65;
                              else if (matchNumber) index = parseInt(matchNumber[1]) - 1;
                              if (index >= 0 && q.options[index] === ans) isCorrect = true;
                           } 
                           // Case 2: Single Letter "A", "B", "C", "D"
                           else if (/^[A-D]$/i.test(correctText)) {
                              const correctIndex = correctText.toUpperCase().charCodeAt(0) - 65;
                              if (q.options[correctIndex] === ans) isCorrect = true;
                           }
                           // Case 3: Exact text match (Case Insensitive)
                           else if (ans.trim().toLowerCase() === correctText.toLowerCase()) {
                              isCorrect = true;
                           }
                           
                           statusColor = isCorrect 
                             ? "bg-green-500 text-white border-2 border-green-600 font-bold hover:bg-green-600" 
                             : "bg-red-500 text-white border-2 border-red-600 font-bold hover:bg-red-600";
                           
                           if (i === currentIndex) statusColor += " ring-2 ring-offset-1 ring-primary";
                        }

                        return (
                          <button
                            key={q.id}
                            onClick={() => {
                              setCurrentIndex(i);
                              setIsStatsOpen(false); // Close sheet automatically
                            }}
                            className={cn(
                              "aspect-square flex items-center justify-center rounded-md text-[10px] font-medium transition-all",
                              statusColor
                            )}
                          >
                            {i + 1}
                          </button>
                        )
                      })}
                   </div>
                </ScrollArea>
             </SheetContent>
        </Sheet>
      </header>

      {/* Question Area - Scrollable */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col max-w-3xl mx-auto w-full pb-32">
         <div className="flex-1 flex flex-col">
           <QuestionCard 
             question={currentQ} 
             selectedOption={answers[currentQ.id]}
             onSelect={handleAnswer}
           />
         </div>
      </main>

      {/* Navigation Footer - Fixed */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg flex gap-4 justify-between items-center max-w-3xl mx-auto w-full z-10">
         <Button 
           variant="outline" 
           onClick={handlePrev} 
           disabled={currentIndex === 0}
           className="flex-1 max-w-[150px]"
         >
           <ChevronLeft className="w-4 h-4 mr-2" /> Previous
         </Button>
         
         <div className="flex flex-col items-center gap-1">
           <div className="text-xs text-muted-foreground font-mono">
             Q. {currentIndex + 1}
           </div>
           {currentQ?.pageNo && (
             <div className="text-xs text-muted-foreground font-mono">
               Page {currentQ.pageNo}
             </div>
           )}
         </div>

         <Button 
           onClick={handleNext} 
           disabled={currentIndex === questions.length - 1}
           className="flex-1 max-w-[150px]"
         >
           Next <ChevronRight className="w-4 h-4 ml-2" />
         </Button>
      </footer>
    </div>
  );
}
