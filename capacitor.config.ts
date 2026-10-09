import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aetherfall.game',
  appName: 'Aetherfall',
  webDir: 'dist',
  backgroundColor: '#0b0f1a',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
