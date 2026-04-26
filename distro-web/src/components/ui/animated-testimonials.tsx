"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { motion, useAnimation, useInView } from "framer-motion";
import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  avatar: string;
}

export interface AnimatedTestimonialsProps {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  testimonials?: Testimonial[];
  autoRotateInterval?: number;
  trustedCompanies?: string[];
  trustedCompaniesTitle?: string;
  className?: string;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AnimatedTestimonials({
  title = "Loved by the community",
  subtitle = "Don't just take our word for it. See what developers and companies have to say about our starter template.",
  badgeText = "Trusted by developers",
  testimonials = [],
  autoRotateInterval = 6000,
  trustedCompanies = [],
  trustedCompaniesTitle = "Trusted by developers from companies worldwide",
  className,
}: AnimatedTestimonialsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const controls = useAnimation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
    },
  };

  useEffect(() => {
    if (isInView) {
      void controls.start("visible");
    }
  }, [isInView, controls]);

  useEffect(() => {
    if (autoRotateInterval <= 0 || testimonials.length <= 1) return;

    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [autoRotateInterval, testimonials.length]);

  if (testimonials.length === 0) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className={cn(
        "overflow-hidden bg-white py-6 sm:py-8 lg:py-10",
        className
      )}
    >
      <div className="w-full px-4 md:px-6">
        <motion.div
          initial="hidden"
          animate={controls}
          variants={containerVariants}
          className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 md:gap-10 lg:gap-12"
        >
          <motion.div
            variants={itemVariants}
            className="flex flex-col justify-center"
          >
            <div className="space-y-4">
              {badgeText ? (
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <Star className="mr-1 h-3.5 w-3.5 fill-primary" />
                  <span>{badgeText}</span>
                </div>
              ) : null}

              <h2 className="text-xl font-bold tracking-tighter sm:text-2xl">
                {title}
              </h2>

              <p className="max-w-[520px] text-xs text-muted-foreground sm:text-sm">
                {subtitle}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      activeIndex === index
                        ? "w-10 bg-primary"
                        : "w-2.5 bg-muted-foreground/30"
                    }`}
                    aria-label={`View testimonial ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="relative mr-0 min-h-[220px] px-2 sm:px-0 sm:mr-4 md:mr-6 md:min-h-[260px] lg:min-h-[280px]"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.id}
                className="absolute inset-0"
                initial={{ opacity: 0, x: 100 }}
                animate={{
                  opacity: activeIndex === index ? 1 : 0,
                  x: activeIndex === index ? 0 : 100,
                  scale: activeIndex === index ? 1 : 0.9,
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ zIndex: activeIndex === index ? 10 : 0 }}
              >
                <div className="flex h-full min-h-0 flex-col rounded-xl border bg-card p-4 shadow-md sm:p-5">
                  <div className="mb-3 flex gap-1">
                    {Array(testimonial.rating)
                      .fill(0)
                      .map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500"
                        />
                      ))}
                  </div>

                  <div className="mb-4 flex-1 min-h-0">
                    <p className="line-clamp-6 text-sm font-medium leading-relaxed text-card-foreground">
                      &ldquo;{testimonial.content}&rdquo;
                    </p>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border sm:h-11 sm:w-11">
                      <AvatarImage
                        src={testimonial.avatar}
                        alt={testimonial.name}
                      />
                      <AvatarFallback>
                        {initialsFromName(testimonial.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-sm font-semibold">{testimonial.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            <div
              className="absolute -bottom-4 -left-4 h-16 w-16 rounded-lg bg-primary/5"
              aria-hidden
            />
            <div
              className="absolute -right-4 -top-4 h-16 w-16 rounded-lg bg-primary/5"
              aria-hidden
            />
          </motion.div>
        </motion.div>

        {trustedCompanies.length > 0 ? (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate={controls}
            className="mt-6 text-center sm:mt-8"
          >
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm">
              {trustedCompaniesTitle}
            </h3>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
              {trustedCompanies.map((company) => (
                <div
                  key={company}
                  className="text-sm font-medium text-muted-foreground/60"
                >
                  {company}
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
