const express = require("express");
const cors = require("cors");
const serverless = require("serverless-http");
const AWS = require("aws-sdk");
const bodyParser = require("body-parser");
const axios = require("axios");

require("dotenv").config();

const DynamoDB = new AWS.DynamoDB({
  region: process.env.AWSREGION,
  endpoint: process.env.AWSENDPOINT,
  accessKeyId: process.env.AWSACCESSKEYID,
  secretAccessKey: process.env.AWSSECRETKEY,
});

const s3 = new AWS.S3({
  region: process.env.AWSREGION,
  accessKeyId: process.env.AWSACCESSKEYID,
  secretAccessKey: process.env.AWSSECRETKEY,
});

const app = express();

app.disable("etag");
app.disable("x-powered-by");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());

app.get("/", async (req, res) => {
  res.send("Hello world");
});

app.get("/metadata/:nftId", async (req, res) => {
  const nftId = req.params.nftId;
  const nftNumber = nftId.split(".")[0];

  const nftInfo = await DynamoDB.getItem({
    TableName: "queenie-metadata",
    Key: {
      id: { S: nftNumber },
    },
  }).promise();

  const name = nftInfo?.Item?.nft_name?.S;
  const description = nftInfo?.Item?.description?.S;
  const image = nftInfo?.Item?.image?.S;

  const prevMetadataResponse = await axios.get(`https://queenie-nft.s3.amazonaws.com/metadata/${nftId}`).then()
  const prevMetadata = prevMetadataResponse.data;

  const data = {
    ...prevMetadata,
    ...{ name: name || prevMetadata.name, description: description || prevMetadata.description, image: image || prevMetadata.image }
  }

  res.send(data);
});

app.post("/metadata", async (req, res) => {
  const nftId = req.body.nftId || "";
  const name = req.body.name || "";
  const description = req.body.description || "";
  const image = req.body.image || "";

  const param = {
    TableName: "queenie-metadata",
    Key: {
      id: { S: nftId },
    },
    UpdateExpression: "set nft_name = :name, description = :description, image = :image",
    ExpressionAttributeValues: {
      ":name": {
        S: name,
      },
      ":description": {
        S: description,
      },
      ":image": {
        S: image,
      },
    },
    ReturnValues: "ALL_NEW",
  };
  DynamoDB.updateItem(param, async (err) => {
    if (err) {
      console.log(err);
      res.send({ err });
    } else {
      res.send({ success: true });
    }
  });
});

app.use((err, req, res, next) => {
  res.status(500).send({ error: "Server error" });
  console.log(err);
});

if (process.env.ENVIRONMENT == "production") {
  exports.handler = serverless(app);
} else {
  app.listen(4000, () => {
    console.log(`Server is listening on port 4000.`);
  });
}
