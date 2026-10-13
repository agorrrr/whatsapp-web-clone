export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';

export type MessageType = 'text' | 'image' | 'audio' | 'sticker' | 'document';

export interface Message {
  id: string;
  chatId: string;
  senderId: string; // 'me' or contactId
  senderName?: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string; // base64 or blob URL or image URL
  fileName?: string;
  fileSize?: string;
  audioDuration?: number; // seconds
  timestamp: string; // ISO string or format
  status: MessageStatus;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
    type: MessageType;
  };
  reaction?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  avatar: string;
  about?: string;
  isOnline: boolean;
  lastSeen?: string;
  isGroup?: boolean;
  participantsCount?: number;
  unreadCount: number;
  pinned?: boolean;
  isTyping?: boolean;
  lastMessage?: {
    text: string;
    timestamp: string;
    type: MessageType;
    senderId: string;
    status?: MessageStatus;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  about: string;
  avatar: string;
  phone: string;
}
