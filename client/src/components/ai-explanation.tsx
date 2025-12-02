import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useStore } from '@/lib/store';

interface AIExplanationProps {
  question: string;
  options: string[];
  correctAnswer: string;
  autoLoad?: boolean;
}

export function AIExplanation({ question, options, correctAnswer, autoLoad = false }: AIExplanationProps) {
  const { openaiKey, geminiKey, aiProvider } = useStore();
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getExplanation = async () => {
    // Auto-detect provider based on which key exists
    let provider = aiProvider;
    let selectedKey = provider === 'openai' ? openaiKey : geminiKey;
    
    // If selected provider has no key, try the other one
    if (!selectedKey || !selectedKey.trim()) {
      if (provider === 'openai' && geminiKey && geminiKey.trim()) {
        provider = 'gemini';
        selectedKey = geminiKey;
      } else if (provider === 'gemini' && openaiKey && openaiKey.trim()) {
        provider = 'openai';
        selectedKey = openaiKey;
      }
    }
    
    if (!selectedKey || !selectedKey.trim()) {
      setError(`Please add OpenAI or Gemini API Key in Settings first.`);
      return;
    }

    setLoading(true);
    setError(null);
    setExplanation(null);

    try {
      const response = await fetch('/api/generate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          options,
          correctAnswer,
          openaiKey: provider === 'openai' ? selectedKey : undefined,
          geminiKey: provider === 'gemini' ? selectedKey : undefined,
          aiProvider: provider
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate explanation");
      }

      const data = await response.json();
      setExplanation(data.explanation || "No explanation returned.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset explanation when question changes
  useEffect(() => {
    setExplanation(null);
    setError(null);
  }, [question, options, correctAnswer]);

  // Auto-load explanation when component mounts and autoLoad is true
  useEffect(() => {
    if (autoLoad && !explanation && !loading && !error) {
      const hasKey = (openaiKey?.trim() || geminiKey?.trim());
      if (hasKey) {
        getExplanation();
      }
    }
  }, [autoLoad, question, options, correctAnswer, openaiKey, geminiKey]);

  const hasAnyKey = (openaiKey?.trim() || geminiKey?.trim());

  // Show button when no explanation yet (only if not autoLoading)
  if (!autoLoad && !explanation && !loading && !error) {
    return (
      <Button 
        onClick={getExplanation}
        variant="outline"
        size="sm"
        className="w-full gap-2"
        data-testid="button-get-ai-explanation"
      >
        <Sparkles className="w-4 h-4" />
        Get AI Explanation
      </Button>
    );
  }

  // If no key set, don't show anything when there's no error
  if (!hasAnyKey && !error && !loading) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2">
      {loading && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-2 opacity-50" />
          <span className="text-xs font-medium">Loading AI solution...</span>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 p-4 rounded-lg flex gap-3 items-start text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold mb-1">Error</p>
            <p>{error}</p>
            <Button 
              variant="link" 
              className="h-auto p-0 text-destructive font-bold underline mt-1" 
              onClick={getExplanation}
              data-testid="button-try-again"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {explanation && (
        <Card className="bg-purple-50/50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 text-purple-600 dark:text-purple-400 font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              AI Explanation
            </div>
            <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {explanation.split('\n\n').filter(Boolean).map((paragraph, idx) => (
                <div key={idx} className="mb-3 last:mb-0">
                  <p className="text-sm">{paragraph}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
