
//  Auto-resume check on page load 
(async () => {
  try {
    const res = await fetch("/api/resume-info");
    const info = await res.json();
    if (info.autoResume) {
      // Hide upload, show pre-loaded indicator
      uploadArea.hidden = true;
      fileInfo.hidden = false;
      fileNameEl.textContent = info.fileName + " (auto-loaded)";
      selectedFile = "auto"; // sentinel value
      updateBtn();
    }
  } catch {}
})();
const fileInput    = document.getElementById("fileInput");
const uploadArea   = document.getElementById("uploadArea");
const fileInfo     = document.getElementById("fileInfo");
const fileNameEl   = document.getElementById("fileName");
const removeFile   = document.getElementById("removeFile");
const targetRole   = document.getElementById("targetRole");
const analyzeBtn   = document.getElementById("analyzeBtn");
const loadingState = document.getElementById("loadingState");
const stepsEl      = document.getElementById("agentSteps");
const errorState   = document.getElementById("errorState");
const errorMsg     = document.getElementById("errorMsg");
const results      = document.getElementById("results");

let selectedFile = null;

uploadArea.addEventListener("click", () => fileInput.click());
uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("drag-over"); });
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

removeFile.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  fileInfo.hidden = true;
  uploadArea.hidden = false;
  updateBtn();
});

function handleFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "docx"].includes(ext)) { showError("Only PDF and DOCX files are supported."); return; }
  selectedFile = file;
  fileNameEl.textContent = file.name;
  uploadArea.hidden = true;
  fileInfo.hidden = false;
  hideError();
  updateBtn();
}

targetRole.addEventListener("input", updateBtn);
function updateBtn() {
  analyzeBtn.disabled = !(selectedFile && targetRole.value.trim());
}

analyzeBtn.addEventListener("click", async () => {
  hideError();
  results.hidden = true;
  stepsEl.innerHTML = ""; stepsEl.hidden = false;
  loadingState.hidden = false;
  analyzeBtn.disabled = true;

  const formData = new FormData();
  if (selectedFile !== "auto") formData.append("resume", selectedFile);
  formData.append("role", targetRole.value.trim());

  try {
    const response = await fetch("/api/analyze", { method: "POST", body: formData });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          handleEvent(event);
        } catch {}
      }
    }
  } catch (err) {
    showError("Connection error: " + err.message);
  } finally {
    loadingState.hidden = true;
    analyzeBtn.disabled = false;
    updateBtn();
  }
});

function handleEvent(event) {
  if (event.type === "step") {
    addStep(event.step, event.label, "running");
  } else if (event.type === "step_done") {
    updateStep(event.step, event.label, "done");
  } else if (event.type === "result") {
    renderResults(event);
  } else if (event.type === "error") {
    showError(event.message);
  }
}

function addStep(step, label, status) {
  const el = document.createElement("div");
  el.className = `agent-step ${status}`;
  el.id = `step-${step}`;
  el.innerHTML = `<span class="step-icon">${status === "running" ? "" : ""}</span><span>${label}</span>`;
  stepsEl.appendChild(el);
}

function updateStep(step, label, status) {
  const el = document.getElementById(`step-${step}`);
  if (el) {
    el.className = `agent-step ${status}`;
    el.innerHTML = `<span class="step-icon"></span><span>${label}</span>`;
  }
}

function renderResults(data) {
  renderList("strengths", data.strengths);
  renderList("weaknesses", data.weaknesses);
  renderList("suggestions", data.suggestions);
  renderTags("skills", data.skills);
  renderTags("missingSkills", data.missingSkills);

  const score = Math.min(100, Math.max(0, Number(data.atsScore) || 0));
  document.getElementById("atsScore").textContent = score;
  document.getElementById("atsLabel").textContent = data.atsLabel || "";

  const ring = document.getElementById("scoreRing");
  ring.style.strokeDashoffset = 314 - (score / 100) * 314;
  ring.style.stroke = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderList(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  (items || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  });
}

function renderTags(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  (items || []).forEach((item) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = item;
    el.appendChild(span);
  });
}

function showError(msg) { errorMsg.textContent = msg; errorState.hidden = false; }
function hideError() { errorState.hidden = true; }



