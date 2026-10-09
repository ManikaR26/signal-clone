export interface User {
  id: number;
  username: string;
  display_name: string;
  avatar: string;
  online: boolean;
  last_seen: number;
  role?: "admin" | "member";
}
export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
}
export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  client_id: string;
  created_at: number;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  reply_to?: number;
  attachment_id?: string;
  attachment?: Attachment | null;
  reply?: { id: number; body: string; display_name: string } | null;
  expires_at?: number;
  receipts: {
    user_id: number;
    delivered_at: number | null;
    read_at: number | null;
  }[];
  reactions: { user_id: number; emoji: string }[];
}
export interface Conversation {
  id: number;
  kind: "direct" | "group";
  name: string | null;
  members: User[];
  last_message: Message | null;
  unread: number;
  updated_at: number;
  disappear_seconds: number;
}
export function chatName(chat: Conversation, uid: number) {
  return chat.kind === "group"
    ? chat.name || "Group"
    : chat.members.find((m) => m.id !== uid)?.display_name || "Conversation";
}
export function chatAvatar(chat: Conversation, uid: number) {
  return chat.kind === "group"
    ? "purple"
    : chat.members.find((m) => m.id !== uid)?.avatar || "blue";
}
