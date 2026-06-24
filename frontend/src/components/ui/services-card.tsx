"use client";

import * as React from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shadcn UI Carousel Imports
import useEmblaCarousel, {
  type EmblaCarouselType,
} from "embla-carousel-react";
import { Button } from "@/components/ui/button";

// --- Carousel Context ---
type CarouselApi = EmblaCarouselType | undefined;
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];
type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};
type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);
  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }
  return context;
}

// --- Main Carousel Component ---
export const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((api: CarouselApi) => {
      if (!api) return;
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev();
    }, [api]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext();
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) return;
      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) return;
      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);
      return () => {
        api?.off("select", onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation,
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = "Carousel";

// --- Carousel Content ---
export const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel();
  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className,
        )}
        {...props}
      />
    </div>
  );
});
CarouselContent.displayName = "CarouselContent";

// --- Carousel Item ---
export const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel();
  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className,
      )}
      {...props}
    />
  );
});
CarouselItem.displayName = "CarouselItem";

// --- Carousel Controls ---
export const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { scrollNext, canScrollNext } = useCarousel();
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-10 w-10 rounded-full bg-white/80 border border-slate-200 hover:bg-slate-50 shadow-sm",
        "right-2 top-1/2 -translate-y-1/2 z-20",
        className,
      )}
      onClick={scrollNext}
      disabled={!canScrollNext}
      {...props}
    >
      <ArrowRight className="h-4 w-4 text-slate-700" />
      <span className="sr-only">Next slide</span>
    </Button>
  );
});
CarouselNext.displayName = "CarouselNext";

// --- Service Card & Carousel Section ---
export interface Service {
  number?: string;
  category?: string;
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  gradient: string;
  illustration?: string;
  illustrationNode?: React.ReactNode;
}

// Sub-component for individual cards (with 3D tilt, mouse follow glow, and fade-up entrance)
export const ServiceCard = ({ service, index }: { service: Service; index: number }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = React.useState(0);
  const [rotateY, setRotateY] = React.useState(0);
  const [glowX, setGlowX] = React.useState(0);
  const [glowY, setGlowY] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate rotation (max 10 degrees tilt)
    const rY = ((mouseX / width) - 0.5) * 10;
    const rX = (((mouseY / height) - 0.5) * -10);
    
    setRotateX(rX);
    setRotateY(rY);
    
    // Glow positions
    setGlowX((mouseX / width) * 100);
    setGlowY((mouseY / height) * 100);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotateX(0);
    setRotateY(0);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 80,
        damping: 15,
        delay: index * 0.1,
      },
    },
  };

  const iconColorClass = service.gradient.includes("rose") ? "text-rose-500" : "text-med-primary";
  const iconBgClass = service.gradient.includes("rose") ? "bg-rose-50" : "bg-sky-50";

  return (
    <motion.div
      ref={cardRef}
      variants={cardVariants}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000,
      }}
      animate={{
        rotateX: isHovered ? rotateX : 0,
        rotateY: isHovered ? rotateY : 0,
        scale: isHovered ? 1.015 : 1,
        boxShadow: isHovered 
          ? "0 25px 50px -12px rgba(15, 23, 42, 0.08)" 
          : "0 4px 20px -2px rgba(15, 23, 42, 0.02)",
      }}
      transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.5 }}
      className={cn(
        "relative flex h-[460px] w-full flex-col justify-between overflow-hidden rounded-3xl p-8 border border-slate-100/80 bg-gradient-to-br transition-all duration-200 cursor-pointer select-none",
        service.gradient
      )}
    >
      {/* 3D Content wrapper for depth */}
      <div 
        className="z-10 flex flex-col items-start text-left w-full h-full justify-between"
        style={{ transform: "translateZ(30px)" }}
      >
        
        {/* Top bar with Step Number / Category and Icon */}
        <div className="w-full flex justify-between items-start">
          <div className="flex flex-col">
            {service.number && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                STEP {service.number}
              </span>
            )}
            {service.category && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                {service.category}
              </span>
            )}
          </div>
          {service.icon && (
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border border-white", iconBgClass)}>
              <service.icon className={cn("w-6 h-6 stroke-[2]", iconColorClass)} />
            </div>
          )}
        </div>

        {/* Middle Area: Illustration/SVG or spacer */}
        {service.illustration && (
          <div className="w-full flex-grow flex items-center justify-center my-6 overflow-hidden h-36 relative">
            <div className="absolute inset-0 bg-med-primary/5 rounded-full blur-2xl -z-10 opacity-40"></div>
            <motion.img 
              whileHover={{ scale: 1.04, y: -2 }}
              transition={{ duration: 0.3 }}
              src={service.illustration} 
              alt={service.title} 
              className="w-full h-full object-contain mx-auto filter drop-shadow-sm rounded-xl"
            />
          </div>
        )}

        {service.illustrationNode && (
          <div className="w-full flex-grow flex items-center justify-center my-6 overflow-hidden h-36 relative">
            {service.illustrationNode}
          </div>
        )}

        {!service.illustration && !service.illustrationNode && (
          <div className="flex-grow"></div>
        )}

        {/* Bottom Area: Title and Description */}
        <div className="w-full mt-auto">
          <h3 className="mb-2.5 text-xl font-bold tracking-tight text-slate-900 group-hover:text-med-primary transition-colors">
            {service.title}
          </h3>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            {service.description}
          </p>
        </div>

      </div>

      {/* Radial Hover Glow overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-0"
        style={{
          opacity: isHovered ? 0.25 : 0,
          background: `radial-gradient(circle 200px at ${glowX}% ${glowY}%, var(--color-med-primary, #0ea5e9), transparent)`,
        }}
      />
      
      {/* Subtle overlay for layout consistency */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent pointer-events-none z-0"></div>
    </motion.div>
  );
};

// Main Carousel Component
export const ServiceCarousel = ({ services }: { services: Service[] }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <div className="w-full max-w-6xl mx-auto px-4">
      <Carousel
        ref={ref}
        opts={{
          align: "start",
          loop: true,
        }}
        className="relative"
      >
        <motion.div
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ staggerChildren: 0.1 }}
        >
          <CarouselContent>
            {services.map((service, index) => (
              <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-2">
                  <ServiceCard service={service} index={index} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </motion.div>
        <CarouselNext className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm z-30" />
      </Carousel>
    </div>
  );
};
