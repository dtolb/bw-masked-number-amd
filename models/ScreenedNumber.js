module.exports = function (sequelize, DataTypes) {
  var ScreenedNumber = sequelize.define('ScreenedNumber', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    numberToScreen: {
      type: DataTypes.STRING,
      field: 'number_to_screen',
      allowNull: false
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      field: 'enabled',
      allowNull: false,
      defaultValue: true,
    }
  });

  ScreenedNumber.associate = function (models) {
    models.ScreenedNumber.belongsTo(models.Binding, {
      onDelete: "CASCADE",
      foreignKey: {
        allowNull: false
      }
    });
  }
  return ScreenedNumber;
};