"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Package } from "lucide-react";
import api from "@/lib/api";
import { formatPrice, routeParamId } from "@/lib/utils";

interface OrderItem {
  id: number;
  name: string;
  productName?: string;
  qty: number;
  price: number;
  total: number;
  unit?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  storeName?: string;
  buyer?: { storeName?: string; phone?: string };
  deliveryAddress: string;
  deliveryDistrict: string;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

export default function OrderConfirmPage() {
  const params = useParams();
  const id = routeParamId(params?.id as string | string[] | undefined);

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: () =>
      api.get(`/orders/${id}`).then((r) => r.data?.order ?? r.data),
    enabled: Boolean(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-light animate-pulse mx-auto mb-6" />
        <div className="h-6 bg-blue-pale rounded w-2/3 mx-auto animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-light mb-5">
          <CheckCircle2 size={40} className="text-green" />
        </div>
        <h1 className="font-grotesk font-bold text-2xl text-ink mb-2">
          Order Placed!
        </h1>
        <p className="text-gray-400 text-sm">
          Thank you! Your order has been received and is being processed.
        </p>
        {order?.orderNumber && (
          <div className="mt-4 inline-block bg-blue-pale text-blue font-grotesk font-semibold text-sm px-4 py-2 rounded-xl">
            Order #{order.orderNumber}
          </div>
        )}
      </div>

      {/* Order details */}
      {order && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-grotesk font-semibold text-sm text-ink">
              Order Details
            </h2>
          </div>

          {/* Items */}
          <ul className="divide-y divide-gray-200">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{item.productName ?? item.name}</p>
                  <p className="text-xs text-gray-400">
                    {item.qty} × {formatPrice(item.price)}{item.unit ? ` ${item.unit}` : ""}
                  </p>
                </div>
                <p className="text-sm font-grotesk font-semibold text-ink">
                  {formatPrice(item.total ?? item.price * item.qty)}
                </p>
              </li>
            ))}
          </ul>

          {/* Totals */}
          <div className="px-5 py-4 border-t border-gray-200 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-grotesk">{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery ({order.deliveryDistrict})</span>
              <span className="font-grotesk">{formatPrice(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between font-grotesk font-bold text-base text-ink border-t border-gray-200 pt-2">
              <span>Total</span>
              <span className="text-blue">{formatPrice(order.total)}</span>
            </div>
          </div>

          {/* Delivery info */}
          <div className="px-5 py-4 border-t border-gray-200 text-xs text-gray-400 space-y-1">
            <p>
              <span className="font-medium text-gray-600">Store:</span>{" "}
              {order.storeName ?? order.buyer?.storeName ?? "—"}
            </p>
            <p>
              <span className="font-medium text-gray-600">Address:</span>{" "}
              {order.deliveryAddress}
            </p>
            <p>
              <span className="font-medium text-gray-600">Payment:</span>{" "}
              {order.paymentMethod}
            </p>
          </div>
        </div>
      )}

      {/* Fallback if no order data */}
      {!order && !isLoading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center mb-6">
          <Package size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">Order ID: {id}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/track?orderId=${id}`}
          className="flex-1 text-center bg-blue hover:bg-blue-dark text-white font-medium py-3.5 rounded-xl transition-colors"
        >
          Track Order
        </Link>
        <Link
          href="/catalogue"
          className="flex-1 text-center border border-gray-200 hover:bg-blue-pale text-gray-600 font-medium py-3.5 rounded-xl transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
