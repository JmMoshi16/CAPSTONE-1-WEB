import { Leaf } from 'lucide-react';

/** Full-screen wait (auth check): the brand mark breathing, with one line saying what is happening. */
export default function BrandSplash({ label }: { label: string }) {
  return (
    <div role="status" className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          <span className="absolute inset-0 rounded-full bg-green/15 animate-breathe" aria-hidden />
          <span className="absolute inset-2 rounded-full bg-forest ring-1 ring-green/30 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-green" aria-hidden />
          </span>
        </div>
        <p className="text-white/50 text-sm">{label}</p>
      </div>
    </div>
  );
}
