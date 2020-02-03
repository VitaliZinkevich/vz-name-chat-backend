"use strict";

const AWS = require("aws-sdk");
let dynamo = new AWS.DynamoDB.DocumentClient();

require("aws-sdk/clients/apigatewaymanagementapi");

const CHATCONNECTION_TABLE = "chatIdTable";

const successfullResponse = {
  statusCode: 200,
  body: "everything is alright"
};

module.exports.connectionHandler = (event, context, callback) => {
  if (event.requestContext.eventType === "CONNECT") {
    // Handle connection
    addConnection(event.requestContext.connectionId)
      .then(() => {
        callback(null, successfullResponse);
      })
      .catch(err => {
        console.log(err);
        callback(null, JSON.stringify(err));
      });
  } else if (event.requestContext.eventType === "DISCONNECT") {
    // Handle disconnection
    deleteConnection(event.requestContext.connectionId)
      .then(() => {
        callback(null, successfullResponse);
      })
      .catch(err => {
        console.log(err);
        callback(null, {
          statusCode: 500,
          body: "Failed to connect: " + JSON.stringify(err)
        });
      });
  }
};

// THIS ONE DOESNT DO ANYHTING
module.exports.defaultHandler = (event, context, callback) => {
  console.log("defaultHandler was called");
  let email = "vitalizinkevich@gmail.com";
  const textBody = `
    текст тела письма
  `;
  const paramsAdmin = {
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `Кто то запросил чат. ЯЗЫК ${event.body}`
        },
        Text: {
          Charset: "UTF-8",
          Data: textBody
        }
      },
      Subject: {
        Charset: "UTF-8",
        Data: "сообщение сайта по web dev"
      }
    },
    Source: "vitalizinkevich@gmail.com"
  };
  let emailPromise = new AWS.SES({ apiVersion: "2010-12-01" })
    .sendEmail(paramsAdmin)
    .promise();

  emailPromise
    .then(res => {
      callback(null, {
        statusCode: 200,
        body: "defaultHandler"
      });
    })
    .catch(err => {
      callback(null, {
        statusCode: 500,
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true
        },
        body: message || "error message"
      });
    });
};

module.exports.sendMessageHandler = (event, context, callback) => {
  sendMessageToAllConnected(event)
    .then(() => {
      callback(null, successfullResponse);
    })
    .catch(err => {
      callback(null, JSON.stringify(err));
    });
};

const sendMessageToAllConnected = event => {
  return getConnectionIds().then(connectionData => {
    return connectionData.Items.map(connectionId => {
      return send(event, connectionId.connectionId);
    });
  });
};

const getConnectionIds = () => {
  const params = {
    TableName: CHATCONNECTION_TABLE,
    ProjectionExpression: "connectionId"
  };

  return dynamo.scan(params).promise();
};

const send = (event, connectionId) => {
  const body = JSON.parse(event.body);
  const postData = body.data;

  const endpoint =
    event.requestContext.domainName + "/" + event.requestContext.stage;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: endpoint
  });

  const params = {
    ConnectionId: connectionId,
    Data: postData
  };
  return apigwManagementApi.postToConnection(params).promise();
};

const addConnection = connectionId => {
  const params = {
    TableName: CHATCONNECTION_TABLE,
    Item: {
      connectionId: connectionId
    }
  };

  return dynamo.put(params).promise();
};

const deleteConnection = connectionId => {
  const params = {
    TableName: CHATCONNECTION_TABLE,
    Key: {
      connectionId: connectionId
    }
  };

  return dynamo.delete(params).promise();
};
