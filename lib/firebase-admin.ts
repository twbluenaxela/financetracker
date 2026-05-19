import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminAuth() {
  if (!getApps().length) {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    if (!privateKey) throw new Error("FIREBASE_ADMIN_PRIVATE_KEY is not set");

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  }

  return getAuth();
}

export { getAdminAuth as adminAuth };
