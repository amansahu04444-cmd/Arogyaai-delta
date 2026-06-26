import { useState, useEffect, useRef } from 'react';

/**
 * ChatGPT-style word-by-word streaming hook.
 * 
 * @param {string} fullText - The complete text to stream.
 * @param {boolean} enabled - Whether to stream (true) or show instantly (false).
 * @param {number} speed - Milliseconds between each word. Default 30ms.
 * @returns {{ displayedText: string, isStreaming: boolean }}
 */
export const useStreamingText = (fullText, enabled = true, speed = 30) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef(null);
  const enabledRef = useRef(enabled);

  // Keep enabledRef current so cleanup knows the latest value
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // If streaming is disabled or no text, show everything instantly
    if (!enabled || !fullText) {
      setDisplayedText(fullText || '');
      setIsStreaming(false);
      return;
    }

    // Split into word tokens (preserving whitespace after each word)
    const tokens = fullText.match(/\S+\s*/g) || [fullText];
    let currentIndex = 0;

    // Start with empty text
    setDisplayedText('');
    setIsStreaming(true);

    intervalRef.current = setInterval(() => {
      currentIndex++;
      const nextText = tokens.slice(0, currentIndex).join('');
      setDisplayedText(nextText);

      if (currentIndex >= tokens.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsStreaming(false);
      }
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fullText, enabled, speed]);

  return { displayedText, isStreaming };
};
