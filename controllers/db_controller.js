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
}

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

const fetchFromDB = async (bandwidthNumber, table) => {
  try {
    const binding = await table.find({
      where: {bandwidthNumber}
    });
    if (binding) {
      return binding.forwardToNumber;
    }
    else {
      debug(`Unknown call to ${bandwidthNumber}`);
      const err = new Error('Couldn\'t find masked number in database');
      throw(err);
    }
  }
  catch (e) {
    debug(`Error finding phone number: ${phoneNumber} in db`);
    throw(e);
  }
}

module.exports.findNumbersFromRecording = async (req, res, next) => {
  if (req.body.eventType !== 'recording' && req.body.status !== 'complete') {
    next();
    return;
  }
  try {
    const bandwidthNumber = res.locals.bandwidthNumber;
    const table = req.app.get('models').Binding;
    res.locals.forwardToNumber = await fetchFromDB(bandwidthNumber, table);
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
    res.locals.forwardToNumber = await fetchFromDB(bandwidthNumber, table);
    next();
  }
  catch (e) {
    debug('Error fetching number from the database');
    next(e);
  }
};

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