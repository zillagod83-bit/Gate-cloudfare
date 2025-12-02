import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, HelpCircle, FileText, X, FileSpreadsheet, ClipboardType } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { Question, Topic } from '@/lib/store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FileImporterProps {
  onImport: (topic: Topic) => void;
}

export function FileImporter({ onImport }: FileImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [manualTopicName, setManualTopicName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear input so same file can be selected again
    event.target.value = '';

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      handleExcelFile(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        parseCSV(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Assume first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to CSV text
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        parseCSV(csvText, file.name);
      } catch (err) {
        console.error(err);
        toast({
          title: "Excel Parse Error",
          description: "Could not read the Excel file. Please ensure it's a valid .xlsx file.",
          variant: "destructive"
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePasteParse = () => {
    if (!pasteText.trim()) {
      toast({
        title: "Empty Content",
        description: "Please paste some CSV text first.",
        variant: "destructive"
      });
      return;
    }
    
    // Use manual topic name if provided, otherwise default to 'Imported Text'
    parseCSV(pasteText, manualTopicName || "Imported Text");
  };

  const parseCSV = (csvText: string, sourceName: string) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
           console.warn("CSV Parse warnings:", results.errors);
        }
        
        const headers = results.meta.fields || [];
        // More lenient validation to support various formats
        // Ideally we look for 'Question' and some options
        const hasQuestion = headers.some(h => h.toLowerCase().includes('question'));
        
        if (!hasQuestion && headers.length > 0) {
           toast({
            title: "Invalid Format",
            description: `Could not find a 'Question' column. Found: ${headers.join(', ')}`,
            variant: "destructive"
           });
           return;
        }

        const processedQuestions: Question[] = [];
        let skippedCount = 0;

        results.data.forEach((row: any, index) => {
          // 1. Try exact match first (case-insensitive)
          const getVal = (target: string) => {
             const exactKey = Object.keys(row).find(k => k.trim().toLowerCase() === target.toLowerCase());
             if (exactKey) return row[exactKey];
             
             // 2. If not found, try contains, but be careful with "Question" vs "Question No."
             // We filter keys that strictly contain the target, but we want to avoid false positives like "Question No." for "Question"
             const fuzzyKey = Object.keys(row).find(k => {
                const keyLower = k.toLowerCase();
                const targetLower = target.toLowerCase();
                
                // Special case: if looking for "Question", ignore "Question No" or "QuestionId"
                if (targetLower === 'question' && (keyLower.includes('no') || keyLower.includes('id') || keyLower.includes('number'))) {
                   return false;
                }
                
                return keyLower.includes(targetLower);
             });
             
             return fuzzyKey ? row[fuzzyKey] : undefined;
          };

          const questionText = getVal('Question');
          if (!questionText) {
            skippedCount++;
            return;
          }

          // Try to find options with new format preference
          let options: string[] = [];
          
          // 1. Try "Option A", "Option B", "Option C", "Option D" (New standard)
          const optionLabels = ['Option A', 'Option B', 'Option C', 'Option D'];
          let foundStandardOptions = false;
          
          optionLabels.forEach(optKey => {
             if (row[optKey]) {
                options.push(row[optKey]);
                foundStandardOptions = true;
             }
          });

          // 2. If not found, try fuzzy matching for "Option A" etc or legacy "Option1"
          if (!foundStandardOptions || options.length === 0) {
             options = []; // Reset
             // Try explicit Option1, Option2 etc
             ['Option1', 'Option2', 'Option3', 'Option4'].forEach(optKey => {
                 const val = row[optKey];
                 if (val) options.push(val);
             });
          }
          
          // 3. If still empty, try "A", "B", "C", "D" columns
          if (options.length === 0) {
             ['A', 'B', 'C', 'D'].forEach(optKey => {
                if (row[optKey]) options.push(row[optKey]);
             });
          }
          
          // 4. Last resort: fuzzy search for anything looking like an option
          if (options.length === 0) {
             optionLabels.forEach(optKey => {
                 const val = getVal(optKey);
                 if (val) options.push(val);
             });
          }

          options = options.filter(o => o && o.toString().trim().length > 0);

          // Deduplicate options (remove duplicates case-insensitively, keep first occurrence)
          const seen = new Set<string>();
          const deduplicatedOptions = options.filter(opt => {
            const normalized = opt.trim().toLowerCase();
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
          });

          if (deduplicatedOptions.length < 2) {
            skippedCount++;
            return; // Need at least 2 options
          }

          const topicName = row['Topic'] || getVal('Topic') || sourceName.replace(/\.(csv|txt|xlsx|xls)$/i, '');
          const correctVal = row['Correct Answer'] || getVal('Correct Answer') || getVal('Correct') || getVal('Answer');
          const explanationVal = row['Explanation'] || getVal('Explanation');

          processedQuestions.push({
            id: uuidv4(),
            no: row['Question No.'] || String(index + 1),
            question: questionText,
            options: deduplicatedOptions,
            correctAnswer: correctVal || deduplicatedOptions[0], // Fallback to first option if missing (bad, but prevents crash)
            explanation: explanationVal,
            topic: topicName
          });
        });

        if (processedQuestions.length === 0) {
           toast({
            title: "No Questions Found",
            description: "Could not parse any valid questions. Check the format.",
            variant: "destructive"
           });
           return;
        }

        // Group by topic
        const questionsByTopic: Record<string, Question[]> = {};
        processedQuestions.forEach(q => {
           const finalTopic = q.topic || "General";
           
           if (!questionsByTopic[finalTopic]) {
             questionsByTopic[finalTopic] = [];
           }
           questionsByTopic[finalTopic].push(q);
        });

        // Import each topic
        Object.entries(questionsByTopic).forEach(([name, qs]) => {
           onImport({
             id: uuidv4(),
             name: name,
             questions: qs
           });
        });

        toast({
          title: "Import Successful",
          description: `Imported ${processedQuestions.length} questions. ${skippedCount > 0 ? `Skipped ${skippedCount} invalid rows.` : ''}`,
        });
        setIsOpen(false);
        setPasteText("");
        setManualTopicName("");
      },
      error: (err: Error) => {
         toast({
            title: "Import Failed",
            description: err.message,
            variant: "destructive"
         });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" size="lg">
          <Upload className="w-4 h-4" />
          Import Questions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Questions</DialogTitle>
          <DialogDescription>
            Upload a file or paste CSV text directly.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="file" className="w-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">File Upload</TabsTrigger>
            <TabsTrigger value="paste">Paste Text</TabsTrigger>
          </TabsList>
          
          <TabsContent value="file" className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
               <Button variant="outline" className="h-32 border-dashed border-2 hover:bg-accent/50 hover:border-primary/50 flex flex-col gap-3" onClick={() => fileInputRef.current?.click()}>
                  <div className="flex gap-4 opacity-50">
                    <FileSpreadsheet className="w-8 h-8" />
                    <FileText className="w-8 h-8" />
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">
                    Click to select .xlsx, .csv, or .txt file
                  </span>
               </Button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept=".csv,.txt,.xlsx,.xls" 
                 onChange={handleFileSelect}
               />
            </div>

            <div className="bg-muted/50 p-4 rounded-lg text-xs space-y-2 w-full">
              <div className="font-semibold flex items-center gap-2">
                <HelpCircle className="w-3 h-3" />
                Supported Formats
              </div>
              <p className="opacity-80">First line must be the header:</p>
              <code className="block bg-black/5 p-2 rounded border overflow-x-auto whitespace-pre text-[10px] w-full break-words">
                Question No.,Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation
              </code>
              <ul className="list-disc pl-4 space-y-1 opacity-80 pt-2">
                <li><strong>Excel (.xlsx)</strong>: Automatically converted. Ensure first row is headers.</li>
                <li><strong>CSV (.csv)</strong>: Standard comma-separated values.</li>
              </ul>
              
              <div className="mt-3">
                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => {
                   const csvContent = `Question No.,Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation
1,Which planet is known as the Red Planet?,Earth,Venus,Mars,Jupiter,Mars,Iron oxide makes it red
2,What is the capital of France?,Berlin,Madrid,Paris,Rome,Paris,Paris is the capital city of France`;
                   const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                   const link = document.createElement("a");
                   const url = URL.createObjectURL(blob);
                   link.setAttribute("href", url);
                   link.setAttribute("download", "sample_questions.csv");
                   document.body.appendChild(link);
                   link.click();
                   document.body.removeChild(link);
                }}>
                  Download Sample CSV
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Topic Name (Optional)</Label>
              <Input 
                id="topic-name" 
                placeholder="e.g. 'History 101' (Defaults to 'General' or column value)" 
                value={manualTopicName}
                onChange={(e) => setManualTopicName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="csv-content">CSV Content</Label>
              <Textarea 
                id="csv-content"
                placeholder={`Question No.,Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation\n1,What is 2+2?,3,4,5,6,4,Math basics`}
                className="h-[200px] font-mono text-xs"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Paste your question data here. Headers are recommended but we'll try to auto-detect if missing.
              </p>
            </div>
            
            <Button onClick={handlePasteParse} className="w-full" disabled={!pasteText.trim()}>
              <ClipboardType className="w-4 h-4 mr-2" /> Parse & Add
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
