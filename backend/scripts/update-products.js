import { connectDB, Product } from '../models/index.js'

async function run() {
    await connectDB()
    const prods = await Product.find()
    console.log('Found', prods.length, 'products')
    let updated = 0
    for (const p of prods) {
        if (!p.packSizes || p.packSizes.length === 0) {
            // Ensure required sku exists; if missing, generate a fallback SKU
            if (!p.sku) {
                p.sku = `SKU-${p._id.toString().slice(-6)}`
                console.log('Generated sku for', p._id.toString(), '->', p.sku)
            }

            const size = p.packSize || (p.unit && p.unit.toLowerCase().includes('litre') ? '1L' : '1kg')
            const price = (p.price && typeof p.price === 'number' && p.price > 0) ? p.price : 100
            const stock = p.stock || p.quantity || 100
            p.packSizes = [{ size, price, stock }]
            await p.save()
            updated++
            console.log('Updated', p._id.toString())
        }
    }
    console.log('Done. Updated', updated, 'products')
    process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
