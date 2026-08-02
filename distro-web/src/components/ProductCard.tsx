"use client";

import Link from "next/link";
import Image from "next/image";
import { getImageUrl, type SellUnit, type StockStatus } from "@/lib/utils";
import PriceBlock, { unitPriceOf } from "@/components/PriceBlock";
import QtyStepper from "@/components/QtyStepper";

export interface Product {
  id: string;
  name: string;
  brand?: string;
  sellUnit: SellUnit;
  /** Rs per piece (derived per-piece price for carton products) */
  price: number;
  mrp?: number | null;
  unit?: string;
  moq: number;
  piecesPerCarton?: number | null;
  pricePerCarton?: number | string | null;
  stockStatus: StockStatus;
  maxOrderQty: number;
  image?: string;
  imageUrl?: string;
  description?: string;
  categoryId?: string;
}

export default function ProductCard({
  product,
  showEconomics = false,
}: {
  product: Product;
  /** Rep-facing pages pass true to keep MRP + margin. Off by default. */
  showEconomics?: boolean;
}) {
  const productImage = product.imageUrl ?? product.image;
  const isOutOfStock = product.stockStatus === "OUT_OF_STOCK";
  const isLowStock = product.stockStatus === "LOW_STOCK";

  return (
    <Link
      href={`/product/${product.id}`}
      className={`group rounded-2xl shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 bg-white border border-gray-100 overflow-hidden flex flex-col ${
        isOutOfStock ? "opacity-60 grayscale" : ""
      }`}
    >
      {/* Image */}
      <div className="relative aspect-square bg-blue-pale overflow-hidden">
        <Image
          src={getImageUrl(productImage)}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {isOutOfStock && (
          <span className="absolute top-2 right-2 rounded-full text-xs font-medium px-2.5 py-1 border bg-gray-100 text-gray-500 border-gray-200">
            Out of Stock
          </span>
        )}
        {isLowStock && (
          <span className="absolute top-2 right-2 rounded-full text-xs font-medium px-2.5 py-1 border bg-orange-50 text-orange-500 border-orange-200">
            Low stock
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-1">
        {product.brand && (
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            {product.brand}
          </p>
        )}
        <p className="text-base font-semibold text-gray-900 capitalize line-clamp-2 flex-1">
          {product.name}
        </p>

        <div className="mt-1">
          <PriceBlock product={product} size="sm" showEconomics={showEconomics} />
        </div>

        <div className="mt-2">
          <QtyStepper
            product={{
              id: product.id,
              name: product.name,
              sellUnit: product.sellUnit,
              unitPrice: unitPriceOf(product),
              mrp: product.mrp,
              moq: product.moq,
              maxOrderQty: product.maxOrderQty,
              piecesPerCarton: product.piecesPerCarton,
              stockStatus: product.stockStatus,
              image: productImage,
              brand: product.brand,
            }}
            size="sm"
          />
        </div>
      </div>
    </Link>
  );
}
