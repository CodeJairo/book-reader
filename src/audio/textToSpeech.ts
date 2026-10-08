export interface TTSElements {
  playBtn: HTMLButtonElement | null;
  pauseBtn: HTMLButtonElement | null;
  stopBtn: HTMLButtonElement | null;
  voiceSelect: HTMLSelectElement | null;
  rateControl: HTMLInputElement | null;
  rateLabel: HTMLElement | null;
  pitchControl: HTMLInputElement | null;
  pitchLabel: HTMLElement | null;
}

export class TextToSpeechService {
  private synth: SpeechSynthesis;
  private utterance: SpeechSynthesisUtterance | null = null;
  public isPaused = false;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  public rate = 1;
  public pitch = 1;
  public onVoicesLoaded?: () => void;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();

    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        this.loadVoices();
        if (this.onVoicesLoaded) this.onVoicesLoaded();
      };
    }

    window.setTimeout(() => {
      if (this.availableVoices.length === 0) {
        this.loadVoices();
        if (this.onVoicesLoaded) this.onVoicesLoaded();
      }
    }, 150);
  }

  loadVoices(): void {
    this.availableVoices = this.synth.getVoices();
    const spanishVoice = this.availableVoices.find((v) => v.lang.startsWith("es"));
    this.selectedVoice = spanishVoice || this.availableVoices[0] || null;
  }

  setVoice(voiceURI: string): void {
    const voice = this.availableVoices.find((v) => v.voiceURI === voiceURI);
    if (voice) {
      this.selectedVoice = voice;
    }
  }

  setRate(rate: number): void {
    this.rate = rate;
  }

  setPitch(pitch: number): void {
    this.pitch = pitch;
  }

  speak(text: string, onEnd?: () => void, onStart?: () => void): void {
    this.stop();

    if (!text || text.trim() === "") {
      console.warn("No hay texto para reproducir.");
      return;
    }

    this.utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      this.utterance.voice = this.selectedVoice;
    }
    this.utterance.rate = this.rate;
    this.utterance.pitch = this.pitch;

    if (onEnd) this.utterance.onend = onEnd;
    if (onStart) this.utterance.onstart = onStart;

    this.isPaused = false;
    this.synth.speak(this.utterance);
  }

  pause(): void {
    if (this.synth.speaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  stop(): void {
    this.synth.cancel();
    this.isPaused = false;
    this.utterance = null;
  }

  isSpeaking(): boolean {
    return this.synth.speaking;
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.availableVoices;
  }
}

export function bindTTSUI(elements: TTSElements, getText: () => string): TextToSpeechService {
  const tts = new TextToSpeechService();

  const updateButtons = (isPlaying: boolean, isPaused: boolean) => {
    if (elements.playBtn) {
      elements.playBtn.disabled = isPlaying && !isPaused;
      elements.playBtn.textContent = isPaused ? "▶ Reanudar" : "▶ Reproducir";
    }
    if (elements.pauseBtn) elements.pauseBtn.disabled = !isPlaying || isPaused;
    if (elements.stopBtn) elements.stopBtn.disabled = !isPlaying;
  };

  const populateVoices = () => {
    if (!elements.voiceSelect) return;
    const voices = tts.getAvailableVoices();

    if (voices.length === 0) {
      elements.voiceSelect.innerHTML = "<option>No hay voces disponibles</option>";
      elements.voiceSelect.disabled = true;
      return;
    }

    elements.voiceSelect.innerHTML = "";
    elements.voiceSelect.disabled = false;

    const spanishVoices = voices.filter((v) => v.lang.startsWith("es"));
    const otherVoices = voices.filter((v) => !v.lang.startsWith("es"));

    if (spanishVoices.length > 0) {
      const group = document.createElement("optgroup");
      group.label = "Español";
      spanishVoices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        group.appendChild(opt);
      });
      elements.voiceSelect.appendChild(group);
    }

    if (otherVoices.length > 0) {
      const group = document.createElement("optgroup");
      group.label = "Otros idiomas";
      otherVoices.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        group.appendChild(opt);
      });
      elements.voiceSelect.appendChild(group);
    }

    if (spanishVoices.length > 0) {
      elements.voiceSelect.value = spanishVoices[0].voiceURI;
      tts.setVoice(spanishVoices[0].voiceURI);
    } else if (voices.length > 0) {
      elements.voiceSelect.value = voices[0].voiceURI;
      tts.setVoice(voices[0].voiceURI);
    }
  };

  populateVoices();
  tts.onVoicesLoaded = populateVoices;

  elements.playBtn?.addEventListener("click", () => {
    if (tts.isPaused) {
      tts.resume();
      updateButtons(true, false);
    } else {
      const text = getText();
      if (!text.trim()) {
        alert("No hay texto para reproducir en este momento.");
        return;
      }
      tts.speak(
        text,
        () => updateButtons(false, false),
        () => updateButtons(true, false)
      );
    }
  });

  elements.pauseBtn?.addEventListener("click", () => {
    tts.pause();
    updateButtons(true, true);
  });

  elements.stopBtn?.addEventListener("click", () => {
    tts.stop();
    updateButtons(false, false);
  });

  elements.voiceSelect?.addEventListener("change", (e) => {
    tts.setVoice((e.target as HTMLSelectElement).value);
  });

  elements.rateControl?.addEventListener("input", (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    tts.setRate(val);
    if (elements.rateLabel) elements.rateLabel.textContent = `${val}x`;
  });

  elements.pitchControl?.addEventListener("input", (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    tts.setPitch(val);
    if (elements.pitchLabel) elements.pitchLabel.textContent = String(val);
  });

  updateButtons(false, false);
  return tts;
}
