import { connectDB, AdminMessage } from '../models/index.js';

await connectDB();
const messages = await AdminMessage.find().sort({ timestamp: -1 }).limit(10);
console.log('Total AdminMessages:', await AdminMessage.countDocuments());
console.log('\nRecent messages:');
messages.forEach((m, i) => {
    console.log(`${i + 1}. [${m.status}] ${m.officerName}: ${m.text.slice(0, 60)}...`);
});
process.exit(0);
