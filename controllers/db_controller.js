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

module.exports.checkIfBindingExists = (req, res, next) => {
  const Binding = req.app.get('models').Binding;
  const numbers = req.body.numbers;
  let numbersAlreadyBound = false;
  Binding.findOne({
    where: {
      $or: [
        {
          $and: {
            numberOne: numbers[0],
            numberTwo: numbers[1]
          }
        },
        {
          $and: {
            numberOne: numbers[1],
            numberTwo: numbers[0]
          }
        }
      ]
    }
  })
  .then( (binding) => {
    if (binding) {
      numbersAlreadyBound = true;
      const errMessage = 'Numbers: ' + req.body.numbers[0] + ' and ' +
        req.body.numbers[1] + ' are already bound to: ' + binding.maskedNumber;
      debug(errMessage);
      let err = new Error(errMessage);
      err.status = 409;
      next(err);
    }
    else {
      debug('Numbers: ' + req.body.numbers[0] + ' and ' + req.body.numbers[1] +
        ' are not bound');
      next();
    }
  });
};

module.exports.saveBinding = (req, res, next) => {
  debug('Saving new Binding');
  const newNumber = req.newNumber;
  const numbers = req.body.numbers;
  Binding.create({
    maskedNumber: req.newNumber,
    numberOne: req.body.numbers[0],
    numberTwo: req.body.numbers[1]
  })
  .then( (binding) => {
    debug('New binding saved as: ' + newNumber);
    resBody = {
      maskedNumber: newNumber,
      numbers: numbers
    }
    res.status('201').send(resBody);
  })
  .catch( (reason) => {
    debug(reason);
    const err = new Error('Couldn\'t save to database');
    err.status = 500;
    next(err);
  });

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