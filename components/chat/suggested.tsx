import Image from 'next/image'

const Suggested = ({ isLoading: _isLoading = false }: { isLoading?: boolean }) => {
  return (
    <>
      <div className="pointer-events-auto w-full max-w-4xl">
        {/* Big title */}
        <h1
          className="text-center font-extrabold tracking-tight text-foreground text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-tight mb-6 sm:mb-8 animate-title"
          style={{ animationDelay: '0ms' }}
        >
          Find your next fit in{' '}
          <span className="bg-gradient-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">
            seconds
          </span>
          .
        </h1>

        {/* Desktop/Large: 8 cols x 2 rows (visible lg+) */}
        <div className="hidden lg:grid grid-cols-8 grid-rows-2 gap-3 sm:gap-4 h-[220px] sm:h-[260px]">
          {/* Card 1: 3 cols x 2 rows, title left, full-height image right */}
          <div
            className="col-span-3 row-span-2 bg-muted rounded-2xl p-4 flex items-stretch shadow-xs animate-fall"
            style={{ animationDelay: '950ms' }}
          >
            <div className="flex-1 flex items-end">
              <h3 className="text-sm sm:text-base font-medium leading-tight">
                Find my perfect Winter look
              </h3>
            </div>
            <div className="ml-3 h-full w-1/3 overflow-hidden rounded-lg relative">
              <Image
                src="/suggestions/winter-outfit.png"
                alt="Autumn fit example"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, 50vw"
                priority
              />
            </div>
          </div>

          {/* Card 2: 2 cols x 2 rows, title above, image 80% height */}
          <div
            className="col-span-2 row-span-2 bg-muted rounded-2xl p-4 flex flex-col shadow-xs animate-fall"
            style={{ animationDelay: '1100ms' }}
          >
            <h3 className="text-sm sm:text-base font-medium">How would this fit on me?</h3>
            <div className="mt-3 h-[80%] w-full overflow-hidden rounded-lg relative">
              <Image
                src="/suggestions/outfit-change.jpeg"
                alt="Professional headshot example"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 25vw, 50vw"
              />
            </div>
          </div>

          {/* Card 3: 3 cols x 1 row, image right at 33% width */}
          <div
            className="col-span-3 row-span-1 bg-muted rounded-2xl p-4 flex items-stretch shadow-xs animate-fall"
            style={{ animationDelay: '1250ms' }}
          >
            <div className="flex-1 flex items-center">
              <h3 className="text-sm sm:text-base font-medium">Find me this item</h3>
            </div>
            <div className="ml-3 h-full w-1/3 overflow-hidden rounded-lg relative">
              <Image
                src="/suggestions/bag.jpeg"
                alt="Bag example"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, 50vw"
              />
            </div>
          </div>

          {/* Card 4: 3 cols x 1 row, image right at 33% width */}
          <div
            className="col-span-3 row-span-1 bg-muted rounded-2xl p-4 flex items-stretch shadow-xs animate-fall"
            style={{ animationDelay: '1400ms' }}
          >
            <div className="flex-1 flex items-center">
              <h3 className="text-sm sm:text-base font-medium">Latest store additions</h3>
            </div>
            <div className="ml-3 h-full w-1/3 overflow-hidden rounded-lg relative">
              <Image
                src="/suggestions/zara.jpeg"
                alt="Zara example"
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, 50vw"
              />
            </div>
          </div>
        </div>

        {/* Mobile/MD: 5 cols x 2 rows (no large 3x2 card), visible below lg */}
        <div className="grid grid-cols-5 grid-rows-2 gap-3 sm:gap-4 h-[200px] sm:h-[220px] lg:hidden">
          {/* Card 3: 3 cols x 1 row, image right at 33% width */}
          <div
            className="col-span-3 row-span-1 bg-muted rounded-2xl p-4 flex items-stretch shadow-xs animate-fall"
            style={{ animationDelay: '950ms' }}
          >
            <div className="flex-1 flex items-center">
              <h3 className="text-sm sm:text-base font-medium">Help me find a bag like this</h3>
            </div>
            <div className="ml-3 h-full w-1/3 overflow-hidden rounded-lg relative">
              <Image
                src="/suggestions/bag.jpeg"
                alt="Custom mini figure example"
                fill
                className="object-contain"
                sizes="(max-width: 1023px) 40vw, 50vw"
              />
            </div>
          </div>

          {/* Card 2: 2 cols x 2 rows, title above, image 80% height */}
          <div
            className="col-span-2 row-span-2 bg-muted rounded-2xl p-4 flex flex-col shadow-xs animate-fall"
            style={{ animationDelay: '450ms' }}
          >
            <h3 className="text-sm sm:text-base font-medium">How would this fit on me?</h3>
            <div className="mt-3 h-[80%] w-full overflow-hidden rounded-lg relative">
              <Image
                src="/suggestions/outfit-change.jpeg"
                alt="Professional headshot example"
                fill
                className="object-cover"
                sizes="(max-width: 900px) 60vw, 50vw"
              />
            </div>
          </div>

          {/* Card 4: 3 cols x 1 row, image right at 33% width */}
          <div
            className="col-span-3 row-span-1 bg-muted rounded-2xl p-4 flex items-stretch shadow-xs animate-fall"
            style={{ animationDelay: '600ms' }}
          >
            <div className="flex-1 flex items-center">
              <h3 className="text-sm sm:text-base font-medium">Any new arrivals?</h3>
            </div>
            <div className="ml-3 h-full w-1/3 overflow-hidden rounded-lg relative">
              <Image
                src="/suggestions/zara.jpeg"
                alt="90s pixie cut example"
                fill
                className="object-cover"
                sizes="(max-width: 1023px) 40vw, 50vw"
              />
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes fall-in {
          0% {
            opacity: 0;
            transform: translateY(-16px);
          }
          70% {
            opacity: 1;
            transform: translateY(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes title-in {
          0% {
            opacity: 0;
            transform: translateY(-24px) scale(0.98);
          }
          60% {
            opacity: 1;
            transform: translateY(6px) scale(1.005);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fall {
          animation: fall-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: transform, opacity;
        }

        .animate-title {
          animation: title-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: transform, opacity;
        }
      `}</style>
    </>
  )
}

export default Suggested