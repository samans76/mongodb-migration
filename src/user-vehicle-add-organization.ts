import { MongoClient } from "mongodb";

const uri = "mongodb://localhost:27017";
const fmsDBName = "fms_db_dev";
const serverDBName = "tms_db_dev";

async function migrateUserOrganizations() {
  const mongoClient = new MongoClient(uri);

  try {
    await mongoClient.connect();
    const fmsDB = mongoClient.db(fmsDBName);
    const serverDB = mongoClient.db(serverDBName);
    const fmsUsersCollection = fmsDB.collection("users");
    const serverUsersCollection = serverDB.collection("users");
    const serverUsers = await serverUsersCollection.find({}).toArray();

    const updates: any[] = [];
    for (const user of serverUsers) {
      updates.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { organizations: user.organizations ? user.organizations : [] } },
        }
      })
    }



    if (updates.length > 0) {
      const result = await fmsUsersCollection.bulkWrite(updates);
      console.log("✅ User migration complete:", result);
    } else {
      console.log("⚠️ No user updates needed.");
    }

  } catch (error) {
    console.error("❌ User migration error:", error);
  } finally {
    await mongoClient.close();
  }
}

async function migrateVehicleOrganizations() {
  const mongoClient = new MongoClient(uri);

  try {
    await mongoClient.connect();
    const fmsDB = mongoClient.db(fmsDBName);
    const serverDB = mongoClient.db(serverDBName);
    const serverUsersCollection = serverDB.collection("users");
    const fmsVehicleCollection = fmsDB.collection("vehicles");

    const serverAgents = await serverUsersCollection.find({shippingAgent: {$exists: true}}).toArray();
    const agents = serverAgents.map((u) => u.shippingAgent)

    const updates: any[] = []
    for (const agent of agents) {
      updates.push({
        updateOne: {
          filter: { _id: agent._id },
          update: { $set: { accessibleByOrganizations: agent.accessableByOrganizations ? agent.accessableByOrganizations : [] } }
        }
      });

    }

    if (updates.length > 0) {
      const result = await fmsVehicleCollection.bulkWrite(updates);
      console.log("✅ Vehicle migration complete:", result);
    } else {
      console.log("⚠️ No vehicle updates needed.");
    }

  } catch (error) {
    console.error("❌ Vehicle migration error:", error);
  } finally {
    await mongoClient.close();
  }
}

(async function () {
  await migrateUserOrganizations();
  await migrateVehicleOrganizations();
})();
