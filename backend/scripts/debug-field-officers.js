import 'dotenv/config'
import { connectDB, User, Attendance, Activity, Sample, LocationLog } from '../models/index.js'
import mongoose from 'mongoose'

await connectDB()
console.log('Connected\n')

const fieldOfficers = await User.find({ role: 'FIELD' }).select('-password').lean()
console.log('FIELD officers found:', fieldOfficers.length)
fieldOfficers.forEach(o => console.log(' -', o.name, o.email, o._id.toString()))

if (fieldOfficers.length === 0) {
    console.log('\nNo FIELD users — check role values in DB')
    const allRoles = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])
    console.log('All roles:', JSON.stringify(allRoles))
    process.exit(0)
}

const officerIds = fieldOfficers.map(u => new mongoose.Types.ObjectId(u._id))
const today = new Date(); today.setHours(0, 0, 0, 0)

const [activeAtt, todayAtt, meetings, samples, locations] = await Promise.all([
    Attendance.find({ userId: { $in: officerIds }, endTime: null }).lean(),
    Attendance.find({ userId: { $in: officerIds }, startTime: { $gte: today } }).lean(),
    Activity.aggregate([
        { $match: { userId: { $in: officerIds }, createdAt: { $gte: today } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]),
    Sample.aggregate([
        { $match: { userId: { $in: officerIds }, createdAt: { $gte: today } } },
        { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]),
    LocationLog.aggregate([
        { $match: { userId: { $in: officerIds } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: '$userId', location: { $first: '$location' }, timestamp: { $first: '$timestamp' } } }
    ])
])

console.log('\nActive attendances (GPS ON):', activeAtt.length)
console.log('Today attendances:', todayAtt.length)
console.log('Meetings today (agg):', JSON.stringify(meetings))
console.log('Samples today (agg):', JSON.stringify(samples))
console.log('Last locations (agg):', locations.length)

// Build result same as controller
const activeAttMap = new Map(activeAtt.map(a => [a.userId.toString(), a]))
const distanceMap = new Map()
todayAtt.forEach(a => {
    const id = a.userId.toString()
    distanceMap.set(id, (distanceMap.get(id) || 0) + (a.totalDistance || 0))
})

const result = fieldOfficers.map(o => ({
    name: o.name,
    isActive: !!activeAttMap.get(o._id.toString()),
    totalDistance: distanceMap.get(o._id.toString()) || 0,
    meetingsToday: meetings.find(m => m._id.toString() === o._id.toString())?.count || 0,
    samplesToday: samples.find(s => s._id.toString() === o._id.toString())?.count || 0,
}))

console.log('\nFinal result:')
result.forEach(r => console.log(' ', JSON.stringify(r)))

const summary = {
    totalOfficers: result.length,
    activeNow: result.filter(o => o.isActive).length,
    totalMeetingsToday: result.reduce((s, o) => s + o.meetingsToday, 0),
    totalSamplesToday: result.reduce((s, o) => s + o.samplesToday, 0),
    totalFleetDistance: result.reduce((s, o) => s + o.totalDistance, 0)
}
console.log('\nSummary:', JSON.stringify(summary))

process.exit(0)
