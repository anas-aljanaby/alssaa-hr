import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

admin.initializeApp();

type Role = "admin" | "manager" | "employee";

type CallerClaims = {
  role?: Role;
};

type SetUserRoleData = {
  uid: string;
  role: Role;
  departmentId?: string | null;
};

type BootstrapBody = {
  uid?: string;
  email?: string;
  secret?: string;
};

const BOOTSTRAP_SECRET = defineSecret("BOOTSTRAP_SECRET");

export const bootstrapAdmin = onRequest(
  { secrets: [BOOTSTRAP_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Use POST" });
      return;
    }

    const body = (req.body ?? {}) as BootstrapBody;

    const provided = (body.secret ?? "").trim();
    const expected = (BOOTSTRAP_SECRET.value() ?? "").trim();

    if (!expected) {
      res.status(500).json({ ok: false, error: "Missing server secret" });
      return;
    }

    if (provided !== expected) {
      res.status(403).json({ ok: false, error: "Forbidden" });
      return;
    }

    let userUid = (body.uid ?? "").trim();

    if (!userUid) {
      const email = (body.email ?? "").trim().toLowerCase();
      if (!email) {
        res.status(400).json({ ok: false, error: "uid or email required" });
        return;
      }
      const user = await admin.auth().getUserByEmail(email);
      userUid = user.uid;
    }

    const userRecord = await admin.auth().getUser(userUid);
    const currentRole =
      (userRecord.customClaims?.role as Role | undefined) ?? undefined;

    if (currentRole === "admin") {
      res.json({ ok: true, alreadyAdmin: true, uid: userUid });
      return;
    }

    await admin.auth().setCustomUserClaims(userUid, {
      ...(userRecord.customClaims ?? {}),
      role: "admin",
      departmentId: "admin",
    });

    await admin.firestore().collection("users").doc(userUid).set(
      {
        role: "admin",
        departmentId: "admin",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ ok: true, uid: userUid });
  }
);

/**
 * Admin-only: set custom claims role + departmentId for a user.
 */
export const setUserRole = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Not signed in");
  }

  const claims = auth.token as CallerClaims;
  const callerRole = claims.role;

  if (callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Admins only");
  }

  const data = request.data as SetUserRoleData;
  const uid = data?.uid?.trim();
  const role = data?.role;
  const departmentId = data?.departmentId ?? null;

  if (!uid || !role) {
    throw new HttpsError("invalid-argument", "uid and role are required");
  }

  const allowedRoles: Role[] = ["admin", "manager", "employee"];
  if (!allowedRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role");
  }

  await admin.auth().setCustomUserClaims(uid, {
    role,
    departmentId,
  });

  await admin.firestore().collection("users").doc(uid).set(
    {
      role,
      departmentId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});
