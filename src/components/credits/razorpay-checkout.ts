// Loads Razorpay Standard Checkout and opens it for a server-created order.
// The browser's success callback is only a hint: the server re-verifies the
// signature and the payment with Razorpay before crediting anything.

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (resp: { error?: { description?: string } }) => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let loading: Promise<RazorpayCtor> | null = null;

function loadCheckout(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  if (loading) return loading;
  loading = new Promise<RazorpayCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Checkout unavailable")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export interface OpenCheckoutInput {
  keyId: string;
  orderId: string;
  amountPaise: number;
  credits: number;
  prefill: { name?: string; email?: string };
}

/**
 * Resolves with the success payload, or `null` if the student closed the
 * window. Rejects with a readable message if the payment failed.
 */
export async function openCheckout(input: OpenCheckoutInput): Promise<CheckoutSuccess | null> {
  const Razorpay = await loadCheckout();
  return new Promise((resolve, reject) => {
    let settled = false;
    // Razorpay keeps the modal open after a failed attempt so the student can
    // retry; only report the failure if they then close the window.
    let lastFailure: string | null = null;
    const rzp = new Razorpay({
      key: input.keyId,
      order_id: input.orderId,
      amount: input.amountPaise,
      currency: "INR",
      name: "OlympiadIQ",
      description: `${input.credits.toLocaleString("en-IN")} credits`,
      prefill: input.prefill,
      notes: { purpose: "credit_purchase" },
      theme: { color: "#2f5bd3" },
      handler: (resp: CheckoutSuccess) => {
        settled = true;
        resolve(resp);
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          if (lastFailure) reject(new Error(lastFailure));
          else resolve(null);
        },
      },
    });
    rzp.on("payment.failed", (resp) => {
      lastFailure = resp?.error?.description || "The payment didn't go through. No money was taken.";
    });
    rzp.open();
  });
}
