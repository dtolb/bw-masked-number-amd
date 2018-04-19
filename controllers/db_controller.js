const debug = require('debug')('masked-numbers');
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
      maskedNumber: newNumber,
      numbers: numbers
    };
    res.status('201').send(resBody);
  }
  catch (e) => {
    debug('Error saving number to the database');
    debug(e);
    const err = new Error('Couldn\'t save to database');
    err.status = 500;
    next(err);
  }
};

module.exports.findNumbers = async (req, res, next) => {
  try {
    debug('Finding number bindings');
    const bandwidthNumber = req.body.to;
    const binding = await res.locals.Binding.find({
      where: {bandwidthNumber}
    });
    if (binding) {
      res.locals.forwardToNumber = binding.forwardToNumber;
      next();
    }
    else {
      debug(`Unknown call to ${bandwidthNumber}`);
      const err = new Error('Couldn\'t find masked number in database');
      next(err);
    }
  }
  catch (e) {
    debug('Error fetching number from the database');
    next(e);
  }
};

module.exports.listBindings = (req, res, next) => {
  debug('Returning Bindings');
  req.Binding.findAll()
  .then( (bindings) => {
    res.status(200).send(bindings);
  })
  .catch( (reason) => {
    debug(reason);
    let err = new Error('Couldn\'t fetch from database');
    next(err);
  });
}