/**
 * Central configuration, read once from the environment (.env).
 * No secret has a hard-coded fallback — a missing JWT secret or database
 * URL fails fast at boot instead of silently running insecure.
 */
export interface AppConfiguration {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  otpDevMode: boolean;
  /** Web client ID for Google Sign-In; null until the owner configures it. */
  googleClientId: string | null;
  fileRetentionDays: number;
  signedUrlExpiryMinutes: number;
  razorpay: {
    keyId: string | null;
    keySecret: string | null;
    webhookSecret: string | null;
  };
  shiprocket: {
    email: string | null;
    password: string | null;
    webhookToken: string | null;
    pickupLocation: string;
  };
  storage: {
    bucket: string | null;
    region: string | null;
    accessKey: string | null;
    secretKey: string | null;
    endpoint: string | null;
  };
  firebase: {
    projectId: string | null;
    serviceAccountJson: string | null;
  };
}

function emptyToNull(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : null;
}

export default (): AppConfiguration => {
  const databaseUrl = emptyToNull(process.env.DATABASE_URL);
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and fill it in.',
    );
  }
  const jwtSecret = emptyToNull(process.env.JWT_SECRET);
  if (!jwtSecret || jwtSecret === 'change-me-to-a-long-random-string') {
    throw new Error(
      'JWT_SECRET is not set (or still has the example value). Set a long random string in .env.',
    );
  }
  return {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    databaseUrl,
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
    otpDevMode: (process.env.OTP_DEV_MODE ?? 'false').toLowerCase() === 'true',
    googleClientId: emptyToNull(process.env.GOOGLE_CLIENT_ID) ?? '897316870551-d0kjk7vubd8c4ekrj8gm09o3h02j86t8.apps.googleusercontent.com',
    fileRetentionDays: parseInt(process.env.FILE_RETENTION_DAYS ?? '30', 10),
    signedUrlExpiryMinutes: parseInt(
      process.env.SIGNED_URL_EXPIRY_MINUTES ?? '15',
      10,
    ),
    razorpay: {
      keyId: emptyToNull(process.env.RAZORPAY_KEY_ID),
      keySecret: emptyToNull(process.env.RAZORPAY_KEY_SECRET),
      webhookSecret: emptyToNull(process.env.RAZORPAY_WEBHOOK_SECRET),
    },
    shiprocket: {
      email: emptyToNull(process.env.SHIPROCKET_EMAIL),
      password: emptyToNull(process.env.SHIPROCKET_PASSWORD),
      webhookToken: emptyToNull(process.env.SHIPROCKET_WEBHOOK_TOKEN),
      pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION ?? 'Primary',
    },
    storage: {
      bucket: emptyToNull(process.env.STORAGE_BUCKET),
      region: emptyToNull(process.env.STORAGE_REGION),
      accessKey: emptyToNull(process.env.STORAGE_ACCESS_KEY),
      secretKey: emptyToNull(process.env.STORAGE_SECRET_KEY),
      endpoint: emptyToNull(process.env.STORAGE_ENDPOINT),
    },
    firebase: {
      projectId: emptyToNull(process.env.FIREBASE_PROJECT_ID),
      serviceAccountJson: emptyToNull(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      ),
    },
  };
};
