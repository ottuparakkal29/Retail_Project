import { authenticateUser, corsHeaders, getCustomerProfileId, getSupabaseConfig, jsonResponse } from "../_shared/http.ts";

type OrderRow = {
  id: string;
  customer_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number | string;
  razorpay_order_id: string | null;
};

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
    if (!orderId) return jsonResponse({ error: "A valid order_id is required." }, 400);

    const customerProfileId = await getCustomerProfileId(user.id);
    if (!customerProfileId) return jsonResponse({ error: "Customer account not found." }, 403);

    const { url, serviceRoleKey } = getSupabaseConfig();
    const query = new URLSearchParams({
      select: "id,customer_id,order_number,status,payment_status,payment_method,total_amount,razorpay_order_id",
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
    if (order.payment_status === "paid") {
      return jsonResponse({ error: "This order is already paid." }, 409);
    }
    if (order.status !== "pending") {
      return jsonResponse({ error: "Only pending orders can be paid online." }, 409);
    }
    if (order.payment_method !== "online") {
      return jsonResponse({ error: "This order is not configured for online payment." }, 409);
    }

    const amount = Math.round(Number(order.total_amount) * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return jsonResponse({ error: "The order amount is invalid." }, 400);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      return jsonResponse({ error: "Razorpay is not configured on the server." }, 500);
    }

    let razorpayOrderId = order.razorpay_order_id;
    if (!razorpayOrderId) {
      const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt: order.order_number,
        }),
      });
      if (!razorpayResponse.ok) {
        console.error("Razorpay order creation failed with status", razorpayResponse.status);
        return jsonResponse({ error: "Unable to initialize the payment." }, 502);
      }
      const razorpayOrder = await razorpayResponse.json();
      if (
        typeof razorpayOrder.id !== "string" ||
        razorpayOrder.amount !== amount ||
        razorpayOrder.currency !== "INR"
      ) {
        return jsonResponse({ error: "Razorpay returned an invalid order." }, 502);
      }
      razorpayOrderId = razorpayOrder.id;

      const updateQuery = new URLSearchParams({
        id: `eq.${order.id}`,
        customer_id: `eq.${customerProfileId}`,
        payment_status: "eq.unpaid",
        payment_method: "eq.online",
        razorpay_order_id: "is.null",
      });
      const updateResponse = await fetch(`${url}/rest/v1/orders?${updateQuery}`, {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ razorpay_order_id: razorpayOrderId }),
      });
      if (!updateResponse.ok) {
        return jsonResponse({ error: "The order changed before payment could be initialized." }, 409);
      }
      const updatedOrders = await updateResponse.json();
      if (!Array.isArray(updatedOrders) || updatedOrders.length === 0) {
        const existingQuery = new URLSearchParams({
          select: "razorpay_order_id",
          id: `eq.${order.id}`,
          customer_id: `eq.${customerProfileId}`,
          payment_status: "eq.unpaid",
          payment_method: "eq.online",
          limit: "1",
        });
        const existingResponse = await fetch(`${url}/rest/v1/orders?${existingQuery}`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        });
        const existingOrders = existingResponse.ok ? await existingResponse.json() : [];
        if (typeof existingOrders[0]?.razorpay_order_id !== "string") {
          return jsonResponse({ error: "The order changed before payment could be initialized." }, 409);
        }
        razorpayOrderId = existingOrders[0].razorpay_order_id;
      }
    }

    return jsonResponse({ razorpay_order_id: razorpayOrderId, amount, currency: "INR", key_id: keyId });
  } catch (error) {
    console.error("create-razorpay-order failed:", error);
    return jsonResponse({ error: "Unable to initialize the payment." }, 500);
  }
});
