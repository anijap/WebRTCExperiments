"use strict";

(function() {
    var socket = io();

    socket.on("full", function() {
        $("#messages").append("Room is full");
        socket.close();
    });

    socket.on("join", function() {
        console.log("Joined chat");
        createOffer();
    });


    /** WebRTC signalling **/

    socket.on("offer", function(offerData) {
        console.log("OFFER received");
        processOffer(offerData);
    });

    socket.on("answer", function(answerData) {
        console.log("ANSWER received");
        processAnswer(answerData);
    });

    socket.on("candidate", function(iceData) {
        console.log("CANDIDATE received");
        processIce(iceData);
    });

    var config = {
        "iceServers": [{
            "url": "stun:stun.l.google.com:19302"
        }]
    };

    var peerConnection;
    var peerSendDataChannel;

    function createOffer() {
        openDataChannel();

        var sdpConstraints = {
            "OfferToReceiveAudio": false,
            "OfferToReceiveVideo": false
        };

        peerConnection.createOffer(function(sdp) {
            peerConnection.setLocalDescription(sdp);
            socket.emit("offer", sdp);
            console.log("Sending OFFER");
        }, function(err) {
            console.log("ERROR");
            console.log(err);
        }, sdpConstraints);

    }

    function openDataChannel() {
        peerConnection = new RTCPeerConnection(config);
        peerConnection.onicecandidate = function(e) {
            if (!peerConnection || !e || !e.candidate) return;
            var candidate = e.candidate;

            console.log("Sending CANDIDATE");
            socket.emit("candidate", candidate);
        }

        peerSendDataChannel = peerConnection.createDataChannel("datachannel", null);

        peerConnection.ondatachannel = function(event) {
            var receiveChannel = event.channel;
            receiveChannel.onmessage = function(event) {
                console.log("Peer connection MESSAGE");
                console.log(event.data);

                $("#messages").append("<p>" + event.data + "</p>");
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

    function processOffer(offer) {
        openDataChannel();

        peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        var sdpConstraints = {
            "mandatory": {
                "OfferToReceiveAudio": false,
                "OfferToReceiveVideo": false
            }
        };

        peerConnection.createAnswer(function(sdp) {
            peerConnection.setLocalDescription(sdp);
            console.log("Sending ANSWER");
            socket.emit("answer", sdp);
        }, function(err) {
            console.log("ERROR");
            console.log(err);
        }, sdpConstraints);
        console.log("PROCESSED OFFER");

    };

    function processAnswer(answer) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("PROCESSED ANSWER");

        // Now ready to exchange data!
        $("#sendChat").prop("disabled", false);
    };

    function processIce(iceCandidate) {
        peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
        console.log("PROCESSED ICE");
    }

    $("#sendChat").click(function() {
        var msg = $("#chatInput").val();
        console.log("Sending message via WebRTC: " + msg);
        peerSendDataChannel.send(msg);
        $("#chatInput").val("");

        $("#messages").append("<p>Me: " + msg + "</p>");
    });
})();