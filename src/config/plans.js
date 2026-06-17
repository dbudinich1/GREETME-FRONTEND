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
          'Bank up to 5 unused Greet-Mes',
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
          'Bank up to 10 unused Greet-Mes',
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
          'Bank up to 5 unused Greet-Mes',
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
          'Bank up to 10 unused Greet-Mes',
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
      name: 'Small Business',
      price: 99,
      period: 'year',
      priceId: 'price_1T4cCSCf7KAA6aLa5zZge8rk',
      purchaseType: 'subscription',
      planTier: 'small_business',
      billingPeriod: 'yearly',
      description: 'Up to 25 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 25 employee recipients', 'American Gift Place', 'Team dashboard'] },
        { section: 'Branding', features: ['Branding + templates', 'Bulk greeting sending'] },
        { section: 'Support & Reporting', features: ['Email support', 'Hero impact reporting (coming soon)'] }
      ]
    },
    {
      id: 'business-medium-founders',
      name: 'Medium Business',
      price: 149,
      period: 'year',
      priceId: 'price_1T4cCTCf7KAA6aLa1V9OaKaW',
      purchaseType: 'subscription',
      planTier: 'medium_business',
      billingPeriod: 'yearly',
      description: 'Up to 50 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 50 employee recipients', 'American Gift Place', 'Team collaboration tools'] },
        { section: 'Branding', features: ['Advanced branding options', 'Analytics & reporting'] },
        { section: 'Support & Reporting', features: ['Priority support', 'Hero impact reporting (coming soon)'] }
      ],
      highlight: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Contact Sales',
      period: '',
      description: 'Custom enterprise solution',
      featureGroups: [
        { section: 'Core', features: ['Unlimited employees', 'American Gift Place', 'API access'] },
        { section: 'Customization', features: ['White-label platform option', 'Custom integrations', 'Custom SLA agreements'] },
        { section: 'Support & Reporting', features: ['Dedicated account manager', 'Hero impact reporting (coming soon)'] }
      ]
    }
  ],
  standard: [
    {
      id: 'business-small-standard',
      name: 'Small Business',
      price: 149,
      period: 'year',
      priceId: 'price_1T4cCUCf7KAA6aLaIQPcsSnW',
      purchaseType: 'subscription',
      planTier: 'small_business',
      billingPeriod: 'yearly',
      description: 'Up to 25 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 25 employee recipients', 'American Gift Place', 'Team dashboard'] },
        { section: 'Branding', features: ['Branding + templates', 'Bulk greeting sending'] },
        { section: 'Support & Reporting', features: ['Email support', 'Hero impact reporting (coming soon)'] }
      ]
    },
    {
      id: 'business-medium-standard',
      name: 'Medium Business',
      price: 299,
      period: 'year',
      priceId: 'price_1T4cCVCf7KAA6aLakkWdH7ZW',
      purchaseType: 'subscription',
      planTier: 'medium_business',
      billingPeriod: 'yearly',
      description: 'Up to 50 Employees',
      featureGroups: [
        { section: 'Core', features: ['Up to 50 employee recipients', 'American Gift Place', 'Team collaboration tools'] },
        { section: 'Branding', features: ['Advanced branding options', 'Analytics & reporting'] },
        { section: 'Support & Reporting', features: ['Priority support', 'Hero impact reporting (coming soon)'] }
      ],
      highlight: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Contact Sales',
      period: '',
      description: 'Custom enterprise solution',
      featureGroups: [
        { section: 'Core', features: ['Unlimited employees', 'American Gift Place', 'API access'] },
        { section: 'Customization', features: ['White-label platform option', 'Custom integrations', 'Custom SLA agreements'] },
        { section: 'Support & Reporting', features: ['Dedicated account manager', 'Hero impact reporting (coming soon)'] }
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
