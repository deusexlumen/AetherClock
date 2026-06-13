import { describe, it, expect } from 'vitest';
import { isValidServerAlarm, isValidDeviceRecord, isValidTimezone } from './validation';

describe('validation', () => {
  it('validates a correct server alarm', () => {
    expect(isValidServerAlarm({ id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] })).toBe(true);
  });

  it('rejects invalid alarm time', () => {
    expect(isValidServerAlarm({ id: 'a1', time: '7:00', label: 'Wake', isActive: true, days: [] })).toBe(false);
  });

  it('validates a correct device record', () => {
    expect(
      isValidDeviceRecord({
        deviceId: 'dev-1',
        timezone: 'Europe/Berlin',
        alarms: [{ id: 'a1', time: '07:00', label: 'Wake', isActive: true, days: ['mon'] }],
        subscription: null,
        updatedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it('rejects invalid timezone', () => {
    expect(isValidTimezone('Mars/Phobos')).toBe(false);
  });
});
