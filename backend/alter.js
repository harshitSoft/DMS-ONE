const { sequelize } = require('./src/models');

async function run() {
  try {
    await sequelize.query('ALTER TABLE admin_internal_messages ADD COLUMN "attachmentUrl" VARCHAR(255)');
  } catch(e) { console.log(e.message) }
  try {
    await sequelize.query('ALTER TABLE admin_internal_messages ADD COLUMN "attachmentName" VARCHAR(255)');
  } catch(e) { console.log(e.message) }
  try {
    await sequelize.query('ALTER TABLE admin_internal_messages ADD COLUMN "isEdited" BOOLEAN NOT NULL DEFAULT false');
  } catch(e) { console.log(e.message) }
  
  console.log('done');
  process.exit(0);
}

run();
