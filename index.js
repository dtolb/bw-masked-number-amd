/* Import our Modules */
const Bandwidth = require('node-bandwidth');
const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const ringing = 'https://s3.amazonaws.com/bw-demo/ring.mp3';
const forwardTo = require('./fowardConfigs.json');
//console.log(forwardTo);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


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
  console.log(`Got eventType to path /incoming-call: ${req.body.eventType}`);
  res.sendStatus(200); // Always going to send 200
  try {
    const event = req.body;
    const callbackUrl = `http://${req.hostname}/answer-event`;
    if (event.eventType !== 'answer') {
      //ignore incoming call event and others
      return;
    }
    const ringing = {
      loopEnabled: true,
      fileUrl: 'https://s3.amazonaws.com/bw-demo/ring.mp3',
      tag: 'ringing'
    };
    const bridgeData = {
      callIds: [event.callId],
      bridgeAudio: false
    };
    //shove the call-id for the incoming call so we get that later
    const callTag = {
      iCallId: event.callId
    };
    const call = {
      from: event.from,
      to: forwardTo[event.to],
      callTimeout: 15,
      callbackUrl: callbackUrl,
    };
    await bwAPI.Call.playAudioAdvanced(event.callId, ringing); //play ringing
    console.log('Playing ringing!');
    const bridge = await bwAPI.Bridge.create(bridgeData);
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
  console.log(`Got eventType to path /answer-event: ${req.body.eventType}`);
  res.sendStatus(200); // Always going to send 200
  try {
    const event = req.body;
    const tag = JSON.parse(event.tag); //Parse the JSON from the tag;
    const iCallId = tag.iCallId;
    if (event.eventType === 'timeout'){
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
    else if (event.eventType === 'hangup') {
      const callEvents = await bwAPI.Call.getEvents(event.callId);
      console.log(callEvents);
      var hasAnswer = false;
      callEvents.forEach(callEvent => {
        if (callEvent.name === 'answer') {
          hasAnswer = true;
        }
      })
      if (hasAnswer) {
        await bwAPI.Call.stopAudioFilePlayback(iCallId);
      //update the callback url to make life easier
        await bwAPI.Call.update(iCallId, {
          callbackUrl: `http://${req.hostname}/voicemail-flow`
        });
        //Start the voicemail prompt
        await bwAPI.Call.speakSentence(iCallId, "Please record your voicemail after the beep.");
      }
      return;
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
    const gatherRes = await bwAPI.Call.createGather(event.callId, gather);
    console.log(`Created gather ${gatherRes.id} on ${event.callId}`);
  }
  catch (e) {
    console.log('Error happened during the outbound call answer handling');
    console.log(e);
  }

});

const hangerupper = async (callId) => {
  try {
    console.log('hangingup');
    return await bwAPI.Call.hangup(callId);
  }
  catch (e) {
    console.log('Error hanging up')
    console.log(e);
  }
}

app.post('/gather-flow', async (req, res) => {
  console.log(`Got eventType to path /gather-flow: ${req.body.eventType}`);
  res.sendStatus(200); // Always going to send 200
  try {
    const event = req.body;
    const tag = JSON.parse(event.tag); //Parse the JSON from the tag
    const iCallId = tag.iCallId;
    console.log(event);
    await bwAPI.Call.stopAudioFilePlayback(iCallId);
    if (event.eventType === 'hangup') {
//      await hangerupper(iCallId);
      return;
    }
    // The catch all case
    if (event.reason !== 'max-digits' || event.digits !== '1') {
      //await bwAPI.Bridge.update(tag.bridgeId, {callIds: [iCallId]}); //Remove the outbound call from bridge
      if (event.reason !== 'hung-up') {
        await bwAPI.Call.hangup(event.callId); //hangup outbound call
      }
      //update the callback url to make life easier
      await bwAPI.Call.update(iCallId, {
        callbackUrl: `http://${req.hostname}/voicemail-flow`
      });
      //Start the voicemail prompt
      console.log('sending to vm flow');
      await bwAPI.Call.speakSentence(iCallId, "Please record your voicemail after the beep.");
      return;
    }

    //accept the call
    await bwAPI.Bridge.update(tag.bridgeId, {
      bridgeAudio: true,
      callIds: [iCallId, event.callId]
    });
    // change callback to hangup
    await bwAPI.Call.update(iCallId, {
      callbackUrl: `http://${req.hostname}/hangup-flow`,
      tag: event.callId
    });
    await bwAPI.Call.update(event.callId, {
      callbackUrl: `http://${req.hostname}/hangup-flow`,
      tag: iCallId
    });
    // console.log('should have updated the bridge');
    // let bridge = await bwAPI.Bridge.get(tag.bridgeId);
    // console.log(bridge)
    // bridge = await bwAPI.Bridge.getCalls(tag.bridgeId);
    // console.log(bridge)
    return;
  }
  catch (e) {
    console.log('Error happened during the gather flow');
    console.log(e);
  }
});

app.post('/voicemail-flow', async (req, res) => {
  console.log(`Got eventType to path /voicemail-flow: ${req.body.eventType}`);
  res.sendStatus(200); // Always going to send 200
  try {
    const event = req.body;
    if (event.eventType === 'speak' && event.state === 'PLAYBACK_STOP'){
      // Speaking is finished, so play the beep
      await bwAPI.Call.playAudioFile(event.callId, "https://s3.amazonaws.com/bw-demo/beep.mp3");
    }
    else if (event.eventType === 'playback' && event.status === 'done' && event.tag !== 'ringing') {
      // The beep.mp3 is done playing, so enable recording;
      console.log('enabling recording');
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
});

app.post('/hangup-flow', async (req, res) => {
  console.log(`Got eventType to path /hangup-flow: ${req.body.eventType}`);
  res.sendStatus(200); // Always going to send 200
  try {
    const event = req.body;
    const call = bwAPI.Call.get(event.tag);
    if (call.state !== 'completed' || call.state !== 'rejected') {
      await bwAPI.Call.hangup(event.tag);
    }
  }
  catch (e) {
    console.log('Error hanging up call');
    console.log(e);
  }
})

http.listen(app.get('port'), function(){
  console.log('listening on *:' + app.get('port'));
});