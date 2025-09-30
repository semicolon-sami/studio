// inventory-backfill.js

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin with your service account
admin.initializeApp({
  credential: admin.credential.cert(path.join(__dirname, "serviceAccountKey.json")),
});
const db = admin.firestore();

async function createInventoryCollection() {
  const inventoryMap = {};

  // Step 1: Aggregate purchases
  const purchasesSnap = await db.collection("purchases").get();
  purchasesSnap.forEach(doc => {
    const purchase = doc.data();
    const branchId = purchase.branchId || "nidagundi"; // Use field or fallback
    if (!purchase.stock) return;
    for (const item of purchase.stock) {
      const { size, pieces, weight } = item;
      const avgCostPerKg = purchase.avgCostPerKg || 0;
      const key = `${branchId}_${size}`;
      if (!inventoryMap[key]) {
        inventoryMap[key] = {
          branchId,
          size,
          totalPiecesInStock: 0,
          totalWeightInStock: 0,
          totalCost: 0
        };
      }
      inventoryMap[key].totalPiecesInStock += pieces;
      inventoryMap[key].totalWeightInStock += weight;
      inventoryMap[key].totalCost += avgCostPerKg * weight;
    }
  });

  // Step 2: Subtract sales
  const salesSnap = await db.collection("sales_entries").get();
  salesSnap.forEach(doc => {
    const sale = doc.data();
    const branchId = sale.branchId || "nidagundi";
    const { size, pieces } = sale;
    const key = `${branchId}_${size}`;
    if (!inventoryMap[key]) return;
    const avgWeightPerPiece = inventoryMap[key].totalPiecesInStock
      ? inventoryMap[key].totalWeightInStock / inventoryMap[key].totalPiecesInStock
      : 0;
    const weightToRemove = pieces * avgWeightPerPiece;
    inventoryMap[key].totalPiecesInStock -= pieces;
    inventoryMap[key].totalWeightInStock -= weightToRemove;
    // totalCost remains; no change on sale
  });

  // Step 3: Write final inventory docs
  const batch = db.batch();
  Object.values(inventoryMap).forEach(({ branchId, size, totalPiecesInStock, totalWeightInStock, totalCost }) => {
    const averageCostPerKg = totalWeightInStock ? totalCost / totalWeightInStock : 0;
    const totalCostValue = totalWeightInStock * averageCostPerKg;
    const ref = db.collection("inventory").doc(`${branchId}_${size}`);
    batch.set(ref, {
      branchId,
      size,
      totalPiecesInStock,
      totalWeightInStock,
      averageCostPerKg,
      totalCostValue,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();
  console.log("Inventory collection created and initialized.");
}

createInventoryCollection().catch(console.error);
