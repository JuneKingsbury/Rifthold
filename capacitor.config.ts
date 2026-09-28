import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rifthold.game',
  appName: 'Rifthold',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;
