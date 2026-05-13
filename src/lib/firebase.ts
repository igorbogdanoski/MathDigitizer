import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
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

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/operation-not-supported-in-this-environment',
]);

export const signInWithGoogle = async () => {
  googleProvider.setCustomParameters({
    prompt: 'select_account',
  });

  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    const code: string | undefined = error?.code;

    if (code && POPUP_FALLBACK_CODES.has(code)) {
      try {
        return await signInWithRedirect(auth, googleProvider);
      } catch (redirectError: any) {
        console.error('Error signing in with Google (redirect fallback)', redirectError);
        if (redirectError?.code === 'auth/unauthorized-domain') {
          alert(
            "Грешка: Доменот не е дозволен во Firebase.\n" +
            "Додадете го овој домен во Firebase Console -> Authentication -> Settings -> Authorized Domains."
          );
        } else {
          alert("Грешка при најава: " + (redirectError?.message || "Непозната грешка."));
        }
        throw redirectError;
      }
    }

    console.error('Error signing in with Google', error);
    if (code === 'auth/unauthorized-domain') {
      alert(
        "Грешка: Доменот не е дозволен во Firebase.\n" +
        "Додадете го овој домен во Firebase Console -> Authentication -> Settings -> Authorized Domains."
      );
    } else if (code === 'auth/network-request-failed') {
      alert("Мрежна грешка при најава. Проверете ја интернет конекцијата и обидете се повторно.");
    } else {
      alert("Грешка при најава: " + (error?.message || "Непозната грешка."));
    }
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
