// const connectionUrl = process.env.DATABASE_URL;

// if (!connectionUrl) {
//   throw new Error('Invalid or non-existing DATABASE_URL connection url');
// }

// const Sequelize = require('sequelize');

// // initialize database connection
// const sequelize = new Sequelize(connectionUrl);

// // load models
// const models = [
//   'Binding',
//   'ScreenedNumber'
// ];

// models.forEach(function (model) {
//   module.exports[model] = sequelize.import(__dirname + '/' + model);
// });

// // export connection
// module.exports.sequelize = sequelize;

// ------
const db            = {};
const fs            = require('fs');
const path          = require('path');
const basename      = path.basename(__filename);
const connectionUrl = process.env.DATABASE_URL;
const Sequelize     = require('sequelize');


if (!connectionUrl) {
  throw new Error('Invalid or non-existing DATABASE_URL connection url');
}

const sequelize = new Sequelize(connectionUrl);


fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    var model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;