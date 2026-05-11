import { adminAuth, db } from "../lib/firestore.js";

const email = process.argv[2];

if (!email) {
  console.error("Usage: npm run set-coach -- coach@example.com");
  process.exitCode = 1;
} else {
  const user = await adminAuth.getUserByEmail(email);
  await adminAuth.setCustomUserClaims(user.uid, {
    ...(user.customClaims ?? {}),
    role: "coach"
  });

  const userRef = db.collection("users").doc(user.uid);
  const profile = await userRef.get();
  if (profile.exists) {
    await userRef.update({ role: "coach" });
  }

  console.log(`Granted coach claim to ${email}. The user must sign out and sign back in.`);
}
