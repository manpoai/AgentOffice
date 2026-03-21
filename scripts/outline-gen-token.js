// Generate an Outline transfer token for admin@asuite.local
// Transfer tokens are single-use, short-lived (1 min), used by /auth/redirect
// which exchanges them for a proper session cookie.
// Must be run inside the Outline container where models + encrypted vault are available
process.env.URL = process.env.URL || "http://localhost:3000";
const db = require("/opt/outline/build/server/storage/database");
db.sequelize.authenticate().then(async () => {
  const models = require("/opt/outline/build/server/models");
  const user = await models.User.findOne({
    where: { email: "admin@asuite.local" },
    include: [{ model: models.Team, as: "team", required: true }]
  });
  if (!user) { process.stderr.write("User not found\n"); process.exit(1); }
  const token = user.getTransferToken();
  process.stdout.write(token);
  process.exit(0);
}).catch(e => { process.stderr.write(e.message + "\n"); process.exit(1); });
