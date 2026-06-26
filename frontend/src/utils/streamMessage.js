/**
 * Streams a full response text into a React state array of messages.
 * This directly updates the message state, providing true state-based progressive rendering.
 * 
 * @param {string} fullText - The complete text to stream.
 * @param {string|number} messageId - The ID of the message to update.
 * @param {Function} setMessages - The React state setter for the messages array.
 * @param {string} textKey - The property name for the text in the message object (e.g. 'text' or 'content').
 * @param {number} speed - Milliseconds between each chunk.
 * @returns {Promise<void>} Resolves when streaming is complete.
 */
export const streamToState = (fullText, messageId, setMessages, textKey = 'text', speed = 30) => {
  return new Promise((resolve) => {
    if (!fullText) {
      resolve();
      return;
    }

    // Split into chunks (words + preserving whitespace)
    const tokens = fullText.match(/\S+\s*/g) || [fullText];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex++;
      const currentChunk = tokens.slice(0, currentIndex).join('');
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, [textKey]: currentChunk } 
            : msg
        )
      );

      if (currentIndex >= tokens.length) {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
};
