import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Optionally import the services that you want to use
// import {...} from 'firebase/auth';
// import {...} from 'firebase/database';
// import {...} from 'firebase/firestore';
// import {...} from 'firebase/functions';
// import {...} from 'firebase/storage';

// Initialize Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyA-7pD46_8ymN957E0S4a5ckTgNsKNDFP8',
  authDomain: 'testproject-59bac.scavengerhunt.com',
  databaseURL: 'https://testproject-59bac.firebaseio.com',
  projectId: 'testproject-59bac',
  storageBucket: 'testproject-59bac.appspot.com',
  messagingSenderId: 'sender-id',
  appId: 'app-id',
  measurementId: 'G-measurement-id',
};

const app = initializeApp(firebaseConfig);

// Export initialized auth and firestore instances for the app
export const auth = getAuth(app);
export const db = getFirestore(app);
