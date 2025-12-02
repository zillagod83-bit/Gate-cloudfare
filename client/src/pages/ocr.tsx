import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useStore, Question, Topic } from '@/lib/store';
import { Camera, Upload, Loader2, Check, AlertCircle, ArrowLeft } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { Link } from 'wouter';

export default function OCRPage() {
  const { topics, addTopic } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [topicMode, setTopicMode] = useState<'new' | 'existing' | null>(null);
  const [newTopicName, setNewTopicName] = useState("");
  const [selectedExistingTopic, setSelectedExistingTopic] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [extractedQuestions, setExtractedQuestions] = useState<Question[]>([]);
  const [showTopicSelection, setShowTopicSelection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processImages = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Missing Info",
        description: "Please select at least one image.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const allQuestions: Question[] = [];

      for (const file of selectedFiles) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const result = (e.target?.result as string).split(',')[1];
              resolve(result);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        try {
          const response = await fetch('/api/extract-mcq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64, topic: "" })
          });

          const result = await response.json();

          if (response.ok) {
            if (result.questions && Array.isArray(result.questions) && result.questions.length > 0) {
              const questions = result.questions.map((q: any) => {
                // Use options as-is (no filtering - P, Q, R, S should be in question text, not in options)
                const options = (q.options || []).slice(0, 4); // Take first 4 options
                
                return {
                  id: uuidv4(),
                  no: q.no || "",
                  question: q.question,
                  options: options,
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation,
                  topic: "",
                  pageNo: q.pageNo || ""
                };
              });
              allQuestions.push(...questions);
            } else if (result.questions && Array.isArray(result.questions) && result.questions.length === 0) {
              toast({
                title: "No MCQs on this page",
                description: `Image processed but no questions detected. Please ensure the image contains clear MCQ questions.`,
                variant: "destructive"
              });
            }
          } else {
            const errorMsg = result.error || result.details || `Failed to extract (Status: ${response.status})`;
            toast({
              title: "Extraction Error",
              description: errorMsg,
              variant: "destructive"
            });
            console.error("Extract failed for image:", errorMsg);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Failed to process image";
          toast({
            title: "Processing Error",
            description: errorMsg,
            variant: "destructive"
          });
          console.error("Error processing image:", err);
        }
      }

      if (allQuestions.length === 0) {
        toast({
          title: "No MCQs Found",
          description: "Could not extract any questions from the images.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      setExtractedQuestions(allQuestions);
      setShowTopicSelection(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process images",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTopic = () => {
    if (extractedQuestions.length === 0) return;

    let topicName = "";
    let topicId = "";

    if (topicMode === 'new') {
      if (!newTopicName.trim()) {
        toast({
          title: "Topic Name Required",
          description: "Please enter a topic name.",
          variant: "destructive"
        });
        return;
      }
      topicName = newTopicName;
      topicId = uuidv4();
    } else if (topicMode === 'existing') {
      const existing = topics.find(t => t.id === selectedExistingTopic);
      if (!existing) {
        toast({
          title: "Select Topic",
          description: "Please select an existing topic.",
          variant: "destructive"
        });
        return;
      }
      topicName = existing.name;
    }

    const questionsWithTopic = extractedQuestions.map(q => ({
      ...q,
      topic: topicName
    }));

    if (topicMode === 'new') {
      const topic: Topic = {
        id: topicId,
        name: topicName,
        questions: questionsWithTopic
      };
      addTopic(topic);
    } else if (topicMode === 'existing') {
      // When adding to existing topic, merge questions by ID
      const topic: Topic = {
        id: selectedExistingTopic,
        name: topicName,
        questions: questionsWithTopic
      };
      addTopic(topic);
    }

    toast({
      title: "Success!",
      description: `Saved ${extractedQuestions.length} questions to "${topicName}"`
    });

    setIsOpen(false);
    setTopicMode(null);
    setNewTopicName("");
    setSelectedExistingTopic("");
    setSelectedFiles([]);
    setPreviews([]);
    setExtractedQuestions([]);
    setShowTopicSelection(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 5);
    if (files.length === 0) return;

    setSelectedFiles(files);
    const newPreviews: string[] = [];

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string);
        if (newPreviews.length === files.length) {
          setPreviews(newPreviews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(event as any);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pt-6">
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <div className="mb-6 flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">📸 Scan MCQ Book</h1>
          <p className="text-muted-foreground">Take photos of up to 5 book pages and we'll extract MCQs automatically</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full gap-2 mb-4">
              <Camera className="w-5 h-5" />
              Start Scanning
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {!showTopicSelection ? (
              <>
                <DialogHeader>
                  <DialogTitle>Scan MCQ Pages</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Image Previews */}
                  {previews.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selected Images ({previews.length}/5)</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                        {previews.map((preview, idx) => (
                          <div key={idx} className="relative">
                            <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-20 object-cover rounded border" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-0 right-0 h-5 w-5 p-0"
                              onClick={() => {
                                const newFiles = selectedFiles.filter((_, i) => i !== idx);
                                const newPreviews = previews.filter((_, i) => i !== idx);
                                setSelectedFiles(newFiles);
                                setPreviews(newPreviews);
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload/Camera Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={loading || selectedFiles.length >= 5}
                    >
                      <Camera className="w-4 h-4" />
                      Camera
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || selectedFiles.length >= 5}
                    >
                      <Upload className="w-4 h-4" />
                      Upload
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                  />

                  {/* Extract Button */}
                  <Button
                    data-testid="button-extract-mcq"
                    className="w-full gap-2"
                    onClick={processImages}
                    disabled={selectedFiles.length === 0 || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Extracting from {selectedFiles.length} page(s)...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Extract MCQs
                      </>
                    )}
                  </Button>

                  {loading && (
                    <div className="text-sm text-muted-foreground text-center">
                      Processing {selectedFiles.length} image(s) with AI vision... This may take a moment.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Save {extractedQuestions.length} Questions</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Topic Mode Selection */}
                  <div className="space-y-2">
                    <Label>Topic Selection</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={topicMode === 'new' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          setTopicMode('new');
                          setSelectedExistingTopic("");
                        }}
                      >
                        + New Topic
                      </Button>
                      <Button
                        variant={topicMode === 'existing' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => {
                          setTopicMode('existing');
                          setNewTopicName("");
                        }}
                        disabled={topics.length === 0}
                      >
                        Existing
                      </Button>
                    </div>
                  </div>

                  {/* New Topic Input */}
                  {topicMode === 'new' && (
                    <div>
                      <Label htmlFor="topic-name">Topic Name *</Label>
                      <Input
                        id="topic-name"
                        data-testid="input-topic-name"
                        placeholder="e.g., Biology Chapter 5"
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Existing Topic Selection */}
                  {topicMode === 'existing' && (
                    <div>
                      <Label htmlFor="existing-topic">Select Topic *</Label>
                      <select
                        id="existing-topic"
                        data-testid="select-existing-topic"
                        className="w-full px-3 py-2 border border-input rounded-md"
                        value={selectedExistingTopic}
                        onChange={(e) => setSelectedExistingTopic(e.target.value)}
                      >
                        <option value="">Choose a topic...</option>
                        {topics.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.questions.length} Qs)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Save Button */}
                  <Button
                    data-testid="button-save-topic"
                    className="w-full gap-2"
                    onClick={saveTopic}
                    disabled={!topicMode || (topicMode === 'new' && !newTopicName.trim()) || (topicMode === 'existing' && !selectedExistingTopic)}
                  >
                    <Check className="w-4 h-4" />
                    Save to {topicMode === 'new' ? 'New' : 'Existing'} Topic
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>How it works:</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Upload or take photos of up to 5 book pages at once</li>
                <li>We'll extract all MCQs using AI vision</li>
                <li>Add to new topic or existing topic</li>
                <li>Questions, options, numbers & explanations saved automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
