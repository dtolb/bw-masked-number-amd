/* Import our Modules */
const Bandwidth = require('node-bandwidth');
const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const ringing = 'https://s3.amazonaws.com/bw-demo/ring.mp3';
const forwardTo = require('fowardConfigs.json');

/* Express Setup */
let app  = express();
let http = require('http').Server(app);
app.use(bodyParser.json());
app.set('port', (process.env.PORT || 3000));

/* Setup our Bandwidth information */
const myCreds = {
  userId    : process.env.BANDWIDTH_USER_ID,
  apiToken  : process.env.BANDWIDTH_API_TOKEN,
  apiSecret : process.env.BANDWIDTH_API_SECRET,
};

const bwAPI = new Bandwidth(myCreds);

/* Setup our incoming call path */
app.post('/incoming-call', async (req, res) => {
  const event = req.body;
  console.log(`Got eventType: ${event.eventType}`);
  const callbackUrl = `http://${req.hostname}/answer-event`;
  res.send(200); // Always going to send 200
  if (event.eventType !== 'answer') {
    //ignore incoming call event and others
    return;
  }
  const ringing = {
    loopEnabled: true,
    fileUrl: 'https://s3.amazonaws.com/bw-demo/ring.mp3'
  };
  const bridge = {
    callIds: [event.callId],
    bridgeAudio: false
  };
  //shove the call-id for the incoming call so we get that later
  const callTag = {
    iCallId: event.callId
  };
  const call = {
    from: event.from,
    to: forwardTo[event.from],
    callTimeout: 15,
    callbackUrl: callbackUrl,
  };

  try {
    await bwAPI.Call.playAudioAdvanced(event.callId, ringing); //play ringing
    const bridge = await bwAPI.Bridge.create(bridge);
    console.log(`Created bridge: ${bridge.id}`);
    call.bridgeId = bridge.id;
    callTag.bridgeId = bridge.id;
    //Stringify the tag to help us later
    call.tag = JSON.stringify(callTag);
    const newCall = await bwAPI.Call.create(call);
    console.log(`Created call ${newCall.id}`);
  }
  catch (e) {
    console.log('Error happened either ringing, bridging, or creating call');
    console.log(e);
  }
});

app.post('/answer-event', async (req, res) => {
  const event = req.body;
  const tag = JSON.parse(event.tag); //Parse the JSON from the tag;
  const iCallId = tag.iCallId;
  console.log(`Got eventType: ${event.eventType}`);
  res.send(200); //We're always going to return 200
  try {
    if (event.eventType !== 'answer'){
      // it's either a hangup or a timeout
      console.log('Outbound call did not answer');
      //stop ringing on inbound call
      await bwAPI.Call.stopAudioFilePlayback(iCallId);
      //update the callback url to make life easier
      await bwAPI.Call.update(iCallId, {
        callbackUrl: `http://${req.hostname}/voicemail-flow`
      });
      //Start the voicemail prompt
      await bwAPI.Call.speakSentence(iCallId, "Please record your voicemail after the beep.");

      return; // we're done with the non-answer case
    }
    const gather = {
      maxDigits: 1,
      prompt: {
        sentence: "Please press 1 to accept the call, or 2 to send to voicemail"
      },
      tag: JSON.stringify(tag) //Pass the tag to the gather
    };
    //update the callback url to make life easier
    await bwAPI.Call.update(event.callId, {
      callbackUrl: `http://${req.hostname}/gather-flow`
    });
    const gather = await bwAPI.Call.createGather(event.callId, gather);
    console.log(`Created gather ${gather.id} on ${event.callId}`);
  }
  catch (e) {
    console.log('Error happened during the outbound call answer handling');
    console.log(e);
  }

});

app.post('/gather-flow', async (req, res) => {
  const event = req.body;
  console.log(`Got eventType: ${event.eventType}`);
  res.send(200);
  const iCallId = tag.iCallId;
  const tag = JSON.parse(event.tag); //Parse the JSON from the tag
  try {
    // The catch all case
    if (event.reason !== 'max-digits') {
      await bwAPI.Bridge.update(tag.bridgeId, {callIds: [iCallId]}); //Remove the outbound call from bridge
      if (event.reason !== 'hang-up') {
        await bwAPI.Call.hangup(event.callId); //hangup outbound call
      }
      await
    }
  }
  catch (e) {
    console.log('Error happened during the gather flow');
    console.log(e);
  }
});

app.post('/voicemail-flow', async (req, res) => {
  const event = req.body;
  console.log(`Got eventType: ${event.eventType}`);
  res.send(200); //Always reply 200;
  try {
    if (event.eventType === 'speak' && event.state === 'PLAYBACK_STOP'){
      // Speaking is finished, so play the beep
      await bwAPI.Call.playAudioFile(event.callId, "https://s3.amazonaws.com/bw-demo/beep.mp3");
    }
    else if (event.eventType === 'playback' && event.status === 'done') {
      // The beep.mp3 is done playing, so enable recording;
      await bwAPI.Call.enableRecording(event.callId);
    }
    else if (event.eventType === 'hangup') {
      // The call hungup
      const recordings = await bwAPI.Call.getRecordings(event.callId);
      console.log(recordings);
    }
    else {
      console.log('Unhandled event in "/voicemail-flow"');
    }
  }
  catch (e) {
    console.log('Error happened in the voicemail flow');
    console.log(e);
  }
})

http.listen(app.get('port'), function(){
  console.log('listening on *:' + app.get('port'));
});