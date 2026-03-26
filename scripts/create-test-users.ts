import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Initialize Firebase Admin
const firebaseConfigPath = path.join(__dirname, "../src/lib/services/firebase-config.json");
const serviceAccountKey = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});

const testUsers = [
  {
    email: "admin@strix.local",
    password: "Admin123!@",
    displayName: "Admin Demo",
  },
  {
    email: "operator@strix.local",
    password: "Operator123!@",
    displayName: "Operador Demo",
  },
  {
    email: "support@strix.local",
    password: "Support123!@",
    displayName: "Soporte Demo",
  },
];

async function main() {
  try {
    console.log("[START] Creating test users in Firebase...");

    for (const user of testUsers) {
      try {
        const existing = await admin.auth().getUserByEmail(user.email);
        console.log(
          `[EXISTS] User ${user.email} already exists with UID: ${existing.uid}`,
        );
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          const created = await admin.auth().createUser({
            email: user.email,
            password: user.password,
            displayName: user.displayName,
          });
          console.log(
            `[CREATED] User ${user.email} with UID: ${created.uid}`,
          );
          console.log(`  Password: ${user.password}`);
        } else {
          console.error(`ERROR creating ${user.email}:`, error.message);
        }
      }
    }

    console.log("[SUCCESS] Test users setup complete!");
    console.log("\nTest credentials:");
    testUsers.forEach((u) => {
      console.log(`  Email: ${u.email}`);
      console.log(`  Password: ${u.password}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error("[ERROR]", error);
    process.exit(1);
  }
}

main();
