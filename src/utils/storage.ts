import { Contact, Message, UserProfile } from '../types/chat';
import { INITIAL_CONTACTS, INITIAL_MESSAGES, CURRENT_USER } from './mockData';

const CONTACTS_KEY = 'wa_clone_contacts_v1';
const MESSAGES_KEY = 'wa_clone_messages_v1';
const USER_KEY = 'wa_clone_user_v1';
const THEME_KEY = 'wa_clone_theme_v1';

export function getStoredTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
}

export function saveStoredTheme(theme: 'dark' | 'light'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}

export function getStoredUser(): UserProfile {
  if (typeof window === 'undefined') return CURRENT_USER;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : CURRENT_USER;
  } catch {
    return CURRENT_USER;
  }
}

export function saveStoredUser(user: UserProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredContacts(): Contact[] {
  if (typeof window === 'undefined') return INITIAL_CONTACTS;
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    return raw ? JSON.parse(raw) : INITIAL_CONTACTS;
  } catch {
    return INITIAL_CONTACTS;
  }
}

export function saveStoredContacts(contacts: Contact[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function getStoredMessages(): Record<string, Message[]> {
  if (typeof window === 'undefined') return INITIAL_MESSAGES;
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : INITIAL_MESSAGES;
  } catch {
    return INITIAL_MESSAGES;
  }
}

export function saveStoredMessages(messages: Record<string, Message[]>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}
