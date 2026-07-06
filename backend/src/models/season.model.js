// models/season.model.js
module.exports = (sequelize, DataTypes) => {
  const Season = sequelize.define('Season', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING,  // URL k obrázku sezóny
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('official', 'community'),  // Typ sezóny: oficiálna alebo komunitná
      defaultValue: 'community',
    },
    mode: {
      type: DataTypes.ENUM('classic', 'standalone'),  // classic = sezóna s ligami; standalone = samostatná liga (turnaj)
      defaultValue: 'classic',
    },
    inviteCode: {
      type: DataTypes.STRING,  // Jedinečný kód na prihlásenie do sezóny
      allowNull: false,
      unique: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Dátumy trvania sezóny (určujú, či je aktívna)
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Ručné ukončenie — po ňom je sezóna uzamknutá (nedá sa nič meniť)
    ended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Heslo (hash) pre súkromnú custom sezónu — NIKDY plaintext
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hasPassword: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Skryť zo zoznamu sezón (pripojiť sa dá len cez ID + heslo)
    hidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    rules: {
      type: DataTypes.TEXT,  // Pravidlá sezóny
      allowNull: true,
    },
    // Ceny pre poradie — JSON pole [{ place: 1, prize: '200 €' }, …]
    prizes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Viditeľnosť blokov na detaile sezóny/turnaja
    showPrizes: { type: DataTypes.BOOLEAN, defaultValue: true },
    showRules: { type: DataTypes.BOOLEAN, defaultValue: true },
    showNews: { type: DataTypes.BOOLEAN, defaultValue: true },
    creatorId: {
      type: DataTypes.INTEGER,  // Odkaz na používateľa, ktorý vytvoril sezónu
      allowNull: false,
    },
    participantLimit: {
      type: DataTypes.INTEGER,  // Limit počtu účastníkov v sezóne
      allowNull: true,         // null znamená neobmedzený počet
      defaultValue: 100,       // Predvolená hodnota pre komunitné sezóny
    },
  }, {
    tableName: 'seasons',
    timestamps: true,
  });


  const UserSeason = sequelize.define('UserSeason', {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    seasonId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: 'Seasons',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.ENUM('player', 'admin'),
      defaultValue: 'player'
    },
    joinedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_seasons',
    timestamps: true,
    // Add this to correctly set up the composite primary key
    uniqueKeys: {
      user_season_unique: {
        fields: ['userId', 'seasonId']
      }
    }
  });
  
  Season.associate = function(models) {
    // Sezóna patrí používateľovi, ktorý ju vytvoril
    Season.belongsTo(models.User, {
      foreignKey: 'creatorId',
      as: 'creator',
    });
    
    // Sezóna môže mať viacero používateľov (hráčov)
    Season.belongsToMany(models.User, {
      through: models.UserSeason,
      foreignKey: 'seasonId',
      otherKey: 'userId',          // OBA kľúče zloženého vzťahu (inak zlý PK)
      as: 'participants',
    });
    
    // Sezóna môže mať viacero líg
    Season.hasMany(models.League, {
      foreignKey: 'seasonId',
    });
  };

  return Season;
};