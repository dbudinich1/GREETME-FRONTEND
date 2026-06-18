// src/config/plans.js — Centralized plan definitions (single source of truth)
// Both Pricing.jsx and Checkout.jsx import from here.

export const personalPlans = {
  founders: [
    {
      id: 'founders-close-circle',
      name: 'Close Circle™',
      price: 9.99,
      period: 'year',
      priceId: 'price_1T4bbGCf7KAA6aLaeFPOGJYq',
      purchaseType: 'subscription',
      planTier: 'close_circle',
      billingPeriod: 'yearly',
      description: 'For the people who matter most',
      footer: 'Most popular for close friends and family',
      featureGroups: [
        { section: 'Membership', features: [
          'Up to 5 recipients',
          '1 Greet-Me included each month',
          '1 Anytime Greet-Me included',
          'Greet One, Give One™ included'
        ] }
      ]
    },
    {
      id: 'founders-social-butterfly',
      name: 'Social Butterfly™',
      price: 19.99,
      period: 'year',
      priceId: 'price_1T4cCOCf7KAA6aLa8Y8Gejj8',
      purchaseType: 'subscription',
      planTier: 'social_butterfly',
      billingPeriod: 'yearly',
      description: 'For people who celebrate everyone',
      footer: 'Perfect for birthdays, holidays, and milestones',
      featureGroups: [
        { section: 'Membership', features: [
          'Up to 15 recipients',
          '3 Greet-Mes included each month',
          '3 Anytime Greet-Mes included',
          'Bank up to 3 unused Greet-Mes',
          'Greet One, Give One™ included'
        ] }
      ]
    },
    {
      id: 'founders-unlimited',
      name: 'Legend™',
      price: 39.99,
      period: 'year',
      priceId: 'price_1T4cCPCf7KAA6aLaNQLBvfkM',
      purchaseType: 'subscription',
      planTier: 'unforgettable',
      billingPeriod: 'yearly',
      description: 'Your complete relationship-building membership',
      footer: 'Never miss an important moment',
      featureGroups: [
        { section: 'Membership', features: [
          'Unlimited recipients',
          '5 Greet-Mes included each month',
          '5 Anytime Greet-Mes included',
          'Bank up to 5 unused Greet-Mes',
          'Greet One, Give One™ included'
        ] }
      ],
      highlight: true
    }
  ],
  standard: [
    {
      id: 'standard-close-circle',
      name: 'Close Circle™',
      price: 19.99,
      period: 'year',
      priceId: 'price_1T4cCPCf7KAA6aLaONpc1Qk9',
      purchaseType: 'subscription',
      planTier: 'close_circle',
      billingPeriod: 'yearly',
      description: 'For the people who matter most',
      footer: 'Most popular for close friends and family',
      featureGroups: [
        { section: 'Membership', features: [
          'Up to 5 recipients',
          '1 Greet-Me included each month',
          '1 Anytime Greet-Me included',
          'Greet One, Give One™ included'
        ] }
      ]
    },
    {
      id: 'standard-social-butterfly',
      name: 'Social Butterfly™',
      price: 39.99,
      period: 'year',
      priceId: 'price_1T4cCQCf7KAA6aLaYApDAdSy',
      purchaseType: 'subscription',
      planTier: 'social_butterfly',
      billingPeriod: 'yearly',
      description: 'For people who celebrate everyone',
      footer: 'Perfect for birthdays, holidays, and milestones',
      featureGroups: [
        { section: 'Membership', features: [
          'Up to 15 recipients',
          '3 Greet-Mes included each month',
          '3 Anytime Greet-Mes included',
          'Bank up to 3 unused Greet-Mes',
          'Greet One, Give One™ included'
        ] }
      ]
    },
    {
      id: 'standard-unlimited',
      name: 'Legend™',
      price: 79.99,
      period: 'year',
      priceId: 'price_1T4cCRCf7KAA6aLaAuJoxNR0',
      purchaseType: 'subscription',
      planTier: 'unforgettable',
      billingPeriod: 'yearly',
      description: 'Your complete relationship-building membership',
      footer: 'Never miss an important moment',
      featureGroups: [
        { section: 'Membership', features: [
          'Unlimited recipients',
          '5 Greet-Mes included each month',
          '5 Anytime Greet-Mes included',
          'Bank up to 5 unused Greet-Mes',
          'Greet One, Give One™ included'
        ] }
      ],
      highlight: true
    }
  ]
};

export const businessPlans = {
  founders: [
    {
      id: 'business-small-founders',
      name: 'Essentials',
      price: 99,
      period: 'year',
      priceId: 'price_1T4cCSCf7KAA6aLa5zZge8rk',
      purchaseType: 'subscription',
      planTier: 'small_business',
      billingPeriod: 'yearly',
      platformFee: 19.99,
      description: 'For businesses getting started with appreciation.',
      featureGroups: [
        { section: 'Membership', features: [
          '10 recipients / 5 monthly Greet-Mes',
          'Appreciation Management System',
          'Additional Greet-Mes available',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ]
    },
    {
      id: 'business-medium-founders',
      name: 'Professional',
      price: 199,
      period: 'year',
      priceId: 'price_1T4cCTCf7KAA6aLa1V9OaKaW',
      purchaseType: 'subscription',
      planTier: 'medium_business',
      billingPeriod: 'yearly',
      platformFee: 19.99,
      description: 'For teams building a culture of appreciation.',
      featureGroups: [
        { section: 'Membership', features: [
          '25 recipients / 10 monthly Greet-Mes',
          'Appreciation Management System',
          'Greet-Me Customization™',
          'Branded Gift Options',
          'Additional Greet-Mes available',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ],
      highlight: true
    },
    {
      id: 'business-scale-founders',
      name: 'Scale',
      price: 499,
      period: 'year',
      priceId: 'price_1TjXS2Cf7KAA6aLakI9L3Vmn',
      purchaseType: 'subscription',
      planTier: 'business_scale',
      billingPeriod: 'yearly',
      platformFee: 19.99,
      description: 'For appreciation programs at scale.',
      featureGroups: [
        { section: 'Membership', features: [
          '100 employee & client recipients',
          'Appreciation Management System',
          'Greet-Me Customization™',
          'Branded Gift Options',
          'Flat-Fee Appreciation™ — $2.99 per Greet-Me sent',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Contact Sales',
      period: '',
      ctaText: 'Talk With Our Team',
      description: 'For organizations with 100+ recipients.',
      featureGroups: [
        { section: 'Membership', features: [
          'Custom appreciation programs',
          'Appreciation Management System',
          'Greet-Me Customization™',
          'Branded Gift Options',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ]
    }
  ],
  standard: [
    {
      id: 'business-small-standard',
      name: 'Essentials',
      price: 199,
      period: 'year',
      priceId: 'price_1T4cCUCf7KAA6aLaIQPcsSnW',
      purchaseType: 'subscription',
      planTier: 'small_business',
      billingPeriod: 'yearly',
      platformFee: 19.99,
      description: 'For businesses getting started with appreciation.',
      featureGroups: [
        { section: 'Membership', features: [
          '10 recipients / 5 monthly Greet-Mes',
          'Appreciation Management System',
          'Additional Greet-Mes available',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ]
    },
    {
      id: 'business-medium-standard',
      name: 'Professional',
      price: 299,
      period: 'year',
      priceId: 'price_1T4cCVCf7KAA6aLakkWdH7ZW',
      purchaseType: 'subscription',
      planTier: 'medium_business',
      billingPeriod: 'yearly',
      platformFee: 19.99,
      description: 'For teams building a culture of appreciation.',
      featureGroups: [
        { section: 'Membership', features: [
          '25 recipients / 10 monthly Greet-Mes',
          'Appreciation Management System',
          'Greet-Me Customization™',
          'Branded Gift Options',
          'Additional Greet-Mes available',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ],
      highlight: true
    },
    {
      id: 'business-scale-standard',
      name: 'Scale',
      price: 699,
      period: 'year',
      priceId: 'price_1TjXS2Cf7KAA6aLayHdvdfTj',
      purchaseType: 'subscription',
      planTier: 'business_scale',
      billingPeriod: 'yearly',
      platformFee: 19.99,
      description: 'For appreciation programs at scale.',
      featureGroups: [
        { section: 'Membership', features: [
          '100 employee & client recipients',
          'Appreciation Management System',
          'Greet-Me Customization™',
          'Branded Gift Options',
          'Flat-Fee Appreciation™ — $2.99 per Greet-Me sent',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Contact Sales',
      period: '',
      ctaText: 'Talk With Our Team',
      description: 'For organizations with 100+ recipients.',
      featureGroups: [
        { section: 'Membership', features: [
          'Custom appreciation programs',
          'Appreciation Management System',
          'Greet-Me Customization™',
          'Branded Gift Options',
          'Greet-Me Gifts™ & QR Cash™',
          'Greet-Me Hero™ Initiative Eligible'
        ] }
      ]
    }
  ]
};

/**
 * Build a lookup map of planId → current plan data (priceId, purchaseType, planTier, billingPeriod).
 * Used by Checkout.jsx to validate/refresh stale cart items.
 */
export function getCurrentPriceMap() {
  const allPlans = [
    ...personalPlans.founders,
    ...personalPlans.standard,
    ...businessPlans.founders,
    ...businessPlans.standard,
  ];
  const map = {};
  for (const plan of allPlans) {
    if (plan.priceId) {
      map[plan.id] = {
        priceId: plan.priceId,
        purchaseType: plan.purchaseType,
        planTier: plan.planTier,
        billingPeriod: plan.billingPeriod,
      };
    }
  }
  return map;
}
