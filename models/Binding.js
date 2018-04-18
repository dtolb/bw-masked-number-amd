module.exports = function (sequelize, DataTypes) {
  return sequelize.define('Binding', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    bandwidthNumber: {
      type: DataTypes.STRING,
      field: 'bandwidth_number',
      allowNull: false
    },
    forwardToNumber: {
      type: DataTypes.STRING,
      field: 'forward_to_number',
      allowNull: false
    }
  });
};