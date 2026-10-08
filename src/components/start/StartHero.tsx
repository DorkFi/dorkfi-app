import { H1, Body } from "@/components/ui/Typography";
import DorkFiCard from "@/components/ui/DorkFiCard";

const StartHero = () => {
  return (
    <DorkFiCard
      hoverable
      className="relative overflow-hidden p-6 text-center md:p-8"
    >
      <div
        className="absolute left-10 top-6 z-0 hidden opacity-80 pointer-events-none animate-bubble-float dark:hidden md:block"
        style={{ animationDelay: "0s" }}
      >
        <img
          src="/lovable-uploads/bird_thinner.png"
          alt=""
          className="h-8 w-8 -rotate-6 select-none md:h-10 md:w-10"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div
        className="absolute right-12 top-14 z-0 hidden opacity-70 pointer-events-none animate-bubble-float dark:hidden md:block"
        style={{ animationDelay: "0.5s" }}
      >
        <img
          src="/lovable-uploads/bird_thinner.png"
          alt=""
          className="h-7 w-7 rotate-3 select-none md:h-9 md:w-9"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div
        className="absolute bottom-10 left-14 z-0 hidden opacity-60 pointer-events-none animate-bubble-float dark:hidden md:block"
        style={{ animationDelay: "1s" }}
      >
        <img
          src="/lovable-uploads/bird_thinner.png"
          alt=""
          className="h-7 w-7 -rotate-2 select-none md:h-9 md:w-9"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div
        className="absolute left-8 top-4 z-0 hidden opacity-80 pointer-events-none animate-bubble-float dark:md:block"
        style={{ animationDelay: "0s" }}
      >
        <img
          src="/lovable-uploads/DorkFi_gold_fish.png"
          alt=""
          className="h-[2.844844rem] w-[2.844844rem] select-none md:h-[3.793125rem] md:w-[3.793125rem]"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div
        className="absolute right-12 top-12 z-0 hidden opacity-80 pointer-events-none animate-bubble-float dark:md:block"
        style={{ animationDelay: "0.5s" }}
      >
        <img
          src="/lovable-uploads/DorkFi_gold_fish.png"
          alt=""
          className="h-[1.896563rem] w-[1.896563rem] -scale-x-100 select-none md:h-[2.844844rem] md:w-[2.844844rem]"
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className="relative z-10">
        <H1 className="m-0 text-4xl md:text-5xl">
          <span className="hero-header">Must-Do</span>
        </H1>
        <Body className="mx-auto max-w-2xl text-sm sm:text-base md:text-lg lg:text-xl">
          The highest-signal ways to put capital to work on DorkFi and Tinyman.
          Yields update with the markets.
        </Body>
      </div>
    </DorkFiCard>
  );
};

export default StartHero;
