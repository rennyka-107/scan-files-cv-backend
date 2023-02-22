const { Client } = require("@elastic/elasticsearch");
const client = new Client({
  node: "http://localhost:9200",
  requestTimeout: 60000,
});

module.exports = client;
