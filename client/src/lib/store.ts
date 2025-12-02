import { useState, useEffect } from 'react';
import { z } from 'zod';

export const QuestionSchema = z.object({
  id: z.string().uuid(),
  no: z.string().optional(),
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
  topic: z.string().default('General'),
  pageNo: z.string().optional().default(''),
});

export type Question = z.infer<typeof QuestionSchema>;

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  questions: z.array(QuestionSchema),
});

export type Topic = z.infer<typeof TopicSchema>;

const STORAGE_KEY = 'mcq_app_data';
const OPENAI_KEY_STORAGE_KEY = 'mcq_app_openai_key';
const GEMINI_KEY_STORAGE_KEY = 'mcq_app_gemini_key';
const PROVIDER_STORAGE_KEY = 'mcq_app_ai_provider';

export type AIProvider = 'openai' | 'gemini';

export function useStore() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [openaiKey, setOpenaiKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [aiProvider, setAiProvider] = useState<AIProvider>('openai');
  const [isLoading, setIsLoading] = useState(true);

  // Load from server on mount (cloud sync - primary storage)
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Try to fetch topics from server
        try {
          const topicsRes = await fetch('/api/topics');
          if (topicsRes.ok) {
            const data = await topicsRes.json();
            if (Array.isArray(data)) {
              setTopics(data);
              // Sync to localStorage backup
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.warn('Could not fetch from server, using localStorage');
        }

        // Fallback to localStorage if server fails
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
          try {
            const parsed = JSON.parse(storedData);
            setTopics(parsed);
          } catch (e) {
            console.error('Failed to parse stored topics', e);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Also load API keys
    const loadApiKeys = async () => {
      try {
        const keysRes = await fetch('/api/keys');
        if (keysRes.ok) {
          const keys = await keysRes.json();
          if (keys) {
            setOpenaiKey(keys.openaiKey || '');
            setGeminiKey(keys.geminiKey || '');
            setAiProvider(keys.aiProvider || 'openai');
            // Sync to localStorage backup
            localStorage.setItem(OPENAI_KEY_STORAGE_KEY, keys.openaiKey || '');
            localStorage.setItem(GEMINI_KEY_STORAGE_KEY, keys.geminiKey || '');
            localStorage.setItem(PROVIDER_STORAGE_KEY, keys.aiProvider || 'openai');
            return;
          }
        }
      } catch (error) {
        console.warn('Could not fetch API keys from server, using localStorage');
      }

      // Fallback to localStorage
      const storedOpenaiKey = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
      if (storedOpenaiKey) setOpenaiKey(storedOpenaiKey);
      const storedGeminiKey = localStorage.getItem(GEMINI_KEY_STORAGE_KEY);
      if (storedGeminiKey) setGeminiKey(storedGeminiKey);
      const storedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY) as AIProvider;
      if (storedProvider) setAiProvider(storedProvider);
    };

    loadData();
    loadApiKeys();
  }, []);

  const addTopic = async (topic: Topic) => {
    // Ensure all question fields are preserved (including pageNo)
    const preserveQuestionFields = (questions: Question[]): Question[] => {
      return questions.map(q => ({
        id: q.id,
        no: q.no || '',
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        topic: q.topic || '',
        pageNo: q.pageNo || '' // Explicitly preserve pageNo
      }));
    };

    const topicWithPreservedQuestions = {
      ...topic,
      questions: preserveQuestionFields(topic.questions)
    };

    // Save to server first (cloud sync - primary)
    try {
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(topicWithPreservedQuestions),
      });

      if (response.ok) {
        const savedTopic = await response.json();
        setTopics(prev => {
          // Check by ID first (for existing topics being updated)
          const existingById = prev.find(t => t.id === topicWithPreservedQuestions.id);
          let updated;
          if (existingById) {
            // Merge questions into existing topic by ID, preserving all fields
            const mergedQuestions = [
              ...existingById.questions,
              ...preserveQuestionFields(topicWithPreservedQuestions.questions)
            ];
            updated = prev.map(t => t.id === topicWithPreservedQuestions.id ? { ...t, questions: mergedQuestions } : t);
          } else {
            // New topic
            updated = [...prev, savedTopic];
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
        return;
      }
    } catch (error) {
      console.warn('Server sync failed, using localStorage:', error);
    }

    // Fallback: Save to localStorage if server fails
    setTopics(prev => {
      // Check by ID first (for existing topics being updated)
      const existingById = prev.find(t => t.id === topicWithPreservedQuestions.id);
      let updated;
      if (existingById) {
        // Merge questions into existing topic by ID, preserving all fields
        const mergedQuestions = [
          ...existingById.questions,
          ...preserveQuestionFields(topicWithPreservedQuestions.questions)
        ];
        updated = prev.map(t => t.id === topicWithPreservedQuestions.id ? { ...t, questions: mergedQuestions } : t);
      } else {
        updated = [...prev, topicWithPreservedQuestions];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteTopic = async (topicId: string) => {
    // Always delete from localStorage first (primary storage)
    setTopics(prev => {
      const updated = prev.filter(t => t.id !== topicId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Try to sync with server (optional, doesn't block)
    try {
      await fetch(`/api/topics/${topicId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Server sync failed (using localStorage):', error);
    }
  };

  const saveOpenaiKey = async (key: string) => {
    setOpenaiKey(key);
    try {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openaiKey: key, geminiKey, aiProvider }),
      });
    } catch (error) {
      console.warn('Server sync failed, using localStorage:', error);
    }
    localStorage.setItem(OPENAI_KEY_STORAGE_KEY, key);
  };

  const saveGeminiKey = async (key: string) => {
    setGeminiKey(key);
    try {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openaiKey, geminiKey: key, aiProvider }),
      });
    } catch (error) {
      console.warn('Server sync failed, using localStorage:', error);
    }
    localStorage.setItem(GEMINI_KEY_STORAGE_KEY, key);
  };

  const setProvider = async (provider: AIProvider) => {
    setAiProvider(provider);
    try {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openaiKey, geminiKey, aiProvider: provider }),
      });
    } catch (error) {
      console.warn('Server sync failed, using localStorage:', error);
    }
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  };

  return {
    topics,
    addTopic,
    deleteTopic,
    openaiKey,
    geminiKey,
    aiProvider,
    saveOpenaiKey,
    saveGeminiKey,
    setProvider,
    isLoading
  };
}
