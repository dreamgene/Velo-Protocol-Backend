"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const bcrypt = require("bcrypt");
async function seed() {
    const client = new pg_1.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const passwordHash = await bcrypt.hash('dev_password_123', 12);
    const { rows: [merchant] } = await client.query(`
    INSERT INTO merchants (email, password_hash, name, status, tier, muxed_base_id)
    VALUES ($1, $2, $3, 'active', 'standard', 1000000)
    ON CONFLICT (email) DO UPDATE SET status = 'active'
    RETURNING id
  `, ['dev@velo.finance', passwordHash, 'Dev Merchant']);
    for (let i = 1; i <= 3; i++) {
        const muxedId = 1000000 + i;
        const amount = (100 * i).toFixed(7);
        const fee = (0.5 * i + 0.25).toFixed(7);
        const gross = (100 * i + 0.5 * i + 0.25).toFixed(7);
        await client.query(`
      INSERT INTO invoices (merchant_id, amount_usdc, gross_usdc, fee_usdc, net_usdc, muxed_id, description, status, expires_at)
      VALUES ($1, $2, $3, $4, $2, $5, $6, 'pending', now() + interval '1 hour')
      ON CONFLICT (muxed_id) DO NOTHING
    `, [merchant.id, amount, gross, fee, muxedId, `Test Invoice ${i}`]);
    }
    await client.end();
    console.log('Seed complete.');
}
seed().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map