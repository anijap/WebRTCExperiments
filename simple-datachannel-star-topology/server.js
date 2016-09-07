var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var redis = require("redis");
var redisClient = redis.createClient();

app.use(express.static(__dirname + "/client"));
server.listen(8888, function() {
	console.log("Listening on: http://localhost:8888");
});

io.on("connection", function(socket) {
	console.log("New client: " + socket.id);

	socket.on("disconnect", function() {
		console.log("Disconnected client: " + socket.id);

		redisClient.hget(socket.id, "roomName", function(error, roomNameToDel) {
			if (roomNameToDel !== null) {
				console.log("Deleting room: " + roomNameToDel + ", for host: " + socket.id);

				redisClient.smembers(roomNameToDel + ":users", function(err, res) {
					res.forEach(function(user) {
						console.log(roomNameToDel + " room deleted, notifying user: " + user);
						socket.broadcast.to(user).emit("deleted-room");
						redisClient.del(user);
					});
				});

				redisClient.del(socket.id);
				redisClient.del(roomNameToDel);
				redisClient.del(roomNameToDel + ":users");
			} else {
				redisClient.hget(socket.id, "host", function(error, hostSocketId) {
					console.log(socket.id + " left room hosted by: " + hostSocketId);
					socket.broadcast.to(hostSocketId).emit("user-left", socket.id);
				});
				redisClient.del(socket.id);
			}
		});
	});

	socket.on('create-room-request', function(roomName) {
		redisClient.hget(roomName, "host", function(err, hostSocketId) {
			if (hostSocketId === null) {
				redisClient.hset(roomName, "host", socket.id);
				redisClient.hset(socket.id, "roomName", roomName);
				socket.emit("created-room");
				console.log("Created room: " + roomName + ", for host: " + socket.id);
			} else {
				console.log("Room already exists: " + roomName + ", for host: " + hostSocketId);
				socket.emit("room-exists");
			}
		});
	});

	socket.on('join-room-request', function(roomName) {
		redisClient.hget(roomName, "host", function(err, hostSocketId) {
			if (hostSocketId !== null) {
				console.log("Joining room: " + roomName + ", for client: " + socket.id);
				socket.emit("joined-room", hostSocketId);

				redisClient.sadd(roomName + ":users", socket.id);
				redisClient.hset(socket.id, "host", hostSocketId);
			} else {
				console.log("Room to join does not exist: " + roomName + ", for client: " + socket.id);
				socket.emit("room-does-not-exist");
			}
		});
	});

	/** WebRTC signalling **/
	socket.on("offer", function(sdp, peerSocketId) {
		console.log("");
		console.log("-----------------------");
		console.log("OFFER " + socket.id + " -> " + peerSocketId);
		console.log(sdp);
		console.log("-----------------------");
		console.log("");
		socket.broadcast.to(peerSocketId).emit('offer', sdp, socket.id);
	});

	socket.on("answer", function(sdp, peerSocketId) {
		console.log("");
		console.log("-----------------------");
		console.log("ANSWER " + socket.id + " -> " + peerSocketId);
		console.log(sdp);
		console.log("-----------------------");
		console.log("");
		socket.broadcast.to(peerSocketId).emit('answer', sdp, socket.id);
	});

	socket.on("candidate", function(candidate, peerSocketId) {
		console.log("");
		console.log("-----------------------");
		console.log("CANDIDATE " + socket.id + " -> " + peerSocketId);
		console.log(candidate);
		console.log("-----------------------");
		console.log("");
		socket.broadcast.to(peerSocketId).emit('candidate', candidate, socket.id);
	});
});