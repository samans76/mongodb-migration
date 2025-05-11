import { MongoClient } from "mongodb";

const uri = "mongodb://localhost:27017";
const fmsDBName = "rahranFmsDB";
const serverDBName = "rahranDB";

async function migrateUserOrganizations() {
  const mongoClient = new MongoClient(uri);

  try {
    await mongoClient.connect();
    const fmsDB = mongoClient.db(fmsDBName);
    const serverDB = mongoClient.db(serverDBName);
    const fmsUsersCollection = fmsDB.collection("users");
    const serverUsersCollection = serverDB.collection("users");

    const fmsUsers = await fmsUsersCollection.find({}).toArray();
    const serverUsersMap = new Map(
      (await serverUsersCollection.find({}).toArray()).map(u => [u._id.toHexString(), u])
    );

    const updates = [];
    for (const user of fmsUsers) {
      const sameUserInServer = serverUsersMap.get(user._id.toHexString());
      if (sameUserInServer?.organizations) {
        updates.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: { organizations: sameUserInServer.organizations } },
          }
        });
      }
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

    const fmsVehicles = await fmsVehicleCollection.find({}).toArray();
    const serverUsers = await serverUsersCollection.find({}).toArray();

    const agentMap = new Map();
    for (const user of serverUsers) {
      const agent = user.shippingAgent;
      if (agent?._id) {
        agentMap.set(agent._id.toHexString(), agent);
      }
    }

    const updates = [];
    for (const vehicle of fmsVehicles) {
      const sameAgentInServer = agentMap.get(vehicle._id.toHexString());
      if (sameAgentInServer?.accessableByOrganizations) {
        updates.push({
          updateOne: {
            filter: { _id: vehicle._id },
            update: { $set: { accessibleByOrganizations: sameAgentInServer.accessableByOrganizations } }
          }
        });
      }
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
