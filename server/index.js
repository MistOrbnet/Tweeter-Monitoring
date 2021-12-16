//load modules
const http = require("http"); // http package
const path = require("path"); //path packege
const express = require("express"); //express
const socketIo = require("socket.io"); // enables realtime, bi-directional communication between web clients and servers
const needle = require("needle"); //http client use for request
const config = require("dotenv").config(); //for using enviroment virables
const TOKEN = process.env.BEARER_TOKEN; //storing token

//configure port
//tell web server what port to listen on
const PORT = process.env.PORT || 3000; //listing port

const app = express(); //Creates an Express application

//turns computer into an HTTP server
//creates an HTTP Server object.
const server = http.createServer(app);
const io = socketIo(server);

app.get("/", (req, res) => {
  //for loading client in browser when local host is 3000
  res.sendFile(path.resolve(__dirname, "../", "client", "index.html")); //pointing to index.html
});

const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules"; //Tweeter endpoint for rules
const streamURL =
  "https://api.twitter.com/2/tweets/search/stream?tweet.fields=public_metrics&expansions=author_id"; //stream URL for tweets (user object with author infor)

const rules = [{ value: "Business" }]; //rules for what tweets to search for

// Get stream rules
async function getRules() {
  const response = await needle("get", rulesURL, {
    //return a promise
    headers: {
      //for sending token
      Authorization: `Bearer ${TOKEN}`, //using token for authorization
    },
  });
  console.log(response.body);
  return response.body; //return response
}

// Set stream rules
async function setRules() {
  const data = {
    add: rules, //data format
  };

  const response = await needle("post", rulesURL, data, {
    // post request
    headers: {
      "content-type": "application/json", // content type JSON
      Authorization: `Bearer ${TOKEN}`, // using token for authorization
    },
  });

  return response.body; // return response
}

// Delete stream rules
async function deleteRules(rules) {
  if (!Array.isArray(rules.data)) {
    //if rules is not array...
    return null;
  }

  const ids = rules.data.map((rule) => rule.id); //array of ids

  const data = {
    delete: {
      ids: ids, //format
    },
  };

  const response = await needle("post", rulesURL, data, {
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  return response.body;
}

//frunction for streeming tweets
function streamTweets(socket) {
  const stream = needle.get(streamURL, {
    //making request
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  stream.on("data", (data) => {
    //call events on stream
    try {
      const json = JSON.parse(data); //parsing to JSON
      console.log(json);
      socket.emit("tweet", json); //for emiting an event with the data to the client
    } catch (error) {}
  });

  return stream;
}

//when the client connect the on function will run
io.on("connection", async () => {
  console.log("Client connected...");
  let currentRules;
  try {
    //   Get all stream rules first
    currentRules = await getRules();

    // Delete all curent stream rules
    await deleteRules(currentRules);

    // Set rules based on array above
    await setRules();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  //filter tweets
  const filteredStream = streamTweets(io);

  let timeout = 0;
  filteredStream.on("timeout", () => {
    // Reconnect on error
    console.warn("A connection error occurred. Reconnecting…");
    setTimeout(() => {
      timeout++;
      streamTweets(io);
    }, 2 ** timeout);
    streamTweets(io);
  });
});

// creates a listener on the specified port
server.listen(PORT, () => console.log(`Listening on port ${PORT}`)); //listening on port
