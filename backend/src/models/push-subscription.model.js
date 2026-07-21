// models/push-subscription.model.js
//
// Web Push subscription (PushSubscription z prehliadača) uložená pre používateľa.
// Jeden používateľ môže mať viacero subscription (viac zariadení/prehliadačov).
// Deduplikácia podľa `endpoint` (pomenovaný unique index → alter-sync ho
// neduplikuje). Pri neplatnej subscription (410/404 z push služby) záznam mažeme
// v push.service.js.
module.exports = (sequelize, DataTypes) => {
  const PushSubscription = sequelize.define('PushSubscription', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    endpoint: {
      // Push endpointy sú URL, v praxi do ~500 znakov. STRING (nie TEXT), aby
      // sa dal jednoducho unikátne indexovať bez prefix-length (ktorý pri
      // alter-sync spôsoboval chybné poradie ADD COLUMN/ADD INDEX).
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    // p256dh a auth kľúče z PushSubscription.getKey() — potrebné na šifrovanie
    // payloadu (web-push si ich pýta v objekte keys).
    p256dh: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    auth: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Voliteľný user-agent kvôli diagnostike/správe zariadení.
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    tableName: 'push_subscriptions',
    timestamps: true,
    indexes: [
      // Pomenovaný unique index na endpoint (STRING(500), bez prefix-length →
      // pod MariaDB limitom indexu pri utf8mb4). Pomenovanie bráni tomu, aby
      // alter-sync vytváral duplikáty (endpoint_2, endpoint_3, …).
      // POZN.: index na userId zámerne NEdávame — Sequelize ho pri alter-sync
      // novej tabuľky pridáva samostatným ADD INDEX ešte pred tým, než MariaDB
      // "vidí" stĺpec, čo hádže ER_KEY_COLUMN_DOES_NOT_EXIST. Pri očakávaných
      // objemoch nie je potrebný; v prípade rastu sa pridá ručnou migráciou.
      { name: 'push_subscriptions_endpoint_unique', unique: true, fields: ['endpoint'] },
    ],
  });

  PushSubscription.associate = function (models) {
    PushSubscription.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return PushSubscription;
};
