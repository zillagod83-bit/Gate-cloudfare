import { useState, useEffect } from 'react';
import { useStore, Topic } from '@/lib/store';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, Play, BookOpen, Settings, Shuffle, Camera } from "lucide-react";
import { FileImporter } from '../components/file-importer';
import { Link, useLocation } from 'wouter';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Home() {
  const { topics, addTopic, deleteTopic } = useStore();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  const [location, setLocation] = useLocation();

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleStartPractice = (random = false) => {
    if (selectedTopics.length === 0) return;
    // Pass selected topics as query param
    const randomParam = random ? '&random=true' : '';
    setLocation(`/practice?topics=${selectedTopics.join(',')}${randomParam}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 pb-2 flex justify-between items-center bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">My Library</h1>
          <p className="text-muted-foreground text-sm">Select topics to practice</p>
        </div>
        <Link href="/settings">
           <Button variant="ghost" size="icon">
             <Settings className="w-5 h-5 text-muted-foreground" />
           </Button>
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 pt-2">
        {topics.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4 opacity-60">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No topics yet</h3>
            <p className="text-sm text-muted-foreground max-w-[250px]">
              Import a CSV file to start practicing your questions.
            </p>
            <div className="pt-4">
               <FileImporter onImport={addTopic} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {topics.map(topic => (
              <div 
                key={topic.id} 
                className={`
                  group flex items-center gap-3 p-4 rounded-xl border transition-all duration-200
                  ${selectedTopics.includes(topic.id) 
                    ? 'bg-primary/5 border-primary/20 shadow-sm' 
                    : 'bg-card border-border hover:border-primary/20'
                  }
                `}
              >
                <Checkbox 
                  id={`topic-${topic.id}`}
                  checked={selectedTopics.includes(topic.id)}
                  onCheckedChange={() => toggleTopic(topic.id)}
                  className="h-5 w-5 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleTopic(topic.id)}>
                  <h3 className="font-medium truncate pr-2">{topic.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {topic.questions.length} questions
                  </p>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-black opacity-100 hover:bg-muted">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => setTopicToDelete(topic.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Topic
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer Actions */}
      <div className="sticky bottom-0 p-6 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-8 mt-auto">
         <div className="flex flex-col gap-3">
            <Link href="/ocr">
              <Button className="w-full gap-2" variant="secondary" data-testid="button-scan-book">
                <Camera className="w-4 h-4" />
                Scan Book Page
              </Button>
            </Link>
            
            {topics.length > 0 && (
              <div className="w-full">
                 <FileImporter onImport={addTopic} />
              </div>
            )}
            
            {topics.length > 0 && (
              <div className="flex gap-3 w-full">
                 <Button 
                    className="flex-1 gap-2 font-semibold text-base shadow-xl shadow-primary/20" 
                    size="lg"
                    disabled={selectedTopics.length === 0}
                    onClick={() => handleStartPractice(false)}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Practice {selectedTopics.length > 0 ? `(${selectedTopics.length})` : ''}
                  </Button>
                  
                  <Button 
                    className="flex-1 gap-2 font-semibold text-base shadow-xl shadow-secondary/20" 
                    size="lg"
                    variant="secondary"
                    disabled={selectedTopics.length === 0}
                    onClick={() => handleStartPractice(true)}
                  >
                    <Shuffle className="w-4 h-4" />
                    Random
                  </Button>
              </div>
            )}
         </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!topicToDelete} onOpenChange={(open) => !open && setTopicToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this topic and all its questions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (topicToDelete) {
                  deleteTopic(topicToDelete);
                  setTopicToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
