import { OrderStatus } from "@/components/customer/order-status";

/** Live status of one order, kept open on the customer's phone while they wait. */
export default async function CustomerOrderPage({
  params,
}: PageProps<"/print/[shopId]/orders/[orderId]">) {
  const { shopId, orderId } = await params;
  return <OrderStatus shopId={shopId} orderId={orderId} />;
}
