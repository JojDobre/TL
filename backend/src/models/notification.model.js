// models/notification.model.js
module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.INTEGER,  // Odkaz na používateľa, pre ktorého je notifikácia určená
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM('new_round', 'deadline', 'result', 'achievement', 'admin'),  // Typ notifikácie
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,  // Správa notifikácie
        allowNull: false,
      },
      link: {
        type: DataTypes.STRING,  // Odkaz, kam notifikácia smeruje
        allowNull: true,
      },
      read: {
        type: DataTypes.BOOLEAN,  // Či bola notifikácia prečítaná
        defaultValue: false,
      },
    }, {
      tableName: 'notifications',
      timestamps: true,
    });
  
    Notification.associate = function(models) {
      // Notifikácia patrí používateľovi
      Notification.belongsTo(models.User, {
        foreignKey: 'userId',
      });
    };
  
    return Notification;
  };