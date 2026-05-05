/**
 * One-time migration: fix users whose role was saved as "FIELD_OFFICER"
 * (or other variants) instead of the correct enum value "FIELD".
 *
 * Run once from the backend directory:
 *   node scripts/fix-field-officer-roles.js
 */

import 'dotenv/config'
import { connectDB } from '../models/index.js'
import mongoose from 'mongoose'

async function migrate() {
    await connectDB()
    console.log('Connected to MongoDB')

    // Fix all known bad role values → correct enum value
    const fixes = [
        { from: 'FIELD_OFFICER', to: 'FIELD' },
        { from: 'Field Officer', to: 'FIELD' },
        { from: 'field_officer', to: 'FIELD' },
        { from: 'field',         to: 'FIELD' },
    ]

    let totalFixed = 0

    for (const { from, to } of fixes) {
        const result = await mongoose.connection.collection('users').updateMany(
            { role: from },
            { $set: { role: to } }
        )
        if (result.modifiedCount > 0) {
            console.log(`  Fixed ${result.modifiedCount} user(s): "${from}" → "${to}"`)
            totalFixed += result.modifiedCount
        }
    }

    if (totalFixed === 0) {
        console.log('No users needed fixing — all roles are already correct.')
    } else {
        console.log(`\nMigration complete. Fixed ${totalFixed} user(s) total.`)
    }

    // Verify final state
    const counts = await mongoose.connection.collection('users').aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]).toArray()

    console.log('\nCurrent role distribution:')
    counts.forEach(c => console.log(`  ${c._id}: ${c.count}`))

    await mongoose.disconnect()
    process.exit(0)
}

migrate().catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
})
