// Firebase project settings (from Firebase console > Project settings > Your apps > Web app).
// These values are safe to publish: access is controlled by the Firestore security rules.
export const firebaseConfig = {
  apiKey: "AIzaSyCx73DtmqOaIm4vUjHRA6SB4kwd9dxvkek",
  authDomain: "edulixa-mental-math.firebaseapp.com",
  projectId: "edulixa-mental-math",
  storageBucket: "edulixa-mental-math.firebasestorage.app",
  messagingSenderId: "606501723152",
  appId: "1:606501723152:web:b0703125096394e993fe95"
};

// Administrators: these accounts open the admin panel and are not limited to two devices.
// The same list is written in firestore.rules — keep both in step.
export const ADMIN_EMAILS = ["abeer.wafaa@monglish.uk", "soha.mohamed@monglish.uk"];

// How many devices one student account may use.
export const MAX_DEVICES = 2;

export const BOOKS = [
  { id: 'L1', level: 'Level 1', name: 'Explorers', game: 'Number Race', gameFile: 'games/level-1-number-race.html' },
  { id: 'L2', level: 'Level 2', name: 'Geniuses', game: 'Number Vault', gameFile: 'games/level-2-number-vault.html' },
  { id: 'L3', level: 'Level 3', name: 'Ninjas', game: 'Ninja Dojo', gameFile: 'games/level-3-ninja-dojo.html' },
  { id: 'L4', level: 'Level 4', name: 'Masters', game: 'Castle Battle', gameFile: 'games/level-4-castle-battle.html' },
  { id: 'L5', level: 'Level 5', name: 'Number Wizards', game: 'Moon Base Launch', gameFile: 'games/level-5-moon-base-launch.html' }
];
