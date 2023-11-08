//_SWIZZLE_FILE_PATH_backend/helpers/stripe.ts
import Stripe from 'stripe';
import { editUser, searchUsers } from "swizzle-js";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

//Creates a customer without saving payment information
async function createCustomer(
    swizzleUid?: string,
    email?: string, 
    name?: string, 
    description?: string, 
    metadata?: any, 
    address?: { city?: string, country?: string, line1?: string, line2?: string, postal_code?: string, state?: string }, 
    phone?: string
){
    //Build the customer object
    var customerObject = { email: email, name: name, description: description, metadata: metadata, address: address, phone: phone }
    //Remove undefined properties
    Object.keys(customerObject).forEach(key => customerObject[key] === undefined ? delete customerObject[key] : {});
    //Create the customer
    const customer = await stripe.customers.create(customerObject);
    //Update the user in Swizzle
    if(swizzleUid){
        await editUser(swizzleUid, {stripeCustomerId: customer.id})
    }
    return customer;
}

//Saves a card to a customer without charging it
async function saveCard(
    swizzleUid: string,
    stripeCustomerId: string,
    paymentMethodId: string
){
    //Get the customer id
    const safeCustomerId = stripeCustomerId ? stripeCustomerId : (await searchUsers({userId: swizzleUid}))[0].stripeCustomerId
    if(!safeCustomerId){
        throw new Error("No customer found")
    }

    //Attach the payment method to the customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: safeCustomerId,
    });

    //Set the payment method as the default for invoices
    await stripe.customers.update(safeCustomerId, {
        invoice_settings: {
            default_payment_method: paymentMethod.id,
        },
    });

    return paymentMethod;
}

//Charges a customer
async function chargeCustomer(
    amount: number,
    swizzleUid?: string,
    stripeCustomerId?: string,
    currency: string = "usd"
){
    //Get the customer id
    const safeCustomerId = stripeCustomerId ? stripeCustomerId : (await searchUsers({userId: swizzleUid}))[0].stripeCustomerId
    if(!safeCustomerId){
        throw new Error("No customer found")
    }

    //Create the charge
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: currency,
        customer: safeCustomerId,
        off_session: true,
        confirm: true
    });

    return paymentIntent;
}
export { createCustomer, saveCard, chargeCustomer }
//_SWIZZLE_FILE_PATH_frontend/src/components/StripeCheckout.tsx
import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe('{{"Stripe public key"}}'); // Use your Stripe public key

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);

    const {error, paymentMethod} = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      console.error(error);
    } else {
      console.log('[PaymentMethod]', paymentMethod);
      // Send paymentMethod.id to your server for further processing
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      <button type="submit" disabled={!stripe}>
        Pay
      </button>
    </form>
  );
};

const StripeCheckout = () => {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm />
    </Elements>
  );
};

export default StripeCheckout;
