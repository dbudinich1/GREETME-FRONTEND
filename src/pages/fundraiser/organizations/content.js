// src/pages/fundraiser/organizations/content.js
// Shared copy for the Fundraisers page (founder handoff 2026-10-28, "Greet-Me for Organizations"): verbatim from the
// supplied components/content.js. Earnings language stays tied to qualifying subscriptions through the organization's
// fundraising links and its agreement; the uses listed are examples of possible uses of organizational earnings.
export const POSSIBILITY_FEATURES = [
  {
    key: 'open-doors',
    label: 'Open doors',
    line: 'Scholarships, educational opportunities and student assistance.',
    image: 'student',
  },
  {
    key: 'in-the-game',
    label: 'Keep everyone in the game',
    line: 'Uniforms, equipment, tournament fees and team travel.',
    image: 'team',
  },
];

export const POSSIBILITY_ROWS = [
  { key: 'milestones', label: 'Make milestone memories', line: 'Proms, class trips, graduations and reunions.' },
  { key: 'creativity', label: 'Keep creativity thriving', line: 'Instruments, theater productions, costumes and art supplies.' },
  { key: 'together', label: 'Bring people together', line: 'Alumni events, school celebrations and neighborhood programs.' },
  { key: 'when-it-matters', label: 'Be there when it matters', line: 'Meals, emergency assistance and outreach.' },
  { key: 'future', label: 'Build for the future', line: 'Facilities, accessibility improvements and new programs.' },
];

export const GROWTH_NODES = [
  { step: '01', title: 'Your organization', line: 'The people who already show up for you: members, families, alumni, neighbors.' },
  { step: '02', title: 'Meaningful celebrations', line: 'They send Greet-Me greetings for the birthdays, holidays and milestones in their own lives.' },
  { step: '03', title: 'Qualifying subscriptions', line: 'Subscriptions they choose through your organization’s fundraising links.' },
  { step: '04', title: 'Support for your mission', line: 'Earnings under your organization’s agreement go toward the work you care about.' },
];

export const SUPPORTER_PILLARS = [
  { icon: 'mic', title: 'Their voice', line: 'A message recorded in the voice the people they love would recognize anywhere.' },
  { icon: 'images', title: 'Their photos and memories', line: 'The pictures and stories only they could share, brought back for the moment that matters.' },
  { icon: 'calendar', title: 'All through the year', line: 'Birthdays, holidays, milestones and ordinary days. Greet-Me is built for more than one occasion.' },
];

export const STEPS = [
  { number: '01', title: 'Let’s build your fundraiser.', line: 'Connect with Greet-Me to establish your organization’s fundraising arrangement.' },
  { number: '02', title: 'Invite your organization.', line: 'Share your organization’s links and QR codes with members, families, friends and supporters.' },
  { number: '03', title: 'Celebrate, and support your mission.', line: 'Supporters enjoy Greet-Me while qualifying subscription payments generate earnings under your organization’s agreement.' },
];

export const ORG_TYPES = [
  {
    key: 'schools', label: 'Schools',
    line: 'Classrooms, clubs and campuses where a little extra changes what students can do.',
    uses: ['Scholarships and student assistance', 'Class trips and milestone celebrations', 'Arts, music and athletics programs'],
  },
  {
    key: 'teams', label: 'Sports teams',
    line: 'From the first practice to the season you will talk about for years.',
    uses: ['Uniforms, equipment and tournament fees', 'Team travel and overnight trips', 'Keeping participation within reach for every family'],
  },
  {
    key: 'boosters', label: 'Booster clubs',
    line: 'The parents and volunteers who quietly hold a program together.',
    uses: ['Senior night and end-of-season banquets', 'Facility and field improvements', 'Support that grows with each incoming class'],
  },
  {
    key: 'alumni', label: 'Alumni associations',
    line: 'An organization that already knows how to come back for one another.',
    uses: ['Reunions and homecoming events', 'Alumni scholarships and giving circles', 'Year-round connection between classes'],
  },
  {
    key: 'arts', label: 'Arts programs',
    line: 'Studios, stages and ensembles where young people find their voice.',
    uses: ['Instruments, costumes and art supplies', 'Productions, exhibitions and travel', 'Access to lessons and creative opportunities'],
  },
  {
    key: 'community', label: 'Community groups',
    line: 'Neighborhoods, congregations and local networks built on everyday generosity.',
    uses: ['Neighborhood celebrations and gatherings', 'Meals, outreach and emergency assistance', 'Programs that welcome new families in'],
  },
  {
    key: 'nonprofits', label: 'Nonprofits',
    line: 'Small teams carrying work that matters more than the budget allows.',
    uses: ['Programs and services for the people you serve', 'Staff training and volunteer support', 'A recurring source that steadies the year'],
  },
];
