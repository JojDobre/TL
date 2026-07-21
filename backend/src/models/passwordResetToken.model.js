// backend/src/models/passwordResetToken.model.js
//
// Model pre jednorazové tokeny na obnovu hesla (forgot-password flow).
// Do databázy NIKDY neukladáme samotný token, ale len jeho SHA-256 hash —
// keby niekto získal prístup k DB, z hashu sa pôvodný token nedá spätne zložiť.
// Pôvodný (surový) token putuje len v e-mailovom odkaze k používateľovi.
//
// POZNÁMKA K INDEXOM:
// Indexy NEDEFINUJEME v samostatnom poli `indexes:`, ale priamo na stĺpci.
// Dôvod: Sequelize pri alter-sync na MariaDB spúšťa pre `indexes:` samostatný
// príkaz `ALTER TABLE ... ADD INDEX (...)`, ktorý môže zbehnúť skôr, než
// existuje samotný stĺpec → chyba 1072 "Key column 'tokenHash' doesn't exist".
// Pri definícii na stĺpci sa index vytvorí spolu so stĺpcom a problém nevzniká.
module.exports = (sequelize, DataTypes) => {
  const PasswordResetToken = sequelize.define('PasswordResetToken', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // ID používateľa, ktorému token patrí (FK na users).
    // index: true → vytvorí sa index spolu so stĺpcom.
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      index: true,
    },
    // SHA-256 hash surového tokenu (hex, 64 znakov). Hľadáme podľa neho.
    // POZOR: unique má POMENOVANÝ index (string, nie true) — inak Sequelize
    // pri každom alter-sync pridá nový unikátny index (token_hash, token_hash_2…)
    // až po strop 64 → ER_TOO_MANY_KEYS. Pomenovaný index sa znovupoužije.
    // Index je stále definovaný na stĺpci (nie v `indexes:`), takže sa vytvorí
    // spolu so stĺpcom a nehrozí chyba 1072 (viď poznámka vyššie).
    tokenHash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'password_reset_tokens_token_hash_unique',
    },
    // Čas, dokedy je token platný. Po ňom sa považuje za neplatný.
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Príznak, či už bol token použitý (po úspešnej zmene hesla ho zneplatníme,
    // aby sa ten istý odkaz nedal použiť druhýkrát).
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'password_reset_tokens',
    timestamps: true, // createdAt / updatedAt
    // Žiadne `indexes:` pole — viď poznámku vyššie.
  });

  // Asociácia: token patrí jednému používateľovi.
  PasswordResetToken.associate = function (models) {
    PasswordResetToken.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE', // keď sa zmaže user, zmažú sa aj jeho reset tokeny
    });
  };

  return PasswordResetToken;
};