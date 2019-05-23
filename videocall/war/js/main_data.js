var channel;
var pc;
var socket;
var xmlhttp;
var started = false;
var channelReady = false;
var signalingReady = false;
var msgQueue = [];
// We set mandatory audio and video
var sdpConstraints = {};
var dataChannel;

var arrayToStoreChunks = [];
var tempSendFilename;
var tempSendTotalBytes;
var tempSendCurrentBytes;

var tempReceiveFilename;
var tempReceiveTotalBytes;
var tempReceiveCurrentBytes;


/** 
 * Function: initialize
 * it will handle the init process
 * 
 * */
function initialize() {
	logThis('Initializing; room=' + roomKey + '.');


	// Begin the process open the channel and request the media (video/audio) to user through browser
	openChannel();


	// initiator is populated by the server directly in the HTML
	signalingReady = initiator;
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
 * Function: transitionToActive
 * This function handles UI transformation in case of call established.
 * Element localVideo will disappear and elements: miniVideo and remoteVideo will be showed.
 * 
 * */
function transitionToActive() {
	document.getElementById('chatbox').innerHTML='';
	enableChat();
}

/** 
 * Function: transitionToWaiting
 * This function handles the reset of UI in case of remote call termination or first initialization.
 * 
 * */
function transitionToWaiting() {
	document.getElementById('chatbox').innerHTML='<p>Waiting for the other participant..</p>';
	disableChat();
}

/** 
 * Function: transitionToDone
 * This function handles the reset of UI in case of local call termination.
 * 
 * */
function transitionToDone() {
	document.getElementById('chatbox').innerHTML='<p>Connection closed.</p>';
	disableChat();
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
			channelReady) {
		logThis('Creating PeerConnection.');
		createPeerConnection();
		logThis('Adding local stream.');

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
		pc = new webkitRTCPeerConnection(pcConfig, {optional: [{RtpDataChannels: true}]});
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
	
	try {
	    // Data Channel api supported from Chrome M25. 
	    // You might need to start chrome with  --enable-data-channels flag.
	    datachannel = pc.createDataChannel("myChannel", dataConstraints);
	    logThis('Created data channel');
	  } catch (e) {
	    alert('Failed to create data channel. ' +
	          'You need Chrome M25 or later with --enable-data-channels flag');
	    logThis('Create Data channel failed with exception: ' + e.message);  
	  }
	  // Setting the callback functions for handling channel's state changes
	  datachannel.onopen = onChannelStateChange;
	  datachannel.onclose = onChannelStateChange;
	  datachannel.onmessage = onReceiveMessageCallback;

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
function onExit() {
	logThis('Hanging up.');
	transitionToDone();

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

function enableChat(){
	document.getElementById('usermsg').disabled =false;
	document.getElementById('submitmsg').disabled =false;
	document.getElementById('file').disabled =false;
	document.getElementById('file').onchange = function() {
	    var file = this.files[0];
	    tempSendFilename=file.name;
	    var reader = new window.FileReader();
	    reader.readAsDataURL(file);
	    reader.onload = onReadAsDataURL;
	};
}


function disableChat(){
	document.getElementById('usermsg').disabled =true;
	document.getElementById('submitmsg').disabled =true;
	document.getElementById('file').disabled =true;
}

/** 
 * Function: onReceiveMessageCallback
 * event: the first input by WebRTC DataChannel object
 * 
 * This function will handle the received messages through WebRTC DataChannel
 * 
 * */
function onReceiveMessageCallback(event) {
	  var data = JSON.parse(event.data);
	  if (data.type == "chat"){ // it's a chat message
		  logThis('Received chat message from datachannel: '+event.data);
		  // print the received message
		  document.getElementById('chatbox').innerHTML = document.getElementById('chatbox').innerHTML  + "<b>[remote]</b>: " + data.message + "\n<br />\n"; 
	  }else if (data.type == "file"){ // it is a file!
		  // if it's the first time we receive a piece of the file we reset all the info and we add also a new HTML DIV to the chatbox container
		  if (data.filename != undefined && tempReceiveFilename!=data.filename){
			  	tempReceiveFilename=data.filename;
		    	document.getElementById('chatbox').innerHTML = document.getElementById('chatbox').innerHTML  + "<div id='"+tempReceiveFilename+"'></div>\n";
		    	tempReceiveTotalBytes=data.totalsize;
		    	tempReceiveCurrentBytes=0;
		  }
		  logThis('Received filechunk from datachannel');
	      arrayToStoreChunks.push(data.message); // pushing received chunks in array and waiting for completion
	      tempReceiveCurrentBytes=tempReceiveCurrentBytes+1000;
	      if (data.last) { // it's the last group of Bytes!
	    	  logThis('The received chunk is the last part of file: '+data.filename);
	          printDownloadLink(arrayToStoreChunks.join(''), data.filename);
	          arrayToStoreChunks = []; // resetting array
	          tempReceiveCurrentBytes=tempReceiveTotalBytes; // not really needed
	      }else{
	    	  // Otherwise print progress about the incoming transfer
	    	  document.getElementById(tempReceiveFilename).innerHTML = "<b>[sys]</b>: Receiving file: \""+tempReceiveFilename+"\"; Progress: "+tempReceiveCurrentBytes+"/"+tempReceiveTotalBytes+" Bytes";
	      }
	  }else{
		  logThis('Received unknown message from datachannel: '+event.data);
	  }
	  
}

/** 
 * Function: onChannelStateChange
 * 
 * This function will be invoked by WebRTC DataChannel object when the channel's state will change
 * 
 * */
function onChannelStateChange() {
	  var readyState = datachannel.readyState;
	  logThis('Channel state is: ' + readyState);
	  if (readyState == "open") {
		  transitionToActive();
	  } else {
		  transitionToWaiting();
	  }
	}

/** 
 * Function: sendChatMessage
 * 
 * This function will format, display in history and send the message writed by user in the chat textbox
 * 
 * */
function sendChatMessage() {
	  var data={};
	  data.message=document.getElementById('usermsg').value;
	  data.type="chat";
	  document.getElementById('usermsg').value='';
	  document.getElementById('chatbox').innerHTML = document.getElementById('chatbox').innerHTML  + "<b>[me]</b>: " + data.message + "\n<br />\n";
	  sendData(data);
	}

/** 
 * Function: sendData
 * data: the data container to send
 * 
 * This function will send the argument through the WebRTC DataChannel
 * 
 * */
function sendData(data) {
	  try{
		  datachannel.send(JSON.stringify(data));
		  logThis('Sent Data: ' + JSON.stringify(data));
	  }catch(e){
		  logThis("Exception while using DataChannel.. Maybe it's closed?");
	  }
	  
	}

/** 
 * Function: onReadAsDataURL
 * event: the first input by FileReader object
 * text: used only for iterate the process, directly inside the function
 * 
 * This function will handle the reading and sending process by group of Bytes
 * 
 * */
function onReadAsDataURL(event, text) {

	var data = {}; // data container
	data.type="file";
    if (event) text = event.target.result; // first invocation

    // If we are at first iteration then in the body it will not exist any element with id of variable: tempSendFilename
    if (document.getElementById(tempSendFilename) == undefined){
    	// add an element with tempSendFilename id to the chatbox container
    	document.getElementById('chatbox').innerHTML = document.getElementById('chatbox').innerHTML  + "<div id='"+tempSendFilename+"'></div>\n";
    	tempSendTotalBytes=text.length;
    	tempSendCurrentBytes=0;
    	data.totalsize=tempSendTotalBytes;
    	data.filename = tempSendFilename;
    }
    
    // If the message (that contains more than 1000 chars, so it starts to split it in many chunks.
    if (text.length > 1000) {
        data.message = text.slice(0, 1000);
        tempSendCurrentBytes=tempSendCurrentBytes+1000; // increase the counter for printing progress
        document.getElementById(tempSendFilename).innerHTML = "<b>[sys]</b>: Sending file \""+tempSendFilename+"\"; Progress: "+tempSendCurrentBytes+"/"+tempSendTotalBytes+" Bytes";
    } else {
    	// otherwise we are sending the last group of Bytes!
        data.message = text;
        data.last = true; // setting the flag for signaling the last part
        data.filename = tempSendFilename;
        tempSendCurrentBytes=tempSendTotalBytes;
        document.getElementById(tempSendFilename).innerHTML = "<b>[sys]</b>: Sending file \""+tempSendFilename+"\"; Progress: Completed!";
    }
    
    sendData(data); // send the message!
    
    var remainingDataURL = text.slice(data.message.length);
    if (remainingDataURL.length && started) setTimeout(function () { // if there is data and the connection is alive continue transmitting
        onReadAsDataURL(null, remainingDataURL);
    }, 500)
}


/** 
 * Function: printDownloadLink
 * fileUrl: temporary location for the received file
 * fileName: original filename for the received file
 * 
 * This function will print a link for saving the received file
 * 
 * */
function printDownloadLink(fileUrl, fileName) {
	document.getElementById(tempReceiveFilename).innerHTML ="<b>[sys]</b>: You received a file.. Click here to download -> <a href='"+ fileUrl +"' target='_blank' download='"+fileName+"'>"+fileName+"</a>\n";
}

