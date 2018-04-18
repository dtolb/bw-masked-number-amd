const debug = require('debug')('masked-numbers');
const urlJoin = require('url-join');
const Bandwidth = require('node-bandwidth');

/* Setup our Bandwidth information */
const myCreds = {
  userId    : process.env.BANDWIDTH_USER_ID,
  apiToken  : process.env.BANDWIDTH_API_TOKEN,
  apiSecret : process.env.BANDWIDTH_API_SECRET,
};

const bwAPI = new Bandwidth(myCreds);

module.exports.callBackResponder = (req, res, next) => {
  debug(`At Path: ${req.path}, got event: ${req.body.eventType}`);
  res.locals.baseUrl = `http://${req.hostname}/bandwidth`;
  res.sendStatus(200);
  next();
};

/* Setup our incoming call path */
module.exports.playRinging = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    //ignore incoming call event and others
    next();
    return;
  }
  try {
    const ringing = {
      loopEnabled : true,
      fileUrl     : 'https://s3.amazonaws.com/bw-demo/ring.mp3',
      tag         : 'ringing'
    };
    debug(`Playing ringing on callId: ${req.body.callId}`);
    await bwAPI.Call.playAudioAdvanced(req.body.callId, ringing); //play ringing
    next();
  }
  catch (e) {
    debug(`Error when trying to play ringing on callId: ${req.body.callId}`);
    next(e);
  }
}

module.exports.createBridge = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    //ignore incoming call event and others
    next();
    return;
  }
  try {
    const bridgeData = {
      callIds     : [req.body.callId],
      bridgeAudio : false
    };
    const bridge = await bwAPI.Bridge.create(bridgeData);
    debug(`Created bridge: ${bridge.id}`);
    res.locals.bridgeId = bridge.id;
    next();
  }
  catch (e) {
    debug(`Error when trying to create bridge with callId: ${req.body.callId}`);
    next(e);
  }
};

module.exports.createOutboundCall = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    //ignore incoming call event and others
    next();
    return;
  }
  try {
    const callData = {
      from        : req.body.from,
      to          : res.locals.forwardToNumber,
      callTimeout : 15,
      callbackUrl : urlJoin(res.locals.baseUrl, 'outbound-call-event');
      bridgeId    : res.locals.bridgeId,
    };
    callData.tag = JSON.stringify({
      iCallId  : req.body.callId,
      bridgeId : res.locals.bridgeId
    });
    const newCall = await bwAPI.Call.create(callData);
    debug(`Created call ${newCall.id}`);
    next();
  }
  catch (e) {
    debug(`Error when trying to create outbound call`);
    next(e);
  }
};

const sendCallToVoiceMail = async (callId, baseUrl) => {
  await bwAPI.Call.stopAudioFilePlayback(callId);
  //update the callback url to make life easier
  const callbackUrl = urlJoin(baseUrl, 'voicemail-flow');
  await bwAPI.Call.update(callId, {callbackUrl});
  //Start the voicemail prompt
  const vmPrompt = 'Please record your voicemail after the beep.';
  await bwAPI.Call.speakSentence(callId, vmPrompt);
};



module.exports.handleOutboundCallEvent = async (req, res, next) => {
  try {
    res.locals.tag = JSON.parse(req.body.tag); //Parse the JSON from the tag;
    const iCallId = res.locals.tag.iCallId;
    if (req.body.eventType === 'timeout'){
      debug(`Timeout event from callId: ${req.body.callId}`);
      sendCallToVoiceMail(iCallId, res.locals.baseUrl);
    }
    //In the rare case that the call was answered and hung up before we play a gather
    else if (event.eventType === 'hangup') {
      const callEvents = await bwAPI.Call.getEvents(event.callId);
      const hasAnswer = callEvents.some(ev => ev.name === 'answer')
      if (hasAnswer) {
        sendCallToVoiceMail(iCallId, res.locals.baseUrl);
      }
    }
    next(); // we're done with the timeout case
    return;
  }
  catch (e) {
    debug('Error happened during the outbound call answer handling');
    next(e);
  }
}

module.exports.updateUrlToGather = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    next();
    return;
  }
  try {
    const callbackUrl = urlJoin(res.locals.baseUrl, 'gather-flow');
    await bwAPI.Call.update(event.callId, {callbackUrl});
    next();
  }
  catch (e) {
    debug(`Error happened updating callback url: ${req.body.callId}`);
    next(e);
  }

}

module.exports.createGather = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    next();
    return;
  }
  try {
    const gatherData = {
      maxDigits : 1,
      tag       : JSON.stringify(res.locals.tag), //Pass the tag to the gather
      prompt    : {
        sentence : "Please press 1 to accept the call, or 2 to send to voicemail"
      }
    };
    const gather = await bwAPI.Call.createGather(req.body.callId, gatherData);
    console.log(`Created gather ${gather.id} on ${req.body.callId}`);
  }
  catch (e) {
    debug(`Error happened creating gather url: ${req.body.callId}`);
    next(e);
  }
};

// const hangerupper = async (callId) => {
//   try {
//     console.log('hangingup');
//     return await bwAPI.Call.hangup(callId);
//   }
//   catch (e) {
//     console.log('Error hanging up')
//     console.log(e);
//   }
// }

module.exports.determineGatherReason = async (req, res, next) => {
  res.locals.tag = JSON.parse(event.tag); //Parse the JSON from the tag
  if (req.body.eventType === 'hangup'){
    res.locals.hangup = true;
  }
  else if (req.body.reason !== 'max-digits' || req.body.digits !== '1') {
    res.locals.connectCall = false;
    res.locals.hangup = false;
  }
  else {
    res.locals.connectCall = true;
    res.locals.hangup = false;
  }
  next();
};

module.exports.shouldHangupOutboundCall = async (req, res, next) => {
  if (res.locals.connectCall || res.locals.hangup) {
    next();
    return;
  }
  try {
    if (req.body.reason !== 'hung-up') {
      await bwAPI.Call.hangup(req.body.callId); //hangup outbound call
    }
    next();
  }
  catch (e) {
    debug(`Error hanging up after gather: ${req.body.callId}`);
    next(e);
  }
};

module.exports.shouldSendtoVoicemail = async (req, res, next) => {
  if (res.locals.hangup) {
    next();
    return;
  }
  try {
    if (!res.locals.connectCall) {
      sendCallToVoiceMail(res.locals.tag.iCallId, res.locals.baseUrl);
    }
  }
  catch (e) {
    debug(`Error Sending call to voicemail: ${res.locals.tag.iCallId}`);
    next(e);
  }
};


module.exports.connectCalls = async (req, res, net) => {
  if (res.locals.hungup || !res.locals.connectCall) {
    next();
    return;
  }
  try {
    const tag = res.locals.tag;
    await bwAPI.Call.stopAudioFilePlayback(tag.iCallId);
    //accept the call
    await bwAPI.Bridge.update(tag.bridgeId, {
      bridgeAudio: true,
      callIds: [tag.iCallId, req.body.callId]
    });
    next();
  }
  catch (e) {
    debug(`Error happened during the gather flow: ${req.body.callId}`);
    next(e);
  }
};

module.exports.updateCallbackUrls = async (req, res, next) => {
  if (res.locals.hungup || !res.locals.connectCall) {
    next();
    return;
  }
  try {
    const callbackUrl = urlJoin(res.locals.baseUrl, 'hangup-flow');
    await bwAPI.Call.update(res.locals.tag.iCallId, {
      callbackUrl : callbackUrl,
      tag         : req.body.callId
    });
    await bwAPI.Call.update(req.body.callId, {
      callbackUrl : callbackUrl,
      tag         : res.locals.tag.iCallId
    });
  }
  catch (e) {
    debug(`Error updating callback urls: ${req.body.callId} & ${res.locals.tag.iCallId}`);
    next(e);
  }
};

app.post('/voicemail-flow', async (req, res) => {
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