/*
 * PURPOSE: Shared notification payload/options for foreground fallback and service worker
 * ARCHITECTURE: services/notificationConfig
 * DEPENDENCIES: none
 * PIPELINE: test
 * LAST_VALIDATED: 2026-06-14
 */

export interface AlarmNotificationData {
  url: string;
}

export const ALARM_NOTIFICATION_OPTIONS = {
  icon: '/icon.svg',
  badge: '/icon.svg',
  tag: 'aetherclock-alarm',
  requireInteraction: true,
  vibrate: [200, 100, 200, 100, 200] as number[],
};

export const buildAlarmNotificationBody = (label: string, time: string): string =>
  `⏰ ${label} — ${time}`;
