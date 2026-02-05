// ---------- IMAGE WORKER ----------
const IMAGE_BASE = "https://imageworker.r-c-kanaan.workers.dev";

// ---------- CONFIG: 12 pages (3 per category) ----------
const pages = [
  // Text / Choice (3 total)
  { type: "text",   prompt: "Where was this photo taken?",        answers: ["amman", "abdoun"],      image: `${IMAGE_BASE}/1.jpg` },
  { type: "choice", prompt: "Before or after graduation?",       choices: ["Before", "After"],     correctIndex: 0,           image: `${IMAGE_BASE}/2.jpg` },
  { type: "text",   prompt: "What song were you obsessed with?", answers: ["yellow", "coldplay"],  image: `${IMAGE_BASE}/3.jpg` },

  // Audio (Guitar) forgiving (3 total)
  { type: "audio", mode: "guitar", prompt: "🎸 Play the A chord (or any chord) for 2 seconds.", minSeconds: 2.0, minRms: 0.02, image: `${IMAGE_BASE}/4.jpg` },
  { type: "audio", mode: "guitar", prompt: "🎸 Strum for 3 seconds (a little louder).",         minSeconds: 3.0, minRms: 0.02, image: `${IMAGE_BASE}/5.jpg` },
  { type: "audio", mode: "guitar", prompt: "🎸 Final guitar lock: 2 seconds, clear sound.",     minSeconds: 2.0, minRms: 0.03, image: `${IMAGE_BASE}/6.jpg` },

  // Audio (Singing) forgiving (3 total)
  { type: "audio", mode: "sing",   prompt: "🎤 Hold any note for 2 seconds.",                    minSeconds: 2.0, minRms: 0.02, image: `${IMAGE_BASE}/7.jpg` },
  { type: "audio", mode: "sing",   prompt: "🎤 Opera moment: 3 seconds.",                        minSeconds: 3.0, minRms: 0.02, image: `${IMAGE_BASE}/8.jpg` },
  { type: "audio", mode: "sing",   prompt: "🎤 Sing/hum for 2 seconds (not a whisper).",         minSeconds: 2.0, minRms: 0.03, image: `${IMAGE_BASE}/9.jpg` },

  // Selfie / Camera (3 total)
  { type: "selfie", prompt: "🤳 Take a selfie with your biggest smile.",              image: `${IMAGE_BASE}/10.jpg` },
  { type: "selfie", prompt: "🤳 Take a ‘serious movie poster’ selfie.",               image: `${IMAGE_BASE}/11.jpg` },
  { type: "selfie", prompt: "🤳 Take a selfie holding the scrapbook page in frame.",  image: `${IMAGE_BASE}/12.jpg` },
];

// ---------- STATE ----------
let current = 0;
let unlocked = false;
let isTransitioning = false;
let submittedImagesDirHandle = null;
let capturedSelfieBlob = null;
let cachedRawShareFile = null;
let cachedPolaroidShareFile = null;
let shareFilesReady = false;
let sharePreparing = false;
let hasStarted = false;

// ---------- DOM ----------
const titleEl = document.getElementById("title");
const stageSubEl = document.getElementById("stageSub");
const progressEl = document.getElementById("progress");
const progressFillEl = document.getElementById("progressFill");
const promptEl = document.getElementById("prompt");
const coverPageWrapEl = document.getElementById("coverPageWrap");
const coverPageEl = document.getElementById("coverPage");
const challengeShellEl = document.getElementById("challengeShell");
const startBtn = document.getElementById("startBtn");
const postageLayerEl = document.getElementById("postageLayer");
const taskGuideEl = document.getElementById("taskGuide");
const polaroidEl = document.getElementById("polaroid");
const photoEl = document.getElementById("photo");
const photoNoteEl = document.getElementById("photoNote");
const printBtn = document.getElementById("printBtn");
const shareBtn = document.getElementById("shareBtn");
const shareChooser = document.getElementById("shareChooser");
const shareRawBtn = document.getElementById("shareRawBtn");
const sharePolaroidBtn = document.getElementById("sharePolaroidBtn");
const shareFeedback = document.getElementById("shareFeedback");
const nextBtn = document.getElementById("nextBtn");

// Panels
const textPanel = document.getElementById("textPanel");
const answerInput = document.getElementById("answerInput");
const unlockTextBtn = document.getElementById("unlockTextBtn");
const feedbackText = document.getElementById("feedbackText");

const choicePanel = document.getElementById("choicePanel");
const choicesEl = document.getElementById("choices");
const feedbackChoice = document.getElementById("feedbackChoice");

const audioPanel = document.getElementById("audioPanel");
const audioHint = document.getElementById("audioHint");
const startRecBtn = document.getElementById("startRecBtn");
const stopRecBtn = document.getElementById("stopRecBtn");
const meterFill = document.getElementById("meterFill");
const audioStatus = document.getElementById("audioStatus");
const feedbackAudio = document.getElementById("feedbackAudio");

const selfiePanel = document.getElementById("selfiePanel");
const startCamBtn = document.getElementById("startCamBtn");
const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const useSelfieBtn = document.getElementById("useSelfieBtn");
const feedbackSelfie = document.getElementById("feedbackSelfie");
const selfieHint = document.getElementById("selfieHint");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const canNativeShare = !!navigator.share && !!navigator.canShare;

// ---------- HELPERS ----------
function hideAllPanels() {
  textPanel.classList.add("hidden");
  choicePanel.classList.add("hidden");
  audioPanel.classList.add("hidden");
  selfiePanel.classList.add("hidden");
}

function clearFeedback() {
  for (const el of [feedbackText, feedbackChoice, audioStatus, feedbackAudio, feedbackSelfie, shareFeedback]) {
    if (!el) continue;
    el.textContent = "";
    el.classList.remove("good", "bad");
  }
}

function setFeedback(el, msg, kind) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("good", "bad");
  if (kind) el.classList.add(kind);
}

function renderPostageStamps() {
  if (!postageLayerEl) return;
  postageLayerEl.innerHTML = "";

  const count = 10;
  const palette = [
    "rgba(188, 107, 82, 0.22)",
    "rgba(119, 135, 92, 0.2)",
    "rgba(110, 98, 146, 0.2)",
    "rgba(177, 129, 72, 0.22)",
  ];

  for (let i = 0; i < count; i++) {
    const stamp = document.createElement("div");
    stamp.className = "stamp";

    const size = Math.floor(80 + Math.random() * 70);
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const angle = -20 + Math.random() * 40;
    const tint = palette[Math.floor(Math.random() * palette.length)];

    stamp.style.width = `${size}px`;
    stamp.style.height = `${size}px`;
    stamp.style.left = `${x}%`;
    stamp.style.top = `${y}%`;
    stamp.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    stamp.style.background = tint;
    stamp.style.opacity = `${0.35 + Math.random() * 0.25}`;

    postageLayerEl.appendChild(stamp);
  }
}

function showCover() {
  hasStarted = false;
  coverPageWrapEl.classList.remove("hidden");
  challengeShellEl.classList.add("hidden");
  startBtn.disabled = false;
}

function startExperience() {
  if (hasStarted) return;
  hasStarted = true;
  coverPageWrapEl.classList.add("hidden");
  challengeShellEl.classList.remove("hidden");
  startBtn.disabled = true;
  loadPage();
}

// ---------- CORE ----------
function setLockedUI() {
  unlocked = false;
  titleEl.innerText = `🔒 Page ${current + 1} Locked`;
  stageSubEl.innerText = "Solve this little challenge to reveal the next memory.";
  progressEl.innerText = `Page ${current + 1} / ${pages.length}`;
  progressFillEl.style.width = `${((current + 1) / pages.length) * 100}%`;

  polaroidEl.classList.add("hidden");
  photoEl.style.display = "none";
  printBtn.classList.add("hidden");
  shareBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
}

function unlock() {
  unlocked = true;
  const page = pages[current];
  titleEl.innerText = `🔓 Page ${current + 1} Unlocked`;
  stageSubEl.innerText = "Unlocked. Print it or continue.";
  photoEl.src = page.image;
  photoEl.style.display = "block";
  polaroidEl.classList.remove("hidden");
  printBtn.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
}

// ---------- LOAD ----------
function loadPage() {
  setLockedUI();
  hideAllPanels();
  clearFeedback();

  const page = pages[current];
  promptEl.innerText = page.prompt;

  if (page.type === "text") textPanel.classList.remove("hidden");
  if (page.type === "choice") choicePanel.classList.remove("hidden");
  if (page.type === "audio") audioPanel.classList.remove("hidden");
  if (page.type === "selfie") selfiePanel.classList.remove("hidden");
}

// ---------- EVENTS ----------
unlockTextBtn.addEventListener("click", unlock);
nextBtn.addEventListener("click", () => {
  current++;
  if (current >= pages.length) return;
  loadPage();
});
startBtn.addEventListener("click", startExperience);

// ---------- START ----------
renderPostageStamps();
showCover();
