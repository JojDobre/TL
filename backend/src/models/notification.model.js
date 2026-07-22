// models/notification.model.js
//
// Notifikácia pre používateľa. Typy pokrývajú udalosti platformy. ENUM rozšírený
// oproti pôvodnej verzii o 'rank' (posun v rebríčku), 'member' (nový hráč v lige)
// a 'canceled' (zrušený zápas) — kvôli verným notifikáciám podľa šablóny.
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,  // Pre ktorého používateľa je notifikácia určená
      allowNull: false,
    },
    type: {
      // Typ notifikácie — riadi ikonu a farbu v UI.
      // Typ notifikácie — riadi ikonu a farbu v UI.
      // POZN.: pri pridaní nového typu treba spustiť DB_SYNC=alter, inak MariaDB
      // hodnotu odmietne ("Data truncated for column 'type'").
      //   new_round   – kolo sa OTVORILO na tipovanie (spúšťa scheduler)
      //   deadline    – blíži sa uzávierka a hráč nemá vyplnené všetky tipy
      //   result      – vyhodnotené zápasy / celé kolo
      //   season      – spustila sa oficiálna sezóna alebo pribudla oficiálna liga
      //   sysadmin    – prevádzková notifikácia pre webových adminov
      //   achievement – získaný odznak
      //   member      – nový hráč v lige
      //   canceled    – zrušený zápas
      //   admin, rank – zatiaľ nevyužité (ponechané kvôli starším záznamom)
      type: DataTypes.ENUM('new_round', 'deadline', 'result', 'achievement', 'admin', 'rank', 'member', 'canceled', 'season', 'sysadmin'),
      allowNull: false,
    },
    // Krátky nadpis (tučný riadok). Voliteľný — staršie záznamy ho nemusia mať.
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    message: {
      type: DataTypes.TEXT,  // Telo správy
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING,  // Kam notifikácia smeruje (CTA tlačidlo)
      allowNull: true,
    },
    read: {
      type: DataTypes.BOOLEAN,  // Či bola prečítaná
      defaultValue: false,
    },
  }, {
    tableName: 'notifications',
    timestamps: true,  // createdAt = čas vzniku (zoskupovanie podľa dní)
  });

  Notification.associate = function (models) {
    Notification.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Notification;
};
