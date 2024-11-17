const crypto = require('crypto');
const io = require("socket.io-client");
const readline = require("readline");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

// RSA Key Pair
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

let registeredUsername = "";
let username = "";

const users = new Map(); // database di server harus di replika di client supaya cepat

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    registeredUsername = input;
    username = input;
    console.log(`Welcome, ${username} to the chat`);

    //regist public key kita ke server
    socket.emit("registerPublicKey", {
      username,
      publicKey: publicKey.export({ type: "spki", format: "pem" }),
    }); 

    rl.prompt();

    rl.on("line", (message) => {
      if ((match = message.match(/^!impersonate (\w+)$/))) { // kalau mau menyamar jadi user lain lalu spasi username
        username = match[1]; // ambil username dari code diatas
        console.log(`Now impersonating as ${username}`);
      } else if (message.match(/^!exit$/)) {
        username = registeredUsername;
        console.log(`Now you are ${username}`);
      } else {
        try {
          // Debug message
          console.log("Signing message:", message);
  
          // Sign message
          const signature = crypto
            .sign("sha256", Buffer.from(message), privateKey)
            .toString("base64");
  
          socket.emit("message", {
            username,
            message,
            signature,
          });
        } catch (err) {
          console.error("Error signing message:", err.message);
        }
      }
      rl.prompt();
    });
  });
});

// object array nya diterima trs dilooping dan di set di data base client (copy database dari server ke database client)
socket.on("init", (keys) => {
  keys.forEach(([user, key]) => users.set(user, key));
  console.log(`\nThere are currently ${users.size} users in the chat`);
  rl.prompt();
});

// dapat public key client lain waktu ada user baru
socket.on("newUser", (data) => {
  const { username, publicKey } = data;
  users.set(username, publicKey);
  console.log(`${username} joined the chat`);
  rl.prompt();
})

socket.on("message", (data) => {
  const { username: senderUsername, message: senderMessage, signature } = data;

  try {
    const senderPublicKey = users.get(senderUsername);

    if (senderPublicKey) {
      const isAuthentic = crypto.verify(
        "sha256",
        Buffer.from(senderMessage),
        {
          key: senderPublicKey,
          format: "pem",
          type: "spki",
        },
        Buffer.from(signature, "base64")
      );

      if (isAuthentic) {
        if (senderUsername !== username) {
          console.log(`${senderUsername}: ${senderMessage}`);
        }
      } else {
        console.log(`⚠️ WARNING: Impersonation detected! "${senderUsername}" is fake!`);
      }
    } else {
      console.log(`⚠️ WARNING: No public key found for "${senderUsername}"!`);
    }
  } catch (err) {
    console.error("Error verifying message:", err.message);
  }

  rl.prompt();
});


socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});
