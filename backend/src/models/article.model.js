// backend/src/models/article.model.js
//
// Model blogového článku. Polia sú navrhnuté tak, aby pokryli všetko, čo zobrazuje
// šablóna blog.html (featured článok, karty, kategórie, emoji cover + gradient,
// čas čítania) aj blog-post.html (perex, markdown obsah, autor).

module.exports = (sequelize, DataTypes) => {
  const Article = sequelize.define('Article', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,   // Nadpis článku
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,   // URL-friendly identifikátor pre /blog/:slug
      allowNull: false,
      unique: true,
    },
    excerpt: {
      type: DataTypes.TEXT,     // Perex / krátky popis (zobrazuje sa na kartách v zozname)
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,     // Telo článku v Markdown formáte
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,   // Kategória: Stratégia, Novinky, Rozhovory, Návody
      allowNull: false,
      defaultValue: 'Novinky',
    },
    // Emoji slúžiace ako "cover" obrázok karty/hero (šablóna používa emoji, nie fotky)
    coverEmoji: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: '📝',
    },
    // CSS gradient pozadia covera (presne v tvare ako v šablóne, napr.
    // "linear-gradient(135deg,#0a3d2e,#15543a)"). Umožňuje 1:1 vzhľad kariet.
    coverGradient: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'linear-gradient(135deg,#2b0a4a,#5b3fd6 60%,#0b4ea2)',
    },
    // Odhadovaný čas čítania v minútach (zobrazuje sa v meta riadku)
    readMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 3,
    },
    // Označený ako hlavný (featured) článok — zobrazí sa veľký navrchu zoznamu
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Publikovaný = viditeľný verejne. Nepublikovaný = koncept (vidí len admin).
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Autor článku (odkaz na používateľa)
    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'articles',
    timestamps: true,  // createdAt slúži ako dátum publikovania
  });

  Article.associate = function (models) {
    // Článok patrí autorovi (používateľovi)
    Article.belongsTo(models.User, {
      foreignKey: 'authorId',
      as: 'author',
    });
  };

  return Article;
};
