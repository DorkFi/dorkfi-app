import React from 'react';

interface AnalyticsSectionProps {
  title: string;
  children: React.ReactNode;
}

const AnalyticsSection = ({ title, children }: AnalyticsSectionProps) => {
  return (
    <section className="space-y-6">
      <div className="relative">
        <h2 className="dorkfi-h2 text-center">
          {title}
        </h2>
        <div className="mx-auto mt-2 h-1 w-24 bg-gradient-to-r from-whale-gold to-ocean-teal rounded-full" />
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </section>
  );
};

export default AnalyticsSection;

