const bcrypt = require('bcrypt');
const db = require('./src/models');

(async () => {
  const newPassword = 'user123';
  const hash = await bcrypt.hash(newPassword, 10);

  const user = await db.User.findOne({ where: { email: 'admin@example.com' } });
  if (!user) { console.log('Používateľ nenájdený'); process.exit(1); }

  user.password = hash;
  user.role = 'admin';
  await user.save();

  console.log('Heslo zmenené pre:', user.email);
  process.exit(0);
})();