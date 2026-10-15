interface TypingEntry {
  chatId: string;
  userId: string;
  userName: string;
  expiresAt: number;
}

// In-memory active typing state (TTL 3.5s)
const typingMap = new Map<string, TypingEntry>();

export function setTypingStatus(
  chatId: string,
  userId: string,
  userName: string,
  isTyping: boolean
): void {
  const key = `${chatId}__${userId}`;
  if (!isTyping) {
    typingMap.delete(key);
    return;
  }
  typingMap.set(key, {
    chatId,
    userId,
    userName,
    expiresAt: Date.now() + 3500,
  });
}

export function getActiveTyping(): { chatId: string; userId: string; userName: string }[] {
  const now = Date.now();
  const results: { chatId: string; userId: string; userName: string }[] = [];

  typingMap.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      typingMap.delete(key);
    } else {
      results.push({
        chatId: entry.chatId,
        userId: entry.userId,
        userName: entry.userName,
      });
    }
  });

  return results;
}
