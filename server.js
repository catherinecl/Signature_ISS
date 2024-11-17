const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer();
const io = socketIo(server);

const users = new Map(); // penyimpanan data, kalau programnya mati informasinya hilang

io.on("connection", (socket) => {
  console.log(`Client ${socket.id} connected`);

  socket.emit("init", Array.from(users.entries())); // spesific ke 1 user id saja yg baru join, dijadikan array dulu baru kirim krn gbs kirim object

  socket.on("registerPublicKey", (data) => {
    const { username, publicKey } = data;
    users.set(username, publicKey); // set untuk simpan, get untuk ambil
    console.log(`${username} registered with public key.`);
    io.emit("newUser", { username, publicKey }); // server harus tahu ada user baru
  });

  socket.on("message", (data) => {
    const { username, message, signature } = data;
    io.emit("message", { username, message, signature}); // io.emit = broadcast
  });

  socket.on("disconnect", () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});