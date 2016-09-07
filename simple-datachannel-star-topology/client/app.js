"use strict";

(function() {
    var socket = io();
    var roomName = null;
    var isHost = false;

    $("#chatInput").hide();
    $("#sendChat").hide();

    socket.on("created-room", function() {
        isHost = true;
        console.log("Created room: " + roomName);
        $("#roomNameHeading").text(roomName);
        $("#createRoom").hide();
        $("#joinRoom").hide();
    });

    socket.on("room-exists", function() {
        alert(roomName + " already exists. Try creating a different room.");
    });

    socket.on("room-does-not-exist", function() {
        alert(roomName + " does not exist. Try joining a different room.");
    });

    socket.on("joined-room", function(hostSocketId) {
        console.log("Joining room: " + roomName + ", for host: " + hostSocketId);
        
        // send offer to host of the room
        createOffer(socket, hostSocketId);
    });

    socket.on("deleted-room", function() {
        $("#messages").text("Room has been deleted.");
    });

    socket.on("user-left", function(userSocketId) {
        console.log("User left: " + userSocketId);

        var index = peers.findIndex(function(peer) {
            if(peer.PeerSocketId === userSocketId) {
                return true;
            }
            return false;
        });

        if(index !== -1) {
            peers.splice(index);    
        }
    });


    /** WebRTC signalling **/
    socket.on('offer', function(offerData, peerSocketId) {
        console.log("OFFER received: " + peerSocketId);
        processOffer(offerData, peerSocketId);
    });

    socket.on('answer', function(answerData, peerSocketId) {
        console.log("ANSWER received: " + peerSocketId);
        processAnswer(answerData, peerSocketId);
    });

    socket.on('candidate', function(iceData, peerSocketId) {
        console.log("CANDIDATE received: " + peerSocketId);
        processIce(iceData, peerSocketId);
    });

    var config = {
        "iceServers": [{
            "url": "stun:stun.l.google.com:19302"
        }]
    };

    var peerConnection;
    var peerSendDataChannel;

    /* 
    Peers array is composed of the 'PeerInfo' objects
    {
        'PeerSocketId':
        'RTCPeerConnection':
        'PeerDataChannel':
    }
    */
    var peers = [];

    function createOffer(socket, hostSocketId) {
        var newPeer = {
            'PeerSocketId': hostSocketId,
            'RTCPeerConnection': null,
            'PeerDataChannel': null
        };
        peers.push(newPeer);

        openDataChannel(newPeer);

        var sdpConstraints = {
            "OfferToReceiveAudio": false,
            "OfferToReceiveVideo": false
        };

        newPeer.RTCPeerConnection.createOffer(function(sdp) {
            newPeer.RTCPeerConnection.setLocalDescription(sdp);
            socket.emit("offer", sdp, newPeer.PeerSocketId);
            console.log("Sending OFFER");
        }, function(err) {
            console.log("ERROR");
            console.log(err);
        }, sdpConstraints);

    }

    function openDataChannel(newPeer) {
        newPeer.RTCPeerConnection = new RTCPeerConnection(config, null);
        newPeer.RTCPeerConnection.onicecandidate = function(e) {
            if (!newPeer.RTCPeerConnection || !e || !e.candidate) return;
            var candidate = e.candidate;

            console.log("Sending CANDIDATE");
            socket.emit("candidate", candidate, newPeer.PeerSocketId);
        }

        newPeer.PeerDataChannel = newPeer.RTCPeerConnection.createDataChannel("datachannel", null);

        newPeer.RTCPeerConnection.ondatachannel = function(event) {
            var receiveChannel = event.channel;
            receiveChannel.onmessage = function(event) {
                console.log("Peer connection MESSAGE");
                var receivedData = JSON.parse(event.data);
                console.log(receivedData);

                $("#messages").append("<p>" + "<b>" + receivedData.from + ": </b>" + receivedData.msg + "</p>");

                // Host forwards relays message to all the peers in this room
                if (isHost) {
                    peers.forEach(function(peer) {
                        console.log('Forwarding to ' + peer.PeerSocketId);
                        peer.PeerDataChannel.send(event.data);
                    });
                }
            }
            receiveChannel.onopen = function() {
                console.log("Peer connection OPEN");
            }
            receiveChannel.onclose = function() {
                console.log("Peer connection CLOSED");
            }
            receiveChannel.onerror = function() {
                console.log("Peer connection ERROR");
            }
        };
    }

    function processOffer(offer, peerSocketId) {
        var newPeer = {
            'PeerSocketId': peerSocketId,
            'RTCPeerConnection': null,
            'PeerDataChannel': null
        };
        peers.push(newPeer);

        openDataChannel(newPeer);

        newPeer.RTCPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        var sdpConstraints = {
            "mandatory": {
                "OfferToReceiveAudio": false,
                "OfferToReceiveVideo": false
            }
        };

        newPeer.RTCPeerConnection.createAnswer(function(sdp) {
            newPeer.RTCPeerConnection.setLocalDescription(sdp);
            console.log("Sending ANSWER");
            socket.emit("answer", sdp, newPeer.PeerSocketId);

            // Now ready to exchange data!
            $("#chatInput").show();
            $("#sendChat").show();
            $("#createRoom").hide();
            $("#joinRoom").hide();
            $("#roomNameHeading").text(roomName);
        }, function(err) {
            console.log("ERROR");
            console.log(err);
        }, sdpConstraints);
        console.log("PROCESSED OFFER");
    };

    function processAnswer(answer, peerSocketId) {
        // TODO - do some error checking & handling
        var peerInfo = peers.filter(function(peer) {
            return peer.PeerSocketId === peerSocketId;
        })[0];

        peerInfo.RTCPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("PROCESSED ANSWER");

        // Now ready to exchange data!
        $("#chatInput").show();
        $("#sendChat").show();
        $("#createRoom").hide();
        $("#joinRoom").hide();
        $("#roomNameHeading").text(roomName);
    };

    function processIce(iceCandidate, peerSocketId) {
        // TODO - do some error checking & handling
        var peerInfo = peers.filter(function(peer) {
            return peer.PeerSocketId === peerSocketId;
        })[0];

        peerInfo.RTCPeerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
        console.log("PROCESSED ICE");
    }

    $("#sendChat").click(function() {
        var msg = $("#chatInput").val();
        console.log("Sending message via WebRTC: " + msg);
        $("#chatInput").val("");

        if (isHost) {
            $("#messages").append("<p>" + "<b>" + socket.id + ": </b>" + msg + "</p>");
        }

        peers.forEach(function(peer) {
            console.log('Sending to ' + peer.PeerSocketId);
            var dataToSend = {
                "from": socket.id,
                "msg": msg
            }
            peer.PeerDataChannel.send(JSON.stringify(dataToSend));
        });
    });

    $("#createRoom").click(function() {
        while (roomName === null) {
            roomName = prompt("Enter a room name to create", "all");
        }

        socket.emit("create-room-request", roomName);
    });

    $("#joinRoom").click(function() {
        roomName = prompt("Enter a room name to join", "all");
        socket.emit("join-room-request", roomName);
    });
})();