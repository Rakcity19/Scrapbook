// ---------- IMAGE WORKER ----------
const IMAGE_BASE = "https://imageworker.r-c-kanaan.workers.dev";

// ---------- CONFIG: 12 pages total ----------
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
  if (coverPageWrapEl) coverPageWrapEl.classList.remove("hidden");
  if (coverPageEl) coverPageEl.classList.remove("hidden");
  if (challengeShellEl) challengeShellEl.classList.add("hidden");
  if (startBtn) startBtn.disabled = false;
}

function startExperience() {
  if (hasStarted) return;
  hasStarted = true;
  if (coverPageWrapEl) coverPageWrapEl.classList.add("hidden");
  if (coverPageEl) coverPageEl.classList.add("hidden");
  if (challengeShellEl) challengeShellEl.classList.remove("hidden");
  if (startBtn) startBtn.disabled = true;
  loadPage();
}

function getDefaultGuide(page) {
  if (page.type === "text") return "Type your best guess. Close counts.";
  if (page.type === "choice") return "Pick the moment that feels right.";
  if (page.type === "audio") return `Need about ${page.minSeconds.toFixed(1)}s with clear sound.`;
  return "Start camera, capture a photo, then use your favorite shot.";
}

function getSuccessMessage(page) {
  if (page.successMessage) return page.successMessage;
  if (page.type === "text") return "You got it. Memory unlocked.";
  if (page.type === "choice") return "Nice pick. Memory unlocked.";
  if (page.type === "audio") {
    return page.mode === "guitar"
      ? "Beautiful strum. Memory unlocked."
      : "That note did it. Memory unlocked.";
  }
  return "Perfect shot. Memory unlocked.";
}

function getPhotoNote(page) {
  if (page.photoNote) return page.photoNote;
  if (page.type === "audio") {
    return page.mode === "guitar" ? "You played this one open." : "You sang this one open.";
  }
  if (page.type === "selfie") return "A little snapshot of us.";
  return `Memory ${current + 1} / ${pages.length}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isAppleDevice() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchMac = platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod|Mac/.test(`${ua} ${platform}`) || touchMac;
}

function isNativeFileShareSupported(file) {
  if (!canNativeShare || !isAppleDevice() || !file) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function blobToFile(blob, filename) {
  return new File([blob], filename, {
    type: blob.type || "image/jpeg",
    lastModified: Date.now(),
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function canvasToBlob(canvasEl) {
  return new Promise((resolve) => {
    canvasEl.toBlob((blob) => resolve(blob), "image/jpeg", 0.95);
  });
}

function makeSelfieFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `page-${String(current + 1).padStart(2, "0")}-${stamp}.jpg`;
}

async function ensureSubmittedImagesFolderHandle() {
  if (submittedImagesDirHandle) return submittedImagesDirHandle;
  if (typeof window.showDirectoryPicker !== "function") return null;

  setFeedback(feedbackSelfie, "Choose the \"submitted images\" folder so we can save this photo.", "");
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    if (handle && handle.name !== "submitted images") {
      setFeedback(feedbackSelfie, "Please select the folder named \"submitted images\".", "bad");
      return null;
    }
    submittedImagesDirHandle = handle;
    return submittedImagesDirHandle;
  } catch {
    return null;
  }
}

async function saveSubmittedSelfie() {
  const filename = makeSelfieFilename();
  const blob = capturedSelfieBlob || await canvasToBlob(canvas);
  if (!blob) return { saved: false, method: "none", filename };

  const dirHandle = await ensureSubmittedImagesFolderHandle();
  if (dirHandle) {
    try {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, method: "filesystem", filename };
    } catch {
      // Fall through to download fallback.
    }
  }

  downloadBlob(blob, filename);
  return { saved: true, method: "download", filename };
}

function toggleShareChooser(show) {
  if (!shareChooser) return;
  shareChooser.classList.toggle("hidden", !show);
  if (!show && shareFeedback) {
    shareFeedback.textContent = "";
    shareFeedback.classList.remove("good", "bad");
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderPolaroidToCanvas() {
  const src = photoEl?.src;
  if (!src) return null;

  const img = await loadImage(src);
  const maxPhotoWidth = 1400;
  const photoAspect = img.naturalWidth / img.naturalHeight || 1;
  const photoWidth = maxPhotoWidth;
  const photoHeight = Math.round(photoWidth / photoAspect);
  const border = 40;
  const bottomPad = 180;

  const out = document.createElement("canvas");
  out.width = photoWidth + border * 2;
  out.height = photoHeight + border + bottomPad;

  const ctx = out.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(img, border, border, photoWidth, photoHeight);

  const note = photoNoteEl?.innerText?.trim() || getPhotoNote(pages[current]);
  ctx.fillStyle = "#5e5043";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '52px "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive';
  ctx.fillText(note, out.width / 2, out.height - bottomPad / 2);

  return out;
}

async function prepareShareFiles() {
  if (sharePreparing || shareFilesReady || !photoEl?.src) return;
  sharePreparing = true;

  try {
    const rawResponse = await fetch(photoEl.src);
    const rawBlob = await rawResponse.blob();
    cachedRawShareFile = blobToFile(rawBlob, `memory-${current + 1}.jpg`);

    const polaroidCanvas = await renderPolaroidToCanvas();
    const polaroidBlob = polaroidCanvas ? await canvasToBlob(polaroidCanvas) : null;
    cachedPolaroidShareFile = polaroidBlob ? blobToFile(polaroidBlob, `memory-polaroid-${current + 1}.jpg`) : null;

    shareFilesReady = !!cachedRawShareFile;
  } catch {
    shareFilesReady = false;
    cachedRawShareFile = null;
    cachedPolaroidShareFile = null;
  } finally {
    sharePreparing = false;
  }
}

function resetShareState() {
  cachedRawShareFile = null;
  cachedPolaroidShareFile = null;
  shareFilesReady = false;
  sharePreparing = false;
}

async function shareFile(file) {
  if (!isNativeFileShareSupported(file)) {
    if (taskGuideEl) taskGuideEl.innerText = "Sharing is unavailable on this device/browser.";
    return;
  }

  try {
    await navigator.share({
      files: [file],
      title: "Scrapbook Memory",
      text: "Unlocked memory",
    });
    setFeedback(shareFeedback, "Shared.", "good");
  } catch (err) {
    if (err?.name === "AbortError") {
      if (taskGuideEl) taskGuideEl.innerText = "Share canceled.";
      return;
    }
    if (taskGuideEl) taskGuideEl.innerText = "Could not share this photo right now.";
  }
}

async function shareRawPhoto() {
  if (!photoEl?.src || photoEl.style.display === "none") return toggleShareChooser(false);
  if (!cachedRawShareFile) {
    if (taskGuideEl) taskGuideEl.innerText = "Preparing share file... tap Share again in a moment.";
    prepareShareFiles();
    return toggleShareChooser(false);
  }
  try {
    await shareFile(cachedRawShareFile);
  } catch {
    if (taskGuideEl) taskGuideEl.innerText = "Could not prepare the raw photo for sharing.";
  } finally {
    toggleShareChooser(false);
  }
}

async function sharePolaroidPhoto() {
  if (!photoEl?.src || photoEl.style.display === "none") return toggleShareChooser(false);
  if (!cachedPolaroidShareFile) {
    if (taskGuideEl) taskGuideEl.innerText = "Preparing polaroid share... tap Share again in a moment.";
    prepareShareFiles();
    return toggleShareChooser(false);
  }
  try {
    await shareFile(cachedPolaroidShareFile);
  } catch {
    if (taskGuideEl) taskGuideEl.innerText = "Could not prepare the polaroid image.";
  } finally {
    toggleShareChooser(false);
  }
}

function printImageOnly() {
  if (!photoEl || !photoEl.src || photoEl.style.display === "none") return;

  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) return;

  const safeSrc = photoEl.src.replace(/"/g, "&quot;");
  printWindow.document.open();
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print Memory</title>
  <style>
    html, body { margin: 0; padding: 0; background: #fff; }
    img { display: block; width: 100%; height: auto; max-width: 100%; object-fit: contain; }
    @media print { @page { margin: 0; } }
  </style>
</head>
<body>
  <img src="${safeSrc}" alt="Memory" />
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();

  const img = printWindow.document.querySelector("img");
  if (!img) return;

  const runPrint = () => {
    printWindow.print();
    printWindow.close();
  };

  if (img.complete) runPrint();
  else img.onload = runPrint;
}

function setLockedUI() {
  unlocked = false;
  resetShareState();
  titleEl.innerText = `🔒 Page ${current + 1} Locked`;
  if (stageSubEl) stageSubEl.innerText = "Solve this little challenge to reveal the next memory.";
  progressEl.innerText = `Page ${current + 1} / ${pages.length}`;
  if (progressFillEl) progressFillEl.style.width = `${((current + 1) / pages.length) * 100}%`;

  if (polaroidEl) polaroidEl.classList.add("hidden");
  photoEl.style.display = "none";
  photoEl.classList.remove("reveal");
  printBtn.classList.add("hidden");
  shareBtn.classList.add("hidden");
  toggleShareChooser(false);
  nextBtn.classList.add("hidden");
}

function unlock() {
  unlocked = true;
  const page = pages[current];
  titleEl.innerText = `🔓 Page ${current + 1} Unlocked`;
  if (stageSubEl) stageSubEl.innerText = "Unlocked. Print it or continue to the next page.";
  if (taskGuideEl) taskGuideEl.innerText = "Take a second to enjoy this one.";
  photoEl.src = pages[current].image;
  photoEl.style.display = "block";
  photoEl.classList.add("reveal");
  if (photoNoteEl) photoNoteEl.innerText = getPhotoNote(page);
  if (polaroidEl) polaroidEl.classList.remove("hidden");
  printBtn.classList.remove("hidden");
  if (canNativeShare && isAppleDevice()) shareBtn.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
  nextBtn.innerText = current + 1 === pages.length ? "Finish Story" : "Next Memory";

  if (unlockTextBtn) unlockTextBtn.disabled = true;
  if (page.type === "selfie") {
    setFeedback(feedbackSelfie, getSuccessMessage(page), "good");
  }
  prepareShareFiles();
}

async function next() {
  if (isTransitioning) return;
  isTransitioning = true;

  stopAudioIfRunning();
  stopCameraIfRunning();
  hideAllPanels();
  if (polaroidEl) polaroidEl.classList.add("hidden");
  photoEl.style.display = "none";
  printBtn.classList.add("hidden");
  shareBtn.classList.add("hidden");
  toggleShareChooser(false);
  nextBtn.classList.add("hidden");
  promptEl.innerText = "Moving to the next memory…";
  if (taskGuideEl) taskGuideEl.innerText = "One heartbeat.";
  if (stageSubEl) stageSubEl.innerText = "Getting the next challenge ready.";
  await sleep(350);

  current++;
  if (current >= pages.length) {
    titleEl.innerText = "📖 All memories unlocked";
    if (stageSubEl) stageSubEl.innerText = "You made it through every page.";
    promptEl.innerText = "That is the whole story.";
    if (taskGuideEl) taskGuideEl.innerText = "Thanks for playing through these memories.";
    hideAllPanels();
    if (polaroidEl) polaroidEl.classList.add("hidden");
    photoEl.style.display = "none";
    printBtn.classList.add("hidden");
    shareBtn.classList.add("hidden");
    toggleShareChooser(false);
    nextBtn.classList.add("hidden");
    progressEl.innerText = `Done`;
    if (progressFillEl) progressFillEl.style.width = "100%";
    isTransitioning = false;
    return;
  }
  loadPage();
  isTransitioning = false;
}

// ---------- TEXT ----------
function checkTextAnswer() {
  const page = pages[current];
  const user = (answerInput.value || "").toLowerCase().trim();

  if (!user) return setFeedback(feedbackText, "Try your best guess. I know you remember it.", "bad");

  const ok = page.answers.some(k => user.includes(k));
  if (ok) {
    setFeedback(feedbackText, getSuccessMessage(page), "good");
    unlock();
  } else {
    setFeedback(feedbackText, page.failureHint || "Close. Keep guessing, this page is still locked.", "bad");
  }
}

// ---------- CHOICE (FIXED) ----------
function renderChoices() {
  const page = pages[current];
  choicesEl.innerHTML = "";
  setFeedback(feedbackChoice, "", "");

  page.choices.forEach((label, idx) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = "secondary";
    b.style.marginTop = "10px";
    b.onclick = () => {
      if (idx === page.correctIndex) {
        setFeedback(feedbackChoice, getSuccessMessage(page), "good");
        unlock();
      } else {
        setFeedback(feedbackChoice, page.failureHint || "Almost. Take another guess.", "bad");
      }
    };
    choicesEl.appendChild(b);
  });
}

// ---------- AUDIO ----------
let audioStream = null;
let audioCtx = null;
let analyser = null;
let rafId = null;
let startedAt = null;
let maxRmsSeen = 0;

async function startAudio() {
  const page = pages[current];
  clearFeedback();
  setFeedback(audioStatus, "Requesting microphone access…", "");

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch {
    setFeedback(audioStatus, "Microphone blocked or unavailable.", "bad");
    setFeedback(feedbackAudio, "Please allow mic access in your browser settings, then try again.", "bad");
    return;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(audioStream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  startedAt = performance.now();
  maxRmsSeen = 0;
  startRecBtn.disabled = true;
  stopRecBtn.disabled = false;

  setFeedback(audioStatus, `Recording… target ${page.minSeconds.toFixed(1)}s + audible sound.`, "");
  tickMeter(page);
}

function computeRms() {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

function tickMeter(page) {
  const rms = computeRms();
  maxRmsSeen = Math.max(maxRmsSeen, rms);

  const pct = Math.min(100, Math.floor((rms / 0.08) * 100));
  meterFill.style.width = pct + "%";

  const elapsed = (performance.now() - startedAt) / 1000;
  setFeedback(audioStatus, `Recording ${elapsed.toFixed(1)}s / ${page.minSeconds.toFixed(1)}s target`, "");

  rafId = requestAnimationFrame(() => tickMeter(page));
}

function stopAudioAndValidate() {
  const page = pages[current];

  stopRecBtn.disabled = true;
  startRecBtn.disabled = false;

  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  const elapsed = startedAt ? (performance.now() - startedAt) / 1000 : 0;
  setFeedback(audioStatus, `Recorded ${elapsed.toFixed(1)}s`, "");

  stopAudioIfRunning();

  const tooShort = elapsed < page.minSeconds;
  const tooQuiet = maxRmsSeen < page.minRms;
  const ok = !tooShort && !tooQuiet;

  if (ok) {
    setFeedback(feedbackAudio, getSuccessMessage(page), "good");
    unlock();
  } else {
    const reasons = [];
    if (tooShort) reasons.push(`a little longer (about ${page.minSeconds.toFixed(1)}s)`);
    if (tooQuiet) reasons.push("a bit louder");
    setFeedback(feedbackAudio, `So close. Try ${reasons.join(" and ")}.`, "bad");
  }
}

function stopAudioIfRunning() {
  if (audioStream) {
    audioStream.getTracks().forEach(t => t.stop());
    audioStream = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  analyser = null;
  startedAt = null;
  meterFill.style.width = "0%";
}

// ---------- SELFIE ----------
let camStream = null;

async function startCamera() {
  clearFeedback();
  capturedSelfieBlob = null;

  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  } catch {
    setFeedback(feedbackSelfie, "Camera access is blocked right now. Please allow camera permission and try again.", "bad");
    return;
  }

  video.srcObject = camStream;
  video.classList.remove("hidden");
  captureBtn.disabled = false;
  captureBtn.innerText = "Capture";
  canvas.style.display = "none";
  retakeBtn.classList.add("hidden");
  useSelfieBtn.classList.add("hidden");

  if (selfieHint) selfieHint.innerText = "Great. Frame your shot, then tap Capture.";
  setFeedback(feedbackSelfie, "Camera is live. Ready when you are.", "");
}

async function captureSelfie() {
  if (!camStream) return;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  capturedSelfieBlob = await canvasToBlob(canvas);

  canvas.style.display = "block";
  retakeBtn.classList.remove("hidden");
  useSelfieBtn.classList.remove("hidden");

  if (selfieHint) selfieHint.innerText = "You can retake or use this one to unlock.";
  setFeedback(feedbackSelfie, "Nice shot. Keep it or retake one more.", "");
}

async function useSelfieToUnlock() {
  const page = pages[current];
  unlock();
  const result = await saveSubmittedSelfie();

  if (!result.saved) {
    setFeedback(feedbackSelfie, `${getSuccessMessage(page)} We could not save the selfie file.`, "bad");
    return;
  }

  if (result.method === "filesystem") {
    setFeedback(feedbackSelfie, `${getSuccessMessage(page)} Saved in \"submitted images\" as ${result.filename}.`, "good");
    return;
  }

  setFeedback(
    feedbackSelfie,
    `${getSuccessMessage(page)} Downloaded as ${result.filename}; move it into \"submitted images\".`,
    "good"
  );
}

function stopCameraIfRunning() {
  if (camStream) {
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
  }
  video.srcObject = null;
  video.classList.add("hidden");
  captureBtn.disabled = true;
  retakeBtn.classList.add("hidden");
  canvas.style.display = "none";
  useSelfieBtn.classList.add("hidden");
  capturedSelfieBlob = null;
}

// ---------- LOAD PAGE ----------
function loadPage() {
  const page = pages[current];
  setLockedUI();
  hideAllPanels();
  clearFeedback();

  promptEl.innerText = page.prompt;
  if (taskGuideEl) taskGuideEl.innerText = page.hint || getDefaultGuide(page);

  if (unlockTextBtn) unlockTextBtn.disabled = false;

  if (page.type === "text") {
    textPanel.classList.remove("hidden");
    answerInput.value = "";
    answerInput.focus();
  }

  // IMPORTANT: render the choice buttons
  if (page.type === "choice") {
    choicePanel.classList.remove("hidden");
    renderChoices();
  }

  if (page.type === "audio") {
    audioPanel.classList.remove("hidden");
    const modeLabel = page.mode === "guitar" ? "guitar" : "voice";
    audioHint.innerText =
      `Quick checklist: a quiet spot, clear ${modeLabel}, and about ${page.minSeconds.toFixed(1)} seconds.`;
    startRecBtn.disabled = false;
    stopRecBtn.disabled = true;
    meterFill.style.width = "0%";
    setFeedback(audioStatus, `Press Start, then go for ~${page.minSeconds.toFixed(1)}s.`, "");
  }

  if (page.type === "selfie") {
    selfiePanel.classList.remove("hidden");
    stopCameraIfRunning();
    if (selfieHint) selfieHint.innerText = "Tip: start the camera, take a photo, and choose your favorite one.";
  }
}

// ---------- EVENTS ----------
unlockTextBtn.addEventListener("click", checkTextAnswer);
answerInput.addEventListener("keydown", (e) => { if (e.key === "Enter") checkTextAnswer(); });

startRecBtn.addEventListener("click", startAudio);
stopRecBtn.addEventListener("click", stopAudioAndValidate);

startCamBtn.addEventListener("click", startCamera);
captureBtn.addEventListener("click", captureSelfie);
retakeBtn.addEventListener("click", captureSelfie);
useSelfieBtn.addEventListener("click", useSelfieToUnlock);

printBtn.addEventListener("click", printImageOnly);
shareBtn.addEventListener("click", () => toggleShareChooser(shareChooser.classList.contains("hidden")));
shareRawBtn.addEventListener("click", shareRawPhoto);
sharePolaroidBtn.addEventListener("click", sharePolaroidPhoto);
nextBtn.addEventListener("click", next);
startBtn.addEventListener("click", startExperience);

// ---------- START ----------
renderPostageStamps();
showCover();
