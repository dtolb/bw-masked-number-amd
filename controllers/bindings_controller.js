const debug = require('debug')('masked-numbers');
const Phone = require('phone');

module.exports.validateMessage = (req, res, next) => {
  if (!req.body.phoneNumber) {
    var err = new Error('No phone number sent in request');
    err.status = 400;
    next(err);
    return;
  }
  if (!req.body.areaCode) {
    var err = new Error('No area code sent in request');
    err.status = 400;
    next(err);
    return;
  }
  const e164 = Phone(req.body.phoneNumber, 'USA');
  if (e164.length === 0) {
    var err = new Error('PhoneNumber is malformed, should be like +18284446666');
    err.status = 400;
    next(err);
    return;
  }
  //Consistency
  req.body.phoneNumber = e164[0];
  next();
};