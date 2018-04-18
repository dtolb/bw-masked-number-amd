const express = require('express');
let router = module.exports = express.Router();
const bw = require('../controllers/bw_controller.js');
const db = require('../controllers/db_controller.js');
const debug = require('debug')('masked-numbers');

router.use('/',
           bw.callBackResponder,
           db.addBindingToContext
           );

router.route('/messages')
  .post(
    bw.validateMessage,
    db.findNumbers,
    bw.makeMessage,
    bw.sendMessage
    );

router.route('/incoming-call')
.post(db.findNumbers,
      bw.playRinging,
      bw.createBridge,
      bw.createOutboundCall,
      );

router.route('/outbound-call-event')
  .post();

router.route('/gather-flow')
    .post();

router.route('/voicemail-flow')
    .post();

router.route('/hangup-flow')
    .post();