// models/league.model.js
module.exports = (sequelize, DataTypes) => {
    const League = sequelize.define('League', {
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
        type: DataTypes.STRING,  // URL k obrázku ligy
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('official', 'custom'),  // Typ ligy: oficiálna alebo vlastná
        defaultValue: 'custom',
      },
      // 6-miestny kód na pripojenie do ligy (zobrazuje sa hráčom ako "ID ligy")
      joinCode: {
        type: DataTypes.STRING(6),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,  // Hash hesla pre ligu (voliteľné) — NIKDY plaintext
        allowNull: true,
      },
      // Príznak, či je liga chránená heslom (aby sme klientovi nemuseli posielať hash)
      hasPassword: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      seasonId: {
        type: DataTypes.INTEGER,  // Odkaz na sezónu, do ktorej liga patrí
        allowNull: false,
      },
      // Kto ligu vytvoril (pre limity a oprávnenia)
      creatorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      // Liga ukončená vlastným rozhodnutím správcu (nezávisle od stavu sezóny).
      // Ukončená liga = uzamknutá: žiadne nové kolá/zápasy/tipy/vyhodnotenia.
      ended: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      scoringSystem: {
        type: DataTypes.JSON,  // JSON s pravidlami bodovania
        allowNull: true,
        defaultValue: {  // Predvolený bodovací systém
          exactScore: 10,  // Presný výsledok
          correctGoals: 1,  // Správny počet gólov jedného tímu
          correctWinner: 3,  // Správny víťaz/remíza
          goalDifference: 2,  // Správny gólový rozdiel
        },
      },
      scoringLocked: {
        type: DataTypes.BOOLEAN,  // Či je bodovací systém uzamknutý (po začiatku prvého kola)
        defaultValue: false,
      },
      // Šablóna: oficiálna liga, ktorú si používatelia môžu naklonovať
      isTemplate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Šablóna: okno dostupnosti pri tvorbe ligy (nullable = bez obmedzenia).
      availableFrom: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      availableTo: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Ak je táto liga KLON šablóny, odkaz na zdrojovú (oficiálnu) ligu
      templateId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    }, {
      tableName: 'leagues',
      timestamps: true,
    });

    League.associate = function(models) {
      // Liga patrí do sezóny
      League.belongsTo(models.Season, {
        foreignKey: 'seasonId',
      });

      // Liga môže mať viacero kôl
      League.hasMany(models.Round, {
        foreignKey: 'leagueId',
      });

      // Tvorca ligy
      League.belongsTo(models.User, {
        foreignKey: 'creatorId',
        as: 'creator',
      });

      // Členovia ligy (cez UserLeague). otherKey + foreignKey: aby Sequelize
      // poznal OBA kľúče zloženého vzťahu a nevytvoril PK len z jedného.
      League.belongsToMany(models.User, {
        through: models.UserLeague,
        foreignKey: 'leagueId',
        otherKey: 'userId',
        as: 'members',
      });

      // Súpiska tímov ligy (z nich sa tvoria zápasy)
      League.belongsToMany(models.Team, {
        through: models.LeagueTeam,
        foreignKey: 'leagueId',
        otherKey: 'teamId',
        as: 'teams',
      });
    };

    return League;
  };