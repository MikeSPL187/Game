import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { planNotifications } from '../game/notifyPlan';
import type { Game } from '../game/game';
import { reportError } from './errors';

const native = () => Capacitor.isNativePlatform();

export async function notificationsAllowed(): Promise<boolean> {
  if (!native()) return false;
  try { return (await LocalNotifications.checkPermissions()).display === 'granted'; } catch { return false; }
}

export async function requestNotifications(): Promise<boolean> {
  if (!native()) return false;
  try { return (await LocalNotifications.requestPermissions()).display === 'granted'; } catch { return false; }
}

/** Called when the app goes to the background. */
export async function scheduleReminders(g: Game) {
  if (!native() || !g.s.settings.notifications) return;
  try {
    if (!(await notificationsAllowed())) return;
    await cancelReminders();
    const plan = planNotifications(g, Date.now());
    if (!plan.length) return;
    await LocalNotifications.schedule({
      notifications: plan.map((p) => ({
        id: p.id, title: p.title, body: p.body,
        schedule: { at: new Date(p.at), allowWhileIdle: true },
        smallIcon: 'ic_stat_aether', iconColor: '#E8B84A',
      })),
    });
  } catch (err) {
    reportError('notify', err);
  }
}

/** Called when the app returns to the foreground: the player sees everything in-game. */
export async function cancelReminders() {
  if (!native()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  } catch { /* ignore */ }
}
