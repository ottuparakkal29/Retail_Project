import { authenticateUser, corsHeaders, getCustomerProfileId, getSupabaseConfig, jsonResponse } from "../_shared/http.ts";

type OrderRow = {
  id: string;
  customer_id: string;
  payment_method: string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`),
  );
  return constantTimeEqual(toHex(new Uint8Array(digest)), signature.toLowerCase());
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const user = await authenticateUser(request);
    if (!user) return jsonResponse({ error: "Authentication required." }, 401);

    const body = await request.json().catch(() => null);
    const orderId = body && typeof body.order_id === "string" ? body.order_id : "";
    const razorpayOrderId = body && typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const paymentId = body && typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const signature = body && typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
    if (!orderId || !razorpayOrderId || !paymentId || !/^[a-f\d]{64}$/i.test(signature)) {
      return jsonResponse({ error: "Payment verification details are invalid." }, 400);
    }

    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!secret) return jsonResponse({ error: "Razorpay is not configured on the server." }, 500);
    if (!await verifySignature(razorpayOrderId, paymentId, signature, secret)) {
      return jsonResponse({ error: "Payment signature is invalid." }, 400);
    }

    const customerProfileId = await getCustomerProfileId(user.id);
    if (!customerProfileId) return jsonResponse({ error: "Customer account not found." }, 403);

    const { url, serviceRoleKey } = getSupabaseConfig();
    const query = new URLSearchParams({
      select: "id,customer_id,payment_method,payment_status,razorpay_order_id,razorpay_payment_id",
      id: `eq.${orderId}`,
      limit: "1",
    });
    const orderResponse = await fetch(`${url}/rest/v1/orders?${query}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (!orderResponse.ok) return jsonResponse({ error: "Unable to load the order." }, 500);
    const orders = await orderResponse.json() as OrderRow[];
    const order = orders[0];
    if (!order || order.customer_id !== customerProfileId) {
      return jsonResponse({ error: "Order not found." }, 404);
    }
    if (order.payment_method !== "online" || order.razorpay_order_id !== razorpayOrderId) {
      return jsonResponse({ error: "Payment does not match this order." }, 400);
    }
    if (order.payment_status === "paid") {
      return order.razorpay_payment_id === paymentId
        ? jsonResponse({ verified: true })
        : jsonResponse({ error: "This order has already been paid." }, 409);
    }

    const updateQuery = new URLSearchParams({
      id: `eq.${order.id}`,
      customer_id: `eq.${customerProfileId}`,
      razorpay_order_id: `eq.${razorpayOrderId}`,
      payment_method: "eq.online",
      payment_status: "eq.unpaid",
    });
    const updateResponse = await fetch(`${url}/rest/v1/orders?${updateQuery}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        payment_status: "paid",
        payment_method: "online",
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    });
    if (!updateResponse.ok) return jsonResponse({ error: "Unable to update the order payment." }, 500);
    const updated = await updateResponse.json();
    if (!Array.isArray(updated)) {
      return jsonResponse({ error: "Unable to update the order payment." }, 500);
    }
    if (updated.length === 0) {
      const currentQuery = new URLSearchParams({
        select: "payment_status,razorpay_payment_id",
        id: `eq.${order.id}`,
        customer_id: `eq.${customerProfileId}`,
        limit: "1",
      });
      const currentResponse = await fetch(`${url}/rest/v1/orders?${currentQuery}`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });
      const currentRows = currentResponse.ok ? await currentResponse.json() : [];
      if (
        currentRows[0]?.payment_status === "paid" &&
        currentRows[0]?.razorpay_payment_id === paymentId
      ) {
        return jsonResponse({ verified: true });
      }
      return jsonResponse({ error: "The order payment status changed. Refresh your orders." }, 409);
    }

    return jsonResponse({ verified: true });
  } catch (error) {
    console.error("verify-razorpay-payment failed:", error);
    return jsonResponse({ error: "Unable to verify the payment." }, 500);
  }
});
