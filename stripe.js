//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.stripe.intent.js
const { db } = require('./swizzle-db');
const { optionalAuthentication } = require('./swizzle-passport');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/stripe/intent', optionalAuthentication, async (request, result) => {
    try {
        const { amount, currency } = request.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            // Optionally add more properties here, such as description or payment_method_types
        });

        result.json({ success: true, clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error(error);
        result.status(500).json({ success: false, message: error.message });
    }
});
//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.stripe.charge.js
const { db } = require('./swizzle-db');
const { optionalAuthentication } = require('./swizzle-passport');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/stripe/charge', optionalAuthentication, async (request, result) => {
    try {
        const { amount, currency, paymentMethodId } = request.body; // Get amount, currency, and payment method ID from frontend

        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            payment_method: paymentMethodId,
            confirm: true,  // Automatically confirm the payment
        });

        result.json({ success: true, paymentIntent });
    } catch (error) {
        console.error(error);
        result.status(500).json({ success: false, message: error.message });
    }
});
//_SWIZZLE_FILE_PATH_backend/user-dependencies/post.stripe.webhook.js
const { db } = require('./swizzle-db');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post('/stripe/webhook', async (request, result) => {
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            request.body,
            request.headers['stripe-signature'],
            process.env.ENDPOINT_SECRET_KEY
        );
    } catch (err) {
        return result.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`PaymentIntent ${paymentIntent.id} was successful!`);
            break;
        case 'payment_intent.payment_failed':
            const paymentError = event.data.object;
            console.log(`PaymentIntent ${paymentError.id} failed!`);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
            result.status(400).send("Unhandled event type")
    }

    result.json({ received: true });
});
