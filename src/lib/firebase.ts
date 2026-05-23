import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';

// Define Operation types for Error Handlers
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let firebaseInitialized = false;

try {
  const env = (import.meta as any).env || {};
  const apiKey = (env.VITE_FIREBASE_API_KEY as string) || firebaseAppletConfig.apiKey;
  const authDomain = (env.VITE_FIREBASE_AUTH_DOMAIN as string) || firebaseAppletConfig.authDomain;
  const projectId = (env.VITE_FIREBASE_PROJECT_ID as string) || firebaseAppletConfig.projectId;
  const storageBucket = (env.VITE_FIREBASE_STORAGE_BUCKET as string) || firebaseAppletConfig.storageBucket;
  const messagingSenderId = (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || firebaseAppletConfig.messagingSenderId;
  const appId = (env.VITE_FIREBASE_APP_ID as string) || firebaseAppletConfig.appId;
  const firestoreDatabaseId = (env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || firebaseAppletConfig.firestoreDatabaseId;

  if (!apiKey || !projectId) {
    console.warn("⚠️ Firebase credentials are not fully configured. Falling back to local data modes to avoid app crashes.");
  } else {
    if (getApps().length === 0) {
      app = initializeApp({
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId
      });
    } else {
      app = getApp();
    }
    db = getFirestore(app, firestoreDatabaseId);
    auth = getAuth(app);
    firebaseInitialized = true;
    console.log("🔥 Firebase initialized successfully. Connected to Firestore Database: " + firestoreDatabaseId);
  }
} catch (error) {
  console.error("❌ Critical: Error initializing Firebase SDK", error);
}

export { app, db, auth, firebaseInitialized };
export const isFirebaseConfigured = () => firebaseInitialized;

// Error handling helper conforming strictly to the FirestoreErrorInfo standard
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
