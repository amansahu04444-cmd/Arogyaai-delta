export const initVoiceRecognition = (onResult, onError, onEnd) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    if (onError) onError('Speech Recognition API is not supported in this browser.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (onResult) onResult(transcript);
  };

  recognition.onerror = (event) => {
    if (onError) onError(`Error occurred in recognition: ${event.error}`);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return recognition;
};

let utterance = null;

export const speakResponse = (text) => {
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  window.dispatchEvent(new CustomEvent('speechStateChange', { detail: { speaking: false } }));

  let stringToSpeak = text;
  if (typeof text === 'object' && text !== null) {
    const parts = [];
    if (text.summary) parts.push(text.summary);
    if (text.home_care && text.home_care.length > 0) {
      parts.push("Home care guidance: " + text.home_care.join(". "));
    }
    if (text.warning_signs && text.warning_signs.length > 0) {
      parts.push("Emergency warning signs: " + text.warning_signs.join(". "));
    }
    stringToSpeak = parts.join(". ");
  }

  utterance = new SpeechSynthesisUtterance(stringToSpeak);
  
  // Language Detection (Devanagari characters)
  const isHindi = /[\u0900-\u097F]/.test(stringToSpeak);
  
  if (isHindi) {
    utterance.lang = "hi-IN";
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang === 'hi-IN' && v.name.includes('Google')) 
                    || voices.find(v => v.lang === 'hi-IN')
                    || voices.find(v => v.lang.startsWith('hi'));
    if (hindiVoice) {
      utterance.voice = hindiVoice;
    }
  } else {
    utterance.lang = "en-US";
  }

  utterance.onstart = () => {
    window.dispatchEvent(new CustomEvent('speechStateChange', { detail: { speaking: true } }));
  };
  utterance.onend = () => {
    window.dispatchEvent(new CustomEvent('speechStateChange', { detail: { speaking: false } }));
  };
  utterance.onerror = () => {
    window.dispatchEvent(new CustomEvent('speechStateChange', { detail: { speaking: false } }));
  };

  window.speechSynthesis.speak(utterance);
};

export const pauseSpeech = () => {
  if (window.speechSynthesis) window.speechSynthesis.pause();
};

export const resumeSpeech = () => {
  if (window.speechSynthesis) window.speechSynthesis.resume();
};

export const stopSpeech = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent('speechStateChange', { detail: { speaking: false } }));
  }
};
