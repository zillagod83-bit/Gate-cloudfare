import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function handleApiRoute(
  req: any,
  res: any,
  path: string,
  env: any
): Promise<void> {
  // Extract MCQ endpoint
  if (path === "/api/extract-mcq" && req.method === "POST") {
    try {
      const { imageBase64, topic } = req.body;

      const imageSize = imageBase64?.length || 0;
      console.log("[OCR] Request received. Image size:", imageSize, "bytes");

      if (!imageBase64 || imageBase64.length === 0) {
        res.status(400).json({ error: "No image provided" });
        return;
      }

      if (imageSize < 1000) {
        console.error("[OCR] Image too small! Likely corrupted. Size:", imageSize);
        res.status(400).json({
          error: "Image appears corrupted (too small). Try uploading again.",
        });
        return;
      }

      const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("[OCR] GEMINI_API_KEY not set!");
        res.status(500).json({ error: "Gemini API not configured" });
        return;
      }

      console.log("[OCR] Using GEMINI_API_KEY:", apiKey.substring(0, 20) + "...");

      const genAIInstance = new GoogleGenerativeAI(apiKey);
      const model = genAIInstance.getGenerativeModel({ model: "gemini-2.0-flash" });

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
- "options": Array of exactly 4 options AS THEY APPEAR
- "correctAnswer": Exactly as shown (B, P and Q, 1-ii, etc.)
- "explanation": Visible explanation text, empty string if not shown
- "pageNo": Page number if first question on page

CRITICAL RULES:
✓ Copy ALL text EXACTLY - character for character, no modifications
✓ For diagrams: describe what you see in the image as part of the question
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

      let result;
      try {
        let jsonStr = responseText.trim();

        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/m, "");
        jsonStr = jsonStr.replace(/\n?```\s*$/m, "");

        const firstBrace = jsonStr.indexOf("{");
        const lastBrace = jsonStr.lastIndexOf("}");

        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
          console.error("[OCR] No JSON found. Response:", responseText.substring(0, 500));
          res.status(400).json({
            error:
              "[DEBUG] Gemini returned no JSON. Response: " +
              responseText.substring(0, 200),
          });
          return;
        }

        let jsonStr2 = jsonStr.substring(firstBrace, lastBrace + 1);
        jsonStr2 = jsonStr2.replace(/,(\s*[\}\]])/g, "$1");

        result = JSON.parse(jsonStr2);
        console.log("[OCR] Parsed successfully. Questions:", result.questions?.length || 0);
      } catch (parseError) {
        const errorMsg =
          parseError instanceof Error ? parseError.message : String(parseError);
        console.error("[OCR] JSON Parse Error:", errorMsg);
        console.error("[OCR] Response was:", responseText.substring(0, 500));
        res.status(400).json({
          error:
            "[DEBUG] JSON Parse Error: " + errorMsg + " | Response: " + responseText.substring(0, 150),
        });
        return;
      }

      if (!result.questions || !Array.isArray(result.questions)) {
        console.error("[OCR] Invalid format. Questions type:", typeof result.questions);
        res.status(400).json({ error: "[DEBUG] Invalid format. Got type: " + typeof result.questions });
        return;
      }

      if (result.questions.length === 0) {
        console.warn("[OCR] Empty questions array returned. Full result:", JSON.stringify(result).substring(0, 300));
        res.status(400).json({
          error: "[DEBUG] Empty questions. Gemini said: " + JSON.stringify(result).substring(0, 150),
        });
        return;
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error("[OCR] Unexpected error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  // Topics endpoint
  if (path === "/api/topics") {
    res.status(200).json([]);
  }

  // Keys endpoint
  if (path === "/api/keys") {
    res.status(200).json({
      id: "",
      userId: "default",
      openaiKey: "",
      geminiKey: "",
      aiProvider: "gemini",
    });
  }

  // Not found
  res.status(404).json({ error: "Not found" });
}
