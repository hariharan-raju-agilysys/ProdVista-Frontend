import api from './api';

// ── Types ──────────────────────────────────────────────────

export interface UserNotification {
  id: string;
  notificationId: string;
  title: string;
  message: string;
  type: 'Info' | 'Warning' | 'Error' | 'Success' | 'Action';
  category: string;
  senderDisplayName: string;
  actionUrl?: string;
  metadata?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface SendNotificationRequest {
  title: string;
  message: string;
  type?: string;
  category?: string;
  targetRoles?: string;
  actionUrl?: string;
  metadata?: string;
}

// ── API Functions ──────────────────────────────────────────

export async function getMyNotifications(take = 20, unreadOnly = false): Promise<UserNotification[]> {
  const { data } = await api.get('/notifications', { params: { take, unreadOnly } });
  return data;
}

export async function getTodayNotifications(): Promise<UserNotification[]> {
  const { data } = await api.get('/notifications/today');
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await api.post(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

export async function dismissNotification(notificationId: string): Promise<void> {
  await api.post(`/notifications/${notificationId}/dismiss`);
}

export async function sendNotification(request: SendNotificationRequest): Promise<void> {
  await api.post('/notifications', request);
}
