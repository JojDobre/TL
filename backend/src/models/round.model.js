// models/round.model.js
module.exports = (sequelize, DataTypes) => {
    const Round = sequelize.define('Round', {
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
      leagueId: {
        type: DataTypes.INTEGER,  // Odkaz na ligu, do ktorej kolo patrí
        allowNull: false,
      },
      startDate: {
        type: DataTypes.DATE,  // Dátum a čas začiatku tipovania
        allowNull: false,
      },
      endDate: {
        type: DataTypes.DATE,  // Dátum a čas konca tipovania
        allowNull: false,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      // Ak je toto kolo v KLONOVANEJ lige, odkaz na zdrojové kolo v šablóne.
      // Umožňuje propagovať zmenu termínov kola (a časov jeho zápasov) zo
      // šablóny do všetkých klonov — správca klonu ich upravovať nemôže.
      sourceRoundId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      // --- príznaky pre plánovač notifikácií (utils/scheduler.js) ---
      // Zabraňujú opakovanému odoslaniu tej istej notifikácie pri každom behu.
      // NULL = ešte neodoslané.
      startNotifiedAt: {
        type: DataTypes.DATE,      // kolo sa otvorilo na tipovanie
        allowNull: true,
      },
      deadlineNotifiedAt: {
        type: DataTypes.DATE,      // pripomienka pred uzávierkou
        allowNull: true,
      },
      adminUnevaluatedNotifiedAt: {
        type: DataTypes.DATE,      // upozornenie adminom, že kolo nie je vyhodnotené
        allowNull: true,
      },
    }, {
      tableName: 'rounds',
      timestamps: true,
    });
  
    Round.associate = function(models) {
      // Kolo patrí do ligy
      Round.belongsTo(models.League, {
        foreignKey: 'leagueId',
      });
      
      // Kolo môže mať viacero zápasov
      Round.hasMany(models.Match, {
        foreignKey: 'roundId',
      });
    };
  
    return Round;
  };