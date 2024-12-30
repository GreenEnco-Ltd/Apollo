const { MongoClient } = require("mongodb");

module.exports.connectToDatabase = async () => {
  const client = new MongoClient(`mongodb://localhost:27017`);
  // const client = new MongoClient(`mongodb://GreenEncoDB:GreenEnco2024@greenencodb.cluster-cf6w22y6ekly.eu-west-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`);

  try {
    await client.connect();
    console.log("Connected to database:");

    return client;
  } catch (error) {
    console.error("Database connection error:", error.message);
    // throw error;
  }
};
