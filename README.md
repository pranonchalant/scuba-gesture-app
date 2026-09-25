# 🌊 CyberHands - Real-Time Sign Language to Speech & Gesture Effects Studio

An interactive, browser-based web application powered by **Google MediaPipe Vision** and the **Web Speech API** that performs real-time hand gesture detection, ASL sign language translation with text-to-speech conversion, and interactive augmented reality VFX.

---

## ✨ Features

### 🗣️ Sign Language to Speech Translator (ASL)
- **3D Landmark ASL Recognition**: Detects American Sign Language (ASL) finger-spelling letters (**A, B, C, D, E, F, I, L, O, U, V, W, Y**) and common word signs (**Hello, Yes, No, I Love You, Peace**).
- **Hold-to-Type Stabilization**: Hold any sign steady for ~0.7s to automatically confirm and append the letter/word to the transcript, preventing jitter and mistyping.
- **Real-Time Speech Synthesis (TTS)**: Built-in Text-To-Speech engine using `window.speechSynthesis` with voice selection, speech rate, voice pitch control, and auto-speak on word completion.
- **Live Sentence Builder**: Full transcript display with word counter, Backspace, Space, Clear, and Copy-to-Clipboard buttons.
- **Quick Word Bank**: One-tap phrase chips (*"Hello"*, *"Thank you"*, *"Yes"*, *"No"*, *"Please help"*, etc.) that speak and insert instantly.
- **ASL Reference Cheat Sheet**: Visual reference guide of finger poses for practice.

### 🎮 Cyber AR & VFX Playground
- **✊ Closed Fist**: Screen-shake earthquake, explosive fire blast particles, and sub-bass rumble sound effect.
- **🖐️ Open Palm**: Holographic sci-fi force field rings and rising bubble stream.
- **🙌 Dual Palms**: Activates Connected Gateway mode with celestial rays and ambient audio.
- **✌️ Peace / Victory**: Multi-colored celebration confetti cannon and fireworks pops.
- **👍 Thumbs Up**: Golden star burst, floating `+100 ⭐ LIKE!` badges, and victory chord chime.
- **👎 Thumbs Down**: Blizzard freeze vignette, falling ice crystals, and freeze wind audio.
- **☝️ Pointing Up**: Magic laser wand with glowing neon trail following your fingertip.
- **🤟 Love Sign**: Floating neon hearts shower and romantic harp arpeggio.
- **🤏 Pinch**: Cosmic sparkle vortex pulling particles into a gravitational center.
- **🫧 AR Bubble Popper**: Floating 3D bubbles that you physically pop by touching them with your fingertips, complete with pop audio and a live score counter!

### 🔊 Zero-Dependency Web Audio Synthesizer
- Built-in oscillators and audio filters synthesizing bubble pops, sub-bass explosions, laser chirps, victory chords, blizzard winds, and chimes directly in the browser with zero network latency.

---

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Google Chrome, Microsoft Edge, Safari, or Firefox)
- Built-in or external webcam

### Running Locally
You can serve the directory using Python's built-in HTTP server:

```bash
python3 -m http.server 8000
```

Then navigate to:
```
http://localhost:8000
```

1. Click **"Enable Audio"** to allow speech synthesis and sound effects.
2. Allow webcam access when prompted.
3. Bring your hand into view to begin translating signs to speech or triggering AR effects!

---

## 🛠️ Technology Stack
- **AI Hand Tracking**: `@mediapipe/tasks-vision` (GestureRecognizer)
- **Speech Synthesis**: Native Web Speech API (`SpeechSynthesisUtterance`)
- **Audio Effects**: Native Web Audio API (`AudioContext`)
- **Rendering**: HTML5 Canvas 2D & CSS3 Hardware-Accelerated Animations
- **Frontend**: Pure Vanilla JavaScript (ES Modules), HTML5, CSS3

---

## 📄 License
MIT License
