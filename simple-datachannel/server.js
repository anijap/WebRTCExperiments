var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);

app.use(express.static(__dirname + "/client"));
server.listen(8888, function() {
	console.log("Listening on: http://localhost:8888");
});

var numOfPeers = 0;

io.on("connection", function(socket) {
	console.log("New client: " + socket.id);

	numOfPeers++;
	if (numOfPeers <= 2) {
		socket.emit("join");
	} else {
		console.log("Room is full");
		socket.emit("full");
	}

	socket.on("disconnect", function() {
		console.log("Disconnected client: " + socket.id);
		numOfPeers--;
	});


	/** WebRTC signalling **/
	socket.on("offer", function(sdp) {
		console.log("");
		console.log("-----------------------");
		console.log("OFFER " + socket.id);
		console.log(sdp);
		console.log("-----------------------");
		console.log("");
		socket.broadcast.emit("offer", sdp);
	});

	socket.on("answer", function(sdp) {
		console.log("");
		console.log("-----------------------");
		console.log("ANSWER " + socket.id);
		console.log(sdp);
		console.log("-----------------------");
		console.log("");
		socket.broadcast.emit("answer", sdp);
	});

	socket.on("candidate", function(candidate) {
		console.log("");
		console.log("-----------------------");
		console.log("CANDIDATE " + socket.id);
		console.log(candidate);
		console.log("-----------------------");
		console.log("");
		socket.broadcast.emit("candidate", candidate);
	});
});