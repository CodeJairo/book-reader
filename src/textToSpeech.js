class TextToSpeech {
  constructor() {
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.isPaused = false;
    this.availableVoices = [];
    this.selectedVoice = null;
    this.rate = 1; // Speed (0.1 to 10)
    this.pitch = 1; // Pitch (0 to 2)
    this.voicesLoadedCallback = null;

    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => {
        this.loadVoices();
        if (this.voicesLoadedCallback) {
          this.voicesLoadedCallback();
        }
      };
    }

    const VOICES_RETRY_DELAY = 100; // ms
    setTimeout(() => {
      if (this.availableVoices.length === 0) {
        this.loadVoices();
        if (this.voicesLoadedCallback) {
          this.voicesLoadedCallback();
        }
      }
    }, VOICES_RETRY_DELAY);
  }

  loadVoices() {
    this.availableVoices = this.synth.getVoices();
    const spanishVoice = this.availableVoices.find((voice) =>
      voice.lang.startsWith("es")
    );
    this.selectedVoice = spanishVoice || this.availableVoices[0];
  }

  setVoice(voiceURI) {
    const voice = this.availableVoices.find((v) => v.voiceURI === voiceURI);
    if (voice) {
      this.selectedVoice = voice;
    }
  }

  setRate(rate) {
    this.rate = parseFloat(rate);
  }

  setPitch(pitch) {
    this.pitch = parseFloat(pitch);
  }

  speak(text, onEnd = null, onStart = null) {
    this.stop();

    if (!text || text.trim() === "") {
      console.warn("No text to speak");
      return;
    }

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.voice = this.selectedVoice;
    this.utterance.rate = this.rate;
    this.utterance.pitch = this.pitch;

    if (onEnd) {
      this.utterance.onend = onEnd;
    }

    if (onStart) {
      this.utterance.onstart = onStart;
    }

    this.isPaused = false;
    this.synth.speak(this.utterance);
  }

  pause() {
    if (this.synth.speaking && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
    }
  }

  resume() {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
    }
  }

  stop() {
    this.synth.cancel();
    this.isPaused = false;
    this.utterance = null;
  }

  isSpeaking() {
    return this.synth.speaking;
  }

  getAvailableVoices() {
    return this.availableVoices;
  }
}

export function initTextToSpeech(elements, getTextCallback) {
  const tts = new TextToSpeech();

  const {
    playBtn,
    pauseBtn,
    stopBtn,
    voiceSelect,
    rateControl,
    rateLabel,
    pitchControl,
    pitchLabel,
  } = elements;

  const updateButtonStates = (isPlaying, isPaused) => {
    if (playBtn) {
      playBtn.disabled = isPlaying && !isPaused;
      playBtn.textContent = isPaused ? "▶ Reanudar" : "▶ Reproducir";
    }
    if (pauseBtn) pauseBtn.disabled = !isPlaying || isPaused;
    if (stopBtn) stopBtn.disabled = !isPlaying;

    // Deshabilitar controles de velocidad y tono durante reproducción
    if (rateControl) rateControl.disabled = isPlaying;
    if (pitchControl) pitchControl.disabled = isPlaying;
    if (voiceSelect) voiceSelect.disabled = isPlaying;
  };

  const populateVoices = () => {
    if (!voiceSelect) return;

    const voices = tts.getAvailableVoices();

    if (voices.length === 0) {
      voiceSelect.innerHTML = "<option>No hay voces disponibles</option>";
      voiceSelect.disabled = true;
      return;
    }

    voiceSelect.innerHTML = "";
    voiceSelect.disabled = false;

    const spanishVoices = voices.filter((v) => v.lang.startsWith("es"));
    const otherVoices = voices.filter((v) => !v.lang.startsWith("es"));

    if (spanishVoices.length > 0) {
      const spanishGroup = document.createElement("optgroup");
      spanishGroup.label = "Español";
      spanishVoices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} (${voice.lang})`;
        spanishGroup.appendChild(option);
      });
      voiceSelect.appendChild(spanishGroup);
    }

    if (otherVoices.length > 0) {
      const otherGroup = document.createElement("optgroup");
      otherGroup.label = "Otros idiomas";
      otherVoices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} (${voice.lang})`;
        otherGroup.appendChild(option);
      });
      voiceSelect.appendChild(otherGroup);
    }

    if (spanishVoices.length > 0) {
      voiceSelect.value = spanishVoices[0].voiceURI;
      tts.setVoice(spanishVoices[0].voiceURI);
    } else if (voices.length > 0) {
      voiceSelect.value = voices[0].voiceURI;
      tts.setVoice(voices[0].voiceURI);
    }
  };

  populateVoices();

  tts.voicesLoadedCallback = populateVoices;

  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (tts.isPaused) {
        tts.resume();
        updateButtonStates(true, false);
      } else {
        const text = getTextCallback();
        if (!text || text.trim() === "") {
          alert(
            "No hay texto para leer. Por favor, pega o carga algún texto primero."
          );
          return;
        }

        tts.speak(
          text,
          () => updateButtonStates(false, false), // onEnd
          () => updateButtonStates(true, false) // onStart
        );
      }
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      tts.pause();
      updateButtonStates(true, true);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      tts.stop();
      updateButtonStates(false, false);
    });
  }

  if (voiceSelect) {
    voiceSelect.addEventListener("change", (e) => {
      tts.setVoice(e.target.value);
    });
  }

  if (rateControl) {
    rateControl.addEventListener("input", (e) => {
      const rate = e.target.value;
      tts.setRate(rate);
      if (rateLabel) rateLabel.textContent = `${rate}x`;
    });

    if (rateLabel) rateLabel.textContent = `${rateControl.value}x`;
  }

  if (pitchControl) {
    pitchControl.addEventListener("input", (e) => {
      const pitch = e.target.value;
      tts.setPitch(pitch);
      if (pitchLabel) pitchLabel.textContent = pitch;
    });

    if (pitchLabel) pitchLabel.textContent = pitchControl.value;
  }

  updateButtonStates(false, false);

  return tts;
}
