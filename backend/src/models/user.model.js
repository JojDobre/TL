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
        unique: true,                      // Hodnota musí byť unikátna v rámci tabuľky
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
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
    }, {
      tableName: 'users',                  // Explicitné nastavenie názvu tabuľky v databáze
      timestamps: true,                    // Automatické pridanie stĺpcov createdAt a updatedAt
    });
  
    // Definícia asociácií (vzťahov) sa doplní neskôr
    User.associate = function(models) {
      // User môže vytvoriť viacero sezón
      User.hasMany(models.Season, {
        foreignKey: 'creatorId',
        as: 'createdSeasons',
      });
      
      // User môže byť členom viacerých sezón
      User.belongsToMany(models.Season, {
        through: 'UserSeasons',
        foreignKey: 'userId',
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
      
      // User môže mať viacero achievementov
      User.belongsToMany(models.Achievement, {
        through: 'UserAchievements',
        foreignKey: 'userId',
      });
    };
  
    return User;
  };