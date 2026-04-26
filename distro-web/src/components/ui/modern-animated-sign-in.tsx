"use client";

import {
  memo,
  type ReactNode,
  useState,
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  forwardRef,
} from "react";
import Image from "next/image";
import {
  motion,
  useAnimation,
  useInView,
  useMotionTemplate,
  useMotionValue,
} from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ==================== Input Component ====================

const Input = memo(
  forwardRef(function Input(
    { className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>,
    ref: React.ForwardedRef<HTMLInputElement>
  ) {
    const radius = 100;
    const [visible, setVisible] = useState(false);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({
      currentTarget,
      clientX,
      clientY,
    }: React.MouseEvent<HTMLDivElement>) {
      const { left, top } = currentTarget.getBoundingClientRect();

      mouseX.set(clientX - left);
      mouseY.set(clientY - top);
    }

    return (
      <motion.div
        style={{
          background: useMotionTemplate`
        radial-gradient(
          ${visible ? radius + "px" : "0px"} circle at ${mouseX}px ${mouseY}px,
          #3b82f6,
          transparent 80%
        )
      `,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="group/input rounded-lg p-[2px] transition duration-300"
      >
        <input
          type={type}
          className={cn(
            "shadow-input flex h-10 w-full rounded-md border-none bg-gray-50 px-3 py-2 text-sm text-black transition duration-400 group-hover/input:shadow-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-white dark:shadow-[0px_0px_1px_1px_#404040] dark:focus-visible:ring-neutral-600",
            className
          )}
          ref={ref}
          {...props}
        />
      </motion.div>
    );
  })
);

Input.displayName = "Input";

// ==================== BoxReveal Component ====================

type BoxRevealProps = {
  children: ReactNode;
  width?: string;
  boxColor?: string;
  duration?: number;
  overflow?: string;
  position?: string;
  className?: string;
};

const BoxReveal = memo(function BoxReveal({
  children,
  width = "fit-content",
  boxColor,
  duration,
  overflow = "hidden",
  position = "relative",
  className,
}: BoxRevealProps) {
  const mainControls = useAnimation();
  const slideControls = useAnimation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      void slideControls.start("visible");
      void mainControls.start("visible");
    } else {
      void slideControls.start("hidden");
      void mainControls.start("hidden");
    }
  }, [isInView, mainControls, slideControls]);

  return (
    <section
      ref={ref}
      style={{
        position: position as
          | "relative"
          | "absolute"
          | "fixed"
          | "sticky"
          | "static",
        width,
        overflow,
      }}
      className={className}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 75 },
          visible: { opacity: 1, y: 0 },
        }}
        initial="hidden"
        animate={mainControls}
        transition={{ duration: duration ?? 0.5, delay: 0.25 }}
      >
        {children}
      </motion.div>
      <motion.div
        variants={{ hidden: { left: 0 }, visible: { left: "100%" } }}
        initial="hidden"
        animate={slideControls}
        transition={{ duration: duration ?? 0.5, ease: "easeIn" }}
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 0,
          right: 0,
          zIndex: 20,
          background: boxColor ?? "#5046e6",
          borderRadius: 4,
        }}
      />
    </section>
  );
});

// ==================== Ripple Component ====================

type RippleProps = {
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
  className?: string;
};

const Ripple = memo(function Ripple({
  mainCircleSize = 210,
  mainCircleOpacity = 0.24,
  numCircles = 11,
  className = "",
}: RippleProps) {
  return (
    <section
      className={`absolute inset-0 flex max-w-[50%] items-center justify-center bg-neutral-50 [mask-image:linear-gradient(to_bottom,black,transparent)] dark:bg-white/5 dark:[mask-image:linear-gradient(to_bottom,white,transparent)] ${className}`}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 70;
        const opacity = mainCircleOpacity - i * 0.03;
        const animationDelay = `${i * 0.06}s`;
        const borderStyle = i === numCircles - 1 ? "dashed" : "solid";
        const borderOpacity = Math.min(0.05 + i * 0.05, 0.5);

        return (
          <span
            key={i}
            className="animate-ripple absolute rounded-full border border-foreground/10 bg-foreground/15"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              opacity: opacity,
              animationDelay: animationDelay,
              borderStyle: borderStyle,
              borderWidth: "1px",
              borderColor: `rgba(15, 23, 42, ${borderOpacity})`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </section>
  );
});

// ==================== OrbitingCircles Component ====================

type OrbitingCirclesProps = {
  className?: string;
  children: ReactNode;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
};

const OrbitingCircles = memo(function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 10,
  radius = 50,
  path = true,
}: OrbitingCirclesProps) {
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <circle
            className="stroke-1 stroke-black/10 dark:stroke-white/10"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
          />
        </svg>
      )}
      <section
        style={
          {
            "--duration": duration,
            "--radius": radius,
            "--delay": -delay,
          } as React.CSSProperties
        }
        className={cn(
          "absolute flex size-full transform-gpu animate-orbit items-center justify-center rounded-full border bg-black/10 [animation-delay:calc(var(--delay)*1s)] dark:bg-white/10",
          { "[animation-direction:reverse]": reverse },
          className
        )}
      >
        {children}
      </section>
    </>
  );
});

// ==================== TechOrbitDisplay Component ====================

export type OrbitIconConfig = {
  className?: string;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
  reverse?: boolean;
  component: () => React.ReactNode;
};

type TechnologyOrbitDisplayProps = {
  iconsArray: OrbitIconConfig[];
  text?: string;
};

const TechOrbitDisplay = memo(function TechOrbitDisplay({
  iconsArray,
  text = "DISTRO",
}: TechnologyOrbitDisplayProps) {
  return (
    <section className="relative flex h-full min-h-[240px] w-full flex-col items-center justify-center overflow-hidden rounded-lg">
      {/* z-10 so orbiting layers (later siblings, position:absolute) do not paint over the wordmark */}
      <span className="pointer-events-none relative z-10 whitespace-pre-wrap bg-gradient-to-b from-slate-500/85 to-slate-400/45 bg-clip-text text-center text-4xl font-semibold leading-none text-transparent dark:from-white/90 dark:to-slate-500/30 sm:text-6xl lg:text-7xl">
        {text}
      </span>

      {iconsArray.map((icon, index) => (
        <OrbitingCircles
          key={index}
          className={cn("z-0", icon.className)}
          duration={icon.duration}
          delay={icon.delay}
          radius={icon.radius}
          path={icon.path}
          reverse={icon.reverse}
        >
          {icon.component()}
        </OrbitingCircles>
      ))}
    </section>
  );
});

// ==================== AnimatedForm Component ====================

type FieldType = "text" | "email" | "password";

export type AnimatedFormField = {
  name: string;
  label: string;
  required?: boolean;
  type: FieldType;
  placeholder?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

type AnimatedFormProps = {
  header: string;
  subHeader?: string;
  fields: AnimatedFormField[];
  submitButton: string;
  textVariantButton?: string;
  errorField?: string;
  fieldPerRow?: 1 | 2;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  googleLogin?: string;
  onGoogleClick?: () => void;
  goTo?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Disables submit and shows loading affordance */
  isSubmitting?: boolean;
};

type Errors = Record<string, string>;

const AnimatedForm = memo(function AnimatedForm({
  header,
  subHeader,
  fields,
  submitButton,
  textVariantButton,
  errorField,
  fieldPerRow = 1,
  onSubmit,
  googleLogin,
  onGoogleClick,
  goTo,
  isSubmitting = false,
}: AnimatedFormProps) {
  const [visible, setVisible] = useState<boolean>(false);
  const [errors, setErrors] = useState<Errors>({});

  const toggleVisibility = () => setVisible((v) => !v);

  const validateForm = (event: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const currentErrors: Errors = {};
    fields.forEach((field) => {
      const value = (formData.get(field.name) as string) ?? "";

      if (field.required && !value.trim()) {
        currentErrors[field.name] = `${field.label} is required`;
      }

      if (field.type === "email" && value && !/\S+@\S+\.\S+/.test(value)) {
        currentErrors[field.name] = "Invalid email address";
      }

      if (field.type === "password" && value && value.length < 6) {
        currentErrors[field.name] = "Password must be at least 6 characters long";
      }
    });
    return currentErrors;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formErrors = validateForm(event);

    if (Object.keys(formErrors).length === 0) {
      setErrors({});
      onSubmit(event);
    } else {
      setErrors(formErrors);
    }
  };

  const gridClass =
    fieldPerRow === 2 ? "grid grid-cols-1 md:grid-cols-2 mb-4 gap-4" : "mb-4 grid grid-cols-1";

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 max-md:w-full">
      <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
        <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200">{header}</h2>
      </BoxReveal>

      {subHeader && (
        <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3} className="pb-2">
          <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">{subHeader}</p>
        </BoxReveal>
      )}

      {googleLogin && (
        <>
          <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3} overflow="visible" width="unset">
            <button
              className="g-button group/btn relative h-10 w-full rounded-md border bg-transparent font-medium outline-none hover:cursor-pointer"
              type="button"
              onClick={onGoogleClick}
            >
              <span className="flex h-full w-full items-center justify-center gap-3">
                <Image
                  src="https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png"
                  width={26}
                  height={26}
                  alt=""
                />
                {googleLogin}
              </span>

              <BottomGradient />
            </button>
          </BoxReveal>

          <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3} width="100%">
            <section className="flex items-center gap-4">
              <hr className="flex-1 border border-dashed border-neutral-300 dark:border-neutral-700" />
              <p className="text-sm text-neutral-700 dark:text-neutral-300">or</p>
              <hr className="flex-1 border border-dashed border-neutral-300 dark:border-neutral-700" />
            </section>
          </BoxReveal>
        </>
      )}

      <form onSubmit={handleSubmit}>
        <section className={gridClass}>
          {fields.map((field) => (
            <section key={field.name} className="flex flex-col gap-2">
              <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
                <Label htmlFor={field.name}>
                  {field.label}{" "}
                  {field.required ? <span className="text-red-500">*</span> : null}
                </Label>
              </BoxReveal>

              <BoxReveal
                width="100%"
                boxColor="hsl(var(--skeleton))"
                duration={0.3}
                className="flex w-full flex-col space-y-2"
              >
                <section className="relative">
                  <Input
                    type={
                      field.type === "password"
                        ? visible
                          ? "text"
                          : "password"
                        : field.type
                    }
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder}
                    onChange={field.onChange}
                    autoComplete={
                      field.type === "password"
                        ? "current-password"
                        : field.type === "email"
                          ? "email"
                          : "username"
                    }
                  />

                  {field.type === "password" && (
                    <button
                      type="button"
                      onClick={toggleVisibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-sm leading-5 text-neutral-600"
                      aria-label={visible ? "Hide password" : "Show password"}
                    >
                      {visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                    </button>
                  )}
                </section>

                <section className="min-h-4">
                  {errors[field.name] ? (
                    <p className="text-xs text-red-500">{errors[field.name]}</p>
                  ) : null}
                </section>
              </BoxReveal>
            </section>
          ))}
        </section>

        <BoxReveal width="100%" boxColor="hsl(var(--skeleton))" duration={0.3}>
          {errorField ? <p className="mb-4 text-sm text-red-500">{errorField}</p> : null}
        </BoxReveal>

        <BoxReveal width="100%" boxColor="hsl(var(--skeleton))" duration={0.3} overflow="visible">
          <button
            className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-zinc-200 to-zinc-200 font-medium text-black shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] outline-none hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 dark:from-zinc-900 dark:to-zinc-900 dark:bg-zinc-800 dark:text-white dark:shadow-[0px_1px_0px_0px_var(--zinc-800)_inset,0px_-1px_0px_0px_var(--zinc-800)_inset]"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in…" : `${submitButton} →`}
            <BottomGradient />
          </button>
        </BoxReveal>

        {textVariantButton && goTo && (
          <BoxReveal boxColor="hsl(var(--skeleton))" duration={0.3}>
            <section className="mt-4 text-center hover:cursor-pointer">
              <button
                type="button"
                className="text-sm text-blue-500 outline-none hover:cursor-pointer"
                onClick={goTo}
              >
                {textVariantButton}
              </button>
            </section>
          </BoxReveal>
        )}
      </form>
    </section>
  );
});

function BottomGradient() {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
}

// ==================== AuthTabs Component ====================

interface AuthTabsProps {
  formFields: {
    header: string;
    subHeader?: string;
    fields: AnimatedFormField[];
    submitButton: string;
    textVariantButton?: string;
  };
  goTo: (event: React.MouseEvent<HTMLButtonElement>) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  googleLogin?: string;
  onGoogleClick?: () => void;
}

const AuthTabs = memo(function AuthTabs({
  formFields,
  goTo,
  handleSubmit,
  googleLogin,
  onGoogleClick,
}: AuthTabsProps) {
  return (
    <div className="flex w-full max-lg:justify-center md:w-auto">
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center max-lg:px-[10%] lg:w-1/2">
        <AnimatedForm
          {...formFields}
          fieldPerRow={1}
          onSubmit={handleSubmit}
          goTo={goTo}
          googleLogin={googleLogin}
          onGoogleClick={onGoogleClick}
        />
      </div>
    </div>
  );
});

// ==================== Label Component ====================

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  htmlFor?: string;
}

const Label = memo(function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
});

// ==================== Exports ====================

export {
  Input,
  BoxReveal,
  Ripple,
  OrbitingCircles,
  TechOrbitDisplay,
  AnimatedForm,
  AuthTabs,
  Label,
  BottomGradient,
};
