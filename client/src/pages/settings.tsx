import { useState } from 'react';
import { useStore, AIProvider } from '@/lib/store';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, Key } from "lucide-react";
import { Link, useLocation } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function Settings() {
  const { openaiKey, geminiKey, aiProvider, saveOpenaiKey, saveGeminiKey, setProvider } = useStore();
  const [openaiInput, setOpenaiInput] = useState(openaiKey);
  const [geminiInput, setGeminiInput] = useState(geminiKey);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(aiProvider);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSave = () => {
    saveOpenaiKey(openaiInput);
    saveGeminiKey(geminiInput);
    
    // Auto-detect provider: use whichever has a key
    let finalProvider = selectedProvider;
    if (geminiInput.trim() && !openaiInput.trim()) {
      finalProvider = 'gemini';
    } else if (openaiInput.trim() && !geminiInput.trim()) {
      finalProvider = 'openai';
    } else if (!openaiInput.trim() && !geminiInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter at least one API key (OpenAI or Gemini).",
        variant: "destructive"
      });
      return;
    }
    
    setProvider(finalProvider);
    toast({
      title: "Settings Saved",
      description: `AI provider changed to ${selectedProvider === 'openai' ? 'OpenAI' : 'Gemini'} and keys updated locally.`,
    });
    
    setTimeout(() => {
      setLocation('/');
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 flex items-center gap-2 border-b bg-background">
        <Link href="/">
          <Button variant="ghost" size="icon" className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      <main className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              AI Configuration
            </CardTitle>
            <CardDescription>
              Choose your AI provider and enter your API key. Keys are stored locally on your device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Select AI Provider</Label>
              <RadioGroup value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as AIProvider)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="openai" id="openai" data-testid="provider-openai" />
                  <Label htmlFor="openai" className="font-normal cursor-pointer">OpenAI (GPT-4)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gemini" id="gemini" data-testid="provider-gemini" />
                  <Label htmlFor="gemini" className="font-normal cursor-pointer">Google Gemini</Label>
                </div>
              </RadioGroup>
            </div>

            {selectedProvider === 'openai' && (
              <div className="space-y-2">
                <Label htmlFor="openai-key">OpenAI API Key</Label>
                <Input 
                  id="openai-key" 
                  data-testid="input-openai-key"
                  type="password" 
                  placeholder="sk-..." 
                  value={openaiInput}
                  onChange={(e) => setOpenaiInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Platform</a>
                </p>
              </div>
            )}

            {selectedProvider === 'gemini' && (
              <div className="space-y-2">
                <Label htmlFor="gemini-key">Google Gemini API Key</Label>
                <Input 
                  id="gemini-key" 
                  data-testid="input-gemini-key"
                  type="password" 
                  placeholder="AIza..." 
                  value={geminiInput}
                  onChange={(e) => setGeminiInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Get your key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a>
                </p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900/50">
              <p className="text-xs text-blue-900 dark:text-blue-200">
                ✓ Your API key is stored securely in your browser and is never sent to any server except the AI provider.
              </p>
            </div>

            <Button onClick={handleSave} className="w-full" data-testid="button-save-settings">
              <Save className="w-4 h-4 mr-2" /> Save Settings
            </Button>
          </CardContent>
        </Card>
        
        <div className="text-center text-xs text-muted-foreground mt-8">
           <p>MCQ Practice App v1.0</p>
           <p>Built with React & Tailwind</p>
        </div>
      </main>
    </div>
  );
}
