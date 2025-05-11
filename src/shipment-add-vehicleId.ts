import { MongoClient, ObjectId } from "mongodb";

const uri = "mongodb://192.168.100.118:27017/";
//   "mongodb://admin:admin123@localhost:27017/tms_db_dev?authSource=admin";

const BATCH_SIZE = 1000;

async function fetchShipments() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    /** get db and collections */
    const test_migration_db = client.db("rahranDB");
    const shipmentsCollection = test_migration_db.collection("shipments");

    const test_migration_fms_db = client.db("rahranFmsDB");
    const vehiclesCollection = test_migration_fms_db.collection("vehicles");

    // Step 1: Load all vehicles into a Map for quick lookup by plate
    const vehicles = await vehiclesCollection.find({}).toArray();
    const vehicleMap = new Map<string, ObjectId>();

    for (const vehicle of vehicles) {
      if (vehicle.plate) {
        vehicleMap.set(vehicle.plate, vehicle._id);
      }
    }

    console.log(`🚗 Loaded ${vehicleMap.size} vehicles into memory`);

    // Step 2: Count shipments and loop in batches
    const totalShipments = await shipmentsCollection.countDocuments();
    console.log(`📦 Total shipments: ${totalShipments}`);

    for (let skip = 0; skip < totalShipments; skip += BATCH_SIZE) {
      console.log(`🔄 Processing batch: ${skip} - ${skip + BATCH_SIZE}`);

      const shipments = await shipmentsCollection
        .find({})
        .skip(skip)
        .limit(BATCH_SIZE)
        .toArray();

      const bulkOperations = [];

      for (const shipment of shipments) {
        const plate = shipment.plate;
        if (!plate) continue;
        const vehicleId = vehicleMap.get(plate);
        if (vehicleId) {
          bulkOperations.push({
            updateOne: {
              filter: { _id: shipment._id },
              update: { $set: { vehicleId } },
            },
          });
        }
      }

      if (bulkOperations.length > 0) {
        const result = await shipmentsCollection.bulkWrite(bulkOperations);
        console.log(`✅ Updated ${result.modifiedCount} shipments in batch`);
      } else {
        console.log("⚠️ No matching plates found in this batch");
      }
    }

    console.log("🎉 All shipments processed successfully");
  } catch (error) {
    console.error("❌ Error fetching shipments:", error);
  } finally {
    await client.close();
  }
}

fetchShipments();
