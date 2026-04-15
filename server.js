require("dotenv").config();
const express  = require("express");
const multer   = require("multer");
const pdfParse = require("pdf-parse");
const mammoth  = require("mammoth");
const https    = require("https");
const path     = require("path");
const fs       = require("fs");

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const PORT   = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// GET /api/resume-info — tells frontend if a resume is auto-loaded
app.get("/api/resume-info", (req, res) => {
  const p = process.env.RESUME_PATH;
  if (p && fs.existsSync(p)) {
    res.json({ autoResume: true, fileName: path.basename(p) });
  } else {
    res.json({ autoResume: false });
  }
});

// POST /api/analyze — SSE streaming multi-step agent
app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (type, data) => res.write("data: " + JSON.stringify({ type, ...data }) + "\n\n");

  try {
    const role = (req.body.role || "").trim();
    if (!role) { send("error", { message: "Target role is required." }); return res.end(); }

    const apiKey = process.env.OLLAMA_API_KEY;
    if (!apiKey || apiKey === "your_ollama_key_here") {
      send("error", { message: "Ollama API key not configured in .env" });
      return res.end();
    }

    // Parse resume — uploaded file takes priority, then auto-path from .env
    let resumeText = "";
    const autoPath = process.env.RESUME_PATH;

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === ".pdf") {
        resumeText = (await pdfParse(req.file.buffer)).text;
      } else if (ext === ".docx") {
        resumeText = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
      } else {
        send("error", { message: "Only PDF and DOCX supported." });
        return res.end();
      }
    } else if (autoPath && fs.existsSync(autoPath)) {
      const ext = path.extname(autoPath).toLowerCase();
      const buffer = fs.readFileSync(autoPath);
      if (ext === ".pdf") {
        resumeText = (await pdfParse(buffer)).text;
      } else if (ext === ".docx") {
        resumeText = (await mammoth.extractRawText({ buffer })).value;
      }
    } else {
      send("error", { message: "No file uploaded and no RESUME_PATH set in .env" });
      return res.end();
    }

    if (!resumeText.trim()) {
      send("error", { message: "Could not extract text from the resume." });
      return res.end();
    }

    const resume = resumeText.slice(0, 10000);

    // Step 1
    send("step", { step: 1, label: "Reading resume background..." });
    const background = await ollamaCall(apiKey, "You are a resume analyst. Read this resume and write a brief 3-sentence summary of the candidate professional background, experience level, and domain.\nResume:\n" + resume + "\nReply with ONLY the summary text, no labels or JSON.");
    send("step_done", { step: 1, label: "Background understood" });

    // Step 2
    send("step", { step: 2, label: "Extracting skills..." });
    const skillsRaw = await ollamaCall(apiKey, "You are a skills extractor. List ALL technical and professional skills in this resume.\nResume:\n" + resume + "\nReturn ONLY a JSON array of strings e.g. [\"Python\",\"React\"]. No explanation.");
    const skills = parseArray(skillsRaw);
    send("step_done", { step: 2, label: skills.length + " skills extracted" });

    // Step 3
    send("step", { step: 3, label: "Analyzing role fit for: " + role + "..." });
    const missingRaw = await ollamaCall(apiKey, "You are a job requirements expert. The candidate is applying for: \"" + role + "\".\nBackground: " + background + "\nCurrent skills: " + skills.join(", ") + "\nList skills they are MISSING for this role. Return ONLY a JSON array of strings. No explanation.");
    const missingSkills = parseArray(missingRaw);
    send("step_done", { step: 3, label: "Role fit analyzed" });

    // Step 4
    send("step", { step: 4, label: "Evaluating strengths & weaknesses..." });
    const swRaw = await ollamaCall(apiKey, "You are a career coach reviewing a resume for: \"" + role + "\".\nBackground: " + background + "\nSkills: " + skills.join(", ") + "\nMissing: " + missingSkills.join(", ") + "\nReturn ONLY this JSON (no markdown): {\"strengths\":[\"...\"],\"weaknesses\":[\"...\"]}");
    const sw = parseObject(swRaw, { strengths: [], weaknesses: [] });
    send("step_done", { step: 4, label: "Strengths & weaknesses identified" });

    // Step 5
    send("step", { step: 5, label: "Generating ATS score & suggestions..." });
    const scoreRaw = await ollamaCall(apiKey, "You are an ATS scoring system for the role: \"" + role + "\".\nBackground: " + background + "\nSkills: " + skills.join(", ") + "\nMissing: " + missingSkills.join(", ") + "\nStrengths: " + (sw.strengths||[]).join(", ") + "\nWeaknesses: " + (sw.weaknesses||[]).join(", ") + "\nReturn ONLY this JSON (no markdown): {\"atsScore\":<0-100>,\"atsLabel\":\"<Excellent|Good|Needs Work|Poor>\",\"suggestions\":[\"tip1\",\"tip2\",\"tip3\",\"tip4\",\"tip5\"]}");
    const final = parseObject(scoreRaw, { atsScore: 50, atsLabel: "Needs Work", suggestions: [] });
    send("step_done", { step: 5, label: "Analysis complete" });

    send("result", {
      skills,
      missingSkills,
      strengths:   sw.strengths   || [],
      weaknesses:  sw.weaknesses  || [],
      suggestions: final.suggestions || [],
      atsScore:    final.atsScore,
      atsLabel:    final.atsLabel
    });

  } catch (err) {
    console.error(err);
    send("error", { message: err.message || "Analysis failed." });
  }
  res.end();
});

// Ollama API call
function ollamaCall(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "gemma3:4b",
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { temperature: 0.3 }
    });
    const options = {
      hostname: "api.ollama.com",
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const request = https.request(options, (response) => {
      let data = "";
      response.on("data", chunk => data += chunk);
      response.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(JSON.stringify(parsed.error)));
          resolve(parsed.message && parsed.message.content ? parsed.message.content : "");
        } catch (e) {
          reject(new Error("Invalid Ollama response: " + e.message));
        }
      });
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function parseArray(raw) {
  try { const m = raw.match(/\[[\s\S]*?\]/); return m ? JSON.parse(m[0]) : []; } catch { return []; }
}
function parseObject(raw, fallback) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : fallback; } catch { return fallback; }
}

app.listen(PORT, () => {
  console.log("Resume Analyzer running at http://localhost:" + PORT);
  require("child_process").exec("start http://localhost:" + PORT);
});