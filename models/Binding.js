module.exports = function (sequelize, DataTypes) {
  var Binding = sequelize.define('Binding', {
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

  Binding.associate = function (models) {
    models.Binding.hasMany(models.ScreenedNumber);
  };
  return Binding;
};