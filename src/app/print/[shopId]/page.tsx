import { OrderFlow } from "@/components/customer/order-flow";

/** The page a customer lands on after scanning the shop's QR code. */
export default async function CustomerPrintPage({
  params,
}: PageProps<"/print/[shopId]">) {
  const { shopId } = await params;
  return <OrderFlow shopId={shopId} />;
}
