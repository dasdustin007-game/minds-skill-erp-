const db = require('./server/database_erp.js');
console.log('Tables in database:');
console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name));

