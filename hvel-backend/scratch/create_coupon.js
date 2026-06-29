const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error('❌ Error: STRIPE_SECRET_KEY not found in .env file!');
  process.exit(1);
}

const stripe = Stripe(secretKey, {
  apiVersion: '2022-11-15',
});

async function run() {
  try {
    const code = process.argv[2] || 'FREE2M';
    console.log(`🚀 Creating 100% off coupon for the first 2 months in Stripe...`);
    
    // 1. Create Coupon
    const coupon = await stripe.coupons.create({
      percent_off: 100,
      duration: 'repeating',
      duration_in_months: 2,
      name: '100% off first 2 months (Employee Promo)',
    });
    
    console.log('✅ Coupon Response:', JSON.stringify(coupon, null, 2));

    // 2. Create Promotion Code linked to the coupon
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code.toUpperCase(),
    });

    console.log(`===================================================`);
    console.log(`🎉 SUCCESS! Promotion Code Created:`);
    console.log(`👉 Code to give employees: ${promoCode.code}`);
    console.log(`👉 Discount: 100% off`);
    console.log(`👉 Duration: Repeating (first 2 months)`);
    console.log(`👉 Coupon ID: ${coupon.id}`);
    console.log(`👉 Promotion Code ID: ${promoCode.id}`);
    console.log(`===================================================`);
  } catch (error) {
    console.error('❌ Error creating coupon/promotion code:', error);
  }
}

run();
