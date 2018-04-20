const debug = require('debug')('masked-numbers');
const Phone = require('phone');
let db = {};

const arraysEqual = (arr1, arr2) => {
  arr1.sort();
  arr2.sort();
  return _.isEqual(arr1, arr2);
};

module.exports.addBindingToContext = (req, res, next) => {
  res.locals.Binding = req.app.get('models').Binding;
  next();
};

module.exports.saveBinding = (req, res, next) => {
  try {
    debug('Saving new Binding');
    const numbers = req.body.numbers;
    const binding = req.app.get('models').Binding.create({
      bandwidthNumber: res.locals.newNumber.number,
      forwardToNumber: req.body.phoneNumber
    });
    const resBody = {
      bandwidthNumber: res.locals.newNumber.number,
      forwardToNumber: req.body.phoneNumber
    };
    res.status('201').send(resBody);
  }
  catch (e) {
    debug('Error saving number to the database');
    debug(e);
    const err = new Error('Couldn\'t save to database');
    err.status = 500;
    next(err);
  }
};

const fetchBindingFromDB = async (bandwidthNumber, table) => {
  try {
    const binding = await table.find({
      where: {bandwidthNumber}
    });
    if (binding) {
      return binding;
    }
    else {
      debug(`Unknown call to ${bandwidthNumber}`);
      const err = new Error('Couldn\'t find masked number in database');
      throw(err);
    }
  }
  catch (e) {
    debug(`Error finding phone number: ${bandwidthNumber} in db`);
    throw(e);
  }
};

const fetchScreenedNumberFromDB = async (iNumber, BindingId, table) => {
  try {
    const sNumber = await table.find({
      where: {
        numberToScreen: iNumber,
        enabled: true,
        BindingId: BindingId
      }
    });
    if (sNumber) {
      return sNumber;
    }
    else {
      debug(`Number ${iNumber} not found in numberToScreen`);
      return false;
    }
  }
  catch (e) {
    debug(`Error finding phone number: ${bandwidthNumber} in db`);
    throw(e);
  }
}

module.exports.addNumberToScreen = async (req, res, next) => {
  if (req.body.eventType !== 'gather' || req.body.reason !== 'max-digits') {
    next();
    return;
  }
  if (req.body.digits != '3') {
    debug(`Not adding to screen user pressed: ${req.body.digits}`);
    next();
    return;
  }
  try {
    const numberToScreen = res.locals.iCall.from;
    const bandwidthNumber = res.locals.iCall.to;
    const ScreenedNumber = req.app.get('models').ScreenedNumber;
    const table = req.app.get('models').Binding;
    const binding = await fetchBindingFromDB(bandwidthNumber, table);
    const newScreen = await ScreenedNumber.findOrCreate({
      where: {
        numberToScreen: numberToScreen,
        BindingId: binding.id,
      }
    });
    if (newScreen[1] === false) {
      debug(`Screen already exists for: ${numberToScreen}`);
      await ScreenedNumber.update(
        {enabled: true}, { where : {id: newScreen[0].id}});
    }
    next();
    return;
  }
  catch (e) {
    debug(`Error saving number ${res.locals.iCall.from} to screen list`);
    next(e);
  }
};

module.exports.findNumbersFromRecording = async (req, res, next) => {
  if (req.body.eventType !== 'recording' && req.body.status !== 'complete') {
    next();
    return;
  }
  try {
    const bandwidthNumber = res.locals.bandwidthNumber;
    const table = req.app.get('models').Binding;
    const binding = await fetchBindingFromDB(bandwidthNumber, table);
    res.locals.forwardToNumber = binding.forwardToNumber;
    next();
  }
  catch (e) {
    debug(`Couldn't fetch number: ${res.locals.phoneNumber} from DB`);
    next(e);
  }
}

module.exports.findNumbersFromAnswer = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    next();
    return;
  }
  try {
    debug('Finding number bindings');
    const bandwidthNumber = req.body.to;
    const table = req.app.get('models').Binding;
    const binding = await fetchBindingFromDB(bandwidthNumber, table);
    res.locals.forwardToNumber = binding.forwardToNumber;
    res.locals.bindingId = binding.id;
    next();
  }
  catch (e) {
    debug('Error fetching number from the database');
    next(e);
  }
};

module.exports.searchScreenedNumbers = async (req, res, next) => {
  if (req.body.eventType !== 'answer') {
    next();
    return;
  }
  try {
    const iNumber = req.body.from;
    const bindingId = res.locals.bindingId;
    const table = req.app.get('models').ScreenedNumber;
    debug(`Search screened db for ${iNumber}`);
    const sNumber = await fetchScreenedNumberFromDB(iNumber, bindingId, table);
    if (sNumber) {
      res.locals.screenCall = true;
    }
    next();
  }
  catch (e) {
    debug('Error searching ScreenedNumber database');
    next(e);
  }
}

module.exports.listBindings = (req, res, next) => {
  debug('Returning Bindings');
  req.app.get('models').Binding.findAll()
  .then( (bindings) => {
    res.status(200).send(bindings);
  })
  .catch( (reason) => {
    debug(reason);
    let err = new Error('Couldn\'t fetch from database');
    next(err);
  });
}