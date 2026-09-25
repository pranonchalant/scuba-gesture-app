import { GestureRecognizer, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

// DOM Elements - Shell & Controls
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const cameraShell = document.getElementById('cameraShell');
const cameraStartOverlay = document.getElementById('cameraStartOverlay');
const btnStartCamera = document.getElementById('btnStartCamera');
const gestureToast = document.getElementById('gestureToast');
const toastIcon = document.getElementById('toastIcon');
const toastText = document.getElementById('toastText');
const activeBadgeIcon = document.getElementById('activeBadgeIcon');
const activeGestureName = document.getElementById('activeGestureName');
const letterCountEl = document.getElementById('letterCount');
const enableSoundButton = document.getElementById('enableSoundButton');
const soundButtonText = document.getElementById('soundButtonText');
const statusText = document.querySelector('.status');
const modeHintText = document.getElementById('modeHintText');

// Mode Switch Tabs
const tabSignMode = document.getElementById('tabSignMode');
const tabVfxMode = document.getElementById('tabVfxMode');
const signStudioSection = document.getElementById('signStudioSection');
const gestureLegend = document.getElementById('gestureLegend');

// Sign-to-Speech DOM Elements
const currentSignDisplay = document.getElementById('currentSignDisplay');
const signInstruction = document.getElementById('signInstruction');
const holdPercent = document.getElementById('holdPercent');
const holdProgressFill = document.getElementById('holdProgressFill');
const transcriptTextEl = document.getElementById('transcriptText');
const transcriptWordCount = document.getElementById('transcriptWordCount');
const btnSpeakSentence = document.getElementById('btnSpeakSentence');
const btnSpace = document.getElementById('btnSpace');
const btnBackspace = document.getElementById('btnBackspace');
const btnClear = document.getElementById('btnClear');
const btnCopy = document.getElementById('btnCopy');
const wordChipsGrid = document.getElementById('wordChipsGrid');
const aslGrid = document.getElementById('aslGrid');

// TTS Settings Elements
const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
const ttsRateSlider = document.getElementById('ttsRateSlider');
const ttsRateValue = document.getElementById('ttsRateValue');
const ttsPitchSlider = document.getElementById('ttsPitchSlider');
const ttsPitchValue = document.getElementById('ttsPitchValue');
const chkSpeakLetters = document.getElementById('chkSpeakLetters');
const chkAutoSpeak = document.getElementById('chkAutoSpeak');

// Feature Toggles Bar
const toggleSpeechBtn = document.getElementById('toggleSpeechBtn');
const toggleBubblesBtn = document.getElementById('toggleBubblesBtn');
const toggleTrailsBtn = document.getElementById('toggleTrailsBtn');
const toggleSkeletonBtn = document.getElementById('toggleSkeletonBtn');

// Media Elements
const scubaGif = document.getElementById('scubaGif');
const scubaVideo = document.getElementById('scubaVideo');
const connectedVideo = document.getElementById('connectedVideo');
const audio = document.getElementById('audio');
const connectedAudio = document.getElementById('connectedAudio');

// File Inputs
const scubaAudioInput = document.getElementById('scubaAudioInput');
const scubaVisualInput = document.getElementById('scubaVisualInput');
const connectedVideoInput = document.getElementById('connectedVideoInput');
const connectedAudioInput = document.getElementById('connectedAudioInput');

const ctx = canvas.getContext('2d');

// App Modes: 'sign' or 'vfx'
let currentAppMode = 'sign';

// State flags and settings
let gestureRecognizer = null;
let latestResult = null;
let soundEnabled = false;
let audioCtx = null;
let speechAudioEnabled = true;
let bubblesEnabled = true;
let trailsEnabled = true;
let skeletonEnabled = true;
let cameraRunning = false;

// Frame processing timestamps
let lastVideoTime = -1;
let lastTimestamp = -1;

// Sign Translation State
let transcript = '';
let totalLettersSpelled = 0;
let currentCandidateSign = null;
let candidateHoldStart = 0;
let lastCommittedSign = null;
let lastCommitTime = 0;
const HOLD_REQUIRED_MS = 650;
const COMMIT_COOLDOWN_MS = 600;

// Web Speech API
const synth = window.speechSynthesis;
let availableVoices = [];
let selectedVoice = null;
let speechRate = 1.0;
let speechPitch = 1.0;

// Particle & AR Systems
const particles = [];
const arBubbles = [];
const fingerTrailHistory = [];
const MAX_TRAIL_LENGTH = 28;
let lastTriggerTimes = {};
const TRIGGER_DEBOUNCE = 1600;
let activeOverlayTimeout = null;
let toastTimeout = null;
let connectedActive = false;

// ==========================================
// Web Speech API (Text-To-Speech)
// ==========================================
function initSpeechVoices() {
  if (!synth) return;
  const populate = () => {
    availableVoices = synth.getVoices();
    if (!ttsVoiceSelect) return;
    ttsVoiceSelect.innerHTML = '';

    const englishVoices = availableVoices.filter((v) => v.lang.startsWith('en'));
    const voicesToShow = englishVoices.length > 0 ? englishVoices : availableVoices;

    voicesToShow.forEach((voice) => {
      const opt = document.createElement('option');
      opt.value = voice.name;
      opt.textContent = `${voice.name} (${voice.lang})`;
      if (voice.default || voice.name.includes('Natural') || voice.name.includes('Siri') || voice.name.includes('Google')) {
        opt.selected = true;
        selectedVoice = voice;
      }
      ttsVoiceSelect.appendChild(opt);
    });

    if (!selectedVoice && voicesToShow.length > 0) {
      selectedVoice = voicesToShow[0];
    }
  };

  populate();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populate;
  }
}

function speakText(text, priority = false) {
  if (!speechAudioEnabled || !synth || !text) return;
  try {
    if (priority) synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = speechRate;
    utter.pitch = speechPitch;
    if (selectedVoice) utter.voice = selectedVoice;
    synth.speak(utter);
  } catch (err) {
    console.warn('Speech error', err);
  }
}

// ==========================================
// Web Audio Synthesizer (Instant SFX)
// ==========================================
function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function unlockAudio() {
  soundEnabled = true;
  const actx = getAudioContext();
  if (actx && actx.state === 'suspended') actx.resume();
  if (soundButtonText) soundButtonText.textContent = 'Audio: ON';
  if (enableSoundButton) enableSoundButton.classList.add('active');
  if (connectedVideo) connectedVideo.muted = false;
  if (audio) audio.muted = false;
  if (connectedAudio) connectedAudio.muted = false;
  updateStatus('Audio & Speech active.');
}

function playBlipSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch (e) {}
}

function playPopSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch (e) {}
}

function playExplosionSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const oscGain = actx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(oscGain);
    oscGain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {}
}

function playChimeSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const now = actx.currentTime + idx * 0.06;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    });
  } catch (e) {}
}

function playConfettiSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const t = actx.currentTime + idx * 0.05;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  } catch (e) {}
}

function playLaserSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1300, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch (e) {}
}

function playShieldSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    const now = actx.currentTime;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(190, now + 0.2);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  } catch (e) {}
}

function playFreezeSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    [880, 784, 659, 523].forEach((freq, idx) => {
      const t = actx.currentTime + idx * 0.07;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch (e) {}
}

function playHarpSound() {
  if (!soundEnabled) return;
  const actx = getAudioContext();
  if (!actx) return;
  try {
    [349.23, 440.00, 523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const t = actx.currentTime + i * 0.05;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (e) {}
}

function playScubaSound() {
  if (!audio) return;
  audio.currentTime = 0;
  audio.muted = !soundEnabled;
  audio.play().catch(() => null);
}

function stopScubaSound() {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

// ==========================================
// Status, Toasts & Mode Management
// ==========================================
function updateStatus(message) {
  if (statusText) statusText.textContent = message;
}

function showToast(icon, text, duration = 2200) {
  if (!gestureToast) return;
  if (toastIcon) toastIcon.textContent = icon;
  if (toastText) toastText.textContent = text;
  gestureToast.classList.add('visible');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    gestureToast.classList.remove('visible');
  }, duration);
}

function switchMode(mode) {
  currentAppMode = mode;
  if (mode === 'sign') {
    tabSignMode.classList.add('active');
    tabVfxMode.classList.remove('active');
    signStudioSection.style.display = 'flex';
    gestureLegend.style.display = 'none';
    modeHintText.textContent = '💡 Tip: Hold any sign steady for 0.7s to type the letter into speech!';
  } else {
    tabVfxMode.classList.add('active');
    tabSignMode.classList.remove('active');
    signStudioSection.style.display = 'none';
    gestureLegend.style.display = 'grid';
    modeHintText.textContent = '💡 Tip: Make gestures like Fist, Palm, Victory, or Thumb Up to trigger VFX!';
  }
}

// ==========================================
// Transcription & Text Manipulation
// ==========================================
function updateTranscriptUI() {
  if (!transcriptTextEl) return;
  transcriptTextEl.textContent = transcript;
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  if (transcriptWordCount) {
    transcriptWordCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
  }
  if (letterCountEl) {
    letterCountEl.textContent = totalLettersSpelled;
  }
}

function appendLetter(char) {
  transcript += char;
  totalLettersSpelled += 1;
  updateTranscriptUI();
  if (chkSpeakLetters && chkSpeakLetters.checked) {
    speakText(char);
  }
}

function appendWord(word) {
  if (transcript.length > 0 && !transcript.endsWith(' ')) {
    transcript += ' ';
  }
  transcript += word + ' ';
  totalLettersSpelled += word.length;
  updateTranscriptUI();
  speakText(word, true);
  showToast('🗣️', `Spoke: "${word}"`);
}

function addSpace() {
  if (transcript.length === 0 || transcript.endsWith(' ')) return;
  if (chkAutoSpeak && chkAutoSpeak.checked) {
    const parts = transcript.trim().split(/\s+/);
    const lastWord = parts[parts.length - 1];
    if (lastWord) speakText(lastWord);
  }
  transcript += ' ';
  updateTranscriptUI();
  playBlipSound();
}

function backspace() {
  if (transcript.length > 0) {
    transcript = transcript.slice(0, -1);
    updateTranscriptUI();
    playPopSound();
  }
}

function clearTranscript() {
  transcript = '';
  updateTranscriptUI();
  playPopSound();
  showToast('🗑️', 'Transcript Cleared');
}

function copyTranscript() {
  if (!transcript) return;
  navigator.clipboard.writeText(transcript).then(() => {
    showToast('📋', 'Copied text to clipboard!');
  }).catch(() => null);
}

function speakFullSentence() {
  const text = transcript.trim();
  if (!text) {
    showToast('⚠️', 'Transcript is empty. Sign some letters first!');
    return;
  }
  unlockAudio();
  speakText(text, true);
  showToast('🔊', `Speaking: "${text}"`);
}

// ==========================================
// Sign Language 3D Landmark Classifier
// ==========================================
function dist3D(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.hypot(dx, dy, dz);
}

function classifySignLanguage(landmarks, handedness = 'Right', cannedName = '') {
  if (!landmarks || landmarks.length < 21) return null;

  const palmSize = dist3D(landmarks[0], landmarks[9]) || 0.18;

  const dThumb = dist3D(landmarks[4], landmarks[9]) / palmSize;
  const dIndex = dist3D(landmarks[8], landmarks[0]) / palmSize;
  const dMid = dist3D(landmarks[12], landmarks[0]) / palmSize;
  const dRing = dist3D(landmarks[16], landmarks[0]) / palmSize;
  const dPinky = dist3D(landmarks[20], landmarks[0]) / palmSize;

  const indexExt = dIndex > 1.25 && landmarks[8].y < landmarks[6].y;
  const midExt = dMid > 1.25 && landmarks[12].y < landmarks[10].y;
  const ringExt = dRing > 1.22 && landmarks[16].y < landmarks[14].y;
  const pinkyExt = dPinky > 1.15 && landmarks[20].y < landmarks[18].y;

  const indexCurled = dIndex < 1.08 || landmarks[8].y > landmarks[6].y;
  const midCurled = dMid < 1.08 || landmarks[12].y > landmarks[10].y;
  const ringCurled = dRing < 1.05 || landmarks[16].y > landmarks[14].y;
  const pinkyCurled = dPinky < 1.0 || landmarks[20].y > landmarks[18].y;

  const thumbExt = dThumb > 0.85;
  const thumbUp = landmarks[4].y < landmarks[3].y && landmarks[3].y < landmarks[2].y;
  const thumbDown = landmarks[4].y > landmarks[3].y && landmarks[3].y > landmarks[2].y;

  const dThumbIndex = dist3D(landmarks[4], landmarks[8]) / palmSize;
  const dThumbMid = dist3D(landmarks[4], landmarks[12]) / palmSize;
  const dIndexMid = dist3D(landmarks[8], landmarks[12]) / palmSize;

  // 1. Word Signs
  if (indexExt && midExt && ringExt && pinkyExt && thumbExt && (cannedName === 'Open_Palm' || dIndexMid > 0.25)) {
    return { sign: 'HELLO', name: 'Hello 👋', type: 'word', icon: '👋', instruction: 'Open Palm' };
  }
  if (thumbUp && indexCurled && midCurled && ringCurled && pinkyCurled && (cannedName === 'Thumb_Up' || dThumb > 0.75)) {
    return { sign: 'YES', name: 'Yes 👍', type: 'word', icon: '👍', instruction: 'Thumbs Up' };
  }
  if (thumbDown && indexCurled && midCurled && ringCurled && pinkyCurled) {
    return { sign: 'NO', name: 'No 👎', type: 'word', icon: '👎', instruction: 'Thumbs Down' };
  }
  if (thumbExt && indexExt && pinkyExt && midCurled && ringCurled) {
    return { sign: 'I LOVE YOU', name: 'I Love You 💖', type: 'word', icon: '🤟', instruction: 'Thumb+Index+Pinky Up' };
  }

  // 2. ASL Alphabet Letters
  if (thumbExt && pinkyExt && indexCurled && midCurled && ringCurled) {
    return { sign: 'Y', name: 'Letter Y', type: 'letter', icon: '🤙', instruction: 'Thumb + Pinky Out' };
  }
  if (indexExt && thumbExt && midCurled && ringCurled && pinkyCurled && dThumbIndex > 0.75) {
    return { sign: 'L', name: 'Letter L', type: 'letter', icon: '👆', instruction: 'Index + Thumb 90°' };
  }
  if (pinkyExt && indexCurled && midCurled && ringCurled && !thumbExt) {
    return { sign: 'I', name: 'Letter I', type: 'letter', icon: '🤞', instruction: 'Pinky Finger Up' };
  }
  if (indexExt && midCurled && ringCurled && pinkyCurled && dThumbMid < 0.45) {
    return { sign: 'D', name: 'Letter D', type: 'letter', icon: '☝️', instruction: 'Index Up + Thumb on Middle' };
  }
  if (dThumbIndex < 0.35 && midExt && ringExt && pinkyExt) {
    return { sign: 'F', name: 'Letter F / OK', type: 'letter', icon: '👌', instruction: 'Thumb-Index Touch + 3 Up' };
  }
  if (indexExt && midExt && ringExt && pinkyCurled) {
    return { sign: 'W', name: 'Letter W', type: 'letter', icon: '🖖', instruction: '3 Fingers Up' };
  }
  if (indexExt && midExt && ringCurled && pinkyCurled && dIndexMid > 0.28) {
    return { sign: 'V', name: 'Letter V', type: 'letter', icon: '✌️', instruction: 'Index & Middle Spread' };
  }
  if (indexExt && midExt && ringCurled && pinkyCurled && dIndexMid <= 0.28) {
    return { sign: 'U', name: 'Letter U', type: 'letter', icon: '✌️', instruction: 'Index & Middle Together' };
  }
  if (indexExt && midExt && ringExt && pinkyExt && dIndexMid < 0.28) {
    return { sign: 'B', name: 'Letter B', type: 'letter', icon: '✋', instruction: '4 Fingers Up & Together' };
  }
  if (dThumbIndex < 0.4 && dThumbMid < 0.45 && !indexExt && !midExt) {
    return { sign: 'O', name: 'Letter O', type: 'letter', icon: '👌', instruction: 'Curved O Shape' };
  }
  if (!indexExt && !midExt && dThumbIndex > 0.45 && dThumbIndex < 0.85 && landmarks[8].y < landmarks[5].y) {
    return { sign: 'C', name: 'Letter C', type: 'letter', icon: '🤏', instruction: 'Curved C Shape' };
  }
  if (indexCurled && midCurled && ringCurled && pinkyCurled && landmarks[4].y < landmarks[6].y) {
    return { sign: 'A', name: 'Letter A', type: 'letter', icon: '✊', instruction: 'Fist with Thumb Up Side' };
  }
  if (indexCurled && midCurled && ringCurled && pinkyCurled && landmarks[4].y >= landmarks[6].y) {
    return { sign: 'E', name: 'Letter E', type: 'letter', icon: '✊', instruction: 'Curled Fingers on Thumb' };
  }

  return null;
}

// ==========================================
// Sign Hold-To-Type Progress Engine
// ==========================================
function processSignCandidate(detected) {
  const now = performance.now();

  if (!detected) {
    currentCandidateSign = null;
    candidateHoldStart = 0;
    if (holdProgressFill) holdProgressFill.style.width = '0%';
    if (holdPercent) holdPercent.textContent = '0%';
    if (currentSignDisplay) currentSignDisplay.textContent = '--';
    if (signInstruction) signInstruction.textContent = 'Bring hand into camera view';
    return;
  }

  if (currentSignDisplay) currentSignDisplay.textContent = detected.sign;
  if (signInstruction) signInstruction.textContent = detected.instruction;
  if (activeBadgeIcon) activeBadgeIcon.textContent = detected.icon || '🖐️';
  if (activeGestureName) activeGestureName.innerHTML = `<strong>${detected.name}</strong>`;

  if (!currentCandidateSign || currentCandidateSign.sign !== detected.sign) {
    currentCandidateSign = detected;
    candidateHoldStart = now;
  }

  const elapsed = now - candidateHoldStart;
  const progress = Math.min(1.0, elapsed / HOLD_REQUIRED_MS);

  if (holdProgressFill) holdProgressFill.style.width = `${(progress * 100).toFixed(0)}%`;
  if (holdPercent) holdPercent.textContent = `${(progress * 100).toFixed(0)}%`;

  if (progress >= 1.0 && (now - lastCommitTime > COMMIT_COOLDOWN_MS || lastCommittedSign !== detected.sign)) {
    commitSign(detected);
    lastCommittedSign = detected.sign;
    lastCommitTime = now;
    candidateHoldStart = now;
  }
}

function commitSign(detected) {
  playBlipSound();
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  emitParticles(22, () => ({
    x: cx + (Math.random() - 0.5) * 80,
    y: cy + (Math.random() - 0.5) * 80,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    size: 8 + Math.random() * 8,
    color: '#48f5a2',
    type: 'sparkle',
    decay: 0.03,
  }));

  showToast(detected.icon || '✨', `Typed: "${detected.sign}"`);

  if (detected.type === 'word') {
    appendWord(detected.sign);
  } else {
    appendLetter(detected.sign);
  }

  document.querySelectorAll('.asl-card').forEach((c) => {
    if (c.dataset.asl === detected.sign) {
      c.classList.add('active');
      setTimeout(() => c.classList.remove('active'), 1200);
    }
  });
}

// ==========================================
// AR & VFX Playground Handlers
// ==========================================
function setOverlayEffect(effectClass, duration = 1800) {
  if (!overlay) return;
  overlay.className = `overlay ${effectClass}`;
  if (activeOverlayTimeout) clearTimeout(activeOverlayTimeout);
  activeOverlayTimeout = setTimeout(() => {
    overlay.className = 'overlay';
  }, duration);
}

function showScubaVisual() {
  if (scubaVideo && scubaVideo.currentSrc) {
    scubaGif.classList.remove('visible');
    scubaGif.style.display = 'none';
    scubaVideo.style.display = 'block';
    scubaVideo.classList.add('visible');
    scubaVideo.muted = true;
    scubaVideo.play().catch(() => null);
  } else {
    scubaVideo.classList.remove('visible');
    scubaVideo.style.display = 'none';
    scubaGif.style.display = 'block';
    scubaGif.classList.add('visible');
  }

  setTimeout(() => {
    scubaGif.classList.remove('visible');
    scubaGif.style.display = 'none';
    if (scubaVideo) {
      scubaVideo.pause();
      scubaVideo.classList.remove('visible');
      scubaVideo.style.display = 'none';
    }
  }, 2800);
}

function triggerClosedFist(x, y) {
  const now = performance.now();
  if (now - (lastTriggerTimes['Closed_Fist'] || 0) < TRIGGER_DEBOUNCE) return;
  lastTriggerTimes['Closed_Fist'] = now;

  cameraShell.classList.remove('screen-shake');
  void cameraShell.offsetWidth;
  cameraShell.classList.add('screen-shake');
  setTimeout(() => cameraShell.classList.remove('screen-shake'), 500);

  setOverlayEffect('fire-glow', 1500);
  playExplosionSound();
  if (soundEnabled) playScubaSound();

  emitParticles(35, () => ({
    x: x,
    y: y,
    vx: (Math.random() - 0.5) * 16,
    vy: (Math.random() - 0.7) * 16,
    size: 14 + Math.random() * 18,
    color: Math.random() > 0.4 ? '#ff5014' : '#ffb72b',
    type: 'fire',
    decay: 0.03,
    gravity: -0.1,
  }));

  showScubaVisual();
  showToast('🔥', 'ENERGY BLAST & EARTHQUAKE!');
}

function triggerOpenPalm(x, y) {
  ctx.save();
  ctx.translate(x, y);
  const time = performance.now() * 0.005;
  const pulse = Math.sin(time) * 6;
  ctx.beginPath();
  ctx.arc(0, 0, 55 + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(76, 225, 255, 0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  if (Math.random() < 0.35) {
    particles.push(new Particle({
      x: x + (Math.random() - 0.5) * 40,
      y: y - 20,
      vx: (Math.random() - 0.5) * 3,
      vy: -3 - Math.random() * 4,
      size: 5 + Math.random() * 7,
      color: '#a8efff',
      type: 'sparkle',
      decay: 0.03,
    }));
  }

  const now = performance.now();
  if (now - (lastTriggerTimes['Open_Palm'] || 0) > 1800) {
    lastTriggerTimes['Open_Palm'] = now;
    playShieldSound();
    showToast('🛡️', 'FORCE SHIELD & BUBBLE STREAM');
  }
}

function triggerDualPalms() {
  const now = performance.now();
  if (connectedActive || now - (lastTriggerTimes['Dual_Palm'] || 0) < TRIGGER_DEBOUNCE) return;
  lastTriggerTimes['Dual_Palm'] = now;
  connectedActive = true;

  updateStatus('Dual Palms: Connected Gateway Activated!');
  showToast('🙌', 'CONNECTED GATEWAY ACTIVATED!', 3500);
  stopScubaSound();

  if (connectedVideo) {
    connectedVideo.currentTime = 0;
    connectedVideo.style.display = 'block';
    connectedVideo.classList.add('visible');
    connectedVideo.muted = !soundEnabled;
    connectedVideo.play().catch(() => null);
  }

  if (soundEnabled && connectedAudio && connectedAudio.src) {
    connectedAudio.currentTime = 0;
    connectedAudio.muted = false;
    connectedAudio.play().catch(() => null);
  }

  setOverlayEffect('gold-glow', 4000);

  setTimeout(() => {
    connectedActive = false;
    if (connectedVideo) {
      connectedVideo.pause();
      connectedVideo.classList.remove('visible');
      connectedVideo.style.display = 'none';
    }
    if (connectedAudio) {
      connectedAudio.pause();
      connectedAudio.currentTime = 0;
    }
  }, 9000);
}

function triggerVictory(x, y) {
  const now = performance.now();
  if (now - (lastTriggerTimes['Victory'] || 0) < TRIGGER_DEBOUNCE) return;
  lastTriggerTimes['Victory'] = now;

  playConfettiSound();
  const colors = ['#4ce1ff', '#ffd159', '#ff5e98', '#48f5a2', '#c078ff', '#ffffff'];
  emitParticles(45, () => ({
    x: x,
    y: y,
    vx: (Math.random() - 0.5) * 14,
    vy: -6 - Math.random() * 12,
    size: 7 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    type: 'confetti',
    decay: 0.015,
    gravity: 0.28,
  }));
  showToast('🎉', 'FIREWORKS & CONFETTI CELEBRATION!');
}

function triggerThumbUp(x, y) {
  const now = performance.now();
  if (now - (lastTriggerTimes['Thumb_Up'] || 0) < TRIGGER_DEBOUNCE) return;
  lastTriggerTimes['Thumb_Up'] = now;

  playChimeSound();
  setOverlayEffect('gold-glow', 1500);

  emitParticles(30, () => ({
    x: x,
    y: y,
    vx: (Math.random() - 0.5) * 10,
    vy: -4 - Math.random() * 8,
    size: 10 + Math.random() * 10,
    color: '#ffd159',
    type: 'star',
    decay: 0.02,
    gravity: 0.15,
  }));
  showToast('👍', 'THUMBS UP! GOLDEN STAR BURST!');
}

function triggerThumbDown(x, y) {
  const now = performance.now();
  if (now - (lastTriggerTimes['Thumb_Down'] || 0) < TRIGGER_DEBOUNCE) return;
  lastTriggerTimes['Thumb_Down'] = now;

  playFreezeSound();
  setOverlayEffect('frost-glow', 2000);

  emitParticles(35, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    vx: (Math.random() - 0.5) * 3,
    vy: 2 + Math.random() * 5,
    size: 8 + Math.random() * 10,
    color: '#e0f7ff',
    type: 'ice',
    decay: 0.015,
    gravity: 0.05,
  }));
  showToast('❄️', 'BLIZZARD & FROST FREEZE!');
}

function triggerPointing(x, y) {
  if (trailsEnabled) {
    fingerTrailHistory.push({ x, y, time: performance.now() });
    if (fingerTrailHistory.length > MAX_TRAIL_LENGTH) fingerTrailHistory.shift();
  }
  const now = performance.now();
  if (now - (lastTriggerTimes['Pointing_Up'] || 0) > 2200) {
    lastTriggerTimes['Pointing_Up'] = now;
    playLaserSound();
    showToast('☝️', 'LASER WAND & AR POINTER');
  }
}

function triggerILoveYou(x, y) {
  const now = performance.now();
  if (now - (lastTriggerTimes['ILoveYou'] || 0) < TRIGGER_DEBOUNCE) return;
  lastTriggerTimes['ILoveYou'] = now;

  playHarpSound();
  setOverlayEffect('love-glow', 2000);

  emitParticles(24, () => ({
    x: x + (Math.random() - 0.5) * 120,
    y: y,
    vx: (Math.random() - 0.5) * 4,
    vy: -2 - Math.random() * 5,
    size: 14 + Math.random() * 12,
    color: '#ff5e98',
    type: 'heart',
    decay: 0.018,
    gravity: -0.05,
  }));
  showToast('💖', 'NEON HEARTS SHOWER!');
}

function triggerPinch(x, y) {
  emitParticles(4, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 60;
    return {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      vx: -Math.cos(angle) * 5,
      vy: -Math.sin(angle) * 5,
      size: 4 + Math.random() * 5,
      color: '#c078ff',
      type: 'sparkle',
      decay: 0.05,
    };
  });
  const now = performance.now();
  if (now - (lastTriggerTimes['Pinch'] || 0) > 1800) {
    lastTriggerTimes['Pinch'] = now;
    playPopSound();
    showToast('🤏', 'SPARKLE PINCH VORTEX');
  }
}

function handleVfxGestures(result) {
  if (!result || !result.gestures || result.gestures.length === 0) {
    if (activeBadgeIcon) activeBadgeIcon.textContent = '🖐️';
    if (activeGestureName) activeGestureName.innerHTML = 'No hands detected';
    return;
  }

  const hands = result.gestures.map((list, idx) => ({
    index: idx,
    name: list?.[0]?.categoryName || 'None',
    score: list?.[0]?.score || 0,
    landmarks: result.landmarks?.[idx] || [],
  }));

  const openPalms = hands.filter((h) => h.name === 'Open_Palm' && h.score >= 0.45);
  if (openPalms.length >= 2) {
    triggerDualPalms();
    return;
  }

  for (const hand of hands) {
    const lm = hand.landmarks;
    const wrist = lm[0];
    const palmX = wrist ? mirroredX(wrist.x) : canvas.width / 2;
    const palmY = wrist ? wrist.y * canvas.height : canvas.height / 2;

    if (hand.score < 0.42) continue;

    switch (hand.name) {
      case 'Closed_Fist': triggerClosedFist(palmX, palmY); break;
      case 'Open_Palm': triggerOpenPalm(palmX, palmY); break;
      case 'Victory': triggerVictory(palmX, palmY); break;
      case 'Thumb_Up': triggerThumbUp(palmX, palmY); break;
      case 'Thumb_Down': triggerThumbDown(palmX, palmY); break;
      case 'Pointing_Up': triggerPointing(palmX, palmY); break;
      case 'ILoveYou': triggerILoveYou(palmX, palmY); break;
    }

    if (activeBadgeIcon) activeBadgeIcon.textContent = '✨';
    if (activeGestureName) activeGestureName.innerHTML = `<strong>${hand.name}</strong> (${(hand.score * 100).toFixed(0)}%)`;
  }
}

// ==========================================
// Particle Engine Update & Render
// ==========================================
class Particle {
  constructor(options = {}) {
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.vx = options.vx || (Math.random() - 0.5) * 6;
    this.vy = options.vy || (Math.random() - 0.5) * 6;
    this.life = options.life || 1.0;
    this.maxLife = this.life;
    this.decay = options.decay || 0.025;
    this.size = options.size || 8;
    this.color = options.color || '#4ce1ff';
    this.type = options.type || 'sparkle';
    this.rotation = Math.random() * Math.PI * 2;
    this.vRot = (Math.random() - 0.5) * 0.2;
    this.gravity = options.gravity || 0;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.rotation += this.vRot;
    this.life -= this.decay;
  }

  draw(context) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, this.life / this.maxLife);
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.globalAlpha = alpha;

    if (this.type === 'star') {
      context.fillStyle = this.color;
      drawStar(context, 0, 0, 5, this.size, this.size * 0.45);
    } else if (this.type === 'confetti') {
      context.fillStyle = this.color;
      context.fillRect(-this.size, -this.size * 0.4, this.size * 2, this.size * 0.8);
    } else if (this.type === 'heart') {
      context.fillStyle = this.color;
      drawHeart(context, 0, 0, this.size);
    } else if (this.type === 'fire') {
      const grad = context.createRadialGradient(0, 0, 0, 0, 0, this.size);
      grad.addColorStop(0, '#fff4b8');
      grad.addColorStop(0.4, this.color);
      grad.addColorStop(1, 'transparent');
      context.fillStyle = grad;
      context.beginPath();
      context.arc(0, 0, this.size, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillStyle = this.color;
      context.shadowBlur = 8;
      context.shadowColor = this.color;
      context.beginPath();
      context.arc(0, 0, this.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx, x, y, size) {
  ctx.beginPath();
  const topCurveHeight = size * 0.3;
  ctx.moveTo(x, y + topCurveHeight);
  ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 1.4, x, y + size);
  ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 1.4, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
  ctx.closePath();
  ctx.fill();
}

function emitParticles(count, configGen) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(configGen(i)));
  }
}

function updateAndDrawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw(ctx);
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ==========================================
// AR Bubbles & Mesh Visualizer
// ==========================================
class ARBubble {
  constructor(w, h) {
    this.reset(w, h, true);
  }
  reset(w, h, initial = false) {
    this.radius = 22 + Math.random() * 26;
    this.x = this.radius + Math.random() * (w - this.radius * 2);
    this.y = initial ? Math.random() * h : h + this.radius + Math.random() * 40;
    this.vy = -(1.2 + Math.random() * 1.8);
    this.wobbleSpeed = 0.03 + Math.random() * 0.04;
    this.wobbleAmount = 1.2 + Math.random() * 2.0;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.hue = 185 + Math.random() * 45;
  }
  update(w, h) {
    this.y += this.vy;
    this.wobblePhase += this.wobbleSpeed;
    this.x += Math.sin(this.wobblePhase) * this.wobbleAmount;
    if (this.y < -this.radius * 2) this.reset(w, h);
  }
  draw(context) {
    context.save();
    context.translate(this.x, this.y);
    context.beginPath();
    context.arc(0, 0, this.radius, 0, Math.PI * 2);
    const grad = context.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius);
    grad.addColorStop(0, `hsla(${this.hue}, 90%, 95%, 0.75)`);
    grad.addColorStop(0.5, `hsla(${this.hue}, 80%, 75%, 0.3)`);
    grad.addColorStop(1, `hsla(${this.hue}, 100%, 85%, 0.9)`);
    context.fillStyle = grad;
    context.fill();
    context.lineWidth = 2.5;
    context.strokeStyle = `hsla(${this.hue}, 100%, 85%, 0.8)`;
    context.stroke();
    context.restore();
  }
  checkCollision(tx, ty, r = 24) {
    return Math.hypot(this.x - tx, this.y - ty) < (this.radius + r);
  }
  pop(w, h) {
    playPopSound();
    emitParticles(14, () => ({
      x: this.x,
      y: this.y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      size: 4 + Math.random() * 5,
      color: `hsl(${this.hue}, 100%, 75%)`,
      type: 'sparkle',
      decay: 0.04,
    }));
    this.reset(w, h);
  }
}

function initARBubbles(count = 10) {
  arBubbles.length = 0;
  const w = canvas.width || 1280;
  const h = canvas.height || 720;
  for (let i = 0; i < count; i++) {
    arBubbles.push(new ARBubble(w, h));
  }
}

function updateAndDrawARBubbles(touchPoints = []) {
  if (!bubblesEnabled) return;
  const w = canvas.width || 1280;
  const h = canvas.height || 720;
  if (arBubbles.length === 0) initARBubbles(10);
  for (const b of arBubbles) {
    b.update(w, h);
    b.draw(ctx);
    for (const pt of touchPoints) {
      if (b.checkCollision(pt.x, pt.y, 22)) {
        b.pop(w, h);
        break;
      }
    }
  }
}

const HAND_CONNECTIONS = [
  [0, 1], [0, 5], [5, 9], [9, 13], [13, 17], [0, 17],
  [1, 2], [2, 3], [3, 4],
  [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [17, 18], [18, 19], [19, 20]
];
const FINGERTIPS = [4, 8, 12, 16, 20];

function mirroredX(x) {
  return canvas.width - x * canvas.width;
}

function drawHandMesh(result, detectedSign) {
  if (!result?.landmarks?.length) return [];
  const touchPoints = [];

  result.landmarks.forEach((handLandmarks, handIndex) => {
    const isSignMode = currentAppMode === 'sign';
    const baseColor = isSignMode ? 'rgba(72, 245, 162, 0.95)' : 'rgba(76, 225, 255, 0.95)';
    const glowColor = isSignMode ? '#48f5a2' : '#4ce1ff';

    FINGERTIPS.forEach((idx) => {
      const lm = handLandmarks[idx];
      if (lm) touchPoints.push({ x: mirroredX(lm.x), y: lm.y * canvas.height, id: idx });
    });

    if (skeletonEnabled) {
      ctx.save();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = baseColor;
      ctx.shadowBlur = 10;
      ctx.shadowColor = glowColor;

      HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = handLandmarks[i];
        const p2 = handLandmarks[j];
        if (!p1 || !p2) return;
        ctx.beginPath();
        ctx.moveTo(mirroredX(p1.x), p1.y * canvas.height);
        ctx.lineTo(mirroredX(p2.x), p2.y * canvas.height);
        ctx.stroke();
      });

      handLandmarks.forEach((lm, idx) => {
        const px = mirroredX(lm.x);
        const py = lm.y * canvas.height;
        const isFingertip = FINGERTIPS.includes(idx);
        ctx.beginPath();
        ctx.arc(px, py, isFingertip ? 7 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isFingertip ? '#ffffff' : baseColor;
        ctx.fill();
      });
      ctx.restore();
    }

    const wrist = handLandmarks[0];
    if (wrist) {
      const px = mirroredX(wrist.x);
      const py = wrist.y * canvas.height - 28;

      ctx.save();
      if (isSignMode && detectedSign) {
        const now = performance.now();
        const elapsed = candidateHoldStart ? now - candidateHoldStart : 0;
        const progress = Math.min(1.0, elapsed / HOLD_REQUIRED_MS);

        ctx.beginPath();
        ctx.arc(px, py, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.strokeStyle = '#48f5a2';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#48f5a2';
        ctx.stroke();

        ctx.font = '800 20px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(detectedSign.sign, px, py);
      } else {
        const topGesture = result.gestures?.[handIndex]?.[0];
        const label = topGesture?.categoryName || 'Hand';
        ctx.font = '600 14px Inter, system-ui, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(2, 14, 22, 0.85)';
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px - tw / 2 - 8, py - 14, tw + 16, 24, 6);
        else ctx.rect(px - tw / 2 - 8, py - 14, tw + 16, 24);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, px, py - 2);
      }
      ctx.restore();
    }
  });

  return touchPoints;
}

// ==========================================
// Frame Processing Loop
// ==========================================
async function processFrame() {
  if (video.videoWidth && video.videoHeight) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      initARBubbles(10);
    }
  } else if (!canvas.width || !canvas.height) {
    canvas.width = cameraShell.clientWidth || 1280;
    canvas.height = cameraShell.clientHeight || 720;
    initARBubbles(10);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let detectedSign = null;

  // Process only when new frame arrived & ensure monotonic timestamp
  if (gestureRecognizer && video.videoWidth && video.videoHeight && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    let now = performance.now();
    if (now <= lastTimestamp) {
      now = lastTimestamp + 1;
    }
    lastTimestamp = now;

    try {
      latestResult = gestureRecognizer.recognizeForVideo(video, now);
      if (latestResult?.landmarks?.length > 0) {
        const canned = latestResult.gestures?.[0]?.[0]?.categoryName || '';
        const handedness = latestResult.handednesses?.[0]?.[0]?.categoryName || 'Right';
        detectedSign = classifySignLanguage(latestResult.landmarks[0], handedness, canned);
      }
    } catch (err) {
      console.warn('Recognition error', err);
    }
  }

  if (currentAppMode === 'sign') {
    processSignCandidate(detectedSign);
  } else {
    handleVfxGestures(latestResult);
  }

  const touchPoints = drawHandMesh(latestResult, detectedSign);
  updateAndDrawARBubbles(touchPoints);
  updateAndDrawParticles();

  requestAnimationFrame(processFrame);
}

// ==========================================
// Camera & MediaPipe Initialization
// ==========================================
async function initCamera() {
  if (cameraRunning) return;
  updateStatus('Requesting camera access...');
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera requires HTTPS or localhost.');
    }

    const constraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: 'user'
      },
      audio: false
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e1) {
      console.warn('Ideal constraint failed, retrying with fallback constraint...', e1);
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(resolve);
      };
    });

    cameraRunning = true;
    if (cameraStartOverlay) {
      cameraStartOverlay.classList.add('hidden');
    }
    updateStatus('Camera active. Hold signs steady to spell words.');
    showToast('📷', 'Camera Connected!');
  } catch (err) {
    updateStatus(`Camera note: ${err.message || 'Access needed'}. Click "Start Camera" above.`);
    console.warn('Camera error', err);
  }
}

async function initGestureRecognizer() {
  updateStatus('Loading MediaPipe AI Model (takes a few seconds on first load)...');
  try {
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    
    // Try GPU acceleration first
    try {
      gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        cannedGesturesClassifierOptions: {
          maxResults: 3,
          scoreThreshold: 0.35,
        },
      });
      updateStatus('AI Model ready (GPU accelerated)! Show your hand to begin.');
      showToast('⚡', 'Neural AI Model Ready!');
      return;
    } catch (gpuErr) {
      console.warn('GPU delegate failed, using CPU delegate...', gpuErr);
    }

    // CPU fallback
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task',
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      cannedGesturesClassifierOptions: {
        maxResults: 3,
        scoreThreshold: 0.35,
      },
    });
    updateStatus('AI Model ready (CPU mode)! Show your hand to begin.');
    showToast('⚡', 'Neural AI Model Ready!');
  } catch (err) {
    updateStatus('Model load error. Quick Words & Speech still work!');
    console.error('Model error', err);
  }
}

// ==========================================
// Setup Event Listeners & App Bootstrap
// ==========================================
function startApp() {
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  initSpeechVoices();

  // Mode Switch Tabs
  if (tabSignMode) {
    tabSignMode.addEventListener('click', () => switchMode('sign'));
  }
  if (tabVfxMode) {
    tabVfxMode.addEventListener('click', () => switchMode('vfx'));
  }

  // Camera Start Button in Overlay
  if (btnStartCamera) {
    btnStartCamera.addEventListener('click', () => {
      unlockAudio();
      initCamera();
    });
  }

  // Audio Button in Top Bar
  if (enableSoundButton) {
    enableSoundButton.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
    });
  }

  // Transcript Action Buttons
  if (btnSpeakSentence) {
    btnSpeakSentence.addEventListener('click', speakFullSentence);
  }
  if (btnSpace) {
    btnSpace.addEventListener('click', addSpace);
  }
  if (btnBackspace) {
    btnBackspace.addEventListener('click', backspace);
  }
  if (btnClear) {
    btnClear.addEventListener('click', clearTranscript);
  }
  if (btnCopy) {
    btnCopy.addEventListener('click', copyTranscript);
  }

  // Quick Word Bank Chips
  document.querySelectorAll('.word-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const phrase = chip.dataset.phrase;
      if (phrase) {
        unlockAudio();
        appendWord(phrase);
      }
    });
  });

  // ASL Cheat Sheet Click-to-Practice
  document.querySelectorAll('.asl-card').forEach((card) => {
    card.addEventListener('click', () => {
      const sign = card.dataset.asl;
      if (sign) {
        unlockAudio();
        if (['HELLO', 'YES', 'NO', 'ILY'].includes(sign)) {
          appendWord(sign === 'ILY' ? 'I love you' : sign);
        } else {
          appendLetter(sign);
        }
      }
    });
  });

  // VFX Legend Cards Click-to-Preview
  document.querySelectorAll('.gesture-card').forEach((card) => {
    card.addEventListener('click', () => {
      const g = card.dataset.gesture;
      const cx = canvas.width ? canvas.width / 2 : 400;
      const cy = canvas.height ? canvas.height / 2 : 300;
      unlockAudio();

      switch (g) {
        case 'Closed_Fist': triggerClosedFist(cx, cy); break;
        case 'Open_Palm': triggerOpenPalm(cx, cy); break;
        case 'Dual_Palm': triggerDualPalms(); break;
        case 'Victory': triggerVictory(cx, cy); break;
        case 'Thumb_Up': triggerThumbUp(cx, cy); break;
        case 'Thumb_Down': triggerThumbDown(cx, cy); break;
        case 'Pointing_Up': triggerPointing(cx, cy); break;
        case 'ILoveYou': triggerILoveYou(cx, cy); break;
        case 'Pinch': triggerPinch(cx, cy); break;
      }
    });
  });

  // TTS Settings
  if (ttsVoiceSelect) {
    ttsVoiceSelect.addEventListener('change', (e) => {
      const vName = e.target.value;
      selectedVoice = availableVoices.find((v) => v.name === vName) || null;
      speakText('Voice updated');
    });
  }

  if (ttsRateSlider) {
    ttsRateSlider.addEventListener('input', (e) => {
      speechRate = parseFloat(e.target.value);
      if (ttsRateValue) ttsRateValue.textContent = `${speechRate.toFixed(1)}x`;
    });
  }

  if (ttsPitchSlider) {
    ttsPitchSlider.addEventListener('input', (e) => {
      speechPitch = parseFloat(e.target.value);
      if (ttsPitchValue) ttsPitchValue.textContent = speechPitch.toFixed(1);
    });
  }

  // Feature Toggles Bar
  if (toggleSpeechBtn) {
    toggleSpeechBtn.addEventListener('click', () => {
      speechAudioEnabled = !speechAudioEnabled;
      toggleSpeechBtn.classList.toggle('active', speechAudioEnabled);
      showToast(speechAudioEnabled ? '🗣️' : '🔇', `Speech Audio: ${speechAudioEnabled ? 'ON' : 'OFF'}`);
    });
  }

  if (toggleBubblesBtn) {
    toggleBubblesBtn.addEventListener('click', () => {
      bubblesEnabled = !bubblesEnabled;
      toggleBubblesBtn.classList.toggle('active', bubblesEnabled);
      showToast(bubblesEnabled ? '🫧' : '🚫', `AR Bubbles: ${bubblesEnabled ? 'ON' : 'OFF'}`);
    });
  }

  if (toggleTrailsBtn) {
    toggleTrailsBtn.addEventListener('click', () => {
      trailsEnabled = !trailsEnabled;
      toggleTrailsBtn.classList.toggle('active', trailsEnabled);
      showToast(trailsEnabled ? '🪄' : '🚫', `Magic Trails: ${trailsEnabled ? 'ON' : 'OFF'}`);
    });
  }

  if (toggleSkeletonBtn) {
    toggleSkeletonBtn.addEventListener('click', () => {
      skeletonEnabled = !skeletonEnabled;
      toggleSkeletonBtn.classList.toggle('active', skeletonEnabled);
      showToast(skeletonEnabled ? '🦴' : '🚫', `Cyber Skeleton: ${skeletonEnabled ? 'ON' : 'OFF'}`);
    });
  }

  // Preload local defaults
  if (audio && !audio.src) audio.src = 'scuba.wav';
  if (connectedAudio && !connectedAudio.src) connectedAudio.src = 'scuba.wav';
  if (connectedVideo && !connectedVideo.src) connectedVideo.src = 'connected.mp4';

  // Custom Media Upload Listeners
  if (scubaAudioInput) {
    scubaAudioInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && audio) {
        audio.src = URL.createObjectURL(file);
        audio.load();
        showToast('🎵', 'Custom Scuba Audio Loaded');
      }
    });
  }

  if (scubaVisualInput) {
    scubaVisualInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        if (file.type.startsWith('video/')) {
          scubaGif.style.display = 'none';
          scubaVideo.src = url;
          scubaVideo.load();
        } else {
          scubaVideo.src = '';
          scubaGif.src = url;
        }
        showToast('🖼️', 'Custom Scuba Visual Loaded');
      }
    });
  }

  if (connectedVideoInput) {
    connectedVideoInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && connectedVideo) {
        connectedVideo.src = URL.createObjectURL(file);
        connectedVideo.load();
        showToast('🎬', 'Custom Connected Video Loaded');
      }
    });
  }

  if (connectedAudioInput) {
    connectedAudioInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && connectedAudio) {
        connectedAudio.src = URL.createObjectURL(file);
        connectedAudio.load();
        showToast('🎶', 'Custom Connected Audio Loaded');
      }
    });
  }

  // Start Model, Camera & Animation loop
  initGestureRecognizer();
  initCamera();
  requestAnimationFrame(processFrame);
}

// Run immediately or on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
