// Shared notification config used by public/sw.js.
// Keep in sync with services/notificationConfig.ts.

export const ALARM_NOTIFICATION_OPTIONS = {
  icon: '/icon.svg',
  badge: '/icon.svg',
  tag: 'aetherclock-alarm',
  requireInteraction: true,
  vibrate: [200, 100, 200, 100, 200],
};

export const buildAlarmNotificationBody = (label, time) => `⏰ ${label} — ${time}`;
