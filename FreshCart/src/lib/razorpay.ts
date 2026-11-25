import { supabase } from '@/lib/supabase';

type CreateOrderResponse = {
  razorpay_order_id: string;
  amount: number;
  currency: 'INR';
  key_id: string;
};

type VerifyPaymentInput = {
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayPaymentResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: { description?: string };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: 'INR';
  name: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
  modal: { ondismiss: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

export async function createRazorpayOrder(orderId: string): Promise<CreateOrderResponse> {
  const { data, error } = await supabase.functions.invoke<CreateOrderResponse>('create-razorpay-order', {
    body: { order_id: orderId },
  });
  if (error) throw error;
  if (!data?.razorpay_order_id || !data.key_id || !Number.isSafeInteger(data.amount)) {
    throw new Error('The server returned invalid payment details.');
  }
  return data;
}

async function loadRazorpayScript(): Promise<RazorpayConstructor> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Online payment is available in the web checkout only.');
  }
  if (window.Razorpay) return window.Razorpay;

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error('Unable to load the Razorpay checkout. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      scriptPromise = null;
      throw error;
    });
  }
  await scriptPromise;
  if (!window.Razorpay) {
    scriptPromise = null;
    throw new Error('Razorpay checkout did not initialize.');
  }
  return window.Razorpay;
}

export async function openRazorpayCheckout({
  orderId,
  name,
  email,
  contact,
  onSuccess,
  onFailure,
  onDismiss,
}: {
  orderId: string;
  name: string;
  email: string;
  contact: string;
  onSuccess: (paymentId: string) => void | Promise<void>;
  onFailure: (message: string) => void;
  onDismiss: () => void;
}) {
  const paymentOrder = await createRazorpayOrder(orderId);
  const Razorpay = await loadRazorpayScript();
  let handlerStarted = false;
  const checkout = new Razorpay({
    key: paymentOrder.key_id,
    amount: paymentOrder.amount,
    currency: paymentOrder.currency,
    name: 'RETAIL360',
    order_id: paymentOrder.razorpay_order_id,
    prefill: { name, email, contact },
    handler: async (response) => {
      handlerStarted = true;
      try {
        if (response.razorpay_order_id !== paymentOrder.razorpay_order_id) {
          throw new Error('The payment response does not match this order.');
        }
        const verification: VerifyPaymentInput = {
          order_id: orderId,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        };
        const { data, error } = await supabase.functions.invoke<{ verified: boolean }>(
          'verify-razorpay-payment',
          { body: verification },
        );
        if (error) throw error;
        if (!data?.verified) throw new Error('Payment could not be verified.');
        await onSuccess(response.razorpay_payment_id);
      } catch (error) {
        onFailure(error instanceof Error ? error.message : 'Payment verification failed.');
      }
    },
    modal: {
      ondismiss: () => {
        if (!handlerStarted) onDismiss();
      },
    },
  });
  checkout.on('payment.failed', (response) => {
    if (!handlerStarted) {
      onFailure(response.error?.description || 'Payment was not completed. Your order is still unpaid.');
    }
  });
  checkout.open();
}
