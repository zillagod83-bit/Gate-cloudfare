import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const DEFAULT_USER_ID = "default";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // OCR endpoint - extract MCQ from book page image
  app.post("/api/extract-mcq", async (req, res) => {
    try {
      const { imageBase64, topic } = req.body;
      
      const imageSize = imageBase64?.length || 0;
      console.log("[OCR] Request received. Image size:", imageSize, "bytes");
      console.log("[OCR] Base64 starts with:", imageBase64?.substring(0, 50) || "NONE");
      console.log("[OCR] Base64 ends with:", imageBase64?.substring(-50) || "NONE");
      
      if (!imageBase64 || imageBase64.length === 0) {
        return res.status(400).json({ error: "No image provided" });
      }

      // Check if base64 is suspiciously small (corrupted?)
      if (imageSize < 1000) {
        console.error("[OCR] Image too small! Likely corrupted. Size:", imageSize);
        return res.status(400).json({ error: "Image appears corrupted (too small). Try uploading again." });
      }

      if (!process.env.GEMINI_API_KEY) {
        console.error("[OCR] GEMINI_API_KEY not set!");
        return res.status(500).json({ error: "Gemini API not configured" });
      }
      
      console.log("[OCR] Using GEMINI_API_KEY:", process.env.GEMINI_API_KEY.substring(0, 20) + "...");

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const prompt = `Extract ALL MCQ questions from this textbook page image with MAXIMUM ACCURACY.

EXTRACT PAGE NUMBER: Look at ALL corners (top-left, top-right, bottom-left, bottom-right) and return visible page number in "pageNo" field.

QUESTION TYPES TO EXTRACT:

TYPE 1 - REGULAR OPTIONS (A/B/C/D or 1/2/3/4):
Q1. Question text?
A) Option A  B) Option B  C) Option C  D) Option D
Answer: B

TYPE 2 - STATEMENT MATCHING (P/Q/R/S):
Q2. Which are correct?
P. Statement 1  Q. Statement 2  R. Statement 3  S. Statement 4
Answer: P and Q (or P, Q and R, etc.)

TYPE 3 - MATCH THE PAIRS/COLUMNS:
Q3. Match column A with column B
A                          B
(1) Item A1             (i) Item B1
(2) Item A2             (ii) Item B2
(3) Item A3             (iii) Item B3
(4) Item A4             (iv) Item B4
Answer: 1-ii, 2-iii, 3-i, 4-iv (or 1-b, 2-d, 3-a, 4-c)

TYPE 4 - DIAGRAM/IMAGE QUESTIONS:
Q4. In the diagram showing [description], what is [question about diagram]?
A) Option based on diagram  B) Option  C) Option  D) Option
(For diagrams: include description of what diagram shows in question text)

EXTRACT EACH QUESTION with:
- "no": Question number exactly as shown (e.g., "22.", "Q1.", "1.", etc.)
- "question": COMPLETE question text word-for-word INCLUDING:
  * All descriptive text before the question
  * For P/Q/R/S: all statements
  * For match pairs: the full matching task description
  * For diagrams: clear description of what the diagram shows + the actual question
- "options": Array of exactly 4 options AS THEY APPEAR:
  * Regular: [opt A, opt B, opt C, opt D]
  * P/Q/R/S: [statement P, statement Q, statement R, statement S]
  * Match pairs: [1-i, 1-ii, 1-iii, 1-iv] OR [A-1, A-2, A-3, A-4] (top 4 pairings shown)
  * Diagram: [option A, option B, option C, option D]
- "correctAnswer": Exactly as shown (B, P and Q, 1-ii, etc.)
- "explanation": Visible explanation text, empty string if not shown
- "pageNo": Page number if first question on page

CRITICAL RULES:
✓ Copy ALL text EXACTLY - character for character, no modifications
✓ For diagrams: describe what you see in the image as part of the question
✓ For match pairs: capture all 4 column A items in first option, column B pairings in "correctAnswer"
✓ Always exactly 4 options (pad with empty string "" if less than 4 items)
✓ Return ONLY valid JSON - no markdown, no extra text:

{
  "pageNo": "22",
  "questions": [
    {"no": "22.", "question": "full exact text", "options": ["opt1", "opt2", "opt3", "opt4"], "correctAnswer": "B", "explanation": "text"}
  ]
}

If no questions found: {"pageNo": "", "questions": []}`;

      const message = await model.generateContent([
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
          },
        },
        {
          text: prompt,
        },
      ]);

      const responseText = message.response.text();
      
      console.log("[OCR] Gemini response length:", responseText.length);
      console.log("[OCR] Full response:", responseText);
      
      // Extract JSON from response
      let result;
      try {
        let jsonStr = responseText.trim();
        
        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/m, '');
        jsonStr = jsonStr.replace(/\n?```\s*$/m, '');
        
        // Find JSON object - match from first { to last }
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
          console.error("[OCR] No JSON found. Response:", responseText.substring(0, 500));
          return res.status(400).json({ 
            error: "[DEBUG] Gemini returned no JSON. Response: " + responseText.substring(0, 200)
          });
        }
        
        let jsonStr2 = jsonStr.substring(firstBrace, lastBrace + 1);
        
        // Remove trailing commas before closing brackets/braces
        jsonStr2 = jsonStr2.replace(/,(\s*[\}\]])/g, '$1');
        
        result = JSON.parse(jsonStr2);
        console.log("[OCR] Parsed successfully. Questions:", result.questions?.length || 0);
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        console.error("[OCR] JSON Parse Error:", errorMsg);
        console.error("[OCR] Response was:", responseText.substring(0, 500));
        return res.status(400).json({ 
          error: "[DEBUG] JSON Parse Error: " + errorMsg + " | Response: " + responseText.substring(0, 150)
        });
      }

      if (!result.questions || !Array.isArray(result.questions)) {
        console.error("[OCR] Invalid format. Questions type:", typeof result.questions);
        return res.status(400).json({ error: "[DEBUG] Invalid format. Got type: " + typeof result.questions });
      }
      
      if (result.questions.length === 0) {
        console.warn("[OCR] Empty questions array returned. Full result:", JSON.stringify(result).substring(0, 300));
        return res.status(400).json({ 
          error: "[DEBUG] Empty questions. Gemini said: " + JSON.stringify(result).substring(0, 150)
        });
      }

      // Validate and clean questions
      const validateAndCleanQuestions = (questions: any[], pageNo: string) => {
        return questions.map((q: any) => {
          // Ensure exactly 4 options
          let options = (q.options || []).map((opt: string) => String(opt).trim());
          
          // Deduplicate (case-insensitive)
          const seen = new Set<string>();
          options = options.filter((opt: string) => {
            const normalized = opt.toLowerCase();
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
          });
          
          // Pad to 4 options if less (should not happen with Gemini, but safety check)
          while (options.length < 4) {
            options.push("");
          }
          
          // Take only first 4 options
          options = options.slice(0, 4);
          
          return {
            id: q.id || "",
            no: String(q.no || "").trim(),
            question: String(q.question || "").trim(),
            options: options,
            correctAnswer: String(q.correctAnswer || "A").trim().toUpperCase(),
            explanation: String(q.explanation || "").trim(),
            topic: q.topic || "",
            pageNo: pageNo
          };
        });
      };

      // Add pageNo to each question and validate
      const pageNo = String(result.pageNo || "").trim();
      const cleanedQuestions = validateAndCleanQuestions(result.questions, pageNo);

      return res.json({ questions: cleanedQuestions, topic });
    } catch (error) {
      console.error("OCR Error:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to extract MCQ" 
      });
    }
  });

  // Get all topics for user
  app.get("/api/topics", async (req, res) => {
    try {
      const topicsList = await storage.getTopics(DEFAULT_USER_ID);
      res.json(topicsList);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  // Add/update topic
  app.post("/api/topics", async (req, res) => {
    try {
      const { id, name, questions } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Topic name required" });
      }

      // Preserve all question fields including pageNo
      const preserveQuestionFields = (questions: any[]): any[] => {
        return (questions || []).map(q => ({
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

      const preservedQuestions = preserveQuestionFields(questions || []);

      // Check if topic with this ID exists (for merging)
      if (id) {
        const existing = await storage.getTopic(id);
        if (existing) {
          // Merge questions: keep existing questions and add new ones, preserving all fields
          const existingQuestions = Array.isArray(existing.questions) ? existing.questions : [];
          const mergedQuestions = [...existingQuestions, ...preservedQuestions];
          const updated = await storage.updateTopic(id, {
            questions: mergedQuestions,
          });
          return res.json(updated);
        }
      }

      // Create new topic if ID doesn't exist or no ID provided
      const topic = await storage.addTopic({
        userId: DEFAULT_USER_ID,
        name,
        questions: preservedQuestions,
      });
      
      res.json(topic);
    } catch (error) {
      console.error("Error adding topic:", error);
      res.status(500).json({ error: "Failed to add topic" });
    }
  });

  // Delete topic
  app.delete("/api/topics/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTopic(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting topic:", error);
      res.status(500).json({ error: "Failed to delete topic" });
    }
  });

  // Get API keys
  app.get("/api/keys", async (req, res) => {
    try {
      const keys = await storage.getApiKeys(DEFAULT_USER_ID);
      if (!keys) {
        return res.json({ openaiKey: "", geminiKey: "", aiProvider: "openai" });
      }
      res.json(keys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // Save API keys
  app.post("/api/keys", async (req, res) => {
    try {
      const { openaiKey, geminiKey, aiProvider } = req.body;
      
      const keys = await storage.saveApiKeys({
        userId: DEFAULT_USER_ID,
        openaiKey: openaiKey || "",
        geminiKey: geminiKey || "",
        aiProvider: aiProvider || "openai",
      });
      
      res.json(keys);
    } catch (error) {
      console.error("Error saving API keys:", error);
      res.status(500).json({ error: "Failed to save API keys" });
    }
  });

  // Generate AI explanation for a question
  app.post("/api/generate-explanation", async (req, res) => {
    try {
      const { question, options, correctAnswer, openaiKey, geminiKey, aiProvider } = req.body;

      if (!question || !options || !correctAnswer) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const selectedKey = aiProvider === 'openai' ? openaiKey : geminiKey;
      if (!selectedKey || !selectedKey.trim()) {
        const providerName = aiProvider === 'openai' ? 'OpenAI' : 'Gemini';
        return res.status(400).json({ error: `${providerName} API key not provided` });
      }

      const systemPrompt = "You are a concise tutor explaining multiple choice questions. Provide clear, brief explanations for each option. IMPORTANT: Always add a blank line after each option and section for readability.";
      const optionsText = options.map((o: string, i: number) => `${String.fromCharCode(65+i)}. ${o}`).join('\n');
      const userMessage = `Question: ${question}

Options:
${optionsText}

Correct Answer: ${correctAnswer}

CRITICAL FORMATTING REQUIREMENTS:
- Start with "Option A:" followed by 2-3 sentences
- Add a BLANK LINE
- Then "Option B:" followed by 2-3 sentences
- Add a BLANK LINE
- Then "Option C:" followed by 2-3 sentences
- Add a BLANK LINE
- Then "Option D:" followed by 2-3 sentences
- Add a BLANK LINE
- Then "Key Concept:" followed by 1-2 sentences

Each section MUST be separated by a blank line. Do not write paragraphs together.`;

      let explanation = "";

      if (aiProvider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage }
            ],
            max_tokens: 500
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || "Failed to fetch explanation from OpenAI");
        }

        const data = await response.json();
        explanation = data.choices[0]?.message?.content || "No explanation returned.";
      } else if (aiProvider === 'gemini') {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: systemPrompt }]
              },
              contents: [{ parts: [{ text: userMessage }] }]
            })
          }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || "Failed to fetch explanation from Gemini");
        }

        const data = await response.json();
        explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation returned.";
      }

      res.json({ explanation });
    } catch (error: any) {
      console.error("Error generating explanation:", error);
      res.status(500).json({ error: error.message || "Failed to generate explanation" });
    }
  });

  return httpServer;
}
