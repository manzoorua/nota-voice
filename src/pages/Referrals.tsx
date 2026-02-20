import React from 'react';
import { ReferralDashboard } from '@/components/referral/ReferralDashboard';
import Header from '@/components/layout/Header';

const Referrals: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ReferralDashboard />
      </main>
    </div>
  );
};

export default Referrals;