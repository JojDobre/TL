// models/user.model.js
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,           // Typ stlpca - celé číslo
        primaryKey: true,                  // Označenie ako primárny kľúč
        autoIncrement: true,               // Automatické zvyšovanie hodnoty
      },
      username: {
        type: DataTypes.STRING,            // Typ stlpca - reťazec
        allowNull: false,                  // Hodnota nesmie byť null
        // unique rieši pomenovaný index nižšie (users_username_unique),
        // aby ho alter-sync neduplikoval pri každom štarte.
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: true,                   // Validácia, že hodnota je platný email
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true,                   // Hodnota môže byť null
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profileImage: {
        type: DataTypes.STRING,            // URL k profilovému obrázku
        allowNull: true,
      },
      // Interný príznak simulovaného hráča (bot). Vo frontende sa nezobrazuje —
      // slúži na správu: hromadné pozastavenie, vyfiltrovanie alebo odstránenie
      // botov, keď platformu prevezme reálna komunita.
      isBot: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      bio: {
        type: DataTypes.TEXT,              // Typ stlpca - dlhší text
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('admin', 'vip', 'player'), // Enumerácia povolených hodnôt
        defaultValue: 'player',            // Predvolená hodnota
      },
      active: {
        type: DataTypes.BOOLEAN,           // Typ stlpca - boolean
        defaultValue: true,                // Predvolená hodnota
      },
      // Preferencie nastavení (/settings)
      notifyInApp: {
        type: DataTypes.BOOLEAN,           // Dostávať notifikácie v aplikácii
        defaultValue: true,
      },
      profilePublic: {
        type: DataTypes.BOOLEAN,           // Verejný profil (vidia ho ostatní cez rebríček)
        defaultValue: true,
      },
      allowCompare: {
        type: DataTypes.BOOLEAN,           // Povoliť porovnávanie s inými hráčmi
        defaultValue: true,
      },
    }, {
      tableName: 'users',                  // Explicitné nastavenie názvu tabuľky v databáze
      timestamps: true,                    // Automatické pridanie stĺpcov createdAt a updatedAt
      indexes: [
        // Pomenované unikátne indexy: majú stabilné meno, takže ich
        // sequelize.sync({alter}) nájde a nevytvára stále nové kópie
        // (username_2, username_3, …) → nehrozí ER_TOO_MANY_KEYS.
        { name: 'users_username_unique', unique: true, fields: ['username'] },
        { name: 'users_email_unique', unique: true, fields: ['email'] },
      ],
    });
  
    // Definícia asociácií (vzťahov) sa doplní neskôr
    User.associate = function(models) {
      // User môže vytvoriť viacero sezón
      User.hasMany(models.Season, {
        foreignKey: 'creatorId',
        as: 'createdSeasons',
      });
      
      // User môže byť členom viacerých sezón.
      // through MUSÍ byť explicitný model (models.UserSeason → tabuľka user_seasons),
      // nie reťazec 'UserSeasons' — ten by vytvoril druhú, neželanú through-tabuľku.
      User.belongsToMany(models.Season, {
        through: models.UserSeason,
        foreignKey: 'userId',
        otherKey: 'seasonId',
        as: 'participatedSeasons',
      });
      
      // User môže mať viacero tipov
      User.hasMany(models.Tip, {
        foreignKey: 'userId',
      });
      
      // User môže mať viacero notifikácií
      User.hasMany(models.Notification, {
        foreignKey: 'userId',
      });

      // POZN.: M:N väzbu User ↔ Achievement (through models.UserAchievement,
      // as: 'achievements') definuje user-achievement.model.js. Tu ju zámerne
      // NEDEFINUJEME znova cez reťazec 'UserAchievements' — vznikla by druhá,
      // neželaná through-tabuľka a duplicitné aliasy.
    };
  
    return User;
  };