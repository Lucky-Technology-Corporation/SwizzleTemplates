//_SWIZZLE_FILE_PATH_backend/user-dependencies/stripe.setup_payment.ts
import express, { Response } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest, editUser, optionalAuthentication } from 'swizzle-js';
const router = express.Router()

router.post('/stripe/setup_payment', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  /* 
  This endpoint is used to set up the checkout form on the frontend for a charge of any amount, defined below.
  If the user is logged in, it will also save the payment method to their stripe account. 
  */

  //Replace amount and description with your own logic
  const AMOUNT_TO_CHARGE = 2000
  const CHARGE_DESCRIPTION = "Swizzle"

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    var customerId;
    if(request.user){
      if(request.user.stripeCustomerId === undefined){
        const customer = await stripe.customers.create({
          email: request.user.email,
          metadata: {
            swizzle_user_id: request.user.userId,
          }
        })
        await editUser({stripeCustomerId: customer.id})
        customerId = customer.id
      } else{
        customerId = request.user.stripeCustomerId
      }
    }

    var paymentIntentObject = {
      amount: AMOUNT_TO_CHARGE,
      currency: "usd",
      statement_descriptor: CHARGE_DESCRIPTION,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        swizzle_user_id: request.user?.userId,
      }
    }

    if(customerId){
      paymentIntentObject["customer"] = customerId
      paymentIntentObject["setup_future_usage"] = 'off_session'
    }

    const result = await stripe.paymentIntents.create(paymentIntentObject)
    return response.json(result)
  } catch (e) {
    return response.status(500).json({ error: e.message })
  }
})

export default router

//_SWIZZLE_FILE_PATH_backend/user-dependencies/stripe.setup_subscription.ts
import express, { Response } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest, editUser, optionalAuthentication } from 'swizzle-js';
const router = express.Router()

router.post('/stripe/setup_future_payment', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  /* 
  This endpoint is used to set up the checkout form on the frontend for a charge of any amount, defined below.
  If the user is logged in, it will also save the payment method to their stripe account. 

  Replace the following const values with your own:
  */

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    var customerId;
    if(request.user){
      if(request.user.stripeCustomerId === undefined){
        const customer = await stripe.customers.create({
          email: request.user.email,
          metadata: {
            swizzle_user_id: request.user.userId,
          }
        })
        await editUser({stripeCustomerId: customer.id})
        customerId = customer.id
      } else{
        customerId = request.user.stripeCustomerId
      }
    }

    const result = await stripe.setupIntents.create({
      automatic_payment_methods: {
        enabled: true,
      },
      customer: customerId,
      metadata: {
        swizzle_user_id: request.user?.userId,
      }
    })

    return response.json(result)
  } catch (e) {
    return response.status(500).json({ error: e.message })
  }
})

export default router

//_SWIZZLE_FILE_PATH_backend/user-dependencies/stripe.webhook.ts
import express, { Response } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest, editUser, optionalAuthentication } from 'swizzle-js';
const router = express.Router()

router.post('/stripe/webhook', optionalAuthentication, async (request: AuthenticatedRequest, response: Response) => {
  /* 
  This endpoint handles the stripe webhook. 
  Add this endpoint to https://dashboard.stripe.com/test/webhooks to receive events.

  You'll need to add logic to handle the different event types if you want to use this.
  */

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const event = stripe.webhooks.constructEvent(request.body, request.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)

    switch (event.type) {
      case 'payment_intent.succeeded':
        const successfulCharge = event.data.object
        break
      case 'payment_intent.payment_failed':
        const failedCharge = event.data.object
        break
      case 'customer.subscription.created':
        const newSubscription = event.data.object
        break
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object
        break
      case 'customer.subscription.paused':
        const pausedSubscription = event.data.object
        break
      case 'customer.subscription.resumed':
        const resumedSubscription = event.data.object
        break
      case 'customer.subscription.updated':
        const updatedSubscription = event.data.object
        break
      case 'refund.created':
        const refundedCharge = event.data.object
        break
      // ... handle other event types if needed (https://docs.stripe.com/api/events/types)
      default:
        return response.status(400).json({ error: 'Unhandled event type' })
    }
    return response.json({ received: true })
  } catch (e) {
    return response.status(500).json({ error: e.message })
  }
})

export default router

//_SWIZZLE_FILE_PATH_frontend/src/components/StripePaymentForm.tsx
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useRef, useState } from 'react';
import api from '../Api';

/*
  Usage: <StripePaymentForm shouldCharge={boolean} onSuccess={() => {}} onSuccessRedirect="" /> 
  
  If shouldCharge is true, the payment will be saved and charged immediately using /stripe/setup_payment.
  If shouldCharge is false, the payment method will be saved for future use using /stripe/setup_future_payment.

  If the user chooses a payment method that requires a redirect, onSuccess will not be called, and the user will be redirected to onSuccessRedirect.
  If the user chooses a payment method that does not require a redirect, onSuccess will be called after the payment is successful and the user will not be redirected.

  This component will call the /stripe/setup_payment endpoint to get charge details and set up the payment form.
*/

const stripePromise = loadStripe(process.env.STRIPE_PUBLIC_KEY)

const StripePaymentForm = ({shouldCharge, onSuccess, onSuccessRedirect}: {shouldCharge: boolean, onSuccess: () => void, onSuccessRedirect: string}) => {
  const [stripeSecretObject, setStripeSecretObject] = useState(null)
  const idempotentRef = useRef(false)

  useEffect(() => {
    const appearance = {
      theme: 'stripe',
    }

    if (idempotentRef.current) {
      return
    }
    idempotentRef.current = true

    const url = shouldCharge ? '/stripe/setup_payment' : '/stripe/setup_future_payment'

    api.post(shouldCharge).then((res) => {
      setStripeSecretObject({
        clientSecret: res.data.client_secret,
        appearance: appearance,
      })
    })

  }, [])

  if (!stripeSecretObject) {
    return <div className="w-full text-center mt-8">Loading...</div>
  }

  return (
    <Elements stripe={stripePromise} options={stripeSecretObject}>
      <CheckoutForm shouldCharge={shouldCharge} onSuccess={onSuccess} onSuccessRedirect={onSuccessRedirect} />
    </Elements>
  )
}


const CheckoutForm = ({shouldCharge, onSuccess, onSuccessRedirect}: {shouldCharge: boolean, onSuccess: () => void, onSuccessRedirect: string}) => {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!stripe || !elements) { return }

    try {
      setLoading(true)
      const result = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.href.split("?")[0], // Redirect to the current page after payment
        },
      })
      setLoading(false)

      if(result.error){
        setError(result.error.message)
      } else{
        //Success!
        setSuccess(true)
        onSuccess()
      }
    } catch (e) {
      setLoading(false)
      console.error('[Stripe]', e)
      setError('Something went wrong. Please check your details and try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full h-full">
      <PaymentElement />
      <div className="w-full text-center mt-2 text-red-400">{error}</div>
      <button
        type="submit"
        disabled={!stripe || loading}
        className={`${(!stripe || loading) && 'opacity-70'} w-full bg-white mt-4 text-black font-semibold text-lg py-2 px-4 rounded-md shadow-md hover:shadow-lg`}
      >
        {success ? "Success!" : (shouldCharge ? "Pay" : "Save")}
      </button>
    </form>
  )
}

export default StripePaymentForm

//_SWIZZLE_FILE_PATH_backend/helpers/stripe.ts
import Stripe from 'stripe';
import { searchUsers } from 'swizzle-js';
interface ChargeOptions {
  amount: number,
  userId?: string,
  stripeCustomerId?: string,
  currency?: string
}

/*
  This function charges a customer using the Stripe API. 
  Use this if the user has already saved their payment method.
  
  If a userId is provided, it will use the user's stripeCustomerId.
  If a stripeCustomerId is provided, it will use that.
  If neither is provided, it will throw an error.

  Amount is in cents. The currency defaults to "usd".

  Usage: await chargeCustomerOnce({amount: 2000, userId: "user_id"})

  Returns the paymentIntent object.
*/
async function chargeCustomerOnce(options: ChargeOptions){
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  if(!options.userId && !options.stripeCustomerId){
      throw new Error("A userId or stripeCustomerId must be provided")
  }

  const safeCustomerId = options.stripeCustomerId ? options.stripeCustomerId : (await searchUsers({userId: options.userId}))[0].stripeCustomerId
  if(!safeCustomerId){
      throw new Error("No customer found")
  }

  const paymentIntent = await stripe.paymentIntents.create({
      amount: options.amount,
      currency: options.currency || "usd",
      customer: safeCustomerId,
      off_session: true,
      confirm: true
  });

  return paymentIntent;
}

interface ChargeOptions {
  priceIds: string[],
  userId?: string,
  stripeCustomerId?: string,
}

/*
  This function creates a subscription for a customer. Prices must be created in the Stripe dashboard. 
  Use this if the user has already saved their payment method.
  
  If a userId is provided, it will use the user's stripeCustomerId.
  If a stripeCustomerId is provided, it will use that.
  If neither is provided, it will throw an error.

  Usage: await chargeCustomerRecurring({priceIds: ["price_1Iq8Z2Lz7L1Gq6d1W4t2j4Rd"], userId: "user_id"})

  Returns the paymentIntent object.
*/
async function chargeCustomerRecurring(options: RecurringChargeOptions){
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  if(!options.userId && !options.stripeCustomerId){
    throw new Error("A userId or stripeCustomerId must be provided")
  }

  const safeCustomerId = options.stripeCustomerId ? options.stripeCustomerId : (await searchUsers({userId: options.userId}))[0].stripeCustomerId
  if(!safeCustomerId){
      throw new Error("No customer found")
  }

  const subscription = await stripe.subscriptions.create({
    customer: safeCustomerId,
    items: priceIds.map(priceId => ({price: priceId})),
  });

  return subscription;
}
export { chargeCustomerOnce, chargeCustomerRecurring }