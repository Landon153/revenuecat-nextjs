import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  console.log('Starting Firebase Admin initialization...');
  console.log('Checking environment variables...');

  if (!process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID.trim() === '') {
    console.error('Firebase Project ID is missing or empty');
    throw new Error('FIREBASE_PROJECT_ID environment variable is required and cannot be empty');
  }
  console.log('Project ID check passed:', process.env.FIREBASE_PROJECT_ID);

  if (!process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL.trim() === '') {
    console.error('Firebase Client Email is missing or empty');
    throw new Error('FIREBASE_CLIENT_EMAIL environment variable is required and cannot be empty');
  }
  console.log('Client Email check passed:', process.env.FIREBASE_CLIENT_EMAIL);

  if (!process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY.trim() === '') {
    console.error('Firebase Private Key is missing or empty');
    throw new Error('FIREBASE_PRIVATE_KEY environment variable is required and cannot be empty');
  }
  console.log('Private Key check passed');

  try {
    console.log('Attempting to initialize Firebase Admin...');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
      }),
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

const app = admin.app()
export const auth = app.auth()
export const firestore = app.firestore()