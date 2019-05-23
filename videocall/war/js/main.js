var localVideo;
var miniVideo;
var remoteVideo;
var localStream;
var remoteStream;
var channel;
var pc;
var socket;
var xmlhttp;
var started = false;
var channelReady = false;
var signalingReady = false;
var msgQueue = [];
// We set mandatory audio and video
var sdpConstraints = {'mandatory': {
	'OfferToReceiveAudio': true,
	'OfferToReceiveVideo': true }};



/** 
 * Function: initialize
 * it will handle the init process
 * 
 * */
function initialize() {
	logThis('Initializing; room=' + roomKey + '.');
	localVideo = document.getElementById('localVideo');
	// Resize the container for fitting the window
	localVideo.addEventListener('loadedmetadata', function(){window.onresize();});
	// Setting variables
	miniVideo = document.getElementById('miniVideo');
	remoteVideo = document.getElementById('remoteVideo');
	hideHangup();
	// Begin the process open the channel and request the media (video/audio) to user through browser
	openChannel();
	doGetUserMedia();
	// initiator is populated by the server directly in the HTML
	signalingReady = initiator;
}

/** 
 * Function: hideHangup
 * his function will hide the "Hang up" button after call termination.
 * 
 * */
function hideHangup(){
	document.getElementById('buttonContainer').innerHTML ='';
}

/** 
 * Function: logThis
 * Double log function, it logs on console and in the overlapped 'div' that you'll see on the webpage.
 * 
 * */
function logThis(log){
	console.log(log);
	var consoleDiv = document.getElementById('console');
	consoleDiv.innerHTML = consoleDiv.innerHTML + '\n' + log;
	consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

/** 
 * Function: window.onresize
 * This function resizes the UI in case of window resizing.
 * 
 * */
window.onresize = function(){
	var aspectRatio;
	if (remoteVideo.style.opacity === '1') {
		aspectRatio = remoteVideo.videoWidth/remoteVideo.videoHeight;
	} else if (localVideo.style.opacity === '1') {
		aspectRatio = localVideo.videoWidth/localVideo.videoHeight;
	} else {
		return;
	}

	var innerHeight = this.innerHeight;
	var innerWidth = this.innerWidth;
	var videoWidth = innerWidth < aspectRatio * window.innerHeight ?
			innerWidth : aspectRatio * window.innerHeight;
	var videoHeight = innerHeight < window.innerWidth / aspectRatio ?
			innerHeight : window.innerWidth / aspectRatio;
	containerDiv = document.getElementById('container');
	containerDiv.style.width = videoWidth + 'px';
	containerDiv.style.height = videoHeight + 'px';
	containerDiv.style.left = (innerWidth - videoWidth) / 2 + 'px';
	containerDiv.style.top = (innerHeight - videoHeight) / 2 + 'px';
};

/** 
 * Function: openChannel
 * it will open Google Appengine Channel, for SDP exchange process
 * 
 * */
function openChannel() {
	logThis('Opening channel.');
	// Creating a new Google Appengine Channel object
	var channel = new goog.appengine.Channel(channelToken);
	var handler = {
			'onopen': onChannelOpened,
			'onmessage': onChannelMessage,
			'onerror': onChannelError,
			'onclose': onChannelClosed
	};
	// Then open it passing the handler with callback functions, then save the socket in a variable
	socket = channel.open(handler);
}

/** 
 * Function: onChannelOpened
 * This function is called when receiving when the Google Appengine Channel is opened 
 * It start also the entire communication process by invoking maybeStart function.
 * */
function onChannelOpened() {
	logThis('Channel opened.');
	channelReady = true;
	maybeStart();
}

/** 
 * Function: onChannelMessage
 * This function is called when receiving a new message on Google Appengine Channel.
 * It will check for msg type and execute the respective actions.
 * */
function onChannelMessage(message) {
	logThis('S->C: ' + message.data);
	var msg = JSON.parse(message.data);
	// Since the turn response is async and also GAE might disorder the message delivery due to possible datastore query at server side,
	// so callee needs to cache messages before PeerConnection object is created.
	if (!initiator && !started) {
		if (msg.type === 'offer') {
			// Add offer to the beginning of msgQueue, since we can't handle early candidates before offer at present.
			msgQueue.unshift(msg);
			// Callee creates PeerConnection
			signalingReady = true;
			maybeStart();
		} else {
			// Otherwise we will place the msg on queue and we'll wait fot the 'offer' message.
			msgQueue.push(msg);
		}
	} else {
		// If the communication is already started we'll pass the message to the function processSignalingMessage for properly handling it
		processSignalingMessage(msg);
	}
}

/** 
 * Function: onChannelError
 * Callback function, it only prints an error.
 * 
 * */
function onChannelError() {
	logThis('Channel error.');
}

/** 
 * Function: onChannelClosed
 * Callback function, it only prints an info.
 * 
 * */
function onChannelClosed() {
	logThis('Channel closed.');
}

/** 
 * Function: sendMessage
 * This function is used for sending message to the remote client via backend webserver. 
 * As you can see it uses a simple XML HTTP Request, the Google Appengine Channel API is used instead only for receiving messages.
 * */
function sendMessage(message) {
	var msgString = JSON.stringify(message);
	logThis('C->S: ' + msgString);
	path = '/message?r=' + roomKey + '&u=' + me;
	var xhr = new XMLHttpRequest();
	xhr.open('POST', path, true);
	xhr.send(msgString);
}

/** 
 * Function: doGetUserMedia
 * Try to request user's media, if something fails, the process will end here.
 * 
 * */
function doGetUserMedia() {
	try {
		// Request the media passing the constraints (in our case are defined in template.html, video and audio set: true!)
		// We define also two callback in case of Error or Success (go ahead to see what this callback will do)
		navigator.webkitGetUserMedia(mediaConstraints, onUserMediaSuccess,onUserMediaError);
		logThis('Requested access to local media with mediaConstraints:\n' +
				'  \'' + JSON.stringify(mediaConstraints) + '\'');
	} catch (e) {
		logThis('getUserMedia failed with exception: ' + e.message);
		alert('getUserMedia() failed. Is this a WebRTC capable browser?');
	}
}

/** 
 * Function: onUserMediaSuccess
 * Callback function, it's invoked when user grant access to local media.
 * Then it starts the communication process by calling maybeStart function.
 * */
function onUserMediaSuccess(stream) {
	logThis('User has granted access to local media.');
	// User has granted access to local media so we initialize video element in the page
	localVideo.src = URL.createObjectURL(stream);
	localVideo.style.opacity = 1;
	localStream = stream;
	// Caller creates PeerConnection.
	maybeStart();
}

/** 
 * Function: onUserMediaError
 * Callback function, it prints an error. The process will stop here.
 * 
 * */
function onUserMediaError(error) {
	logThis('Failed to get access to local media. Error code was ' +
			error.code);
	alert('Failed to get access to local media. Error code was ' +
			error.code + '.');
}

/** 
 * Function: showHangup
 * This function will show the "Hang up" button for call termination.
 * 
 * */
function showHangup(){
	document.getElementById('buttonContainer').innerHTML ='<input type=\'button\' id=\'hangup\' value=\'End call\' \
		onclick=\'onHangup()\' />'; 
}

/** 
 * Function: transitionToActive
 * This function handles UI transformation in case of call established.
 * Element localVideo will disappear and elements: miniVideo and remoteVideo will be showed.
 * 
 * */
function transitionToActive() {
	remoteVideo.style.opacity = 1;
	localVideo.src = '';
	miniVideo.style.opacity = 1;
	showHangup();
}

/** 
 * Function: transitionToWaiting
 * This function handles the reset of UI in case of remote call termination or first initialization.
 * 
 * */
function transitionToWaiting() {
	localVideo.src = miniVideo.src;
	miniVideo.src = '';
	remoteVideo.src = '';
	miniVideo.style.opacity = 0;
	remoteVideo.style.opacity = 0;
	hideHangup();
}

/** 
 * Function: transitionToDone
 * This function handles the reset of UI in case of local call termination.
 * 
 * */
function transitionToDone() {
	localVideo.style.opacity = 0;
	remoteVideo.style.opacity = 0;
	miniVideo.style.opacity = 0;
	hideHangup();
}

/** 
 * Function: window.onbeforeunload
 * This function send 'bye' message on refreshing(or leaving) the page to ensure the room is cleaned for next session.
 * 
 * */
window.onbeforeunload = function() {
	// this will trigger BYE from server
	socket.close();
}

/** 
 * Function: maybeStart
 * This function is called by onChannelOpened callback, it will start the process of PeerConnection object creation
 * and it will start the calling or called scenario handling
 * */
function maybeStart() {
	if (!started && signalingReady &&
			localStream && channelReady) {
		logThis('Creating PeerConnection.');
		createPeerConnection();
		logThis('Adding local stream.');
		pc.addStream(localStream);
		started = true;
		
		// If I'm starting the call it will run the "doCall" function, otherwise "calleeStart"
		if (initiator)
			doCall();
		else
			calleeStart();
	}
}

/** 
 * Function: createPeerConnection
 * With this function we'll create a new RTCPeerConnection that will handle all the connection process with the other client
 * 
 * */
function createPeerConnection() {
	try {
		// Create a new PeertConnection object with configuration taken by the server thanks to template.html file but without any constraints
		pc = new webkitRTCPeerConnection(pcConfig, {});
		// Set the callback to handle ice candidates!
		pc.onicecandidate = onIceCandidate;
		logThis('Created RTCPeerConnnection with:\n' +
				'  config: \'' + JSON.stringify(pcConfig) + '\';\n');
	} catch (e) {
		logThis('Failed to create PeerConnection, exception: ' + e.message);
		alert('Cannot create RTCPeerConnection object; \
		WebRTC is not supported by this browser.');
		return;
	}
	// Setting callback to correctly handle remote stream!
	pc.onaddstream = onRemoteStreamAdded;
	pc.onremovestream = onRemoteStreamRemoved;

}

/** 
 * Function: onIceCandidate
 * Callback function, when it receive back from stun/turn server a candidate, it prepares the SDP for sending it to remote client.
 * 
 * */
function onIceCandidate(event) {
	// Once we received an ICE candidate from stun/turn server, we'll forward it to remote client
	if (event.candidate) {
		sendMessage({type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate});
	} else {
		logThis('End of candidates.');
	}
}

/** 
 * Function: onRemoteStreamAdded
 * Callback function, it will be called directly by PeerConnection object when it starts receiveing the media stream.
 * 
 * */
function onRemoteStreamAdded(event) {
	logThis('Remote stream added.');
	// we move the local source to the "mini" video element
	miniVideo.src = localVideo.src;
	// we initialize remote video element in the page
	remoteVideo.src = URL.createObjectURL(event.stream);
	remoteStream = event.stream;
	waitForRemoteVideo();
}

/** 
 * Function: onRemoteStreamRemoved
 * Callback function, it only prints an info.
 * 
 * */
function onRemoteStreamRemoved(event) {
	logThis('Remote stream removed.');
}

/** 
 * Function: doCall
 * Start the conversation with the other client, creating the first SDP offer.
 * 
 * */
function doCall() {
	logThis('Sending offer to peer, with constraints: \n' +
			'  \'' + JSON.stringify(sdpConstraints) + '\'.');
	pc.createOffer(setLocalAndSendMessage,
			onCreateSessionDescriptionError, sdpConstraints); 
}

/** 
 * Function: calleeStart
 * Callee starts to process received messages
 * 
 * */
function calleeStart() {
	while (msgQueue.length > 0) {
		processSignalingMessage(msgQueue.shift());
	}
}

/** 
 * Function: processSignalingMessage
 * This function is called when receiving a new message on Google Appengine Channel.
 * It will invoked by onChannelMessage callback defined previously.
 * */
function processSignalingMessage(message) {
	if (!started) {
		logThis('peerConnection has not been created yet!');
		return;
	}
	
	/* It's important to analyze this conditional construct step by step:
	 * 		'offer' type: remote client sent an offer with audio/video codecs SDP, we set the remote offer in PeerConnection object (through setRemote function) and then we'll answer (doAnswer function)
	 * 		'answer' type: we received an update to our offer , we need only to notify the PeerConnection object of the received reply
	 * 		'candidate' type: we received an ICE candidate from remote client, we pass it to PeerConnection object that will handle the choice of the better one.
	 * 		'bye' type: It's time to close the communication, the client is disconnecting.
	 * */
	
	if (message.type === 'offer') {
		setRemote(message);
		doAnswer();
	} else if (message.type === 'answer') {
		setRemote(message);
	} else if (message.type === 'candidate') {
		var candidate = new RTCIceCandidate({sdpMLineIndex: message.label,
			candidate: message.candidate});
		pc.addIceCandidate(candidate);
	} else if (message.type === 'bye') {
		onRemoteHangup();
	}
}

/** 
 * Function: doAnswer
 * This function is called by processSignalingMessage callback, it will invoked for replying to an SDP OFFER message 
 * 
 * */
function doAnswer() {
	logThis('Sending answer to peer.');
	pc.createAnswer(setLocalAndSendMessage,onCreateSessionDescriptionError, sdpConstraints);
}

/** 
 * Function: setLocalAndSendMessage
 * This function is passed as argument to pc.createAnswer method, it will invoked for replying to an SDP OFFER message 
 * It needs also other 2 callback for handling the Success/Error case.
 * */
function setLocalAndSendMessage(sessionDescription) {
	pc.setLocalDescription(sessionDescription,
			onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
	sendMessage(sessionDescription);
}

/** 
 * Function: setRemote
 * This function is used for setting the Session Description for the remote client.  
 * It's used just after receiving an OFFER or ANSWER message
 * */
function setRemote(message) {
	pc.setRemoteDescription(new RTCSessionDescription(message),
			onSetSessionDescriptionSuccess, onSetSessionDescriptionError);
}

/** 
 * Function: onCreateSessionDescriptionError
 * Callback function, it prints an error. The process will stop here.
 * 
 * */
function onCreateSessionDescriptionError(error) {
	logThis('Failed to create session description: ' + error.toString());
}

/** 
 * Function: onSetSessionDescriptionSuccess
 * Callback function, it only prints an info.
 * 
 * */
function onSetSessionDescriptionSuccess() {
	logThis('Set session description success.');
}

/** 
 * Function: onSetSessionDescriptionError
 * Callback function, it prints an error. The process will stop here.
 * 
 * */
function onSetSessionDescriptionError(error) {
	logThis('Failed to set session description: ' + error.toString());
}

/** 
 * Function: onHangup
 * This function handles the reset of UI in case of call termination.
 * It's invoked directly by the "Hang up" button in the UI.
 * 
 * */
function onHangup() {
	logThis('Hanging up.');
	transitionToDone();
	localStream.stop();
	stop();
	// this will trigger BYE from server
	socket.close();
}

/** 
 * Function: onRemoteHangup
 * This function handles the reset of UI in case of remote call termination.
 * 
 * */
function onRemoteHangup() {
	logThis('Session terminated.');
	initiator = 0;
	transitionToWaiting();
	stop();
}

/** 
 * Function: stop
 * This function handles the network disconnection in case of call termination.
 * 
 * */
function stop() {
	started = false;
	signalingReady = false;
	pc.close();
	pc = null;
	msgQueue.length = 0;
}

/** 
 * Function: waitForRemoteVideo
 * This function handles UI's transition in the time frame between PeerConnection announce that is receiving media from remote client 
 * and when the media is really available to be played in the video box.
 * 
 * */
function waitForRemoteVideo() {
	videoTracks = remoteStream.getVideoTracks();
	if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
		transitionToActive();
	} else {
		setTimeout(waitForRemoteVideo, 100);
	}
}


