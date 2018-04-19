const debug = require('debug')('masked-numbers');
const urlJoin = require('url-join');
const Bandwidth = require('node-bandwidth');
const app = require('../index.js')

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
};

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
      callbackUrl : urlJoin(res.locals.baseUrl, 'outbound-call-event'),
      bridgeId    : res.locals.bridgeId,
    };
    callData.tag = JSON.stringify({
      iCallId  : req.body.callId,
      bridgeId : res.locals.bridgeId
    });
    const newCall = await bwAPI.Call.create(callData);
    debug(`Created call ${newCall.id}`);
    res.locals.newCall = newCall;
    next();
  }
  catch (e) {
    debug(`Error when trying to create outbound call`);
    next(e);
  }
};

module.exports.setHangupPathWhileScreening = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    //ignore incoming call event and others
    return;
  }
  try {
    const callbackUrl = urlJoin(res.locals.baseUrl, 'hangup-flow');
    await bwAPI.Call.update(req.body.callId, {
      tag: res.locals.newCall.id,
      callbackUrl: callbackUrl
    });
  }
  catch (e) {
    debug(`Error updating the call for hangup during screen: ${req.body.callId}`);
    next(e);
  }
}
const sendCallToVoiceMail = async (callId, baseUrl) => {
  try {
    await bwAPI.Call.stopAudioFilePlayback(callId);
    //update the callback url to make life easier
    const callbackUrl = urlJoin(baseUrl, 'voicemail-flow');
    await bwAPI.Call.update(callId, {callbackUrl});
    //Start the voicemail prompt
    const vmPrompt = 'Please record your voicemail after the beep.';
    await bwAPI.Call.speakSentence(callId, vmPrompt);
  }
  catch (e) {
    debug(`Error sending call to voicemail: ${callId}`);
    throw(e);
  }
};



module.exports.handleOutboundCallEvent = async (req, res, next) => {
  try {
    const event = req.body;
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
};

module.exports.updateUrlToGather = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    next();
    return;
  }
  const event = req.body;
  try {
    const callbackUrl = urlJoin(res.locals.baseUrl, 'gather-flow');
    await bwAPI.Call.update(event.callId, {callbackUrl});
    next();
  }
  catch (e) {
    debug(`Error happened updating callback url: ${req.body.callId}`);
    next(e);
  }
};

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
    debug(`Created gather ${gather.id} on ${req.body.callId}`);
    next();
  }
  catch (e) {
    debug(`Error happened creating gather url: ${req.body.callId}`);
    next(e);
  }
};

module.exports.handleGather = async (req, res, next) => {
  try {
    const event = req.body;
    debug(event);
    const tag = JSON.parse(event.tag); //Parse the JSON from the tag
    const iCallId = tag.iCallId;
    res.locals.tag = tag;
    if (event.eventType === 'hangup') {
      res.locals.sentCallToVoicemail = true;
      next();
      return;
    }
    // The catch all case
    if (event.reason !== 'max-digits' || event.digits !== '1') {
      if (event.reason !== 'hung-up') {
        await bwAPI.Call.hangup(event.callId); //hangup outbound call
      }
      await sendCallToVoiceMail(iCallId, res.locals.baseUrl);
      res.locals.sentCallToVoicemail = true;
      next();
      return;
    }
    next();
  }
  catch (e) {
    debug(`Error occured handling gather event ${req.body.callId}`);
    next(e);
  }
};

module.exports.connectCalls = async (req, res, next) => {
  if(res.locals.sentCallToVoicemail) {
    next();
    return;
  }
  try {
    const event = req.body;
    const tag = JSON.parse(event.tag); //Parse the JSON from the tag
    const iCallId = tag.iCallId;
    await bwAPI.Call.stopAudioFilePlayback(iCallId);
    await bwAPI.Bridge.update(tag.bridgeId, {
      bridgeAudio: true,
      callIds: [iCallId, event.callId]
    });
    next();
    return;
  }
  catch (e) {
    debug(`Error happened trying to connect the calls: ${req.body.callId}`);
    next(e);
  }
}

module.exports.updateCallbackUrls = async (req, res, next) => {
  if(res.locals.sentCallToVoicemail) {
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

module.exports.voicemailFlow = async (req, res, next) => {
  try {
    const event = req.body;
    if (event.eventType === 'speak' && event.state === 'PLAYBACK_STOP'){
      // Speaking is finished, so play the beep
      await bwAPI.Call.playAudioFile(event.callId, "https://s3.amazonaws.com/bw-demo/beep.mp3");
    }
    else if (event.eventType === 'playback' && event.status === 'done' && event.tag !== 'ringing') {
      // The beep.mp3 is done playing, so enable recording;
      await bwAPI.Call.enableRecording(event.callId);
    }
    else if (event.eventType === 'hangup') {
      // The call hungup
      const recordings = await bwAPI.Call.getRecordings(event.callId);
      debug(recordings);
    }
  }
  catch (e) {
    debug(`Error happened in the voicemail flow: ${req.body.callId}`);
    next(e);
  }
};

module.exports.hangupFlow = async (req, res, next) => {
  try {
    const event = req.body;
    const call = bwAPI.Call.get(event.tag);
    if (call.state !== 'completed' || call.state !== 'rejected') {
      await bwAPI.Call.hangup(event.tag);
    }
  }
  catch (e) {
    debug(`Error hanging up call: ${req.body.tag}`);
    next(e);
  }
};

module.exports.searchAndOrderNumber = async (req, res, next) => {
  try {
    const areaCode = req.body.areaCode;
    const numberName = req.body.phoneNumber;
    const numbers = await bwAPI.AvailableNumber.searchAndOrder('local', {
      areaCode : areaCode,
      quantity : 1
    })
    // Make number name the two numbers binded
    res.locals.newNumber = numbers[0];
    debug(`Found New Number: ${res.locals.newNumber.number} for: ${numberName}`);
    next();
  }
  catch (e) {
    debug(`Error searching for phone number`);
    next(e);
  };
}

module.exports.updateNumberToApplication = async (req, res, next) => {
  try {
    debug(`Updating Number to application: ${req.app.applicationId}`);
    await bwAPI.PhoneNumber.update(res.locals.newNumber.id, {
      name: req.body.phoneNumber.toString(),
      applicationId: req.app.applicationId
    });
    next();
  }
  catch (e) {
    debug(`Error assigning application to numberId: ${res.locals.numberId}`);
    next(e);
  }
}


/**
 * Below here is setup logic. This is only run once per instance of this application
 * The main use of the logic below is for one click deployments. Most likely,
 * you would NOT need this in a production envirnonment.
 *
 * This handles the oddness of heroku sleep and not knowing the heroku url until
 * deploying.
 */

//Checks the current Applications to see if we have one.
module.exports.checkOrCreateApplication = (req, res, next) => {
  if (app.applicationId) {
    next();
    return;
  }
  app.callbackUrl = getBaseUrlFromReq(req);
  const appName = `${req.app.rootName} on ${req.app.callbackUrl}`;
  debug('appName: ' + appName);
  bwAPI.Application.list({
    size: 1000
  })
  .then( (apps) => {
    const appId = searchForApplication(apps.applications, appName);
    if(appId !== false) {
      debug('Application Found: ' + appId);
      app.applicationId = appId;
      next();
    }
    else {
      debug('No Application Found');
      newApplication(appName, app.callbackUrl)
      .then( (application) => {
        debug('Created Application: ' + application.id);
        app.applicationId = application.id;
        next();
      });
    }
  })
  .catch( (reason) => {
    debug(reason);
    next(reason);
  });
};

// Searches for applicatoin by name
const searchForApplication = (applications, name) => {
  for (var i = 0; i < applications.length; i+=1) {
      if ( applications[i].name === name) {
        return applications[i].id;
      }
    }
  return false;
};

// Creates a new application with callbacks set to this server
const newApplication = (appName, url) => {
  return bwAPI.Application.create({
    name: appName,
    incomingMessageUrl: url + '/bandwidth/messages',
    incomingCallUrl: url + '/bandwidth/incoming-call',
    callbackHttpMethod: 'post',
    autoAnswer: true
  });
};

const getBaseUrlFromReq = (req) => {
  return 'http://' + req.hostname;
};
