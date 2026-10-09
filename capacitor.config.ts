import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aetherfall.game',
  appName: 'Aetherfall',
  webDir: 'dist',
  backgroundColor: '#0b0f1a',
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_aether', iconColor: '#E8B84A' },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
