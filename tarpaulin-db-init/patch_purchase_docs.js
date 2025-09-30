const admin = require("firebase-admin");
const path = require("path");

// Adjust path to your serviceAccountKey.json
admin.initializeApp({
  credential: admin.credential.cert(path.join(__dirname, "serviceAccountKey.json")),
});
const db = admin.firestore();

const DEFAULT_VALUES = {
  branchId: "nidagundi",
  avgCostPerKg: 0,
  vendor: "unknown",
  totalCost: 0,
  totalWeight: 0,
  transportCost: 0,
  gst: 0,
  stock: [],
  billPhotoURL: null,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  createdBy: "admin",
};

async function patchAllPurchases() {
  const purchases = await db.collection("purchases").get();
  const batch = db.batch();

  purchases.forEach(doc => {
    const data = doc.data();
    const update = {};
    for (const [field, value] of Object.entries(DEFAULT_VALUES)) {
      if (data[field] === undefined || data[field] === null) {
        update[field] = value;
      }
    }
    if (Object.keys(update).length > 0) {
      batch.update(doc.ref, update);
    }
  });

  await batch.commit();
  console.log("All purchase documents patched with default schema!");
}

patchAllPurchases().catch(console.error);
