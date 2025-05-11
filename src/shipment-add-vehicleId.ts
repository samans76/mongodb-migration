import { MongoClient, ObjectId } from "mongodb";

const uri =
  "mongodb://localhost:27017";
// "mongodb://user:pass@host:port/db_name?authSource=admin";

async function updateShipmentsWithUsers() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const DB = client.db("tms_db_dev");
    const shipmentsCollection = DB.collection("shipments");
    const usersCollection = DB.collection("users");

    // Step 1: Load users with shippingAgent info
    const users = await usersCollection
      .find({ "shippingAgent.vehicleRegistrationPlate": { $exists: true } })
      .project({
        _id: 1,
        "shippingAgent._id": 1,
        "shippingAgent.vehicleRegistrationPlate": 1,
      })
      .toArray();

    // Step 2: Create a lookup map from plate to user info
    const plateMap = new Map<
      string,
      { driverId: ObjectId; vehicleId: ObjectId }
    >();

    for (const user of users) {
      const plate = user.shippingAgent?.vehicleRegistrationPlate;
      if (plate) {
        plateMap.set(plate, {
          driverId: user._id,
          vehicleId: user.shippingAgent._id,
        });
      }
    }

    console.log(`👤 Loaded ${plateMap.size} users with shippingAgent vehicles`);

    // Step 3: Process shipments in chunks
    const totalShipments = await shipmentsCollection.countDocuments();
    console.log(`📦 Total shipments: ${totalShipments}`);

    const bulkOperations: any[] = [];
    plateMap.forEach((item, index) => {
      bulkOperations.push({
        updateMany: {
          filter: { plate: index },
          update: {
            $set: {
              vehicleId: item.vehicleId,
              driverId: item.driverId,
            },
          },
        },
      });
    })

    const totalBulkOperations = bulkOperations.length
    const BATCH_SIZE = 50;


    for (let skip = 0; skip < totalBulkOperations; skip += BATCH_SIZE) {
      const result = await shipmentsCollection.bulkWrite(bulkOperations.slice(skip, skip + BATCH_SIZE));
      console.log(`✅ Updated ${result.modifiedCount} shipments in batch`);
    }

    console.log("🎉 Migration completed successfully");
  } catch (error) {
    console.error("❌ Error during migration:", error);
  } finally {
    await client.close();
  }
}

updateShipmentsWithUsers();
