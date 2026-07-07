"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import api from "@/lib/api";
import { getImageUrl, stockStatusLabel, unitShort } from "@/lib/utils";
import { Product } from "@/components/ProductCard";
import PriceBlock, { unitPriceOf } from "@/components/PriceBlock";
import QtyStepper from "@/components/QtyStepper";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-blue-pale rounded-2xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-6 bg-blue-pale rounded animate-pulse w-1/3" />
          <div className="h-8 bg-blue-pale rounded animate-pulse w-3/4" />
          <div className="h-6 bg-blue-pale rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center text-gray-400">
        <p className="text-lg font-medium">Product not found</p>
        <Link
          href="/catalogue"
          className="mt-4 inline-flex items-center gap-1 text-blue hover:underline text-sm"
        >
          <ChevronLeft size={14} /> Back to Catalogue
        </Link>
      </div>
    );
  }

  const productImage = product.imageUrl ?? product.image;
  const stockInfo = stockStatusLabel(product.stockStatus);
  const isOutOfStock = product.stockStatus === "OUT_OF_STOCK";
  const unit = unitShort(product.sellUnit);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/catalogue"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue mb-6 transition-colors"
      >
        <ChevronLeft size={14} /> Back to Catalogue
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image */}
        <div className={`relative aspect-square bg-blue-pale rounded-2xl overflow-hidden ${isOutOfStock ? "opacity-60 grayscale" : ""}`}>
          <Image
            src={getImageUrl(productImage)}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
          {product.brand && (
            <span className="inline-flex self-start bg-blue-light text-blue text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
              {product.brand}
            </span>
          )}

          <h1 className="font-grotesk font-bold text-2xl sm:text-3xl text-ink">
            {product.name}
          </h1>

          <span
            className={`self-start text-xs font-medium px-3 py-1 rounded-full ${stockInfo.color}`}
          >
            {stockInfo.label}
          </span>

          <PriceBlock product={product} size="lg" />

          {/* Order info */}
          <div className="bg-blue-pale rounded-xl p-4">
            <p className="text-sm text-gray-600">
              <span className="font-grotesk font-semibold text-ink">
                Minimum order:
              </span>{" "}
              {product.moq} {unit}
              {product.sellUnit === "CARTON" && product.piecesPerCarton
                ? ` (${product.moq * product.piecesPerCarton} pieces)`
                : ""}
            </p>
          </div>

          {/* Add / stepper */}
          <div className="max-w-xs">
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
              size="lg"
            />
          </div>

          {product.description && (
            <div className="text-sm text-gray-600 whitespace-pre-line">
              {product.description}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Payments: eSewa · Khalti · Cash on Delivery
          </p>
        </div>
      </div>
    </div>
  );
}
