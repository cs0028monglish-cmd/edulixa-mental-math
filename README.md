# Edulixa Mental Math Portal

The Mental Math library (5 books + 5 games), with sign-in, an admin panel and live PIN tests.

- `index.html` – sign-in and the library. Students see only the books their administrator gave them.
- `admin.html` – administrators: add users, give books, reset devices, change passwords, delete accounts, make live tests, download results as an Edulixa Excel sheet.
- `live.html` – students join a live test with a PIN.
- `games/` – the five book games (each one checks the student has that book).
- `js/config.js` – Firebase settings and the administrator emails.
- `firestore.rules` – Firestore security rules (paste into Firebase console > Firestore > Rules).

Each student account works on 2 devices. Administrators can reset a student's devices.
