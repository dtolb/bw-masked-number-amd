const connectionUrl = process.env.DATABASE_URL;

if (!connectionUrl) {
  throw new Error('Invalid or non-existing DATABASE_URL connection url');
}

const Sequelize = require('sequelize');

// initialize database connection
let sequelize = new Sequelize(connectionUrl);

// load models
const models = [
  'Binding'
];

models.forEach(function (model) {
  module.exports[model] = sequelize.import(__dirname + '/' + model);
});

// export connection
module.exports.sequelize = sequelize;